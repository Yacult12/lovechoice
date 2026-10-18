'use strict';

/**
 * 数据库自检脚本：npm run db:check
 * 会打印当前连接的库名、所有表、关键表数据量，
 * 以及常见「库名写错」的提示（脚本里是 lovechoice，你说是 love）。
 */
const mysql = require('mysql2/promise');
const config = require('../src/config');

const EXPECTED_TABLES = [
  'users',
  'routes',
  'characters',
  'chapters',
  'scene_nodes',
  'choices',
  'saves',
  'choice_logs',
  'endings',
  'user_endings',
];

const COUNT_TABLES = ['routes', 'chapters', 'scene_nodes', 'choices', 'endings'];

async function main() {
  console.log('配置:', {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    database: config.db.database,
  });

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: 'utf8mb4_unicode_ci',
  });

  const [[dbInfo]] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version');
  console.log(`\n✓ 已连接 MySQL ${dbInfo.version}，当前库: ${dbInfo.db}`);

  const [tables] = await connection.query(
    `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
    [config.db.database]
  );
  const names = tables.map((t) => String(t.name || t.NAME));
  console.log(`\n共 ${names.length} 张表: ${names.join(', ') || '(空库)'}`);

  const missing = EXPECTED_TABLES.filter((t) => !names.includes(t));
  if (missing.length) {
    console.log(`\n⚠ 缺少表: ${missing.join(', ')}`);
  }

  if (names.length) {
    console.log('\n关键表数据量:');
    for (const t of COUNT_TABLES) {
      if (!names.includes(t)) continue;
      const [[row]] = await connection.query(`SELECT COUNT(*) AS c FROM \`${t}\``);
      console.log(`  ${t.padEnd(14)} ${row.c}`);
    }
  }

  if (missing.length) {
    const [others] = await connection.query(
      `SELECT schema_name AS name FROM information_schema.schemata
        WHERE schema_name IN ('love', 'lovechoice')`
    );
    const candidates = others.map((r) => String(r.name || r.NAME));
    console.log(`\n磁盘上存在的候选库: ${candidates.join(', ') || '(无)'}`);
    console.log('提示: 若表其实建在 lovechoice 里，请把 .env 的 DB_NAME 改成 lovechoice，或执行：');
    console.log('      RENAME TABLE/lovechoice 相关表迁移到 love（或直接重新在 love 库执行建表脚本）。');
  } else {
    console.log('\n✓ 表结构检查通过，可以启动服务: npm run dev');
  }

  await connection.end();
}

main().catch((err) => {
  console.error('\n✗ 自检失败:', err.code ? `${err.code} - ${err.message}` : err.message);
  if (err.code === 'ER_BAD_DB_ERROR') {
    console.error('  → 数据库不存在，请在 MySQL 里 CREATE DATABASE 或修正 .env 的 DB_NAME');
  }
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('  → 账号或密码不对，检查 .env 里的 DB_USER / DB_PASSWORD');
  }
  if (err.code === 'ECONNREFUSED') {
    console.error('  → MySQL 没启动，或端口不对（默认 3306）');
  }
  process.exit(1);
});
