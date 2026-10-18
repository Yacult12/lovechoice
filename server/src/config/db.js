'use strict';

const mysql = require('mysql2/promise');
const config = require('./index');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  // JSON 列由驱动解析成对象，DATETIME 保持 JS Date（序列化为 ISO 字符串）
  dateStrings: false,
  namedPlaceholders: false,
});

/**
 * 普通查询：返回 rows。
 */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * 执行写操作：返回 MySQL 的 ResultSetHeader（含 insertId / affectedRows）。
 */
async function execute(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/**
 * 只取第一行，没有则返回 null。
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * 事务包装：回调里拿到 connection，抛错自动回滚。
 * 用法：await withTransaction(async (conn) => { await conn.query(...) })
 */
async function withTransaction(handler) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      err.rollbackError = rollbackErr;
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, queryOne, execute, withTransaction, ping, close };
