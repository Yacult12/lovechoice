'use strict';

const { query, queryOne, withTransaction } = require('../config/db');
const { ApiError, ErrorCodes } = require('../utils/errors');
const { clampAffection } = require('../utils/game');
const storyService = require('./storyService');

/*
 * 存档相关的读写都走这里。
 * 一份存档 = (user_id, slot)，只属于一条故事线；切线路会重置这份存档。
 */

function parseStateJson(raw) {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function mapSave(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    slot: row.slot,
    routeId: row.route_id,
    routeCode: extra.routeCode ?? null,
    chapterId: row.chapter_id,
    chapterNo: extra.chapterNo ?? null,
    chapterTitle: extra.chapterTitle ?? null,
    nodeKey: row.node_key,
    affectionMale: row.affection_male,
    affectionFemale: row.affection_female,
    state: parseStateJson(row.state_json),
    schemaVersion: row.schema_version,
    playSeconds: row.play_seconds,
    updatedAt: row.updated_at,
  };
}

async function getSaveRow(userId, slot) {
  return queryOne('SELECT * FROM saves WHERE user_id = ? AND slot = ? LIMIT 1', [userId, slot]);
}

/** 存档 + 章节信息（给前端展示用）。 */
async function getSaveDetail(userId, slot) {
  const row = await getSaveRow(userId, slot);
  if (!row) return null;

  const meta = await queryOne(
    `SELECT r.route_code, c.chapter_no, c.title AS chapter_title
       FROM routes r
       LEFT JOIN chapters c ON c.id = ?
      WHERE r.id = ?`,
    [row.chapter_id, row.route_id]
  );

  return mapSave(row, meta ?? {});
}

async function listSaves(userId) {
  const rows = await query(
    `SELECT s.*, r.route_code AS route_code, c.chapter_no AS chapter_no, c.title AS chapter_title
       FROM saves s
       LEFT JOIN routes r ON r.id = s.route_id
       LEFT JOIN chapters c ON c.id = s.chapter_id
      WHERE s.user_id = ?
      ORDER BY s.slot ASC`,
    [userId]
  );
  return rows.map((row) =>
    mapSave(row, {
      routeCode: row.route_code,
      chapterNo: row.chapter_no,
      chapterTitle: row.chapter_title,
    })
  );
}

async function countSaves(userId) {
  const row = await queryOne('SELECT COUNT(*) AS total FROM saves WHERE user_id = ?', [userId]);
  return Number(row?.total ?? 0);
}

/**
 * 找到 (user, slot) 的存档；不存在就按路线起始节点创建。
 * 若存档属于另一条故事线，则重置到新路线（返回 reset=true）。
 */
async function findOrCreateSave(userId, slot, routeRow) {
  const existing = await getSaveRow(userId, slot);

  if (existing && Number(existing.route_id) === Number(routeRow.id)) {
    return { row: existing, created: false, reset: false };
  }

  const firstChapter = await storyService.getFirstChapter(routeRow.id);

  if (existing) {
    await query(
      `UPDATE saves
          SET route_id = ?, chapter_id = ?, node_key = ?,
              affection_male = 0, affection_female = 0,
              state_json = NULL, play_seconds = 0
        WHERE id = ?`,
      [routeRow.id, firstChapter.id, firstChapter.start_node, existing.id]
    );
    const fresh = await getSaveRow(userId, slot);
    return { row: fresh, created: false, reset: true };
  }

  try {
    await query(
      `INSERT INTO saves (user_id, slot, route_id, chapter_id, node_key, affection_male, affection_female)
       VALUES (?, ?, ?, ?, ?, 0, 0)`,
      [userId, slot, routeRow.id, firstChapter.id, firstChapter.start_node]
    );
  } catch (err) {
    // 并发双击导致唯一键冲突时，直接读回来即可
    if (!err || err.code !== 'ER_DUP_ENTRY') throw err;
  }

  const row = await getSaveRow(userId, slot);
  return { row, created: true, reset: false };
}

/** 更新进度（节点/章节/好感/状态），可在外部事务里复用。 */
async function updateProgress(conn, saveId, patch) {
  const fields = [];
  const params = [];

  const assign = (column, value) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.chapterId !== undefined) assign('chapter_id', patch.chapterId);
  if (patch.nodeKey !== undefined) assign('node_key', patch.nodeKey);
  if (patch.affectionMale !== undefined) assign('affection_male', clampAffection(patch.affectionMale));
  if (patch.affectionFemale !== undefined) assign('affection_female', clampAffection(patch.affectionFemale));
  if (patch.state !== undefined) assign('state_json', patch.state === null ? null : JSON.stringify(patch.state));
  if (patch.playSeconds !== undefined) assign('play_seconds', patch.playSeconds);

  if (!fields.length) return;

  params.push(saveId);
  await conn.query(`UPDATE saves SET ${fields.join(', ')} WHERE id = ?`, params);
}

/** 累加游玩时长，单次上限由 schema 控制。 */
async function addPlaySeconds(saveId, seconds) {
  await query('UPDATE saves SET play_seconds = play_seconds + ? WHERE id = ?', [seconds, saveId]);
}

/**
 * 手动覆盖存档（前端本地计算模式 / 导入存档用）。
 * 会校验节点确实存在于该路线。
 */
async function upsertSave(userId, slot, payload) {
  const routeRow = await storyService.getRouteByCode(payload.routeCode);
  await storyService.mustGetNodePayload(routeRow.id, payload.nodeKey, payload.chapterId);

  const chapter = payload.chapterId
    ? await queryOne('SELECT * FROM chapters WHERE id = ? AND route_id = ? LIMIT 1', [
        payload.chapterId,
        routeRow.id,
      ])
    : null;

  const nextChapterId =
    chapter?.id ??
    (await storyService.getNodeRow(routeRow.id, payload.nodeKey))?.chapter_id ??
    null;

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO saves (user_id, slot, route_id, chapter_id, node_key,
                          affection_male, affection_female, state_json, play_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         route_id = VALUES(route_id),
         chapter_id = VALUES(chapter_id),
         node_key = VALUES(node_key),
         affection_male = VALUES(affection_male),
         affection_female = VALUES(affection_female),
         state_json = VALUES(state_json),
         play_seconds = VALUES(play_seconds)`,
      [
        userId,
        slot,
        routeRow.id,
        nextChapterId,
        payload.nodeKey,
        clampAffection(payload.affectionMale ?? 0),
        clampAffection(payload.affectionFemale ?? 0),
        payload.stateJson ? JSON.stringify(payload.stateJson) : null,
        payload.playSeconds ?? 0,
      ]
    );
  });

  return getSaveDetail(userId, slot);
}

async function deleteSave(userId, slot) {
  const result = await query('DELETE FROM saves WHERE user_id = ? AND slot = ?', [userId, slot]);
  if (!result.affectedRows) {
    throw new ApiError(404, ErrorCodes.SAVE_NOT_FOUND, `档位 ${slot} 没有存档`);
  }
  return true;
}

/** 写一条选择记录（回看功能的数据源）。 */
async function insertChoiceLog(conn, payload) {
  await conn.query(
    `INSERT INTO choice_logs
       (user_id, route_id, choice_id, node_key,
        affection_male_before, affection_female_before,
        affection_male_after, affection_female_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.userId,
      payload.routeId,
      payload.choiceId,
      payload.nodeKey,
      payload.before.male,
      payload.before.female,
      payload.after.male,
      payload.after.female,
    ]
  );
}

module.exports = {
  mapSave,
  getSaveRow,
  getSaveDetail,
  listSaves,
  countSaves,
  findOrCreateSave,
  updateProgress,
  addPlaySeconds,
  upsertSave,
  deleteSave,
  insertChoiceLog,
  parseStateJson,
};
