-- ============================================================
--  《他们的故事》完整剧本
--
--  ⚠️ 本文件由 scripts/build-story-sql.js 自动生成，请勿手改。
--  要改剧情请改 scripts/story/*.js，然后跑：
--      node scripts/build-story-sql.js
--
--  剧本约定（务必遵守）：
--   1) node_key 只在「章内」唯一（uk_chapter_node），所以每章首节点都叫 n_start。
--   2) 章末：dialogue 节点的 next_node_key 留 NULL —— 服务端会自动进入下一章首节点。
--      ⚠️ 千万不要把章末的 next_node_key 写成 'n_start'，否则会跳回本章开头死循环。
--   3) choice 节点自身不设 next_node_key，走向写在 choices.next_node_key。
--   4) 最后一章的末节点指向 node_type='ending' 的节点，进入即触发结局匹配。
--
--  结局判定顺序：非隐藏优先（按 id 升序）→ 隐藏结局。
--  因此每个路由的条件都设计成互斥且完备。
-- ============================================================

SET NAMES utf8mb4;

SET @r_male   := (SELECT id FROM routes WHERE route_code = 'male');
SET @r_female := (SELECT id FROM routes WHERE route_code = 'female');

-- ------------------------------------------------------------
-- 清空旧剧本
--
-- ⚠️ 进度数据必须一起清，原因是外键指向：
--   saves.chapter_id  →  chapters.id
--   choice_logs.node_id → scene_nodes.id
--
-- 重建章节时 MySQL 会分配新的 chapter_id（旧的被删掉了），
-- 而旧的存档行还指着那些已经不存在的 chapter_id / node_key，
-- 于是玩家一进来就报：
--   剧情节点不存在: n_final        （HTTP 404）
--
-- 剧本已经整体重写了，旧的 node_key 全部对不上，
-- 保留这些存档没有意义 —— 直接清空最干净。
-- ------------------------------------------------------------
DELETE cl FROM choice_logs cl;
DELETE s FROM saves s;
DELETE ch FROM choices ch;
DELETE n FROM scene_nodes n;
DELETE e FROM endings e;
DELETE ue FROM user_endings ue;
DELETE FROM chapters;

-- ------------------------------------------------------------
-- 角色立绘路径
--   前端 pickAvatar() 用 base.replace(/[^/]+$/, name) 替换末段文件名，
--   所以这里的末段只是个占位名，写什么都不影响显示。
-- ------------------------------------------------------------
UPDATE characters SET avatar_url = 'assets/img/avatar/male-soft.svg'
 WHERE route_id = @r_male AND char_key = 'male';
UPDATE characters SET avatar_url = 'assets/img/avatar/female-soft.svg'
 WHERE route_id = @r_male AND char_key = 'female';
UPDATE characters SET avatar_url = 'assets/img/avatar/female-soft.svg'
 WHERE route_id = @r_female AND char_key = 'female';
UPDATE characters SET avatar_url = 'assets/img/avatar/male-soft.svg'
 WHERE route_id = @r_female AND char_key = 'male';

-- ------------------------------------------------------------
-- 章节表：两条线各 5 章
-- ------------------------------------------------------------
INSERT INTO chapters (route_id, chapter_no, title, start_node, is_published) VALUES
  (@r_male, 1, '第一章 · 初遇', 'n_start', 1),
  (@r_male, 2, '第二章 · 相处', 'n_start', 1),
  (@r_male, 3, '第三章 · 矛盾', 'n_start', 1),
  (@r_male, 4, '第四章 · 别离', 'n_start', 1),
  (@r_male, 5, '第五章 · 圆满', 'n_start', 1),
  (@r_female, 1, '第一章 · 初遇', 'n_start', 1),
  (@r_female, 2, '第二章 · 相处', 'n_start', 1),
  (@r_female, 3, '第三章 · 矛盾', 'n_start', 1),
  (@r_female, 4, '第四章 · 别离', 'n_start', 1),
  (@r_female, 5, '第五章 · 圆满', 'n_start', 1);

-- ============================================================
--  他主线
-- ============================================================

-- ---------- 第一章 · 初遇 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十月，朋友组的聚会。你在人群边缘看见一个女生，好像在等谁，又好像只是站着。',
       'party', 'dialogue', 'n_m1_c1'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_c1', '旁白',
       '她朝你这边看了一眼。你有三秒钟决定要不要过去。',
       'party', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_a1', '你',
       '你走过去，把「你喜欢猫还是狗」「你怕不怕冷」这类问题提前排好顺序。她笑着听完，说你怎么跟背课文似的。你说没有啊，我只是记性好。',
       'party', 'dialogue', 'n_m1_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_b1', '你',
       '你走过去，聊了几句，转头把刚才约的朋友也叫了过来。她愣了一下，说这样挺好的。',
       'party', 'dialogue', 'n_m1_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_d1', '你',
       '你没动。整晚你都在跟老同学聊从前的事，散场时回头，她已经不在了。',
       'party', 'dialogue', 'n_m1_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_c2', '旁白',
       '那天之后，你开始等她的消息。她的回复通常在两分钟以内，偶尔会晚一点。',
       'party', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_a2', '你',
       '你算过，她的活跃时间在二十一点前后。你把晚上的事都推了，手机放在枕边，屏幕亮一次你看一次。',
       'party', 'dialogue', 'n_m1_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_b2', '你',
       '你第一次在十二点前睡着，醒来发现她发来三条消息。你回得比以前慢，但心情很好。',
       'party', 'dialogue', 'n_m1_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_d2', '你',
       '你把她设成了免打扰。头几天你总想去解除设置，后来就没再管过。',
       'party', 'dialogue', 'n_m1_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_end', '旁白',
       '你以为你在追一个人。后来才发现，你追的是她给你的那种被需要的感觉。',
       'party', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c1_approach', '走过去，把她随口说过的喜好都记下来', 'n_m1_a1', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND sn.node_key = 'n_m1_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c1_join', '走过去聊两句，也顺手约上了自己的朋友', 'n_m1_b1', 8, 6, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND sn.node_key = 'n_m1_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c1_ignore', '继续跟朋友聊，她来不来都无所谓', 'n_m1_d1', 8, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND sn.node_key = 'n_m1_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c2_wait', '每晚刷新，确认她最后一条动态的时间', 'n_m1_a2', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND sn.node_key = 'n_m1_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c2_sleep', '把手机扣在桌上，先睡够', 'n_m1_b2', 8, 6, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND sn.node_key = 'n_m1_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c2_mute', '把她的聊天设成免打扰，专心做自己的事', 'n_m1_d2', 7, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND sn.node_key = 'n_m1_c2';

-- ---------- 第二章 · 相处 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '在一起三个月。约会你提前做好攻略，礼物你提前一个月订，她的口味你记得比自己的还清楚。',
       'street', 'dialogue', 'n_m2_c1'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_c1', '旁白',
       '她最近常在忙。你想知道她在忙什么。',
       'street', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_a1', '你',
       '屏幕在你手里亮着。你看得很仔细，连她和谁用同一个表情包都记住了。你把手机还回去的时候，手心是汗。',
       'street', 'dialogue', 'n_m2_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_b1', '你',
       '你发完那句「玩得开心吗」，把手机扣下，去把拖了两周的球打了。她回了一个表情，你笑了一下。',
       'street', 'dialogue', 'n_m2_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_c1x', '旁白',
       '她愣了一下，说「好」。那之后她报备的次数反而变少了。',
       'street', 'dialogue', 'n_m2_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_d1', '你',
       '你把手机放回口袋。她后来发来的消息你隔了几个小时才回，回的时候已经不太记得她说了什么。',
       'street', 'dialogue', 'n_m2_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_c2', '旁白',
       '晚上她给你打电话，一开口就是「我好累」。你很想帮她。',
       'street', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_a2', '你',
       '你说得很在理，还帮她把明天该怎么跟对方说都想好了。她「嗯」了一声，然后说「我知道了」。',
       'street', 'dialogue', 'n_m2_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_b2', '你',
       '你什么都没建议，只是一直「嗯嗯」。挂了电话她说「谢谢你听我说完」。这句话你记了很久。',
       'street', 'dialogue', 'n_m2_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_c2x', '旁白',
       '电话挂了。她没有再打过来，你也没有再问。',
       'street', 'dialogue', 'n_m2_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_d2', '你',
       '你挂了电话，翻身睡了。醒来的时候你想起她昨天好像找过你，但你想不起是什么事。',
       'street', 'dialogue', 'n_m2_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_end', '旁白',
       '你把在乎变成了管，把体贴变成了安排。她一开始觉得被珍惜，后来只觉得喘不过气。',
       'street', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_check', '翻她手机，看她今天都和谁在一起', 'n_m2_a1', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_trust', '只发一句「玩得开心吗」，然后去做自己的事', 'n_m2_b1', 8, 7, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_cold', '直接说「你去吧，不用解释」', 'n_m2_c1x', -7, -6, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_alone', '算了，她忙她的，我也忙我的', 'n_m2_d1', 8, -7, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_solve', '立刻讲道理，给她三套解决方案', 'n_m2_a2', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_listen', '先安静听完，再问一句「然后呢」', 'n_m2_b2', 8, 7, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_brief', '嗯两声，说「我有点累，先这样」', 'n_m2_c2x', -7, -6, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_alone', '「我也挺累的，改天再说」', 'n_m2_d2', 8, -7, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND sn.node_key = 'n_m2_c2';

-- ---------- 第三章 · 矛盾 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '同一件事，第三次出现了。你已经能预见她会怎么开头。',
       'cafe', 'dialogue', 'n_m3_c1'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_c1', '旁白',
       '你很累。',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_a1', '你',
       '你说「没事的，我不介意」。她松了口气。你也松了口气——虽然你知道自己很介意。',
       'cafe', 'dialogue', 'n_m3_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_b1', '你',
       '你说完就后悔了，怕她觉得你在推开她。她沉默了几秒，说「好，我给你空间」。这句话你听不出是松了口气还是失望。',
       'cafe', 'dialogue', 'n_m3_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_c1x', '旁白',
       '你们各坐一边，咖啡凉透了。谁也没开口，因为开口就意味着先承认自己受不了。',
       'cafe', 'dialogue', 'n_m3_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_d1', '旁白',
       '你结了账，起身走了。她在后面叫了你一声，你没回头。',
       'cafe', 'dialogue', 'n_m3_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_c2', '旁白',
       '深夜你翻来覆去，脑子里只有一句：也许我们真的不合适。',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_a2', '你',
       '你把话说得很轻，说她最近工作太忙了。她信了，或者说，她选择信了。',
       'cafe', 'dialogue', 'n_m3_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_b2', '你',
       '「我好像在这段关系里，越活越不像我自己。」你说完，手在抖。但说出来的那一刻，你轻了一点。',
       'cafe', 'dialogue', 'n_m3_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_d2', '你',
       '你把要说的话删掉，把她的联系方式删掉，然后好好睡了一觉。醒来心里空空的，但也安静。',
       'cafe', 'dialogue', 'n_m3_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_end', '旁白',
       '喜欢的时候要勇敢，被消耗的时候也要勇敢。拖着不放手，不叫坚持，叫舍不得自己。',
       'cafe', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_endure', '再忍忍，也许以后她会变好', 'n_m3_a1', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND sn.node_key = 'n_m3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_speak', '说出来：我最近需要一点自己的空间', 'n_m3_b1', 8, 6, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND sn.node_key = 'n_m3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_quiet', '谁也不说话，看谁先低头', 'n_m3_c1x', -7, -6, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND sn.node_key = 'n_m3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_leave', '算了，我先去一个人待会儿', 'n_m3_d1', 8, -7, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND sn.node_key = 'n_m3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c6_hold', '假装没事，把所有的念头都咽下去', 'n_m3_a2', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND sn.node_key = 'n_m3_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c6_admit', '承认这段关系在消耗我', 'n_m3_b2', 8, 5, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND sn.node_key = 'n_m3_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c6_leave', '想清楚了，我该走了', 'n_m3_d2', 8, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND sn.node_key = 'n_m3_c2';

-- ---------- 第四章 · 别离 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '最后还是分开了。理由很杂，但你们都知道是什么。',
       'rain', 'dialogue', 'n_m4_c1'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_c1', '旁白',
       '分开后的第一周，你把聊天记录翻到了最开始。',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_a1', '你',
       '你翻到很早以前的一条语音，那天她说「今天特别开心，因为下雨了」。你听着听着就哭了。',
       'rain', 'dialogue', 'n_m4_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_b1', '你',
       '你把手机放进口袋，出了门。外面在下雨，你没带伞，走着走着反而舒服了一点。',
       'rain', 'dialogue', 'n_m4_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_c1x', '你',
       '删得很干净，干净到第二天你想发消息时，手指停在「发送」上面，不知道该发给谁。',
       'rain', 'dialogue', 'n_m4_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_d1', '你',
       '这一周你谁也没见。第八天你想起她，发现自己已经想不起她说话的样子了。',
       'rain', 'dialogue', 'n_m4_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_c2', '旁白',
       '你开始怀疑，是不是自己不够好。',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_a2', '你',
       '你把所有错都揽到自己身上，像揽一件行李，仿佛只要你足够自责，结局就能重来一次。',
       'rain', 'dialogue', 'n_m4_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_b2', '你',
       '不是所有相爱都能走到最后。有些人不是不好，只是不适合并肩。放过她，也是放过那个困住的你。',
       'rain', 'dialogue', 'n_m4_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_c2x', '旁白',
       '你把门关上得很响，然后站在门后很久，一句话也说不出来。',
       'rain', 'dialogue', 'n_m4_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_d2', '你',
       '你把她的照片从手机里移走，也从心里移走。移走的时候你以为会疼，结果只是空。',
       'rain', 'dialogue', 'n_m4_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_end', '旁白',
       '放下不是遗忘。你把回忆收好，然后继续走。',
       'rain', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_scroll', '翻遍记录，想找一句话把她劝回来', 'n_m4_a1', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_stop', '关掉手机，去过自己的这一周', 'n_m4_b1', 8, 4, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_erase', '删掉所有联系方式，清得干干净净', 'n_m4_c1x', -7, -6, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_alone', '这周我想一个人过，谁也不见', 'n_m4_d1', 8, -7, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_blame', '认定是自己失败，自己不配被喜欢', 'n_m4_a2', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_fact', '承认只是不合适，不是谁的错', 'n_m4_b2', 8, 6, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_cut', '把她的号码也删掉，假装从没存在过', 'n_m4_c2x', -7, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_alone', '我一个人也挺好的，不用谁来证明', 'n_m4_d2', 8, -7, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND sn.node_key = 'n_m4_c2';

-- ---------- 第五章 · 圆满 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '一年后。你有固定的朋友，有雷打不动的球场，有几个睡不着的晚上，也有几个睡得很好的早上。',
       'dailylife', 'dialogue', 'n_m5_c1'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_c1', '旁白',
       '新认识的人问你在忙什么。你想了想。',
       'dailylife', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_a1', '你',
       '你说完自己就笑了。笑得很轻，像在承认一件有点丢人、但也不打算改的事。',
       'dailylife', 'dialogue', 'n_m5_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_b1', '你',
       '「球场、朋友、还有一个人。」你数着说，「都在。」她听完点点头，说「听起来不错」。',
       'dailylife', 'dialogue', 'n_m5_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_d1', '你',
       '「过得挺好的。」你说。这话是真的，只是你没提她。她也没问。',
       'dailylife', 'dialogue', 'n_m5_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_c2', '旁白',
       '有些话到了嘴边，你还在想要不要讲。',
       'dailylife', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_a2', '你',
       '你没讲。她问了一句「你最近怎么了」，你说「没什么」，话题就过去了。',
       'dailylife', 'dialogue', 'n_m5_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_b2', '你',
       '「我今天很想你。」你说得有点笨。她笑了一下，说「我也是」。就这么简单。',
       'dailylife', 'dialogue', 'n_m5_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_d2', '你',
       '你把想说的话咽了回去，继续过你的日子。日子过得挺好，就是偶尔会觉得少了点什么。',
       'dailylife', 'dialogue', 'n_m5_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_end', '旁白',
       '安全感不是把谁牢牢捆住，是你先站稳了，再伸出手。完整的你，才接得住另一个人。',
       'dailylife', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c9_depend', '「等一个人回消息」', 'n_m5_a1', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND sn.node_key = 'n_m5_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c9_balanced', '把自己的日子过好，也给她留了位置', 'n_m5_b1', 8, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND sn.node_key = 'n_m5_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c9_alone', '「没什么，我过得挺好的」', 'n_m5_d1', 8, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND sn.node_key = 'n_m5_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c10_swallow', '什么都不说，等她发现', 'n_m5_a2', -9, 9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND sn.node_key = 'n_m5_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c10_tell', '说出来：我需要你，我想你了', 'n_m5_b2', 8, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND sn.node_key = 'n_m5_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c10_silent', '算了，不说也没关系', 'n_m5_d2', 8, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND sn.node_key = 'n_m5_c2';

-- ============================================================
--  她主线
-- ============================================================

-- ---------- 第一章 · 初遇 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十月，朋友组的聚会。他在人群边缘看见你，好像在等谁，又好像只是站着。',
       'party', 'dialogue', 'n_f1_c1'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_c1', '旁白',
       '他朝你走过来了。他有话想说，但没说出来。',
       'party', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_a1', '他',
       '「你怕不怕冷？」他问得没头没尾。你说怕。他就笑，说那我们不合适。',
       'party', 'dialogue', 'n_f1_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_b1', '他',
       '他举起杯子又放下，好像还想说什么。最后只说了句「那下次见」，转身走了。',
       'party', 'dialogue', 'n_f1_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_d1', '旁白',
       '他走过来的时候你正跟别人聊得开心。等你回过头，他已经跟别人聊上了。',
       'party', 'dialogue', 'n_f1_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_c2', '旁白',
       '你们在一起了。他回消息很快，几乎从不让你等。',
       'party', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_a2', '你',
       '你把一天里所有的事都讲给他听。他说「傻瓜」，你听了整个晚上都高兴。你不知道的是，他开始觉得喘不过气。',
       'party', 'dialogue', 'n_f1_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_b2', '你',
       '你还是喜欢告诉他今天的事，只是也留了一点给自己。你发现，这样反而更想说话。',
       'party', 'dialogue', 'n_f1_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_d2', '你',
       '你把他设成了免打扰。头几天你总想去解除设置，后来就没再管过。',
       'party', 'dialogue', 'n_f1_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_end', '旁白',
       '被人放在心上的感觉太好了，好到你开始把喜怒哀乐都系在他身上。',
       'party', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c1_approach', '接住他的紧张，替他把话头接过去', 'n_f1_a1', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND sn.node_key = 'n_f1_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c1_join', '和他聊两句，也叫上自己的朋友一起', 'n_f1_b1', 6, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND sn.node_key = 'n_f1_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c1_ignore', '他走过来的时候，你在跟别人聊', 'n_f1_d1', -7, 8, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND sn.node_key = 'n_f1_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c2_wait', '把一天里所有的事都讲给他听，连天气都想说', 'n_f1_a2', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND sn.node_key = 'n_f1_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c2_sleep', '留一点自己的时间给朋友和爱好', 'n_f1_b2', 6, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND sn.node_key = 'n_f1_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c2_mute', '把他的聊天设成免打扰，专注自己的事', 'n_f1_d2', -7, 7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND sn.node_key = 'n_f1_c2';

-- ---------- 第二章 · 相处 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '在一起三个月。他记得你所有的喜好，也记得你所有的坏脾气。他对你好得没有一丝保留。',
       'street', 'dialogue', 'n_f2_c1'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_c1', '旁白',
       '他今晚要和朋友吃饭。你想问他在做什么。',
       'street', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_a1', '你',
       '他真的把整个晚上的行程发给了你。你盯着屏幕等他每一条回复，心里踏实了一点，也没踏实多少。',
       'street', 'dialogue', 'n_f2_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_b1', '你',
       '他回了个「好」。你放下手机去见了老同学，笑了好几次。回家时他在门口等，手里拎着你爱吃的。',
       'street', 'dialogue', 'n_f2_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_c1x', '旁白',
       '他愣了一下，说「好」。那之后他报备的次数反而变少了。',
       'street', 'dialogue', 'n_f2_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_d1', '你',
       '你放下手机。他后来发来的消息你隔了几个小时才回，回的时候已经不太记得他说了什么。',
       'street', 'dialogue', 'n_f2_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_c2', '旁白',
       '他抱怨工作。你想安慰他。',
       'street', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_a2', '你',
       '你们一起骂到十二点，很解气。可第二天他还是很累，而且不太想跟你说话了。',
       'street', 'dialogue', 'n_f2_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_b2', '你',
       '「我在。」你说。他沉默了一会儿，说「嗯，我知道」。那晚他睡得比平时好。',
       'street', 'dialogue', 'n_f2_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_c2x', '旁白',
       '电话挂了。他没有再打过来，你也没有再问。',
       'street', 'dialogue', 'n_f2_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_d2', '你',
       '你挂了电话，翻身睡了。醒来的时候你想起他昨天好像找过你，但你想不起是什么事。',
       'street', 'dialogue', 'n_f2_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_end', '旁白',
       '你把亲密理解成了完全重合。而他的世界在悄悄变小。',
       'street', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_check', '要求他事事报备，空闲时间都留给我', 'n_f2_a1', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_trust', '只说一句「玩得开心」，然后去陪自己的朋友', 'n_f2_b1', 7, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_cold', '直接说「你去吧，不用解释」', 'n_f2_c1x', -6, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c3_alone', '算了，他忙他的，我也忙我的', 'n_f2_d1', -7, 8, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_solve', '急着替他分析，帮他骂那个不讲理的人', 'n_f2_a2', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_listen', '安静听完，只说「我在」', 'n_f2_b2', 7, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_brief', '嗯两声，说「我有点累，先这样」', 'n_f2_c2x', -6, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c4_alone', '「我也挺累的，改天再说」', 'n_f2_d2', -7, 8, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND sn.node_key = 'n_f2_c2';

-- ---------- 第三章 · 矛盾 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '同一件事，第三次出现了。你已经知道他会怎么解释，也知道你们会怎么吵。',
       'cafe', 'dialogue', 'n_f3_c1'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_c1', '旁白',
       '这一次，你特别累。',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_a1', '你',
       '你又替他找了个理由：他工作压力大。你一次次降低底线，心里那笔账你不敢去算。',
       'cafe', 'dialogue', 'n_f3_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_b1', '你',
       '「我也会累的。」你说。他愣住了，说「我以为你不会累」。原来他也以为你不会。',
       'cafe', 'dialogue', 'n_f3_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_c1x', '旁白',
       '你们隔着一张小桌，谁都没动面前的咖啡。空气比上一次更冷。',
       'cafe', 'dialogue', 'n_f3_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_d1', '旁白',
       '你站起来走了。他在后面叫了你一声，你没回头。',
       'cafe', 'dialogue', 'n_f3_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_c2', '旁白',
       '你想起他说过「我可能给不了你想要的」。',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_a2', '你',
       '你说了「我什么都不要」。他握住了你的手。你们都很久没这么近过——因为谁都不敢再往前一步。',
       'cafe', 'dialogue', 'n_f3_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_b2', '你',
       '「我爱过你，但我不能这样消耗自己。」你说完，第一次觉得心里是亮的，不是空的。',
       'cafe', 'dialogue', 'n_f3_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_d2', '你',
       '你把要说的话删掉，把他的联系方式删掉，然后好好睡了一觉。醒来心里空空的，但也安静。',
       'cafe', 'dialogue', 'n_f3_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_end', '旁白',
       '害怕分开之后遇不到更好的，所以一直妥协。可真正的勇敢，是敢在痛的时候说不。',
       'cafe', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_endure', '再等等吧，也许他以后会改', 'n_f3_a1', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND sn.node_key = 'n_f3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_speak', '说出来：我也有需要被照顾的地方', 'n_f3_b1', 6, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND sn.node_key = 'n_f3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_quiet', '谁也不先开口，看谁先低头', 'n_f3_c1x', -6, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND sn.node_key = 'n_f3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c5_leave', '算了，我先一个人待一会儿', 'n_f3_d1', -7, 8, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND sn.node_key = 'n_f3_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c6_hold', '假装没事，说「我什么都不要」', 'n_f3_a2', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND sn.node_key = 'n_f3_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c6_admit', '承认这段关系在消耗我', 'n_f3_b2', 5, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND sn.node_key = 'n_f3_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c6_leave', '想清楚了，我该走了', 'n_f3_d2', -7, 8, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND sn.node_key = 'n_f3_c2';

-- ---------- 第四章 · 别离 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '最后还是分开了。理由很杂，但你们都知道是什么。',
       'rain', 'dialogue', 'n_f4_c1'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_c1', '旁白',
       '分开后的第一周，你把他所有的聊天记录翻到了最开始。',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_a1', '你',
       '你翻到很早以前的一条语音，那天他说「今天特别开心，因为下雨了」。你听着听着就哭了。',
       'rain', 'dialogue', 'n_f4_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_b1', '你',
       '你把手机放进口袋，出了门。外面在下雨，你没带伞，走着走着反而舒服了一点。',
       'rain', 'dialogue', 'n_f4_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_c1x', '你',
       '删得很干净，干净到第二天你想发消息时，手指停在「发送」上面，不知道该发给谁。',
       'rain', 'dialogue', 'n_f4_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_d1', '你',
       '这一周你谁也没见。第八天你想起他，发现自己已经想不起他说话的样子了。',
       'rain', 'dialogue', 'n_f4_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_c2', '旁白',
       '你开始怀疑，是不是自己不够好。',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_a2', '你',
       '你把所有的错都揽到自己身上。你想，如果当时再好一点，是不是就不用走到这里。',
       'rain', 'dialogue', 'n_f4_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_b2', '你',
       '一段感情落幕，不等于你不值得被爱。允许自己难过，但别把一次失败当成整个人生的定论。',
       'rain', 'dialogue', 'n_f4_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_c2x', '旁白',
       '你把他从所有列表里删掉，最后一个长按确认的时候，你的手指停了很久。',
       'rain', 'dialogue', 'n_f4_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_d2', '你',
       '你把他的照片从手机里移走，也从心里移走。移走的时候你以为会疼，结果只是空。',
       'rain', 'dialogue', 'n_f4_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_end', '旁白',
       '放下不是遗忘，是不再被过去困住。',
       'rain', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_scroll', '翻遍记录，想找一句话把他叫回来', 'n_f4_a1', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_stop', '关掉手机，把这一周留给自己', 'n_f4_b1', 4, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_erase', '删掉所有联系方式，清得干干净净', 'n_f4_c1x', -6, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c7_alone', '这周我想一个人过，谁也不见', 'n_f4_d1', -7, 8, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_blame', '否定自己，觉得是自己不够好才走到这步', 'n_f4_a2', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_fact', '承认只是不合适，不是我不值得被爱', 'n_f4_b2', 6, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_cut', '把他也拉黑，假装从没存在过', 'n_f4_c2x', -7, -7, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c8_alone', '我一个人也挺好的，不用谁来证明', 'n_f4_d2', -7, 8, 4
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND sn.node_key = 'n_f4_c2';

-- ---------- 第五章 · 圆满 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '一年后。你有常约的饭局，有重拾起来的爱好，有几个睡不着的晚上，也有几个睡得很好的早上。',
       'dailylife', 'dialogue', 'n_f5_c1'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_c1', '旁白',
       '新认识的人问你在忙什么。你想了想。',
       'dailylife', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_a1', '你',
       '你说完自己就笑了。笑得很轻，像在承认一件有点丢人、但也不打算改的事。',
       'dailylife', 'dialogue', 'n_f5_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_b1', '你',
       '「朋友、爱好、还有一个人。」你数着说，「都在。」他听完点点头，说「听起来不错」。',
       'dailylife', 'dialogue', 'n_f5_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_d1', '你',
       '「过得挺好的。」你说。这话是真的，只是你没提他。他也没问。',
       'dailylife', 'dialogue', 'n_f5_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_c2', '旁白',
       '有些不安已经到了嘴边。',
       'dailylife', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_a2', '你',
       '你用一句「你今天怎么没找我」代替了真正想问的那句。他困惑地看着你，你把话咽了回去。',
       'dailylife', 'dialogue', 'n_f5_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_b2', '你',
       '「我有点不安。」你说得有点笨。他放下手机，认真听完了。两个人都是完整的，也都愿意为对方挪一点位置。',
       'dailylife', 'dialogue', 'n_f5_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_d2', '你',
       '你把想说的话咽了回去，继续过你的日子。日子过得挺好，就是偶尔会觉得少了点什么。',
       'dailylife', 'dialogue', 'n_f5_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_end', '旁白',
       '好的安全感，一半来自伴侣的真诚坚定，一半源于内心的自足。相爱是两个完整独立的人，互相靠近。',
       'dailylife', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c9_depend', '「等一个人回消息」', 'n_f5_a1', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND sn.node_key = 'n_f5_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c9_balanced', '把自己的日子过好，也给他留了位置', 'n_f5_b1', 8, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND sn.node_key = 'n_f5_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c9_alone', '「没什么，我过得挺好的」', 'n_f5_d1', -7, 8, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND sn.node_key = 'n_f5_c1';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c10_swallow', '什么都不说，猜忌试探，看他什么反应', 'n_f5_a2', 9, -9, 1
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND sn.node_key = 'n_f5_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c10_tell', '坦诚说出来：我有点不安，讲给你听', 'n_f5_b2', 8, 8, 2
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND sn.node_key = 'n_f5_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT sn.id, 'c10_silent', '算了，不说也没关系', 'n_f5_d2', -7, 8, 3
FROM scene_nodes sn JOIN chapters c ON c.id = sn.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND sn.node_key = 'n_f5_c2';

-- ============================================================
-- 结局定义
--   判定顺序：非隐藏优先 → 隐藏。条件互斥且完备。
-- ============================================================

-- 他线
INSERT INTO endings (route_id, ending_key, title, description, condition_json, is_hidden) VALUES
  (@r_male, 'e_bond', '圆满',
   '你们都成了更好的自己，也还在一起。这一次，不是因为抓得紧，是因为都站稳了。',
   '{"all":[{"affection_male":{">=":15}},{"affection_female":{">=":25}},{"not":{"all":[{"affection_male":{">=":40}},{"affection_female":{">=":30}}]}}]}', 0),
  (@r_male, 'e_apart', '各自安好',
   '最后没走到一起。但你没有把自己弄丢，她也没有。分开不是谁的错，只是两条路岔开了。',
   '{"all":[{"affection_male":{">=":15}},{"affection_female":{"<":25}}]}', 0),
  (@r_male, 'e_miss', '错过',
   '她一直都在。只是那时候的你，太用力了，忙着围着她转，反而看不见站在旁边的人。',
   '{"all":[{"affection_male":{"<":15}},{"affection_female":{">=":25}}]}', 0),
  (@r_male, 'e_alone', '一个人的体面',
   '你把体面守得很好，好到只剩下体面。两个人都没做错什么，也都没得到什么。',
   '{"all":[{"affection_male":{"<":15}},{"affection_female":{"<":25}}]}', 0),
  (@r_male, 'e_quiet', '原来那天你也在',
   '很多年后你才明白：那些你以为错过的时刻，她其实一直都在。你终于学会爱自己，却再也找不到那个愿意等你的人。',
   '{"all":[{"affection_male":{">=":40}},{"affection_female":{">=":30}}]}', 1);

-- 她线
INSERT INTO endings (route_id, ending_key, title, description, condition_json, is_hidden) VALUES
  (@r_female, 'e_bond', '圆满',
   '你们都成了更好的自己，也还在一起。这一次，不是因为抓得紧，是因为都站稳了。',
   '{"all":[{"affection_female":{">=":15}},{"affection_male":{">=":25}},{"not":{"all":[{"affection_female":{">=":40}},{"affection_male":{">=":30}}]}}]}', 0),
  (@r_female, 'e_apart', '各自安好',
   '最后没走到一起。但你没有把自己弄丢，他也没有。分开不是谁的错，只是两条路岔开了。',
   '{"all":[{"affection_female":{">=":15}},{"affection_male":{"<":25}}]}', 0),
  (@r_female, 'e_miss', '错过',
   '他一直都在。只是那时候的你，太习惯被爱了，反而忘了看看自己还想要什么。',
   '{"all":[{"affection_female":{"<":15}},{"affection_male":{">=":25}}]}', 0),
  (@r_female, 'e_alone', '一个人的体面',
   '你把体面守得很好，好到只剩下体面。两个人都没做错什么，也都没得到什么。',
   '{"all":[{"affection_female":{"<":15}},{"affection_male":{"<":25}}]}', 0),
  (@r_female, 'e_umbrella', '伞一直在他那里',
   '很多年后你才明白：那些你以为错过的时刻，他其实一直都在。你终于学会爱自己，却再也找不到那个愿意等你的人。',
   '{"all":[{"affection_female":{">=":40}},{"affection_male":{">=":30}}]}', 1);

-- ------------------------------------------------------------
-- 自检：
--   SELECT COUNT(*) FROM routes;      -- 应为 2
--   SELECT COUNT(*) FROM chapters;    -- 应为 10
--   SELECT COUNT(*) FROM scene_nodes; -- 应为 110
--   SELECT COUNT(*) FROM choices;     -- 应为 70
--   SELECT COUNT(*) FROM endings;     -- 应为 10
-- ------------------------------------------------------------
