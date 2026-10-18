'use strict';

const { ApiError } = require('../utils/errors');

/**
 * 用 zod schema 校验请求，校验通过后把「清洗过的值」写回 req[source]。
 *
 * 注意：Express 4 的 req.query 是原型上的 getter，直接赋值会抛错，
 * 因此这里用 defineProperty 定义同名自有属性来覆盖它。
 */
function validate(schema, source = 'body') {
  return function validateMiddleware(req, res, next) {
    const input = source === 'body' ? (req.body ?? {}) : (req[source] ?? {});
    const result = schema.safeParse(input);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.') || source,
        message: issue.message,
        code: issue.code,
      }));
      return next(ApiError.validation('参数校验失败', details));
    }

    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return next();
  };
}

const validateBody = (schema) => validate(schema, 'body');
const validateQuery = (schema) => validate(schema, 'query');
const validateParams = (schema) => validate(schema, 'params');

module.exports = { validate, validateBody, validateQuery, validateParams };
