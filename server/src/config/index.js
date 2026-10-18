'use strict';

/**
 * 统一的环境变量加载与校验入口。
 * 生产环境下会对关键配置做强校验，避免用默认密钥上线。
 */
require('dotenv').config();

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`[config] 缺少必需的环境变量: ${name}`);
  }
  return value;
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

if (isProd) {
  if (!process.env.JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('[config] 生产环境必须配置长度 >= 32 的 JWT_SECRET');
  }
  if (!process.env.DB_PASSWORD) {
    throw new Error('[config] 生产环境必须配置 DB_PASSWORD');
  }
  // 限流阈值必须为正数，否则等于没开
  for (const key of ['RATE_LIMIT_MAX', 'RATE_LIMIT_WRITE_MAX', 'RATE_LIMIT_AUTH_MAX']) {
    const n = Number.parseInt(process.env[key] ?? '', 10);
    if (Number.isFinite(n) && n <= 0) {
      throw new Error(`[config] 生产环境 ${key} 必须为正整数（当前 ${n}）`);
    }
  }
}

const config = {
  env: NODE_ENV,
  isProd,
  port: toInt(process.env.PORT, 3000),

  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: toInt(process.env.DB_PORT, 3306),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME', 'love'),
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  },

  jwt: {
    secret: JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),

  game: {
    affectionMin: toInt(process.env.AFFECTION_MIN, 0),
    affectionMax: toInt(process.env.AFFECTION_MAX, 100),
    strictPlay: (process.env.STRICT_PLAY || 'true').toLowerCase() !== 'false',
  },

  corsOrigin: (process.env.CORS_ORIGIN || '*').trim(),

  /**
   * 限流。
   * 开发环境默认关闭，避免调剧本时被自己的测试刷爆；
   * 生产环境默认开启，且在下面强制校验过阈值。
   */
  rateLimit: {
    enabled: (process.env.RATE_LIMIT_ENABLED || (isProd ? 'true' : 'false')).toLowerCase() !== 'false',
    // 全局兜底：单个 IP 在窗口内的总请求数
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
    // 写操作单独收紧（注册/登录/提交选择/互动）
    writeMax: toInt(process.env.RATE_LIMIT_WRITE_MAX, 30),
    writeWindowMs: toInt(process.env.RATE_LIMIT_WRITE_WINDOW_MS, 60_000),
    // 登录/注册这类敏感接口再单独收紧
    authMax: toInt(process.env.RATE_LIMIT_AUTH_MAX, 10),
    authWindowMs: toInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60_000),
    // 命中限流后是否直接断开
    hardBlock: (process.env.RATE_LIMIT_HARD_BLOCK || 'false').toLowerCase() === 'true',
  },
};

module.exports = config;
