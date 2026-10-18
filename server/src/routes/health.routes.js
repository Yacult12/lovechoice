'use strict';

const express = require('express');
const { query } = require('../config/db');
const config = require('../config');
const { ok, asyncHandler } = require('../utils/response');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

/** 需要后端运行时能确认存在的表 */
const REQUIRED_TABLES = [
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

/**
 * GET /api/health 健康检查：适合给阿里云 SLB / 云监控探活。
 * 返回 200 表示进程活着，db.status = 'up' 才代表能真正服务。
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const payload = {
      status: 'ok',
      env: config.env,
      database: config.db.database,
      uptimeSeconds: Math.floor(process.uptime()),
      time: new Date().toISOString(),
      db: { status: 'down', missingTables: [] },
      // 限流是否真的开着 —— 部署时最容易忘配的一项，放进健康检查便于确认
      rateLimit: rateLimit.describe(),
    };

    try {
      const rows = await query(
        `SELECT table_name AS name
           FROM information_schema.tables
          WHERE table_schema = ?`,
        [config.db.database]
      );
      const existing = new Set(rows.map((r) => String(r.name || r.NAME || '').toLowerCase()));
      const missing = REQUIRED_TABLES.filter((t) => !existing.has(t));

      payload.db.status = missing.length ? 'degraded' : 'up';
      payload.db.tableCount = existing.size;
      payload.db.missingTables = missing;
    } catch (err) {
      payload.db.status = 'down';
      payload.db.error = err.message;
    }

    return ok(res, payload);
  })
);

/** GET /api/meta 前端启动时拉一次的元信息 */
router.get(
  '/meta',
  asyncHandler(async (req, res) =>
    ok(res, {
      service: 'love-backend',
      version: require('../../package.json').version,
      env: config.env,
      affectionRange: [config.game.affectionMin, config.game.affectionMax],
      supports: ['male', 'female'],
      rateLimit: rateLimit.describe(),
    })
  )
);

module.exports = router;
