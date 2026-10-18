'use strict';

const express = require('express');
const { query, queryOne } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const { ok, page, asyncHandler } = require('../utils/response');
const authService = require('../services/authService');
const storyService = require('../services/storyService');
const endingService = require('../services/endingService');
const saveService = require('../services/saveService');
const { historyQuerySchema } = require('../schemas');

const router = express.Router();

router.use(requireAuth);

/** GET /api/me 个人主页数据 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const row = await authService.findById(req.user.id);
    return ok(res, { user: authService.toPublicUser(row) });
  })
);

/** PATCH /api/me 修改昵称 */
router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const nickname = String(req.body?.nickname ?? '').trim();
    if (!nickname || nickname.length > 32) {
      return res.status(422).json({
        code: 42200,
        message: '参数校验失败',
        data: null,
        details: [{ path: 'nickname', message: '昵称需为 1-32 个字符' }],
      });
    }
    const user = await authService.updateProfile(req.user.id, { nickname });
    return ok(res, user, '资料已更新');
  })
);

/** GET /api/me/stats 全局统计（存档数 / 各线好感峰值 / 结局收集度） */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const [saveAgg] = await query(
      `SELECT COUNT(*) AS save_count,
              COALESCE(SUM(play_seconds), 0) AS total_seconds,
              COALESCE(MAX(affection_male), 0) AS best_male,
              COALESCE(MAX(affection_female), 0) AS best_female
         FROM saves WHERE user_id = ?`,
      [userId]
    );

    const [choiceAgg] = await query(
      'SELECT COUNT(*) AS choice_count FROM choice_logs WHERE user_id = ?',
      [userId]
    );

    const routes = await storyService.listRoutes();
    const routeStats = [];

    for (const route of routes) {
      const unlockedIds = await endingService.getUnlockedEndingIds(userId, route.id);
      const endings = await storyService.listEndings(route.id, unlockedIds);

      const chapters = await storyService.listChapters(route.id);
      const [progress] = await query(
        `SELECT COUNT(DISTINCT s.chapter_id) AS reached_chapters
           FROM saves s WHERE s.user_id = ? AND s.route_id = ?`,
        [userId, route.id]
      );

      const [choiceCount] = await query(
        'SELECT COUNT(*) AS c FROM choice_logs WHERE user_id = ? AND route_id = ?',
        [userId, route.id]
      );

      routeStats.push({
        route,
        choiceCount: Number(choiceCount?.c ?? 0),
        chaptersTotal: chapters.length,
        chaptersReached: Math.min(Number(progress?.reached_chapters ?? 0), chapters.length),
        endingsUnlocked: endings.filter((e) => e.unlocked).length,
        endingsTotal: endings.length,
      });
    }

    const [endingsAgg] = await query(
      'SELECT COUNT(*) AS unlocked FROM user_endings WHERE user_id = ?',
      [userId]
    );
    const [endingTotal] = await query('SELECT COUNT(*) AS total FROM endings');

    return ok(res, {
      saveCount: Number(saveAgg?.save_count ?? 0),
      totalPlaySeconds: Number(saveAgg?.total_seconds ?? 0),
      choiceCount: Number(choiceAgg?.choice_count ?? 0),
      bestAffection: {
        male: Number(saveAgg?.best_male ?? 0),
        female: Number(saveAgg?.best_female ?? 0),
      },
      endings: {
        unlocked: Number(endingsAgg?.unlocked ?? 0),
        total: Number(endingTotal?.total ?? 0),
      },
      routes: routeStats,
    });
  })
);

/** GET /api/me/endings 已解锁结局 */
router.get(
  '/endings',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const rows = await query(
      `SELECT ue.unlocked_at, ue.route_id, e.*
         FROM user_endings ue
         JOIN endings e ON e.id = ue.ending_id
        WHERE ue.user_id = ?
        ORDER BY ue.unlocked_at DESC`,
      [userId]
    );

    const routes = await storyService.listRoutes();
    const routeCodeById = new Map(routes.map((r) => [r.id, r.routeCode]));

    return ok(res, {
      list: rows.map((row) => ({
        endingId: row.ending_id,
        endingKey: row.ending_key,
        routeId: row.route_id,
        routeCode: routeCodeById.get(row.route_id) ?? null,
        title: row.title,
        description: row.description,
        isHidden: row.is_hidden === 1 || row.is_hidden === true,
        unlockedAt: row.unlocked_at,
      })),
      total: rows.length,
    });
  })
);

/** GET /api/me/history 选择记录（回看） */
router.get(
  '/history',
  validateQuery(historyQuerySchema),
  asyncHandler(async (req, res) => {
    const { routeCode, page: pageNo, pageSize } = req.query;
    const userId = req.user.id;

    let routeId = null;
    if (routeCode) {
      routeId = (await storyService.getRouteByCode(routeCode)).id;
    }

    const where = ['cl.user_id = ?'];
    const params = [userId];
    if (routeId) {
      where.push('cl.route_id = ?');
      params.push(routeId);
    }

    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM choice_logs cl WHERE ${where.join(' AND ')}`,
      params
    );

    const rows = await query(
      `SELECT cl.id, cl.route_id, cl.node_key, cl.created_at,
              cl.affection_male_before, cl.affection_female_before,
              cl.affection_male_after, cl.affection_female_after,
              ch.option_key, ch.option_text, ch.effect_male, ch.effect_female,
              n.speaker, n.content AS node_content,
              c.chapter_no, c.title AS chapter_title,
              r.route_code
         FROM choice_logs cl
         LEFT JOIN choices ch ON ch.id = cl.choice_id
         LEFT JOIN scene_nodes n ON n.id = ch.node_id
         LEFT JOIN chapters c ON c.id = n.chapter_id
         LEFT JOIN routes r ON r.id = cl.route_id
        WHERE ${where.join(' AND ')}
        ORDER BY cl.created_at DESC, cl.id DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (pageNo - 1) * pageSize]
    );

    return page(res, {
      list: rows.map((row) => ({
        id: row.id,
        routeId: row.route_id,
        routeCode: row.route_code,
        chapterNo: row.chapter_no,
        chapterTitle: row.chapter_title,
        nodeKey: row.node_key,
        speaker: row.speaker,
        nodeContent: row.node_content,
        optionKey: row.option_key,
        optionText: row.option_text,
        effects: { male: row.effect_male, female: row.effect_female },
        affectionBefore: { male: row.affection_male_before, female: row.affection_female_before },
        affectionAfter: { male: row.affection_male_after, female: row.affection_female_after },
        createdAt: row.created_at,
      })),
      total: Number(total ?? 0),
      page: pageNo,
      pageSize,
    });
  })
);

module.exports = router;
