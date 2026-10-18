'use strict';

const express = require('express');
const storyService = require('../services/storyService');
const endingService = require('../services/endingService');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { validateParams, validateQuery } = require('../middleware/validate');
const { ok, asyncHandler } = require('../utils/response');
const { z } = require('zod');
const { routeCodeParams, chapterParams } = require('../schemas');

const router = express.Router();

/** GET /api/story/routes 故事线列表（他 / 她） */
router.get(
  '/routes',
  asyncHandler(async (req, res) => ok(res, { list: await storyService.listRoutes() }))
);

/** GET /api/story/routes/:routeCode 故事线详情 + 章节列表 */
router.get(
  '/routes/:routeCode',
  validateParams(routeCodeParams),
  optionalAuth,
  asyncHandler(async (req, res) => {
    const routeRow = await storyService.getRouteByCode(req.params.routeCode);
    const chapters = await storyService.listChapters(routeRow.id);

    let unlocked = new Set();
    if (req.user) {
      unlocked = await endingService.getUnlockedEndingIds(req.user.id, routeRow.id);
    }

    const endings = await storyService.listEndings(routeRow.id, unlocked);

    return ok(res, {
      route: storyService.mapRoute(routeRow),
      chapters,
      endings: endings.map((e) => ({
        endingKey: e.endingKey,
        title: e.isHidden && !e.unlocked ? '???' : e.title,
        description: e.isHidden && !e.unlocked ? '尚未解锁的隐藏结局' : e.description,
        isHidden: e.isHidden,
        unlocked: e.unlocked,
        condition: e.condition,
      })),
      endingProgress: {
        unlocked: endings.filter((e) => e.unlocked).length,
        total: endings.length,
      },
    });
  })
);

/** GET /api/story/routes/:routeCode/chapters/:chapterNo 单章剧本 */
router.get(
  '/routes/:routeCode/chapters/:chapterNo',
  validateParams(chapterParams),
  asyncHandler(async (req, res) => {
    const routeRow = await storyService.getRouteByCode(req.params.routeCode);
    const script = await storyService.getChapterScript(routeRow.id, req.params.chapterNo);
    return ok(res, script);
  })
);

/** GET /api/story/routes/:routeCode/script 整线剧本（前端预加载用） */
router.get(
  '/routes/:routeCode/script',
  validateParams(routeCodeParams),
  asyncHandler(async (req, res) => {
    const script = await storyService.getRouteScript(req.params.routeCode);
    return ok(res, script);
  })
);

/** GET /api/story/routes/:routeCode/validate 剧本自检（断链 / 不可达节点） */
router.get(
  '/routes/:routeCode/validate',
  validateParams(routeCodeParams),
  asyncHandler(async (req, res) => ok(res, await storyService.validateRoute(req.params.routeCode)))
);

/** GET /api/story/endings?routeCode=male 结局列表（含解锁状态） */
router.get(
  '/endings',
  optionalAuth,
  validateQuery(z.object({ routeCode: z.string().trim().min(2).max(16).optional() })),
  asyncHandler(async (req, res) => {
    const { routeCode } = req.query;

    if (routeCode) {
      const unlocked = req.user
        ? await endingService.getUnlockedEndingIds(
            req.user.id,
            (await storyService.getRouteByCode(routeCode)).id
          )
        : new Set();
      return ok(res, await storyService.listEndingsByCode(routeCode, unlocked));
    }

    const routes = await storyService.listRoutes();
    const list = [];
    for (const route of routes) {
      const unlocked = req.user
        ? await endingService.getUnlockedEndingIds(req.user.id, route.id)
        : new Set();
      list.push({ route, endings: await storyService.listEndings(route.id, unlocked) });
    }
    return ok(res, { list });
  })
);

/** GET /api/story/routes/:routeCode/characters 角色列表 */
router.get(
  '/routes/:routeCode/characters',
  validateParams(routeCodeParams),
  asyncHandler(async (req, res) => {
    const routeRow = await storyService.getRouteByCode(req.params.routeCode);
    const { query } = require('../config/db');
    const rows = await query(
      'SELECT * FROM characters WHERE route_id = ? ORDER BY role ASC, id ASC',
      [routeRow.id]
    );
    return ok(res, {
      list: rows.map((r) => ({
        id: r.id,
        charKey: r.char_key,
        name: r.name,
        role: r.role,
        avatarUrl: r.avatar_url,
      })),
    });
  })
);

module.exports = router;
