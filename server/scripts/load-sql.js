'use strict';

/**
 * 用 Node 执行一个 .sql 文件：npm run demo
 * 允许同时执行多条语句（multipleStatements），出错整体报错。
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: node scripts/load-sql.js <sql文件路径>');
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error(`文件不存在: ${abs}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(abs, 'utf8');
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: true,
  });

  console.log(`执行 ${abs} 于 ${config.db.database}@${config.db.host}:${config.db.port} ...`);
  try {
    const [result] = await connection.query(sql);
    const results = Array.isArray(result) ? result : [result];
    console.log(`✓ 执行完成，共 ${results.length} 条语句`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('✗ 执行失败:', err.message);
  process.exit(1);
});
