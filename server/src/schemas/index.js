'use strict';

const { z } = require('zod');

const routeCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{2,16}$/, '故事线代码格式不正确');

const slotSchema = z.coerce
  .number()
  .int('档位必须是整数')
  .min(0, '档位最小为 0')
  .max(9, '档位最大为 9');

const nodeKeySchema = z.string().trim().min(1, '节点不能为空').max(64);

// ---------------- auth ----------------
const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{3,32}$/, '用户名需为 3-32 位字母、数字或下划线'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码最长 64 位'),
  nickname: z.string().trim().min(1).max(32).optional(),
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(64),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(64),
  newPassword: z.string().min(6, '新密码至少 6 位').max(64),
});

const updateProfileSchema = z.object({
  nickname: z.string().trim().min(1, '昵称不能为空').max(32),
});

// ---------------- story ----------------
const routeCodeParams = z.object({ routeCode: routeCodeSchema });

const chapterParams = z.object({
  routeCode: routeCodeSchema,
  chapterNo: z.coerce.number().int().min(1, '章节号必须大于 0'),
});

// ---------------- play ----------------
const playBase = z.object({
  routeCode: routeCodeSchema,
  slot: slotSchema.default(0),
});

const startPlaySchema = playBase;

const advanceSchema = playBase.extend({ nodeKey: nodeKeySchema });

const chooseSchema = playBase.extend({
  nodeKey: nodeKeySchema,
  optionKey: z.string().trim().min(1, '选项不能为空').max(64),
});

const enterChapterSchema = playBase.extend({
  chapterNo: z.coerce.number().int().min(1),
});

/**
 * 隐藏互动（牵手 / 擦眼泪 …）。
 * 好感增量由前端按互动定义算好后回传，服务端只负责落库。
 */
const gestureSchema = playBase.extend({
  nodeKey: nodeKeySchema,
  gestureId: z.string().trim().min(1, '互动 id 不能为空').max(64),
  effectMale: z.coerce.number().int().min(-50).max(50).default(0),
  effectFemale: z.coerce.number().int().min(-50).max(50).default(0),
});

const tickSchema = playBase.extend({
  seconds: z.coerce.number().int().min(1).max(1800, '单次上报最多 1800 秒'),
});

const settleSchema = playBase;

// ---------------- saves ----------------
const saveParams = z.object({ slot: slotSchema });

const upsertSaveSchema = playBase.extend({
  chapterId: z.coerce.number().int().positive().nullable().optional(),
  nodeKey: nodeKeySchema,
  affectionMale: z.coerce.number().int().min(-999).max(999).optional(),
  affectionFemale: z.coerce.number().int().min(-999).max(999).optional(),
  stateJson: z.record(z.any()).nullable().optional(),
  playSeconds: z.coerce.number().int().min(0).max(360000).optional(),
});

// ---------------- me ----------------
const historyQuerySchema = z.object({
  routeCode: routeCodeSchema.optional(),
  slot: slotSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  routeCodeSchema,
  slotSchema,
  nodeKeySchema,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  routeCodeParams,
  chapterParams,
  startPlaySchema,
  advanceSchema,
  chooseSchema,
  gestureSchema,
  enterChapterSchema,
  tickSchema,
  settleSchema,
  saveParams,
  upsertSaveSchema,
  historyQuerySchema,
};
