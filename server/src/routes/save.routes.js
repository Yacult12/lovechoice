'use strict';

const express = require('express');
const saveService = require('../services/saveService');
const { requireAuth } = require('../middleware/auth');
const { validateBody, validateParams } = require('../middleware/validate');
const { writeLimiter } = require('../middleware/rateLimit');
const { ok, asyncHandler } = require('../utils/response');
const { saveParams, upsertSaveSchema } = require('../schemas');

const router = express.Router();

router.use(requireAuth);

/** GET /api/saves 存档列表（含章节信息） */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await saveService.listSaves(req.user.id);
    return ok(res, { list, total: list.length });
  })
);

/** GET /api/saves/:slot 单个存档 */
router.get(
  '/:slot',
  validateParams(saveParams),
  asyncHandler(async (req, res) => {
    const save = await saveService.getSaveDetail(req.user.id, req.params.slot);
    return ok(res, save);
  })
);

/** PUT /api/saves/:slot 覆盖写存档（导入 / 本地计算模式回写） */
router.put(
  '/:slot',
  writeLimiter,
  validateParams(saveParams),
  validateBody(upsertSaveSchema),
  asyncHandler(async (req, res) => {
    const save = await saveService.upsertSave(req.user.id, req.params.slot, req.body);
    return ok(res, save, '存档已保存');
  })
);

/** DELETE /api/saves/:slot 删除存档 */
router.delete(
  '/:slot',
  writeLimiter,
  validateParams(saveParams),
  asyncHandler(async (req, res) => {
    await saveService.deleteSave(req.user.id, req.params.slot);
    return ok(res, { slot: req.params.slot }, '存档已删除');
  })
);

module.exports = router;
