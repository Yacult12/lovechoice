'use strict';

const config = require('../config');
const { ApiError, ErrorCodes } = require('../utils/errors');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`接口不存在: ${req.method} ${req.originalUrl}`, ErrorCodes.NOT_FOUND));
}

const MYSQL_MAP = {
  ER_DUP_ENTRY: () => ApiError.conflict('数据已存在，请勿重复提交', ErrorCodes.CONFLICT),
  ER_NO_REFERENCED_ROW_2: () => ApiError.badRequest('关联的数据不存在', ErrorCodes.VALIDATION_FAILED),
  ER_ROW_IS_REFERENCED_2: () => ApiError.conflict('该数据被其他记录引用，无法删除', ErrorCodes.CONFLICT),
  ER_DATA_TOO_LONG: () => ApiError.validation('字段内容过长'),
  ER_TRUNCATED_WRONG_VALUE: () => ApiError.validation('字段类型不正确'),
  ER_BAD_FIELD_ERROR: () => ApiError.internal('数据库字段配置有误，请检查建表语句'),
  ER_NO_SUCH_TABLE: () => ApiError.internal('数据表不存在，请先执行建表脚本'),
  ER_ACCESS_DENIED_ERROR: () => ApiError.internal('数据库账号或密码错误，请检查 .env 配置'),
  ER_BAD_DB_ERROR: () => ApiError.internal('数据库不存在，请检查 .env 里的 DB_NAME'),
};

const NETWORK_MAP = {
  ECONNREFUSED: '无法连接数据库，请确认 MySQL 已启动且端口正确',
  ETIMEDOUT: '数据库连接超时',
  PROTOCOL_CONNECTION_LOST: '与数据库的连接已断开，请重试',
  ER_CON_COUNT_ERROR: '数据库连接数已满，请稍后重试',
  ER_GET_CONNECTION_TIMEOUT: '数据库连接池繁忙，请稍后重试',
};

/**
 * 把任意异常规整成 ApiError，并保证日志里有足够上下文。
 */
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err && err.name === 'ZodError') {
    return ApiError.validation('参数校验失败', err.issues ?? []);
  }

  if (err && err.name === 'JsonWebTokenError') {
    return new ApiError(401, ErrorCodes.TOKEN_INVALID, '登录凭证无效，请重新登录');
  }
  if (err && err.name === 'TokenExpiredError') {
    return new ApiError(401, ErrorCodes.TOKEN_EXPIRED, '登录已过期，请重新登录');
  }

  if (err && typeof err.type === 'string' && err.type === 'entity.parse.failed') {
    return ApiError.badRequest('请求体不是合法的 JSON');
  }

  if (err && typeof err.code === 'string') {
    if (MYSQL_MAP[err.code]) return MYSQL_MAP[err.code]();
    if (NETWORK_MAP[err.code]) {
      return new ApiError(503, ErrorCodes.DB_ERROR, NETWORK_MAP[err.code]);
    }
  }

  return new ApiError(
    500,
    ErrorCodes.INTERNAL_ERROR,
    config.isProd ? '服务器内部错误' : (err && err.message) || '服务器内部错误'
  );
}

/**
 * 兜底错误中间件，必须挂在所有路由之后。
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const apiError = normalize(err);

  if (!apiError.expected || apiError.httpStatus >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} ->`, err);
  }

  const body = {
    code: apiError.code,
    message: apiError.message,
    data: null,
  };
  if (apiError.details !== undefined) body.details = apiError.details;
  if (!config.isProd && !apiError.expected) body.stack = err && err.stack;

  res.status(apiError.httpStatus).json(body);
}

module.exports = { notFoundHandler, errorHandler, normalize };
