'use strict';

const config = require('../config');
const { query, queryOne, withTransaction } = require('../config/db');
const { ApiError, ErrorCodes } = require('../utils/errors');
const { clampAffection } = require('../utils/game');
const storyService = require('./storyService');
const saveService = require('./saveService');
const endingService = require('./endingService');

/*
 * 「跑剧情」的核心：服务端权威推进。
 * 前端只上报「我在哪个节点、点了哪个选项」，好感度与跳转一律由服务器裁决，
 * 这样 choice_logs / saves / 结局解锁才能保证一致。
 */

async function loadContext(userId, routeCode, slot, { createIfMissing = true } = {}) {
  const routeRow = await storyService.getRouteByCode(routeCode);

  if (createIfMissing) {
    const { row, created, reset } = await saveService.findOrCreateSave(userId, slot, routeRow);
    return { routeRow, saveRow: row, created, reset };
  }

  const row = await saveService.getSaveRow(userId, slot);
  if (!row) {
    throw new ApiError(404, ErrorCodes.SAVE_NOT_FOUND, `档位 ${slot} 还没有存档，请先开始游戏`);
  }
  if (Number(row.route_id) !== Number(routeRow.id)) {
    throw new ApiError(409, ErrorCodes.SAVE_ROUTE_CONFLICT, '该档位被另一条故事线占用，请换档位');
  }
  return { routeRow, saveRow: row, created: false, reset: false };
}

function assertNodeMatches(saveRow, nodeKey) {
  if (!config.game.strictPlay) return;
  if (saveRow.node_key !== nodeKey) {
    throw new ApiError(
      409,
      ErrorCodes.NODE_MISMATCH,
      `进度不一致：服务端记录在 ${saveRow.node_key}，本次请求是 ${nodeKey}，请重新同步存档`,
      { serverNodeKey: saveRow.node_key, clientNodeKey: nodeKey }
    );
  }
}

async function getChapterRowById(chapterId) {
  if (!chapterId) return null;
  return queryOne('SELECT * FROM chapters WHERE id = ? LIMIT 1', [chapterId]);
}

/**
 * 统一组装返回体。
 */
async function buildState({ routeRow, saveRow, nodeFound, extra = {} }) {
  const chapter = await getChapterRowById(saveRow.chapter_id);
  return {
    save: saveService.mapSave(saveRow, {
      routeCode: routeRow.route_code,
      chapterNo: chapter ? chapter.chapter_no : null,
      chapterTitle: chapter ? chapter.title : null,
    }),
    node: nodeFound ? nodeFound.payload : null,
    ...extra,
  };
}

/**
 * 到达 ending 节点时结算：匹配结局 + 解锁 + 返回给前端。
 */
async function settleEnding(userId, routeRow, saveRow) {
  const state = saveService.parseStateJson(saveRow.state_json);
  const ctx = {
    affectionMale: saveRow.affection_male,
    affectionFemale: saveRow.affection_female,
    playSeconds: saveRow.play_seconds,
    flags: state.flags ?? {},
  };

  const endingRow = await endingService.findMatchingEnding(routeRow.id, ctx);

  if (!endingRow) {
    return {
      ended: true,
      noEndingMatched: true,
      ending: null,
      affection: { male: saveRow.affection_male, female: saveRow.affection_female },
    };
  }

  const newlyUnlocked = await endingService.unlockEnding(userId, endingRow.id, routeRow.id);

  return {
    ended: true,
    noEndingMatched: false,
    newlyUnlocked,
    ending: storyService.mapEnding(endingRow, true),
    affection: { male: saveRow.affection_male, female: saveRow.affection_female },
  };
}

/**
 * 进入 ending 节点之后要做的收尾（当前实现：只做结算，不改进度）。
 */
async function maybeSettle(userId, routeRow, saveRow, nodeFound) {
  if (!nodeFound || nodeFound.row.node_type !== 'ending') return {};
  return settleEnding(userId, routeRow, saveRow);
}

/** 开始 / 继续游戏。 */
async function start(userId, { routeCode, slot }) {
  const { routeRow, saveRow, created, reset } = await loadContext(userId, routeCode, slot);

  const nodeFound = await storyService.mustGetNodePayload(
    routeRow.id,
    saveRow.node_key,
    saveRow.chapter_id
  );

  const extra = await maybeSettle(userId, routeRow, saveRow, nodeFound);
  return buildState({
    routeRow,
    saveRow,
    nodeFound,
    extra: { ...extra, created, reset, resumed: !created && !reset },
  });
}

/** 只读当前状态（不创建存档）。 */
async function state(userId, { routeCode, slot }) {
  const { routeRow, saveRow } = await loadContext(userId, routeCode, slot, {
    createIfMissing: false,
  });

  const nodeFound = await storyService.getNodePayload(
    routeRow.id,
    saveRow.node_key,
    saveRow.chapter_id
  );

  return buildState({
    routeRow,
    saveRow,
    nodeFound,
    extra: { warning: nodeFound ? undefined : `节点 ${saveRow.node_key} 已不在剧本中，可能剧本被改动过` },
  });
}

/** 线性对白推进；节点没有下一节点时自动进入下一章。 */
async function advance(userId, { routeCode, slot, nodeKey }) {
  const { routeRow, saveRow } = await loadContext(userId, routeCode, slot);
  assertNodeMatches(saveRow, nodeKey);

  const current = await storyService.mustGetNodePayload(
    routeRow.id,
    nodeKey,
    saveRow.chapter_id
  );

  if (current.row.node_type === 'ending') {
    const extra = await settleEnding(userId, routeRow, saveRow);
    return buildState({ routeRow, saveRow, nodeFound: current, extra });
  }

  if (current.row.node_type === 'choice') {
    throw new ApiError(
      400,
      ErrorCodes.NOT_A_CHOICE_NODE,
      '当前是选项节点，请调用 /api/play/choice 提交选择'
    );
  }

  let nextFound = null;
  let chapterComplete = false;
  let finished = false;
  let nextChapterNo = null;

  if (current.row.next_node_key) {
    nextFound = await storyService.mustGetNodePayload(
      routeRow.id,
      current.row.next_node_key,
      saveRow.chapter_id
    );
  } else {
    // 章末：交给服务端进入下一章
    const currentChapter = await getChapterRowById(saveRow.chapter_id);
    const nextChapter = await storyService.getNextChapter(
      routeRow.id,
      currentChapter ? currentChapter.chapter_no : 0
    );

    if (!nextChapter) {
      finished = true;
    } else {
      chapterComplete = true;
      nextChapterNo = nextChapter.chapter_no;
      nextFound = await storyService.mustGetNodeInChapter(nextChapter.id, nextChapter.start_node);
    }
  }

  let fresh = saveRow;
  if (nextFound) {
    await withTransaction(async (conn) => {
      await saveService.updateProgress(conn, saveRow.id, {
        chapterId: nextFound.row.chapter_id,
        nodeKey: nextFound.row.node_key,
      });
    });
    fresh = await saveService.getSaveRow(userId, slot);
  }

  const extra = { chapterComplete, nextChapterNo, finished };
  Object.assign(extra, await maybeSettle(userId, routeRow, fresh, nextFound));

  return buildState({ routeRow, saveRow: fresh, nodeFound: nextFound, extra });
}

/** 提交一次选择：结算好感 + 写日志 + 推进。 */
async function choose(userId, { routeCode, slot, nodeKey, optionKey }) {
  const { routeRow, saveRow } = await loadContext(userId, routeCode, slot);
  assertNodeMatches(saveRow, nodeKey);

  const current = await storyService.mustGetNodePayload(
    routeRow.id,
    nodeKey,
    saveRow.chapter_id
  );

  if (current.row.node_type !== 'choice') {
    throw new ApiError(400, ErrorCodes.NOT_A_CHOICE_NODE, '当前节点不是选项节点');
  }

  const choiceRow = await storyService.getChoiceRow(routeRow.id, current.row.id, optionKey);
  if (!choiceRow) {
    throw new ApiError(404, ErrorCodes.OPTION_NOT_FOUND, `选项不存在: ${optionKey}`);
  }

  const before = {
    male: saveRow.affection_male,
    female: saveRow.affection_female,
  };
  const after = {
    male: clampAffection(before.male + choiceRow.effect_male),
    female: clampAffection(before.female + choiceRow.effect_female),
  };

  let nextFound = null;
  let chapterComplete = false;
  let finished = false;
  let nextChapterNo = null;

  if (choiceRow.next_node_key) {
    nextFound = await storyService.mustGetNodePayload(
      routeRow.id,
      choiceRow.next_node_key,
      saveRow.chapter_id
    );
  } else {
    // 选项是本章最后一个节点：直接结算本章
    const currentChapter = await getChapterRowById(saveRow.chapter_id);
    const nextChapter = await storyService.getNextChapter(
      routeRow.id,
      currentChapter ? currentChapter.chapter_no : 0
    );
    if (!nextChapter) {
      finished = true;
    } else {
      chapterComplete = true;
      nextChapterNo = nextChapter.chapter_no;
      nextFound = await storyService.mustGetNodeInChapter(nextChapter.id, nextChapter.start_node);
    }
  }

  await withTransaction(async (conn) => {
    await saveService.updateProgress(conn, saveRow.id, {
      chapterId: nextFound ? nextFound.row.chapter_id : saveRow.chapter_id,
      nodeKey: nextFound ? nextFound.row.node_key : saveRow.node_key,
      affectionMale: after.male,
      affectionFemale: after.female,
    });
    await saveService.insertChoiceLog(conn, {
      userId,
      routeId: routeRow.id,
      choiceId: choiceRow.id,
      nodeKey,
      before,
      after,
    });
  });

  const fresh = await saveService.getSaveRow(userId, slot);

  const extra = {
    effects: { male: choiceRow.effect_male, female: choiceRow.effect_female },
    affection: after,
    delta: { male: after.male - before.male, female: after.female - before.female },
    choice: {
      optionKey: choiceRow.option_key,
      optionText: choiceRow.option_text,
    },
    chapterComplete,
    nextChapterNo,
    finished,
  };
  Object.assign(extra, await maybeSettle(userId, routeRow, fresh, nextFound));

  return buildState({ routeRow, saveRow: fresh, nodeFound: nextFound, extra });
}

/** 跳到指定章节（章节选择 / 重玩某章）。 */
async function enterChapter(userId, { routeCode, slot, chapterNo }) {
  const { routeRow, saveRow } = await loadContext(userId, routeCode, slot);

  const chapter = await storyService.getChapterRow(routeRow.id, chapterNo);
  const nodeFound = await storyService.mustGetNodeInChapter(chapter.id, chapter.start_node);

  await withTransaction(async (conn) => {
    await saveService.updateProgress(conn, saveRow.id, {
      chapterId: chapter.id,
      nodeKey: nodeFound.row.node_key,
    });
  });

  const fresh = await saveService.getSaveRow(userId, slot);
  const extra = { chapterComplete: false, chapterEntered: chapter.chapter_no };
  Object.assign(extra, await maybeSettle(userId, routeRow, fresh, nodeFound));

  return buildState({ routeRow, saveRow: fresh, nodeFound, extra });
}

/** 主动结算当前好感对应的结局（例如从存档页触发「看结局」）。 */
async function settle(userId, { routeCode, slot }) {
  const { routeRow, saveRow } = await loadContext(userId, routeCode, slot);
  const extra = await settleEnding(userId, routeRow, saveRow);
  return buildState({ routeRow, saveRow, nodeFound: null, extra });
}

/** 累计游玩时长。 */
async function tick(userId, { routeCode, slot, seconds }) {
  const { routeRow, saveRow } = await loadContext(userId, routeCode, slot, {
    createIfMissing: false,
  });
  await saveService.addPlaySeconds(saveRow.id, seconds);
  const fresh = await saveService.getSaveRow(userId, slot);
  return buildState({ routeRow, saveRow: fresh, nodeFound: null, extra: { addedSeconds: seconds } });
}

/**
 * 隐藏互动结算：牵手 / 擦眼泪 / 披外套 …
 *
 * 与「选择」不同，这里**不推进剧情、不写 choice_logs** ——
 * 它是发生在一个节点之内的动作，不构成叙事分叉。
 * 只做三件事：加好感、把 flag 写进 state（防一次性互动重复触发）、返回最新状态。
 *
 * 好感增量由前端按互动定义回传；服务端只保证不越界（schema 限 ±50，clampAffection 再夹一次）。
 */
async function gesture(userId, { routeCode, slot, nodeKey, gestureId, effectMale, effectFemale }) {
  const { routeRow, saveRow } = await loadContext(userId, routeCode, slot, { createIfMissing: false });

  // 互动必须发生在对白节点上，不能在选项/结局时乱触发
  const current = await storyService.mustGetNodePayload(routeRow.id, nodeKey, saveRow.chapter_id);
  if (current.row.node_type !== 'dialogue') {
    throw new ApiError(400, ErrorCodes.INVALID_NODE_TYPE, '当前不是对白节点，无法触发互动');
  }

  const state = saveService.parseStateJson(saveRow.state_json);
  const flags = state.flags ?? {};
  const flagKey = `gx_${gestureId}`;
  const alreadyDone = Boolean(flags[flagKey]);

  // 已经触发过的（一次性互动）直接幂等返回，不重复加好感
  if (alreadyDone) {
    const fresh = await saveService.getSaveRow(userId, slot);
    return buildState({
      routeRow,
      saveRow: fresh,
      nodeFound: current,
      extra: { gesture: { id: gestureId, applied: false, alreadyDone: true }, delta: { male: 0, female: 0 } },
    });
  }

  const before = { male: saveRow.affection_male, female: saveRow.affection_female };
  const after = { male: before.male + effectMale, female: before.female + effectFemale };

  flags[flagKey] = 1;
  state.flags = flags;

  await withTransaction(async (conn) => {
    await saveService.updateProgress(conn, saveRow.id, {
      affectionMale: after.male,
      affectionFemale: after.female,
      state,
    });
  });

  const fresh = await saveService.getSaveRow(userId, slot);
  return buildState({
    routeRow,
    saveRow: fresh,
    nodeFound: current,
    extra: {
      gesture: { id: gestureId, applied: true, alreadyDone: false },
      affection: after,
      delta: { male: after.male - before.male, female: after.female - before.female },
    },
  });
}

module.exports = {
  start, state, advance, choose, enterChapter, settle, tick, gesture, settleEnding,
};
