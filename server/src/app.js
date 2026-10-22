'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimit');

function buildCorsOptions() {
  const origin = config.corsOrigin;

  if (!origin || origin === '*') {
    return { origin: true, credentials: false };
  }

  const allowList = origin
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    origin(origin_, callback) {
      if (!origin_ || allowList.includes(origin_)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  };
}

function createApp() {
  const app = express();

  // 阿里云 SLB / Nginx 后面要拿到真实 IP，限流与日志才准
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  if (!config.isProd) {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  /*
   * API 响应一律不许缓存。
   *
   * 踩过的坑：改了剧本/数值后，老浏览器登录进去看到的还是旧内容，
   * 换一台没登录过的浏览器却是新版 —— 因为 /api/play/state 这类
   * GET 被浏览器缓存了，登录后直接拿本地副本渲染。
   *
   * no-store 是最强的一档：不存、不读、不问。
   * 游戏的数据本来就要求实时，任何缓存都是错的。
   *
   * ⚠️ 必须挂在 healthRoutes 之前 ——
   * 否则 /api/health 会绕过这个中间件，头上没有缓存控制字段，
   * 云监控那边看到的响应头是空的，排查问题时容易误判。
   */
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  // 健康检查不带 /api 前缀，方便云监控直接探活
  // 刻意放在限流之前 —— 否则云监控高频探活会把自己限掉
  app.use('/api', routes.healthRoutes);

  // 全站兜底限流，走在业务路由之前
  app.use(globalLimiter);

  app.use('/api', routes.router);

  app.get('/', (req, res) => {
    res.json({
      code: 0,
      message: 'ok',
      data: {
        service: '他们的故事 · 后端 API',
        docs: '/api/health',
        routes: ['/api/auth', '/api/story', '/api/play', '/api/saves', '/api/me'],
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, buildCorsOptions };
