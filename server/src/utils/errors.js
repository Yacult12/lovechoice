'use strict';

/**
 * 业务错误码统一登记处。
 * HTTP 状态码只表达「协议层」含义，code 才是前端做分支判断的依据。
 */
const ErrorCodes = {
  OK: 0,

  // 通用 4xx
  BAD_REQUEST: 40000,
  UNAUTHORIZED: 40100,
  TOKEN_EXPIRED: 40101,
  TOKEN_INVALID: 40102,
  FORBIDDEN: 40300,
  NOT_FOUND: 40400,
  CONFLICT: 40900,
  VALIDATION_FAILED: 42200,
  TOO_MANY_REQUESTS: 42900,

  // 账号 1xxxx
  USERNAME_TAKEN: 10001,
  USER_NOT_FOUND: 10002,
  PASSWORD_WRONG: 10003,
  OLD_PASSWORD_WRONG: 10004,

  // 剧情 2xxxx
  ROUTE_NOT_FOUND: 20001,
  CHAPTER_NOT_FOUND: 20002,
  NODE_NOT_FOUND: 20003,
  NOT_A_CHOICE_NODE: 20004,
  OPTION_NOT_FOUND: 20005,
  NODE_MISMATCH: 20006,
  CHAPTER_FINISHED: 20007,
  NO_ENDING_MATCHED: 20008,
  INVALID_NODE_TYPE: 20009,

  // 存档 3xxxx
  SAVE_NOT_FOUND: 30001,
  SAVE_ROUTE_CONFLICT: 30002,
  SAVE_SLOT_INVALID: 30003,

  // 限流 4xxxx
  RATE_LIMITED: 40001,

  // 服务端 5xxxx
  INTERNAL_ERROR: 50000,
  DB_ERROR: 50001,
};

class ApiError extends Error {
  /**
   * @param {number} httpStatus HTTP 状态码
   * @param {number} code 业务错误码
   * @param {string} message 面向用户的提示
   * @param {any} [details] 附加信息（仅开发环境返回）
   */
  constructor(httpStatus, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
    this.expected = true;
  }

  static badRequest(message = '请求参数有误', code = ErrorCodes.BAD_REQUEST, details) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = '请先登录', code = ErrorCodes.UNAUTHORIZED) {
    return new ApiError(401, code, message);
  }

  static forbidden(message = '没有权限执行该操作') {
    return new ApiError(403, ErrorCodes.FORBIDDEN, message);
  }

  static notFound(message = '资源不存在', code = ErrorCodes.NOT_FOUND) {
    return new ApiError(404, code, message);
  }

  static conflict(message = '资源冲突', code = ErrorCodes.CONFLICT) {
    return new ApiError(409, code, message);
  }

  static validation(message = '参数校验失败', details) {
    return new ApiError(422, ErrorCodes.VALIDATION_FAILED, message, details);
  }

  static internal(message = '服务器开小差了，请稍后再试') {
    return new ApiError(500, ErrorCodes.INTERNAL_ERROR, message);
  }
}

module.exports = { ApiError, ErrorCodes };
