'use strict';

const { ErrorCodes } = require('./errors');

/**
 * 统一成功响应体：{ code: 0, message: 'ok', data: ... }
 */
function ok(res, data = null, message = 'ok') {
  return res.status(200).json({ code: ErrorCodes.OK, message, data });
}

/**
 * 统一创建响应（201）。
 */
function created(res, data = null, message = 'created') {
  return res.status(201).json({ code: ErrorCodes.OK, message, data });
}

/**
 * 分页响应体：data 里带 list / total / page / pageSize。
 */
function page(res, { list, total, page: p, pageSize }) {
  return ok(res, {
    list,
    total,
    page: p,
    pageSize,
    hasMore: p * pageSize < total,
  });
}

/**
 * 把 async 中间件/处理器的异常转交给 express 错误中间件。
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 把 camelCase 字段名转成前端友好的布尔值。
 */
function toBool(value) {
  return value === true || value === 1 || value === '1';
}

module.exports = { ok, created, page, asyncHandler, toBool };
