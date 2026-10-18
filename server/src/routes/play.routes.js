'use strict';

const express = require('express');
const playService = require('../services/playService');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { writeLimiter } = require('../middleware/rateLimit');
const { ok, asyncHandler } = require('../utils/response');
const {
  startPlaySchema,
  advanceSchema,
  chooseSchema,
  gestureSchema,
  enterChapterSchema,
  tickSchema,
  settleSchema,
} = require('../schemas');

const router = express.Router();

router.use(requireAuth);

/** POST /api/play/start 开始 / 继续游戏（无存档则按线路起始节点创建） */
router.post(
  '/start',
  validateBody(startPlaySchema),
  asyncHandler(async (req, res) => ok(res, await playService.start(req.user.id, req.body)))
);

/** GET /api/play/state?routeCode=male&slot=0 只读当前进度（不创建存档） */
router.get(
  '/state',
  asyncHandler(async (req, res) => {
    const routeCode = String(req.query.routeCode || '');
    const slot = Number.parseInt(req.query.slot ?? '0', 10) || 0;
    if (!routeCode) {
      return res.status(422).json({
        code: 42200,
        message: '参数校验失败',
        data: null,
        details: [{ path: 'routeCode', message: 'routeCode 不能为空' }],
      });
    }
    return ok(res, await playService.state(req.user.id, { routeCode, slot }));
  })
);

/** POST /api/play/advance 对白推进（章末自动进入下一章） */
router.post(
  '/advance',
  writeLimiter,
  validateBody(advanceSchema),
  asyncHandler(async (req, res) => ok(res, await playService.advance(req.user.id, req.body)))
);

/** POST /api/play/choice 提交选择：结算双方好感 + 写日志 + 推进 */
router.post(
  '/choice',
  writeLimiter,
  validateBody(chooseSchema),
  asyncHandler(async (req, res) => ok(res, await playService.choose(req.user.id, req.body)))
);

/** POST /api/play/gesture 隐藏互动：只加好感 + 记 flag，不推进剧情 */
router.post(
  '/gesture',
  writeLimiter,
  validateBody(gestureSchema),
  asyncHandler(async (req, res) => ok(res, await playService.gesture(req.user.id, req.body)))
);

/** POST /api/play/chapter 跳到指定章节 */
router.post(
  '/chapter',
  validateBody(enterChapterSchema),
  asyncHandler(async (req, res) => ok(res, await playService.enterChapter(req.user.id, req.body)))
);

/** POST /api/play/settle 主动结算结局 */
router.post(
  '/settle',
  validateBody(settleSchema),
  asyncHandler(async (req, res) => ok(res, await playService.settle(req.user.id, req.body)))
);

/** POST /api/play/tick 上报游玩时长（秒） */
router.post(
  '/tick',
  validateBody(tickSchema),
  asyncHandler(async (req, res) => ok(res, await playService.tick(req.user.id, req.body)))
);

module.exports = router;
