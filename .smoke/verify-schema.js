/**
 * 验证 schema.sql 能被 MySQL 干净导入
 *   node verify-schema.js
 *
 * 起因：CI 第三次失败——
 *   ERROR 1067 (42000) at line 41: Invalid default value for 'created_at'
 * 原因是导出的 DDL 把 CURRENT_TIMESTAMP 加了引号，
 * MySQL 当成字符串常量直接拒绝。
 *
 * 光靠肉眼看不出这类问题，必须真的建一遍库。
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = path.join(ROOT, 'server', 'sql', 'schema.sql');
const TEST_DB = 'love_schema_probe';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

(async () => {
  console.log('\n=== schema.sql 导入验证 ===\n');
  console.log('  目标库: ' + TEST_DB + '（验证后会删除，不碰你的 love 库）\n');

  // ---------- 1. 静态检查：先把明显的 SQL 错误挑出来 ----------
  console.log('[1] 静态检查');
  const ddl = fs.readFileSync(SCHEMA, 'utf8');

  check('无 BOM（Linux 上会解析失败）',
    !(ddl.charCodeAt(0) === 0xfeff));

  // 引号包住的时间默认值是这次的元凶，单独挑出来
  const badDefaults = [...ddl.matchAll(/DEFAULT\s+['"](now\(\)|CURRENT_TIMESTAMP|current_timestamp\(\))['"]/gi)];
  check('时间默认值未被引号包裹',
    badDefaults.length === 0,
    '仍有 ' + badDefaults.length + ' 处: ' + badDefaults.slice(0, 3).map((m) => m[0]).join(', '));

  check('无反斜杠转义残留',
    !/DEFAULT\s+'\\\\/.test(ddl), '导出时字符串转义处理有问题');

  const createCount = (ddl.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
  check('含 10 张表建表语句', createCount === 10, '实际 ' + createCount);
  check('全部用 IF NOT EXISTS（可重复导入）',
    !/CREATE TABLE (?!IF NOT EXISTS)/.test(ddl));
  check('末尾恢复外键检查', /FOREIGN_KEY_CHECKS\s*=\s*1/.test(ddl));

  // 括号配平
  const open = (ddl.match(/\(/g) || []).length;
  const close = (ddl.match(/\)/g) || []).length;
  check('括号配平', open === close, `左 ${open} / 右 ${close}`);

  // ---------- 2. 真导入一次 ----------
  console.log('\n[2] 实际导入 MySQL');
  const c = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '123456', multipleStatements: true
  });

  try {
    await c.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await c.query(`CREATE DATABASE \`${TEST_DB}\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await c.query(`USE \`${TEST_DB}\``);

    // 整份 DDL 一次性执行，任何一处语法错都会抛异常
    await c.query(ddl);
    pass++;
    console.log('  ✓ 整份 schema.sql 导入成功（无语法错误）');
  } catch (err) {
    fail++;
    console.log('  ✗ 导入失败: ' + err.message);
    console.log('    sqlState=' + err.sqlState + ' errno=' + err.errno);
  }

  // ---------- 3. 表结构核对 ----------
  try {
    const [tables] = await c.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [TEST_DB]
    );
    check('实际创建 10 张表', tables.length === 10, '实际 ' + tables.length);

    // 时间默认值是否真的是函数而非字符串
    const [tsCols] = await c.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND COLUMN_DEFAULT IN ('CURRENT_TIMESTAMP', 'current_timestamp()')
          AND DATA_TYPE = 'datetime'`,
      [TEST_DB]
    );
    check('时间默认值被正确识别为函数',
      tsCols.length >= 3,
      '只识别到 ' + tsCols.length + ' 个');
    console.log('    时间默认值列: ' +
      tsCols.map((r) => r.TABLE_NAME + '.' + r.COLUMN_NAME).join(', '));

    // 真的有表被建出来且列数正常
    const [users] = await c.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' ORDER BY ORDINAL_POSITION`,
      [TEST_DB]
    );
    check('users 表列结构完整', users.length === 6, '实际 ' + users.length + ' 列');

    // information_schema.STATISTICS 是「每个索引列一行」，
    // 所以单列主键也会出现多行，只断言存在即可。
    //
    // ⚠️ 下面两处必须解构 [rows] —— c.query() 返回的是 [rows, fields]，
    // 直接当数组用会拿到 length=2 且元素是 rows/fields 本身，
    // 表现为「查到 2 行、列名全是 null」的假象。
    const [idx] = await c.query(
      `SELECT COLUMN_NAME AS col FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'PRIMARY'`,
      [TEST_DB]
    );
    check('users 主键存在', idx.length > 0);
    check('users 主键是 id 列',
      idx.length === 1 && idx[0].col === 'id',
      '实际: ' + JSON.stringify(idx.map((r) => r.col)));

    const [uniq] = await c.query(
      `SELECT COLUMN_NAME AS col FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'username'`,
      [TEST_DB]
    );
    check('users 用户名唯一索引存在',
      uniq.length === 1 && uniq[0].col === 'username',
      '实际: ' + JSON.stringify(uniq.map((r) => r.col)));

    // 真正写一条数据，验证默认值真的会生效
    await c.query(
      `INSERT INTO users (username, password_hash) VALUES ('__probe__', 'x')`
    );
    const [row] = await c.query(`SELECT created_at FROM users WHERE username = '__probe__'`);
    check('created_at 默认值实际生效',
      row[0].created_at instanceof Date,
      '取到的是 ' + row[0].created_at);
    await c.query(`DELETE FROM users WHERE username = '__probe__'`);

  } catch (err) {
    fail++;
    console.log('  ✗ 结构核对失败: ' + err.message);
  }

  // ---------- 4. 幂等性：再导一次不能报错 ----------
  try {
    await c.query(`USE \`${TEST_DB}\``);
    await c.query(ddl);
    pass++;
    console.log('  ✓ 重复导入不报错（IF NOT EXISTS 生效）');
  } catch (err) {
    fail++;
    console.log('  ✗ 重复导入失败: ' + err.message);
  }

  // ---------- 清理 ----------
  await c.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  console.log('\n  （探测库已清理，love 库未受影响）');
  await c.end();

  console.log('\n' + '='.repeat(50));
  console.log(fail === 0
    ? `  全部通过 ${pass} 项 ✅ schema.sql 可安全导入`
    : `  通过 ${pass} / 失败 ${fail}`);
  console.log('='.repeat(50));
  process.exit(fail ? 1 : 0);
})();