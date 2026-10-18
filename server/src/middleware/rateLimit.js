'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');
const { ErrorCodes } = require('../utils/errors');

/**
 * 限流中间件。
 *
 * 分三层，从宽到紧：
 *   1. globalLimiter —— 全站兜底，防止单个 IP 刷接口
 *   2. writeLimiter  —— 写操作（注册/登录/选择/互动/存档），翻倍敏感
 *   3. authLimiter   —— 登录注册，窗口长、次数少，专防撞库和批量注册
 *
 * 生产环境跑在 Nginx / 阿里云 SLB 后面，所以 keyGenerator 用
 * `app.set('trust proxy', 1)` 拿到的真实 IP，而不是 XFF 里的第一个值
 * （否则攻击者随便伪造一个 X-Forwarded-For 就能绕过）。
 */

/**
 * 限流关闭时的直通中间件。
 *
 * ⚠️ 必须写成 (req, res, next) => next()：
 * 早先写成 () => false 是错的 —— Express 4 会把「函数」当成路由处理器，
 * 而不是带 arity===3 的中间件，于是既不 next 也不响应，
 * 请求直接挂住，表现为所有接口超时。
 */
const DISABLED = (req, res, next) => next();

/**
 * 取真实客户端 IP。
 * trust proxy=1 时 req.ip 已经是最后一跳代理还原出的地址。
 */
function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** 命中限流时的响应体，保持和项目内其它错误一致的 { code, message, data } 结构。 */
function buildHandler(retryAfterSeconds) {
  return (req, res) => {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      code: ErrorCodes.RATE_LIMITED,
      message: `操作太频繁，请 ${retryAfterSeconds} 秒后再试`,
      data: {
        retryAfter: retryAfterSeconds,
        limit: Number(res.getHeader('RateLimit-Limit')) || null,
        remaining: 0,
      },
    });
  };
}

/** 统一构造一个限流器；enabled=false 时返回直通中间件。 */
function makeLimiter({ windowMs, max, keyPrefix, name }) {
  if (!config.rateLimit.enabled) return DISABLED;

  const retryAfter = Math.ceil(windowMs / 1000);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // 用 name 做命名空间，避免三层限流共用同一个计数器
    keyGenerator: (req) => `${keyPrefix}:${clientIp(req)}`,
    handler: buildHandler(retryAfter),
    // 开发环境下跳过 OPTIONS 预检，否则前端第一次请求就被 429 了
    skip: (req) => req.method === 'OPTIONS',
  });
}

/** 全站兜底 */
const globalLimiter = makeLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  keyPrefix: 'global',
});

/** 写操作收紧 */
const writeLimiter = makeLimiter({
  windowMs: config.rateLimit.writeWindowMs,
  max: config.rateLimit.writeMax,
  keyPrefix: 'write',
});

/** 登录注册最严 */
const authLimiter = makeLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  keyPrefix: 'auth',
});

/** 供 /api/health 汇报当前配置，便于线上确认限流真的开着 */
function describe() {
  if (!config.rateLimit.enabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    global: { windowMs: config.rateLimit.windowMs, max: config.rateLimit.max },
    write: { windowMs: config.rateLimit.writeWindowMs, max: config.rateLimit.writeMax },
    auth: { windowMs: config.rateLimit.authWindowMs, max: config.rateLimit.authMax },
  };
}

module.exports = {
  globalLimiter,
  writeLimiter,
  authLimiter,
  clientIp,
  describe,
};