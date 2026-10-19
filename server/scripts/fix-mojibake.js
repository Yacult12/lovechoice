/**
 * 修复 MySQL 双重编码（mojibake）
 *   node scripts/fix-mojibake.js love            # 演练
 *   node scripts/fix-mojibake.js love --apply    # 实际执行
 *
 * 问题现象
 *   游戏里所有中文显示为「æ—ç™½ ä¹æœˆ…」
 *
 * 成因
 *   MySQL 官方镜像的客户端默认字符集是 latin1。
 *   导入 UTF-8 的 .sql 时，每个字节被当成 latin1 字符解读，
 *   再按 utf8mb4 存回去 ——「他」（E4 B8 96）被拆成 3 个 latin1
 *   字符，每个又编码成 2~3 字节，最终变成 C3A6 E28094 C2A7 …
 *   典型的双重编码（double encoding）。
 *
 * 修复
 *   CONVERT(列 USING utf8mb4) 正是逆转这个过程。
 *   正确中文的 UTF-8 首字节 >= E0，双重编码后落在 C2~C4，
 *   用这个特征精准筛选，不会误伤正常数据。
 */
const mysql = require('mysql2/promise');

// 只列表名，文本列由 information_schema 动态探测。
// 硬编码列名容易踩坑 —— 比如 choices 表并没有 label 列。
const TABLES = ['routes', 'chapters', 'characters', 'scene_nodes', 'choices', 'endings'];

const TEXT_TYPES = ['char', 'varchar', 'text', 'tinytext', 'mediumtext', 'longtext', 'enum'];

async function textColumns(conn, db, table) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        AND DATA_TYPE IN (${TEXT_TYPES.map(() => '?').join(',')})`,
    [db, table, ...TEXT_TYPES]
  );
  return rows.map((r) => r.COLUMN_NAME);
}

(async () => {
  const DB = process.argv[2] || 'love';
  const APPLY = process.argv.includes('--apply');

  // 主机从环境变量读：容器里DB_HOST=mysql，宿主机上跑才是 127.0.0.1。
  // 写死 127.0.0.1 会在容器内连不上（ECONNREFUSED）。
  const HOST = process.env.DB_HOST || '127.0.0.1';
  const PORT = Number(process.env.DB_PORT || 3306);
  const USER = process.env.DB_USER || 'root';
  const PASS = process.env.DB_PASSWORD || '123456';

  const c = await mysql.createConnection({
    host: HOST, port: PORT, user: USER, password: PASS,
    database: DB, charset: 'utf8mb4'
  });

  console.log(`\n=== 修复双重编码（${DB} @ ${HOST}:${PORT}${APPLY ? ' · 实际执行' : ' · 演练模式'}）===\n`);

  // ---------- 先确认确实是双重编码 ----------
  const [sample] = await c.query(
    "SELECT HEX(LEFT(speaker,1)) AS hx FROM scene_nodes WHERE node_type='dialogue' LIMIT 1"
  );
  const hx = sample[0] ? String(sample[0].hx).toLowerCase() : '';
  const isMojibake = /^c[234]/.test(hx);
  console.log('  speaker 首字符十六进制: ' + hx.slice(0, 12));
  console.log('  正常中文首字节形如: e4 / e5 / e6 …');
  console.log('  判定: ' + (isMojibake ? '疑似双重编码' : '看起来正常'));

  // ---------- 逐表修复 ----------
  let totalRows = 0;
  for (const table of TABLES) {
    const cols = await textColumns(c, DB, table);
    if (!cols.length) {
      console.log(`  — ${table.padEnd(14)} 跳过（无文本列）`);
      continue;
    }

    const setList = cols
      .map((col) => `\`${col}\` = CONVERT(\`${col}\` USING utf8mb4)`)
      .join(', ');

    const whereCond = cols
      .map((col) => `HEX(LEFT(\`${col}\`,1)) BETWEEN 'C2' AND 'C4'`)
      .join(' OR ');

    const [before] = await c.query(
      `SELECT COUNT(*) AS n FROM \`${table}\` WHERE ${whereCond}`
    );
    const bad = Number(before[0].n);

    if (bad === 0) {
      console.log(`  ✓ ${table.padEnd(14)} 无需修复  (${cols.length} 个文本列)`);
      continue;
    }

    if (!APPLY) {
      console.log(`  ◦ ${table.padEnd(14)} ${bad} 行待修复（演练，未执行）`);
      totalRows += bad;
      continue;
    }

    await c.query(`UPDATE \`${table}\` SET ${setList} WHERE ${whereCond}`);
    totalRows += bad;
    console.log(`  ✓ ${table.padEnd(14)} 修复 ${bad} 行  (${cols.length} 个文本列)`);
  }

  if (!APPLY) {
    console.log(`\n  演练完成，共 ${totalRows} 行待修复。加 --apply 实际执行。`);
  } else {
    console.log(`\n  全部完成，共修复 ${totalRows} 行`);

    console.log('\n  修复后抽样：');
    const [rows] = await c.query(
      "SELECT speaker, LEFT(content,28) AS txt FROM scene_nodes WHERE node_type='dialogue' LIMIT 3"
    );
    rows.forEach((r) => console.log('    ' + r.speaker + '：' + r.txt));

    const [rt] = await c.query('SELECT title FROM routes ORDER BY id');
    console.log('\n  故事线：');
    rt.forEach((r) => console.log('    ' + r.title));

    const [ed] = await c.query('SELECT title FROM endings ORDER BY id');
    console.log('\n  结局：');
    ed.forEach((r) => console.log('    ' + r.title));
  }

  await c.end();
  console.log('');
})();