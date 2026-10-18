'use strict';

const express = require('express');
const authService = require('../services/authService');
const { validateBody } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { ok, created, asyncHandler } = require('../utils/response');
const { signToken } = require('../utils/token');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
} = require('../schemas');

const router = express.Router();

/** POST /api/auth/register 注册并直接登录 */
router.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.register(req.body);
    const token = signToken(user);
    return created(res, { token, user }, '注册成功');
  })
);

/** POST /api/auth/login 登录 */
router.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.login(req.body);
    const token = signToken(user);
    return ok(res, { token, user }, '登录成功');
  })
);

/** GET /api/auth/me 当前登录用户 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await authService.findById(req.user.id);
    return ok(res, authService.toPublicUser(row));
  })
);

/** PATCH /api/auth/profile 修改昵称 */
router.patch(
  '/profile',
  requireAuth,
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user.id, req.body);
    return ok(res, user, '资料已更新');
  })
);

/** POST /api/auth/password 修改密码（JWT 无状态，改完前端重新登录即可） */
router.post(
  '/password',
  requireAuth,
  authLimiter,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.changePassword(req.user.id, req.body.oldPassword, req.body.newPassword);
    return ok(res, { relogin: true }, '密码已修改，请重新登录');
  })
);

/** POST /api/auth/logout 退出登录（令牌由前端丢弃） */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => ok(res, { loggedOut: true }, '已退出登录'))
);

module.exports = router;
