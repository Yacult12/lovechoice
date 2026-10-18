'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { ApiError, ErrorCodes } = require('../utils/errors');

/**
 * 从 Authorization: Bearer xxx 或 x-access-token 头里取 token。
 */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const legacy = req.headers['x-access-token'];
  if (legacy) return String(legacy).trim();
  return null;
}

function verify(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, ErrorCodes.TOKEN_EXPIRED, '登录已过期，请重新登录');
    }
    throw new ApiError(401, ErrorCodes.TOKEN_INVALID, '登录凭证无效，请重新登录');
  }
}

/**
 * 强制登录：解析失败直接 401。
 */
function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('请先登录');
    const payload = verify(token);
    req.user = { id: Number(payload.sub), username: payload.username };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * 可选登录：有 token 就解析，没有也放行（用于剧情等公开接口）。
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verify(token);
    req.user = { id: Number(payload.sub), username: payload.username };
  } catch (err) {
    // 公开接口不因为过期 token 而失败
  }
  return next();
}

module.exports = { requireAuth, optionalAuth, extractToken };
