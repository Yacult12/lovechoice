'use strict';

const { query, queryOne } = require('../config/db');
const { ApiError, ErrorCodes } = require('../utils/errors');
const { toBool } = require('../utils/response');

/*
 * 所有「剧本读取」逻辑集中在这里。
 * 返回给前端的字段统一转成 camelCase，且选项不暴露 next_node_key，
 * 保证跳转由服务端裁决（防作弊）。
 */

function mapRoute(row) {
  return {
    id: row.id,
    routeCode: row.route_code,
    title: row.title,
    description: row.description,
    sortNo: row.sort_no,
    chapterCount: row.chapter_count !== undefined ? Number(row.chapter_count) : undefined,
    endingCount: row.ending_count !== undefined ? Number(row.ending_count) : undefined,
  };
}

function mapChapter(row) {
  return {
    id: row.id,
    routeId: row.route_id,
    chapterNo: row.chapter_no,
    title: row.title,
    startNode: row.start_node,
    isPublished: toBool(row.is_published),
  };
}

function mapOption(row) {
  return {
    optionKey: row.option_key,
    optionText: row.option_text,
    effectMale: row.effect_male,
    effectFemale: row.effect_female,
    sortNo: row.sort_no,
  };
}

function mapEnding(row, unlocked = false) {
  let condition = row.condition_json;
  if (typeof condition === 'string') {
    try {
      condition = JSON.parse(condition);
    } catch (err) {
      condition = null;
    }
  }
  return {
    id: row.id,
    routeId: row.route_id,
    endingKey: row.ending_key,
    title: row.title,
    description: row.description,
    isHidden: toBool(row.is_hidden),
    unlocked: Boolean(unlocked),
    // 隐藏结局在未解锁前不返回达成条件
    condition: toBool(row.is_hidden) && !unlocked ? null : condition,
  };
}

function mapNode(row, options = []) {
  return {
    nodeKey: row.node_key,
    speaker: row.speaker,
    content: row.content,
    bgKey: row.bg_key,
    type: row.node_type,
    nextNodeKey: row.next_node_key,
    chapterId: row.chapter_id,
    chapterNo: row.chapter_no !== undefined ? row.chapter_no : null,
    chapterTitle: row.chapter_title !== undefined ? row.chapter_title : null,
    options,
  };
}

// ------------------------------------------------------------
// 故事线 / 章节
// ------------------------------------------------------------

async function listRoutes() {
  const rows = await query(
    `SELECT r.*,
            (SELECT COUNT(*) FROM chapters c WHERE c.route_id = r.id AND c.is_published = 1) AS chapter_count,
            (SELECT COUNT(*) FROM endings e WHERE e.route_id = r.id) AS ending_count
       FROM routes r
      ORDER BY r.sort_no ASC, r.id ASC`
  );
  return rows.map(mapRoute);
}

async function getRouteRowByCode(routeCode) {
  return queryOne('SELECT * FROM routes WHERE route_code = ? LIMIT 1', [routeCode]);
}

async function getRouteByCode(routeCode) {
  const row = await getRouteRowByCode(routeCode);
  if (!row) {
    throw new ApiError(404, ErrorCodes.ROUTE_NOT_FOUND, `故事线不存在: ${routeCode}`);
  }
  return row;
}

async function listChapters(routeId, { publishedOnly = true } = {}) {
  const rows = await query(
    `SELECT * FROM chapters
      WHERE route_id = ? ${publishedOnly ? 'AND is_published = 1' : ''}
      ORDER BY chapter_no ASC`,
    [routeId]
  );
  return rows.map(mapChapter);
}

async function getChapterRow(routeId, chapterNo, { publishedOnly = true } = {}) {
  const row = await queryOne(
    `SELECT * FROM chapters
      WHERE route_id = ? AND chapter_no = ? ${publishedOnly ? 'AND is_published = 1' : ''}
      LIMIT 1`,
    [routeId, chapterNo]
  );
  if (!row) {
    throw new ApiError(404, ErrorCodes.CHAPTER_NOT_FOUND, `章节不存在: 第${chapterNo}章`);
  }
  return row;
}

/** 取该路线第一章（最小 chapter_no），用于新建存档。 */
async function getFirstChapter(routeId) {
  const row = await queryOne(
    `SELECT * FROM chapters
      WHERE route_id = ? AND is_published = 1
      ORDER BY chapter_no ASC LIMIT 1`,
    [routeId]
  );
  if (!row) {
    throw new ApiError(404, ErrorCodes.CHAPTER_NOT_FOUND, '该故事线还没有已发布的章节');
  }
  return row;
}

/** 取下一章：章节号严格大于当前章、且已发布。 */
async function getNextChapter(routeId, currentChapterNo) {
  return queryOne(
    `SELECT * FROM chapters
      WHERE route_id = ? AND chapter_no > ? AND is_published = 1
      ORDER BY chapter_no ASC LIMIT 1`,
    [routeId, currentChapterNo]
  );
}

// ------------------------------------------------------------
// 节点 / 选项
// ------------------------------------------------------------

/**
 * 按「路线 + 节点key」取节点。
 * node_key 只在章内唯一（uk_chapter_node），所以优先命中当前章节，
 * 否则退回同路线内章节号最小的那一份。
 */
async function getNodeRow(routeId, nodeKey, preferredChapterId = null) {
  return queryOne(
    `SELECT n.*, c.chapter_no, c.title AS chapter_title, c.is_published
       FROM scene_nodes n
       JOIN chapters c ON c.id = n.chapter_id
      WHERE c.route_id = ? AND n.node_key = ?
      ORDER BY (n.chapter_id = ?) DESC, c.chapter_no ASC
      LIMIT 1`,
    [routeId, nodeKey, preferredChapterId ?? 0]
  );
}

/** 章内精确定位节点：跨章跳转必须走这个（node_key 只在章内唯一）。 */
async function getNodeInChapter(chapterId, nodeKey) {
  return queryOne(
    `SELECT n.*, c.chapter_no, c.title AS chapter_title, c.is_published
       FROM scene_nodes n
       JOIN chapters c ON c.id = n.chapter_id
      WHERE n.chapter_id = ? AND n.node_key = ?
      LIMIT 1`,
    [chapterId, nodeKey]
  );
}

async function mustGetNodeInChapter(chapterId, nodeKey) {
  const row = await getNodeInChapter(chapterId, nodeKey);
  if (!row) {
    throw new ApiError(
      404,
      ErrorCodes.NODE_NOT_FOUND,
      `章节(ID=${chapterId})中找不到节点: ${nodeKey}`
    );
  }
  const options = row.node_type === 'choice' ? await listOptions(row.id) : [];
  return { row, payload: mapNode(row, options) };
}

async function listOptions(nodeId) {
  const rows = await query(
    `SELECT * FROM choices WHERE node_id = ? ORDER BY sort_no ASC, id ASC`,
    [nodeId]
  );
  return rows.map(mapOption);
}

/**
 * 取「可直接下发给前端的节点负载」，choice 节点带上选项列表。
 */
async function getNodePayload(routeId, nodeKey, preferredChapterId = null) {
  const row = await getNodeRow(routeId, nodeKey, preferredChapterId);
  if (!row) return null;
  const options = row.node_type === 'choice' ? await listOptions(row.id) : [];
  return { row, payload: mapNode(row, options) };
}

/** 校验并返回节点负载，不存在则抛 404。 */
async function mustGetNodePayload(routeId, nodeKey, preferredChapterId = null) {
  const found = await getNodePayload(routeId, nodeKey, preferredChapterId);
  if (!found) {
    throw new ApiError(404, ErrorCodes.NODE_NOT_FOUND, `剧情节点不存在: ${nodeKey}`);
  }
  return found;
}

async function getChoiceRow(routeId, nodeId, optionKey) {
  return queryOne(
    `SELECT ch.*
       FROM choices ch
       JOIN scene_nodes n ON n.id = ch.node_id
       JOIN chapters c ON c.id = n.chapter_id
      WHERE c.route_id = ? AND ch.node_id = ? AND ch.option_key = ?
      LIMIT 1`,
    [routeId, nodeId, optionKey]
  );
}

// ------------------------------------------------------------
// 章节剧本 / 整线剧本
// ------------------------------------------------------------

/** 取一章的完整剧本：{ chapter, nodes:[{...options}] } */
async function getChapterScript(routeId, chapterNo, { publishedOnly = true } = {}) {
  const chapterRow = await getChapterRow(routeId, chapterNo, { publishedOnly });

  const nodes = await query(
    'SELECT * FROM scene_nodes WHERE chapter_id = ? ORDER BY id ASC',
    [chapterRow.id]
  );

  let optionsByNode = new Map();
  if (nodes.length) {
    const ids = nodes.map((n) => n.id);
    const options = await query(
      `SELECT * FROM choices WHERE node_id IN (?) ORDER BY sort_no ASC, id ASC`,
      [ids]
    );
    optionsByNode = options.reduce((acc, opt) => {
      const list = acc.get(opt.node_id) ?? [];
      list.push(mapOption(opt));
      acc.set(opt.node_id, list);
      return acc;
    }, new Map());
  }

  return {
    chapter: mapChapter(chapterRow),
    nodes: nodes.map((n) => mapNode(n, optionsByNode.get(n.id) ?? [])),
  };
}

/** 取整条路线的剧本（按章节分组），用于前端预加载。 */
async function getRouteScript(routeCode) {
  const routeRow = await getRouteByCode(routeCode);
  const chapters = await listChapters(routeRow.id);
  const scripts = [];
  for (const chapter of chapters) {
    const script = await getChapterScript(routeRow.id, chapter.chapterNo);
    scripts.push(script);
  }
  return { route: mapRoute(routeRow), chapters: scripts };
}

// ------------------------------------------------------------
// 结局
// ------------------------------------------------------------

async function listEndings(routeId, unlockedIds = new Set()) {
  const rows = await query(
    'SELECT * FROM endings WHERE route_id = ? ORDER BY id ASC',
    [routeId]
  );
  return rows.map((row) => mapEnding(row, unlockedIds.has(row.id)));
}

async function listEndingsByCode(routeCode, unlockedIds = new Set()) {
  const routeRow = await getRouteByCode(routeCode);
  return { route: mapRoute(routeRow), endings: await listEndings(routeRow.id, unlockedIds) };
}

// ------------------------------------------------------------
// 剧本自检：找出断链、不可达节点、缺选项等
// ------------------------------------------------------------

async function validateRoute(routeCode) {
  const routeRow = await getRouteByCode(routeCode);
  const chapters = await listChapters(routeRow.id, { publishedOnly: false });

  const nodes = await query(
    `SELECT n.*, c.chapter_no
       FROM scene_nodes n
       JOIN chapters c ON c.id = n.chapter_id
      WHERE c.route_id = ?
      ORDER BY c.chapter_no ASC, n.id ASC`,
    [routeRow.id]
  );

  const nodeIds = nodes.map((n) => n.id);
  const options = nodeIds.length
    ? await query('SELECT * FROM choices WHERE node_id IN (?) ORDER BY sort_no ASC, id ASC', [nodeIds])
    : [];

  const optionsByNodeId = options.reduce((acc, opt) => {
    const list = acc.get(opt.node_id) ?? [];
    list.push(opt);
    acc.set(opt.node_id, list);
    return acc;
  }, new Map());

  // 节点 key 只在章内唯一，所以图上的点必须用「章号::key」标识
  const idOf = (chapterNo, key) => `${chapterNo}::${key}`;
  const byId = new Map(nodes.map((n) => [idOf(n.chapter_no, n.node_key), n]));
  const byKey = new Map();
  for (const n of nodes) {
    const list = byKey.get(n.node_key) ?? [];
    list.push(n);
    byKey.set(n.node_key, list);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.chapter_no - b.chapter_no);

  /** 与 playService 一致的跳转解析：优先本章，其次章节号最小的一章 */
  const resolve = (chapterNo, key) => {
    if (!key) return { node: null, crossChapter: false };
    const same = byId.get(idOf(chapterNo, key));
    if (same) return { node: same, crossChapter: false };
    const candidates = byKey.get(key) ?? [];
    if (!candidates.length) return { node: null, crossChapter: false };
    return { node: candidates[0], crossChapter: true };
  };

  const nextChapterOf = (chapterNo) =>
    chapters.find((c) => c.chapterNo > chapterNo) ?? null;

  const issues = [];

  // 1) 章节起始节点必须存在（chapters 已转成 camelCase）
  for (const c of chapters) {
    if (!byId.has(idOf(c.chapterNo, c.startNode))) {
      issues.push({
        level: 'error',
        type: 'CHAPTER_START_MISSING',
        chapterNo: c.chapterNo,
        message: `第${c.chapterNo}章的起始节点 ${c.startNode} 不存在`,
      });
    }
  }

  // 2) 跳转目标必须存在
  const edges = new Map(); // id -> [ids]
  const pushEdge = (fromId, toId) => {
    const list = edges.get(fromId) ?? [];
    list.push(toId);
    edges.set(fromId, list);
  };

  const checkTarget = (fromNode, key, meta) => {
    const { node: target, crossChapter } = resolve(fromNode.chapter_no, key);

    if (!target) {
      issues.push({
        level: 'error',
        type: meta.isChoice ? 'CHOICE_TARGET_MISSING' : 'NEXT_NODE_MISSING',
        chapterNo: fromNode.chapter_no,
        nodeKey: fromNode.node_key,
        optionKey: meta.optionKey,
        message: `${meta.label} 指向的节点 ${key} 不存在`,
      });
      return;
    }

    if (crossChapter) {
      issues.push({
        level: 'warning',
        type: 'CROSS_CHAPTER_REF',
        chapterNo: fromNode.chapter_no,
        nodeKey: fromNode.node_key,
        optionKey: meta.optionKey,
        message:
          `${meta.label} 跳到了别的章节（第${target.chapter_no}章的 ${key}）。` +
          '建议把章末 next_node_key 留空，让服务端自动进入下一章。',
      });
    }

    pushEdge(idOf(fromNode.chapter_no, fromNode.node_key), idOf(target.chapter_no, target.node_key));
  };

  for (const n of nodes) {
    const nodeOptions = optionsByNodeId.get(n.id) ?? [];

    if (n.node_type === 'choice') {
      if (!nodeOptions.length) {
        issues.push({
          level: 'error',
          type: 'CHOICE_EMPTY',
          chapterNo: n.chapter_no,
          nodeKey: n.node_key,
          message: `选项节点 ${n.node_key} 没有任何选项`,
        });
      }
      for (const opt of nodeOptions) {
        checkTarget(n, opt.next_node_key, {
          isChoice: true,
          optionKey: opt.option_key,
          label: `选项 ${n.node_key}/${opt.option_key}`,
        });
      }
    } else if (n.node_type === 'dialogue') {
      if (n.next_node_key) {
        checkTarget(n, n.next_node_key, { label: `对白节点 ${n.node_key} 的下一个节点` });
      } else {
        const nextChapter = nextChapterOf(n.chapter_no);
        if (nextChapter) {
          pushEdge(
            idOf(n.chapter_no, n.node_key),
            idOf(nextChapter.chapterNo, nextChapter.startNode)
          );
          issues.push({
            level: 'info',
            type: 'CHAPTER_END',
            chapterNo: n.chapter_no,
            nodeKey: n.node_key,
            message: `节点 ${n.node_key} 作为第${n.chapter_no}章的结尾，服务端会自动进入第${nextChapter.chapterNo}章`,
          });
        } else {
          issues.push({
            level: 'info',
            type: 'ROUTE_END',
            chapterNo: n.chapter_no,
            nodeKey: n.node_key,
            message: `节点 ${n.node_key} 是本线路的最后一个节点（没有下一章了）`,
          });
        }
      }
    } else if (n.node_type === 'ending') {
      if (n.next_node_key) {
        issues.push({
          level: 'warning',
          type: 'ENDING_HAS_NEXT',
          chapterNo: n.chapter_no,
          nodeKey: n.node_key,
          message: `结局节点 ${n.node_key} 的 next_node_key 会被忽略，建议留空`,
        });
      }
    }
  }

  // 3) 可达性分析：从各章起始节点出发做 BFS（跨章边界已被补成边）
  const reachable = new Set();
  const stack = chapters
    .map((c) => idOf(c.chapterNo, c.startNode))
    .filter((id) => byId.has(id));
  while (stack.length) {
    const id = stack.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const next of edges.get(id) ?? []) {
      if (!reachable.has(next)) stack.push(next);
    }
  }

  for (const n of nodes) {
    if (!reachable.has(idOf(n.chapter_no, n.node_key))) {
      issues.push({
        level: 'warning',
        type: 'UNREACHABLE_NODE',
        chapterNo: n.chapter_no,
        nodeKey: n.node_key,
        message: `节点 ${n.node_key}（第${n.chapter_no}章）从任何章节起始节点都无法到达`,
      });
    }
  }

  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warnCount = issues.filter((i) => i.level === 'warning').length;

  return {
    route: mapRoute(routeRow),
    ok: errorCount === 0,
    stats: {
      chapters: chapters.length,
      nodes: nodes.length,
      choiceNodes: nodes.filter((n) => n.node_type === 'choice').length,
      endingNodes: nodes.filter((n) => n.node_type === 'ending').length,
      choices: options.length,
      endings: (await listEndings(routeRow.id)).length,
      errorCount,
      warnCount,
    },
    issues,
  };
}

module.exports = {
  mapRoute,
  mapChapter,
  mapNode,
  mapOption,
  mapEnding,
  listRoutes,
  getRouteByCode,
  getRouteRowByCode,
  listChapters,
  getChapterRow,
  getFirstChapter,
  getNextChapter,
  getNodeRow,
  getNodeInChapter,
  mustGetNodeInChapter,
  listOptions,
  getNodePayload,
  mustGetNodePayload,
  getChoiceRow,
  getChapterScript,
  getRouteScript,
  listEndings,
  listEndingsByCode,
  validateRoute,
};
