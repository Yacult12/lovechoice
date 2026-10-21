'use strict';

/**
 * 从 JS 剧情数据生成 full_story.sql
 *   node scripts/build-story-sql.js
 *
 * 为什么要有这层间接：
 *   剧本有 10 章、约 90 个节点、30 个选项、10 个结局。
 *   手写 SQL 的话，node_key 写错一个就是死链，
 *   而且改一句台词要翻 SQL、找对行、改引号。
 *
 *   改成「JS 是唯一数据源，SQL 是生成物」之后：
 *     - 改台词只动 JS，跑一次脚本就同步
 *     - 死链在生成期就能查出来
 *     - 两条线的镜像关系可以用代码保证，不会因为手抖写偏
 *
 * 生成的 SQL 仍然提交进仓库，因为 Docker 初始化和 CI
 * 需要它，且它本身就是可审阅的「剧本快照」。
 */

const fs = require('fs');
const path = require('path');

const male = require('./story/male');
const female = require('./story/female');
const endings = require('./story/endings');

const OUT = path.resolve(__dirname, '..', 'sql', 'full_story.sql');

/** SQL 字符串字面量：转义单引号和反斜杠 */
function q(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
}

/** JSON 字面量：直接内嵌（条件里只有数字和字符串） */
function json(obj) {
  return q(JSON.stringify(obj));
}

const lines = [];
const w = (s = '') => lines.push(s);

w('-- ============================================================');
w('--  《他们的故事》完整剧本');
w('--');
w('--  ⚠️ 本文件由 scripts/build-story-sql.js 自动生成，请勿手改。');
w('--  要改剧情请改 scripts/story/*.js，然后跑：');
w('--      node scripts/build-story-sql.js');
w('--');
w('--  剧本约定（务必遵守）：');
w('--   1) node_key 只在「章内」唯一（uk_chapter_node），所以每章首节点都叫 n_start。');
w('--   2) 章末：dialogue 节点的 next_node_key 留 NULL —— 服务端会自动进入下一章首节点。');
w('--      ⚠️ 千万不要把章末的 next_node_key 写成 \'n_start\'，否则会跳回本章开头死循环。');
w('--   3) choice 节点自身不设 next_node_key，走向写在 choices.next_node_key。');
w('--   4) 最后一章的末节点指向 node_type=\'ending\' 的节点，进入即触发结局匹配。');
w('--');
w('--  结局判定顺序：非隐藏优先（按 id 升序）→ 隐藏结局。');
w('--  因此每个路由的条件都设计成互斥且完备。');
w('-- ============================================================');
w('');
w('SET NAMES utf8mb4;');
w('');
w('SET @r_male   := (SELECT id FROM routes WHERE route_code = \'male\');');
w('SET @r_female := (SELECT id FROM routes WHERE route_code = \'female\');');
w('');

// ---------- 清空 ----------
w('-- ------------------------------------------------------------');
w('-- 清空旧剧本');
w('--');
w('-- ⚠️ 进度数据必须一起清，原因是外键指向：');
w('--   saves.chapter_id  →  chapters.id');
w('--   choice_logs.node_id → scene_nodes.id');
w('--');
w('-- 重建章节时 MySQL 会分配新的 chapter_id（旧的被删掉了），');
w('-- 而旧的存档行还指着那些已经不存在的 chapter_id / node_key，');
w('-- 于是玩家一进来就报：');
w('--   剧情节点不存在: n_final        （HTTP 404）');
w('--');
w('-- 剧本已经整体重写了，旧的 node_key 全部对不上，');
w('-- 保留这些存档没有意义 —— 直接清空最干净。');
w('-- ------------------------------------------------------------');
w('DELETE cl FROM choice_logs cl;');
w('DELETE s FROM saves s;');
w('DELETE ch FROM choices ch;');
w('DELETE n FROM scene_nodes n;');
w('DELETE e FROM endings e;');
w('DELETE ue FROM user_endings ue;');
w('DELETE FROM chapters;');
w('');

// ---------- 角色立绘 ----------
w('-- ------------------------------------------------------------');
w('-- 角色立绘路径');
w('--   前端 pickAvatar() 用 base.replace(/[^/]+$/, name) 替换末段文件名，');
w('--   所以这里的末段只是个占位名，写什么都不影响显示。');
w('-- ------------------------------------------------------------');
w('UPDATE characters SET avatar_url = \'assets/img/avatar/male-soft.svg\'');
w(' WHERE route_id = @r_male AND char_key = \'male\';');
w('UPDATE characters SET avatar_url = \'assets/img/avatar/female-soft.svg\'');
w(' WHERE route_id = @r_male AND char_key = \'female\';');
w('UPDATE characters SET avatar_url = \'assets/img/avatar/female-soft.svg\'');
w(' WHERE route_id = @r_female AND char_key = \'female\';');
w('UPDATE characters SET avatar_url = \'assets/img/avatar/male-soft.svg\'');
w(' WHERE route_id = @r_female AND char_key = \'male\';');
w('');

// ---------- 章节 ----------
w('-- ------------------------------------------------------------');
w('-- 章节表：两条线各 5 章');
w('-- ------------------------------------------------------------');
w('INSERT INTO chapters (route_id, chapter_no, title, start_node, is_published) VALUES');
const chapterRows = [];
for (const [code, data] of [['male', male], ['female', female]]) {
  const v = code === 'male' ? '@r_male' : '@r_female';
  data.chapters.forEach((c) => {
    chapterRows.push(`  (${v}, ${c.no}, ${q(c.title)}, 'n_start', 1)`);
  });
}
w(chapterRows.join(',\n') + ';');
w('');

// ---------- 节点与选项 ----------
function emitRoute(code, data) {
  const v = code === 'male' ? '@r_male' : '@r_female';
  const label = code === 'male' ? '他' : '她';

  w('-- ============================================================');
  w(`--  ${label}主线`);
  w('-- ============================================================');
  w('');

  data.chapters.forEach((ch) => {
    w(`-- ---------- ${ch.title} ----------`);

    ch.nodes.forEach((n) => {
      const isChoice = n.type === 'choice';
      const type = isChoice ? 'choice' : 'dialogue';
      const next = isChoice ? 'NULL' : (n.next ? q(n.next) : 'NULL');

      w('INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)');
      w(`SELECT c.id, ${q(n.key)}, ${q(n.speaker)},`);
      w(`       ${q(n.content)},`);
      w(`       ${q(n.bg || ch.bg)}, ${q(type)}, ${next}`);
      w(`FROM chapters c WHERE c.route_id = ${v} AND c.chapter_no = ${ch.no};`);
      w('');
    });

    // 选项
    ch.nodes.filter((n) => n.type === 'choice').forEach((n) => {
      n.options.forEach((o, i) => {
        w('INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)');
        w(`SELECT sn.id, ${q(o.key)}, ${q(o.text)}, ${q(o.next)}, ${o.m || 0}, ${o.f || 0}, ${i + 1}`);
        w('FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id');
        w(`WHERE c.route_id = ${v} AND c.chapter_no = ${ch.no} AND sn.node_key = ${q(n.key)};`);
        w('');
      });
    });
  });
}

emitRoute('male', male);
emitRoute('female', female);

// ---------- 结局 ----------
w('-- ============================================================');
w('-- 结局定义');
w('--   判定顺序：非隐藏优先 → 隐藏。条件互斥且完备。');
w('-- ============================================================');
w('');
for (const code of ['male', 'female']) {
  const v = code === 'male' ? '@r_male' : '@r_female';
  const label = code === 'male' ? '他' : '她';
  w(`-- ${label}线`);
  w('INSERT INTO endings (route_id, ending_key, title, description, condition_json, is_hidden) VALUES');
  const rows = endings[code].map((e) => {
    return `  (${v}, ${q(e.key)}, ${q(e.title)},\n   ${q(e.description)},\n   ${json(e.condition)}, ${e.isHidden})`;
  });
  w(rows.join(',\n') + ';');
  w('');
}

w('-- ------------------------------------------------------------');
w('-- 自检：');
w('--   SELECT COUNT(*) FROM routes;      -- 应为 2');
w('--   SELECT COUNT(*) FROM chapters;    -- 应为 10');
w('--   SELECT COUNT(*) FROM scene_nodes; -- 应为 ' +
  (male.chapters.concat(female.chapters).reduce((s, c) => s + c.nodes.length, 0)));
w('--   SELECT COUNT(*) FROM choices;     -- 应为 ' +
  (male.chapters.concat(female.chapters).reduce((s, c) => s + c.nodes.filter((n) => n.type === 'choice').reduce((t, n) => t + n.options.length, 0), 0)));
w('--   SELECT COUNT(*) FROM endings;     -- 应为 ' + (endings.male.length + endings.female.length));
w('-- ------------------------------------------------------------');

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');

const kb = (Buffer.byteLength(lines.join('\n'), 'utf8') / 1024).toFixed(1);
console.log(`已生成 ${OUT}`);
console.log(`  ${kb} KB · ${lines.length} 行`);
console.log(`  章节 ${chapterRows.length} · 结局 ${endings.male.length + endings.female.length}`);
