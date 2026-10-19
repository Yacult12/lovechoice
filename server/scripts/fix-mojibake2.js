/**
 * 修复双重编码 —— 用二进制方式处理
 *   node scripts/fix-mojibake2.js love          # 演练
 *   node scripts/fix-mojibake2.js love --apply  # 执行
 *
 * 为什么第一版修不好
 *   CONVERT(col USING utf8mb4) 在 utf8mb4 连接下会「转完又被重新编码回去」，
 *   实测转一次和转两次结果完全一样 —— 等于没转。
 *   根因是 CONVERT 走的是字符集转换函数，
 *   而列里存的已经是「被当 latin1 解读过的 UTF-8 字节」，
 *   再用 utf8mb4 解读一次就还原了，但写回时又按连接字符集编码，形成死循环。
 *
 * 正确做法
 *   1. 用 CONVERT(col USING binary) 取出原始字节（不做任何字符解读）
 *   2. 在 Node 里 Buffer.from(bytes, 'latin1').toString('utf8') 逆转
 *   3. 用 SET col = _utf8mb4 0x<hex> 写回，绕过字符集转换
 */
const mysql = require('mysql2/promise');

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

/**
 * 判断一段字符串是否是双重编码。
 * 正常中文的 UTF-8 首字节 >= E0；
 * 双重编码后每个原字节变成 2 个字节，首字节落在 C2~C4。
 */
function looksMojibake(buf) {
  if (!buf.length) return false;
  const first = buf[0];
  return first >= 0xc2 && first <= 0xc4;
}

/** 逆转双重编码：把被当 latin1 解读过的字节还原成 UTF-8 */
function repair(buf) {
  const s = buf.toString('latin1');
  const fixed = Buffer.from(s, 'utf8');
  // 如果还原后仍含替换字符（U+FFFD），说明不是双重编码，别动它
  if (fixed.includes(0xef) && fixed.toString('utf8').includes('�')) return null;
  return fixed;
}

(async () => {
  const DB = process.argv[2] || 'love';
  const APPLY = process.argv.includes('--apply');
  const HOST = process.env.DB_HOST || '127.0.0.1';
  const PORT = Number(process.env.DB_PORT || 3306);
  const USER = process.env.DB_USER || 'root';
  const PASS = process.env.DB_PASSWORD || '123456';

  const c = await mysql.createConnection({
    host: HOST, port: PORT, user: USER, password: PASS,
    database: DB, charset: 'utf8mb4'
  });

  console.log(`\n=== 修复双重编码 · 二进制方式（${DB} @ ${HOST}${APPLY ? ' · 执行' : ' · 演练'}）===\n`);

  let totalFixed = 0;

  for (const table of TABLES) {
    const cols = await textColumns(c, DB, table);
    if (!cols.length) continue;

    // 用 CONVERT(... USING binary) 取原始字节，绕开字符集解读
    const selectCols = cols.map((col) => `CONVERT(\`${col}\` USING binary) AS \`${col}\``).join(', ');
    const [rows] = await c.query(`SELECT id, ${selectCols} FROM \`${table}\``);

    const updates = [];

    for (const row of rows) {
      const sets = [];
      let touched = false;

      for (const col of cols) {
        const val = row[col];
        if (val == null) continue;

        // mysql2 在 binary 模式下返回的是 Buffer
        const buf = Buffer.isBuffer(val) ? val : Buffer.from(val);
        if (!looksMojibake(buf)) continue;

        const fixed = repair(buf);
        if (!fixed || fixed.equals(buf)) continue;

        sets.push({ col, hex: fixed.toString('hex').toUpperCase() });
        touched = true;
      }

      if (touched) updates.push({ id: row.id, sets });
    }

    if (!updates.length) {
      console.log(`  ✓ ${table.padEnd(14)} 无需修复  (${cols.length} 个文本列)`);
      continue;
    }

    if (!APPLY) {
      console.log(`  ◦ ${table.padEnd(14)} ${updates.length} 行待修复（演练）`);
      totalFixed += updates.length;
      continue;
    }

    // 写回时用 _utf8mb4 0x<hex>，让 MySQL 按 UTF-8 直接落盘
    let done = 0;
    for (const u of updates) {
      const setSql = u.sets.map((s) => `\`${s.col}\` = CONVERT(0x${s.hex} USING utf8mb4)`).join(', ');
      await c.query(`UPDATE \`${table}\` SET ${setSql} WHERE id = ?`, [u.id]);
      done++;
    }

    totalFixed += done;
    console.log(`  ✓ ${table.padEnd(14)} 修复 ${done} 行  (${cols.length} 个文本列)`);
  }

  console.log('');
  if (!APPLY) {
    console.log(`  演练完成，共 ${totalFixed} 行待修复。加 --apply 执行。`);
  } else {
    console.log(`  全部完成，共修复 ${totalFixed} 行\n`);

    console.log('  验证：');
    const [d] = await c.query(
      "SELECT speaker, LEFT(content,30) AS t FROM scene_nodes WHERE node_type='dialogue' LIMIT 3"
    );
    d.forEach((r) => console.log('    ' + r.speaker + '：' + r.t));

    const [ch] = await c.query('SELECT title FROM chapters ORDER BY id LIMIT 3');
    console.log('\n  章节：');
    ch.forEach((r) => console.log('    ' + r.title));

    const [ed] = await c.query('SELECT title FROM endings ORDER BY id');
    console.log('\n  结局：');
    ed.forEach((r) => console.log('    ' + r.title));
  }

  await c.end();
  console.log('');
})();