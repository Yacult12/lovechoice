'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 生成访问令牌。subject 固定为 userId（字符串），便于后续扩展 refresh token。
 */
function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = { signToken };
