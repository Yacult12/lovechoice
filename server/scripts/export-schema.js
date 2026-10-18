/**
 * 从真实数据库导出建表 DDL（mysqldump 的轻量替代）
 *   node export-schema.js
 *
 * 为什么需要它：仓库里从来没有 schema.sql，
 * 而 Docker 初始化容器必须有建表语句才能跑起来。
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'sql', 'schema.sql');
const DB = 'love';

(async () => {
  const c = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '123456'
  });

  const [tables] = await c.query(
    `SELECT TABLE_NAME, TABLE_COMMENT, ENGINE, TABLE_COLLATION
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
    [DB]
  );

  const out = [];
  out.push('-- ============================================================');
  out.push('--   数据库结构（由 export-schema.js 从真实库导出）');
  out.push('--   改动表结构后请重新运行该脚本，不要手改这个文件');
  out.push(`--   库名: ${DB}    表数: ${tables.length}`);
  out.push('-- ============================================================');
  out.push('');
  out.push('SET NAMES utf8mb4;');
  out.push('SET FOREIGN_KEY_CHECKS = 0;');
  out.push('');

  for (const t of tables) {
    const [cols] = await c.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
              COLUMN_KEY, EXTRA, COLUMN_COMMENT
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION`,
      [DB, t.TABLE_NAME]
    );

    const [fks] = await c.query(
      `SELECT k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE k
        WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ?
          AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
      [DB, t.TABLE_NAME]
    );

    const [idx] = await c.query(
      `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
         FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [DB, t.TABLE_NAME]
    );

    const primary = cols.filter((x) => x.COLUMN_KEY === 'PRI').map((x) => x.COLUMN_NAME);
    const fkMap = new Map(fks.map((f) => [f.COLUMN_NAME, f]));

    out.push(`-- ${'─'.repeat(60)}`);
    out.push(`-- 表: ${t.TABLE_NAME}${t.TABLE_COMMENT ? '  ' + t.TABLE_COMMENT : ''}`);
    out.push(`-- ${'─'.repeat(60)}`);
    out.push(`CREATE TABLE IF NOT EXISTS \`${t.TABLE_NAME}\` (`);

    const defs = cols.map((col) => {
      let line = '  `' + col.COLUMN_NAME + '` ' + col.COLUMN_TYPE;
      if (col.IS_NULLABLE === 'NO') line += ' NOT NULL';

      const raw = col.COLUMN_DEFAULT;
      const isTimestamp =
        typeof raw === 'string' &&
        /^(now\(\)|current_timestamp(\(\d*\))?)$/i.test(raw.trim());

      if (isTimestamp) {
        // ⚠️ 这里绝对不能加引号。
        // information_schema.COLUMNS.COLUMN_DEFAULT 对时间默认值返回的是
        // 字符串 'CURRENT_TIMESTAMP'，直接照抄成 DEFAULT 'CURRENT_TIMESTAMP'
        // 会被 MySQL 当成字符串常量，导入时报
        //   ERROR 1067 (42000): Invalid default value for 'created_at'
        line += ' DEFAULT CURRENT_TIMESTAMP';
      } else if (raw !== null && raw !== undefined) {
        const d = String(raw);
        line += ' DEFAULT ' + (d === 'NULL' || /^-?\d+(\.\d+)?$/.test(d) ? d : `'${d}'`);
      } else if (raw === null && col.IS_NULLABLE === 'YES' && col.EXTRA !== 'auto_increment') {
        line += ' DEFAULT NULL';
      }

      if (col.EXTRA && col.EXTRA.includes('auto_increment')) line += ' AUTO_INCREMENT';
      if (col.COLUMN_COMMENT) line += ` COMMENT '${col.COLUMN_COMMENT.replace(/'/g, "''")}'`;
      return line;
    });

    if (primary.length) {
      defs.push('  PRIMARY KEY (' + primary.map((p) => '`' + p + '`').join(', ') + ')');
    }

    // 索引。⚠️ 必须按 NON_UNIQUE 区分 UNIQUE 和普通 KEY ——
    // 早先这里一律输出 UNIQUE KEY，结果把普通索引也变成了唯一约束。
    // 典型后果：scene_nodes 的 idx_chapter(chapter_id) 变成单列唯一，
    // 于是同一章下的第二个节点就报
    //   Duplicate entry '1' for key 'scene_nodes.idx_chapter'
    // 而节点本来就是「一章多个」，只有 (chapter_id, node_key) 才唯一。
    const seenIdx = new Map();
    for (const row of idx) {
      if (row.INDEX_NAME === 'PRIMARY') continue;
      if (!seenIdx.has(row.INDEX_NAME)) {
        seenIdx.set(row.INDEX_NAME, {
          unique: Number(row.NON_UNIQUE) === 0,
          cols: []
        });
      }
      seenIdx.get(row.INDEX_NAME).cols.push(row.COLUMN_NAME);
    }
    for (const [name, info] of seenIdx) {
      const colsIn = info.cols.map((cn) => '`' + cn + '`').join(', ');
      defs.push(
        info.unique
          ? `  UNIQUE KEY \`${name}\` (${colsIn})`
          : `  KEY \`${name}\` (${colsIn})`      // 普通索引，不是唯一约束
      );
    }

    for (const fk of fks) {
      defs.push(
        `  KEY \`fk_${t.TABLE_NAME}_${fk.COLUMN_NAME}\` (\`${fk.COLUMN_NAME}\`)` +
        ` /* → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} */`
      );
    }

    out.push(defs.join(',\n'));
    out.push(') ENGINE=' + (t.ENGINE || 'InnoDB') +
      ' DEFAULT CHARSET=utf8mb4 COLLATE=' + (t.TABLE_COLLATION || 'utf8mb4_unicode_ci') + ';');
    out.push('');

    console.log('  ✓ ' + t.TABLE_NAME.padEnd(16) + cols.length + ' 列' +
      (fks.length ? '  ' + fks.length + ' 外键' : ''));
  }

  out.push('SET FOREIGN_KEY_CHECKS = 1;');
  out.push('');

  fs.writeFileSync(OUT, out.join('\n'), 'utf8');
  console.log('');
  console.log('已导出到 sql/schema.sql  (' + out.join('\n').length + ' 字节)');
  console.log('⚠️  注意：只含结构，不含数据。初始剧情请另行导入。');

  await c.end();
})();