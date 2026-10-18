'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');
const { query, queryOne } = require('../config/db');
const { ApiError, ErrorCodes } = require('../utils/errors');

/** 只暴露给前端的用户字段，绝不能带上 password_hash。 */
function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

async function findByUsername(username) {
  return queryOne('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
}

async function findById(id) {
  return queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
}

async function register({ username, password, nickname }) {
  const exists = await findByUsername(username);
  if (exists) {
    throw new ApiError(409, ErrorCodes.USERNAME_TAKEN, '该用户名已被注册');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  try {
    const result = await query(
      'INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)',
      [username, passwordHash, nickname || username]
    );
    const row = await findById(result.insertId);
    return toPublicUser(row);
  } catch (err) {
    // 并发注册时唯一索引兜底
    if (err && err.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, ErrorCodes.USERNAME_TAKEN, '该用户名已被注册');
    }
    throw err;
  }
}

async function login({ username, password }) {
  const row = await findByUsername(username);
  if (!row) {
    // 不区分「用户不存在」和「密码错误」，避免账号枚举
    throw new ApiError(401, ErrorCodes.PASSWORD_WRONG, '用户名或密码错误');
  }

  const matched = await bcrypt.compare(password, row.password_hash);
  if (!matched) {
    throw new ApiError(401, ErrorCodes.PASSWORD_WRONG, '用户名或密码错误');
  }

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);
  const fresh = await findById(row.id);
  return toPublicUser(fresh);
}

async function changePassword(userId, oldPassword, newPassword) {
  const row = await findById(userId);
  if (!row) throw new ApiError(404, ErrorCodes.USER_NOT_FOUND, '用户不存在');

  const matched = await bcrypt.compare(oldPassword, row.password_hash);
  if (!matched) {
    throw new ApiError(400, ErrorCodes.OLD_PASSWORD_WRONG, '原密码不正确');
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  return true;
}

async function updateProfile(userId, { nickname }) {
  await query('UPDATE users SET nickname = ? WHERE id = ?', [nickname, userId]);
  const row = await findById(userId);
  return toPublicUser(row);
}

module.exports = {
  toPublicUser,
  findById,
  register,
  login,
  changePassword,
  updateProfile,
};
