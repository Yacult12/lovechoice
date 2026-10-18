'use strict';

const { query, execute } = require('../config/db');
const { clampAffection } = require('../utils/game');

/**
 * 条件求值器。支持：
 *   { "affection_male": { ">=": 70 } }
 *   { "affection_female": { "<": 30 } }
 *   { "flags": { "gave_gift": true } }
 *   { "all": [ cond, cond ] }  /  { "any": [...] }  /  { "not": cond }
 *   { "play_seconds": { ">=": 600 } }
 * 任何无法识别的键都返回 false（宁可不触发，也不要误触发隐藏结局）。
 */
function evaluateCondition(condition, ctx = {}) {
  if (!condition) return true;

  let cond = condition;
  if (typeof cond === 'string') {
    try {
      cond = JSON.parse(cond);
    } catch (err) {
      return false;
    }
  }
  if (typeof cond !== 'object' || cond === null) return false;

  const compare = (actual, op, expected) => {
    switch (op) {
      case '>=':
        return actual >= expected;
      case '>':
        return actual > expected;
      case '<=':
        return actual <= expected;
      case '<':
        return actual < expected;
      case '==':
        return actual === expected;
      case '!=':
        return actual !== expected;
      default:
        return false;
    }
  };

  const getActual = (key) => {
    switch (key) {
      case 'affection_male':
        return ctx.affectionMale ?? 0;
      case 'affection_female':
        return ctx.affectionFemale ?? 0;
      case 'play_seconds':
        return ctx.playSeconds ?? 0;
      default:
        return undefined;
    }
  };

  for (const [key, expected] of Object.entries(cond)) {
    if (key === 'all') {
      if (!Array.isArray(expected)) return false;
      if (!expected.every((sub) => evaluateCondition(sub, ctx))) return false;
      continue;
    }
    if (key === 'any') {
      if (!Array.isArray(expected)) return false;
      if (!expected.some((sub) => evaluateCondition(sub, ctx))) return false;
      continue;
    }
    if (key === 'not') {
      if (evaluateCondition(expected, ctx)) return false;
      continue;
    }
    if (key === 'flags') {
      const flags = ctx.flags ?? {};
      if (typeof expected !== 'object' || expected === null) return false;
      for (const [flagKey, flagValue] of Object.entries(expected)) {
        if (flags[flagKey] !== flagValue) return false;
      }
      continue;
    }

    const actual = getActual(key);
    if (actual === undefined) return false;

    if (typeof expected === 'object' && expected !== null) {
      for (const [op, value] of Object.entries(expected)) {
        if (!compare(actual, op, value)) return false;
      }
    } else if (actual !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * 找出该路线第一个满足条件的结局。
 * 排序：非隐藏优先、id 升序 —— 隐藏结局只在前面都没命中时才可能触发。
 */
async function findMatchingEnding(routeId, ctx) {
  const rows = await query('SELECT * FROM endings WHERE route_id = ? ORDER BY id ASC', [routeId]);

  const sorted = [...rows].sort((a, b) => {
    const hiddenA = Number(a.is_hidden) === 1 ? 1 : 0;
    const hiddenB = Number(b.is_hidden) === 1 ? 1 : 0;
    if (hiddenA !== hiddenB) return hiddenA - hiddenB;
    return a.id - b.id;
  });

  for (const row of sorted) {
    if (evaluateCondition(row.condition_json, ctx)) return row;
  }
  return null;
}

/**
 * 写入/更新用户结局解锁记录，返回是否首次解锁。
 * 传入 conn 时复用外部事务。
 */
async function unlockEnding(userId, endingId, routeId, conn = null) {
  const sql = `INSERT INTO user_endings (user_id, ending_id, route_id)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE route_id = VALUES(route_id)`;
  const params = [userId, endingId, routeId];

  // 复用外部事务时 conn.query 返回 [result, fields]；走连接池时用 db.execute 拿 header
  const result = conn ? (await conn.query(sql, params))[0] : await execute(sql, params);

  // 新插入时 affectedRows = 1；命中已有记录时返回 0（值未变化）或 2
  return result.affectedRows === 1;
}

/** 当前用户在指定路线（或全部）下已解锁的结局 id 集合。 */
async function getUnlockedEndingIds(userId, routeId = null) {
  const rows = routeId
    ? await query('SELECT ending_id FROM user_endings WHERE user_id = ? AND route_id = ?', [
        userId,
        routeId,
      ])
    : await query('SELECT ending_id FROM user_endings WHERE user_id = ?', [userId]);
  return new Set(rows.map((r) => r.ending_id));
}

module.exports = {
  evaluateCondition,
  findMatchingEnding,
  unlockEnding,
  getUnlockedEndingIds,
  clampAffection,
};
