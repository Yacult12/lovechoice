-- ============================================================
--  《他们的故事》完整剧本重建
--  执行： npm run script
--
--  结构：每条线 5 章，每章 2 个抉择点（第一章 1 个），共 8 个选项 / 8 个结局。
--
--  剧本约定（务必遵守）：
--   1) node_key 只在「章内」唯一（uk_chapter_node），所以每章首节点都叫 n_start。
--   2) 章末：dialogue 节点的 next_node_key 留 NULL —— 服务端会自动进入下一章首节点。
--      ⚠️ 千万不要把章末的 next_node_key 写成 'n_start'，否则会跳回本章开头死循环。
--   3) choice 节点自身不设 next_node_key，走向写在 choices.next_node_key。
--   4) 最后一章的选项指向 node_type='ending' 的节点，进入即触发结局匹配。
--
--  结局判定顺序：非隐藏优先（按 id 升序）→ 隐藏结局。
--  因此每个路由的条件都设计成互斥且完备，隐藏结局在「其它都不匹配」时才可能触发。
-- ============================================================

SET @r_male   := (SELECT id FROM routes WHERE route_code = 'male');
SET @r_female := (SELECT id FROM routes WHERE route_code = 'female');

-- 清空旧剧本（保留 users / saves / choice_logs / user_endings）
DELETE ch FROM choices ch
  JOIN scene_nodes n ON n.id = ch.node_id
  JOIN chapters c ON c.id = n.chapter_id
  JOIN routes r ON r.id = c.route_id
 WHERE r.id IN (@r_male, @r_female);

DELETE n FROM scene_nodes n
  JOIN chapters c ON c.id = n.chapter_id
  JOIN routes r ON r.id = c.route_id
 WHERE r.id IN (@r_male, @r_female);

DELETE e FROM endings e WHERE e.route_id IN (@r_male, @r_female);
DELETE ue FROM user_endings ue WHERE ue.route_id IN (@r_male, @r_female);

-- ------------------------------------------------------------
-- 立绘路径（相对 client/assets/js/pages/）
-- ------------------------------------------------------------
UPDATE characters SET avatar_url = '../../img/avatar/male-soft.svg'
 WHERE route_id = @r_male AND char_key = 'male';
UPDATE characters SET avatar_url = '../../img/avatar/female-soft.svg'
 WHERE route_id = @r_male AND char_key = 'female';
UPDATE characters SET avatar_url = '../../img/avatar/female-soft.svg'
 WHERE route_id = @r_female AND char_key = 'female';
UPDATE characters SET avatar_url = '../../img/avatar/male-soft.svg'
 WHERE route_id = @r_female AND char_key = 'male';

-- ------------------------------------------------------------
-- 章节表：两条线各 5 章
-- ------------------------------------------------------------
DELETE FROM chapters WHERE route_id IN (@r_male, @r_female);

INSERT INTO chapters (route_id, chapter_no, title, start_node, is_published) VALUES
  (@r_male, 1, '第一章 · 初见',   'n_start', 1),
  (@r_male, 2, '第二章 · 靠近',   'n_start', 1),
  (@r_male, 3, '第三章 · 传闻',   'n_start', 1),
  (@r_male, 4, '第四章 · 雨夜',   'n_start', 1),
  (@r_male, 5, '第五章 · 走廊',   'n_start', 1),
  (@r_female, 1, '第一章 · 借书', 'n_start', 1),
  (@r_female, 2, '第二章 · 误解', 'n_start', 1),
  (@r_female, 3, '第三章 · 传闻', 'n_start', 1),
  (@r_female, 4, '第四章 · 一把伞','n_start', 1),
  (@r_female, 5, '第五章 · 走廊', 'n_start', 1);


-- ============================================================
--  男主线「他的视角」
--  情绪弧线：试探 → 靠近 → 得意 → 裂痕 → 和解
--  好感区间：最佳 m=75 / f=85，最差全负
-- ============================================================

-- ---------- 第一章 · 初见 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '九月，图书馆的空调开得太冷。她坐在你斜后方第三排，掉了三次书。',
       'library', 'dialogue', 'n_m1_c'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_c', '旁白',
       '这一次，书直接滑到她脚边。她没捡，只是看着你，像在等什么。',
       'library', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_helped', '她',
       '「谢谢。」她弯腰的时候刘海垂下来，「其实……我是故意的。」',
       'library', 'dialogue', 'n_m1_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_ignored', '旁白',
       '你把书推回去，说了句「下次小心」。她笑了一下，那个笑很难懂。',
       'library', 'dialogue', 'n_m1_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m1_end', '旁白',
       '九月的最后一周，你开始记住她翻书的节奏。',
       'library', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 1;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_help', '弯腰帮她捡，顺势搭句话', 'n_m1_helped', 0, 6, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND n.node_key = 'n_m1_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_ignore', '把书推回去，说「下次小心」', 'n_m1_ignored', -5, -4, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 1 AND n.node_key = 'n_m1_c';

-- ---------- 第二章 · 靠近 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十月，自习室。你们的位置隔了两排，正好能看见对方抬头。',
       'classroom', 'dialogue', 'n_m2_c'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_c', '她',
       '「我最近有点累……」她声音很轻。你要——',
       'classroom', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_listen', '你',
       '「那就都说给我听，今天什么都别扛着。」你把笔放下了。',
       'classroom', 'dialogue', 'n_m2_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_argue', '你',
       '「谁不累。」话一出口，你听见空气凉下来的声音。',
       'classroom', 'dialogue', 'n_m2_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_c2', '旁白',
       '晚上十点，回宿舍的路要绕一段才经过那家还亮着的店。',
       'street', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_gift', '她',
       '「……你怎么知道我今天想吃这个。」她笑的时候有点想哭。',
       'dorm', 'dialogue', 'n_m2_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_skip', '旁白',
       '你什么都没买。手机屏幕亮了一整夜，两个人都在等对方先开口。',
       'dorm', 'dialogue', 'n_m2_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m2_end', '旁白',
       '十月结束的时候，你发现沉默是会累积的。',
       'street', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 2;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_listen', '放下笔，认真听她说完', 'n_m2_listen', 5, 8, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND n.node_key = 'n_m2_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_argue', '说自己也累，别矫情', 'n_m2_argue', -3, -10, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND n.node_key = 'n_m2_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_gift', '绕远路给她带一份宵夜', 'n_m2_gift', 4, 6, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND n.node_key = 'n_m2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_skip', '算了，各自冷静一下', 'n_m2_skip', 0, -2, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 2 AND n.node_key = 'n_m2_c2';

-- ---------- 第三章 · 传闻 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十一月，隔壁班开始传你和她的事。传得比真的快。',
       'cafe', 'dialogue', 'n_m3_c'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_c', '旁白',
       '朋友在食堂起哄，问你俩是不是在一起了。你——',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_admit', '你',
       '「别瞎说。」你笑着把话挡回去，然后看向她坐的方向。',
       'cafe', 'dialogue', 'n_m3_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_deny', '你',
       '「没有的事。」你说得很快，快得像心虚。',
       'cafe', 'dialogue', 'n_m3_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_c2', '她',
       '「他们说的是真的吗。」她没有看你。你要——',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_truth', '你',
       '「是真的。」你说完，她才抬起头，「你怎么不早讲。」',
       'cafe', 'dialogue', 'n_m3_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_joke', '你',
       '「你觉得呢。」你开了个玩笑。她笑了一下，然后站起来走了。',
       'cafe', 'dialogue', 'n_m3_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m3_end', '旁白',
       '那天之后，你们在食堂坐得比从前远了两个座位。',
       'cafe', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 3;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_admit', '别承认，但挡一下话题', 'n_m3_admit', 6, 5, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND n.node_key = 'n_m3_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_deny', '当众否认', 'n_m3_deny', 0, -8, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND n.node_key = 'n_m3_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_honest', '说实话', 'n_m3_truth', 8, 8, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND n.node_key = 'n_m3_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_joke', '用玩笑带过去', 'n_m3_joke', 0, -12, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 3 AND n.node_key = 'n_m3_c2';

-- ---------- 第四章 · 雨夜 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十一月最后一场雨。她没带伞，站在教学楼门口很久。',
       'rain', 'dialogue', 'n_m4_c'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_c', '旁白',
       '雨很大。你手里只有一把伞。你要——',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_umbrella', '你',
       '你把伞塞过去就跑。跑出十米她才喊住你，你没敢回头。',
       'rain', 'dialogue', 'n_m4_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_c2', '她',
       '「我们是不是……不合适。」她说这句话的时候在看雨。',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_stay', '你',
       '「是我不好。」你在雨里站住了，「你要走我不拦，但你得让我陪。」',
       'rain', 'dialogue', 'n_m4_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_left', '你',
       '「可能是吧。」你说完就走了。雨很大，理由很充分。',
       'rain', 'dialogue', 'n_m4_end'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_end', '旁白',
       '那天夜里下了很久的雨。天亮的时候，你们都没有发消息。',
       'rain', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_share', '把伞给她，自己淋雨回去', 'n_m4_umbrella', 10, 12, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND n.node_key = 'n_m4_c';

-- 隐藏结局入口：把伞塞过去就跑，什么都不说。
-- 女方被这份笨拙的善意打动（f +5），而男方自己越想越退缩（m -25）。
-- 这是全局唯一能造出「f 高、但 m 明显掉队」的组合，作为隐藏结局的签名。
INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_run', '把伞塞过去，然后跑掉', 'n_m4_run', -25, 5, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND n.node_key = 'n_m4_c';

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m4_run', '旁白',
       '你把伞塞进她手里，转身走进了雨里。你没敢看她的表情。',
       'rain', 'dialogue', 'n_m4_c2'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 4;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_stay', '认错，说愿意陪她', 'n_m4_stay', 12, 10, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND n.node_key = 'n_m4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_giveup', '承认可能不合适', 'n_m4_left', -5, -20, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 4 AND n.node_key = 'n_m4_c2';

-- ---------- 第五章 · 走廊 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十二月，毕业季。走廊里全是道别的声音，和行李箱轮子的响动。',
       'corridor', 'dialogue', 'n_m5_c'
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_m5_c', '旁白',
       '她站在楼梯口，手里握着一封没有署名的信。你要——',
       'corridor', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_final', '旁白',
       '后来的故事，取决于你们两个人在那之前，一次次把对方放在心上的重量。',
       'corridor', 'ending', NULL
FROM chapters c WHERE c.route_id = @r_male AND c.chapter_no = 5;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_confess', '「信我收下了。这次换我先说。」', 'n_final', 25, 30, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND n.node_key = 'n_m5_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_hold', '把话咽回去，说一句「路上小心」', 'n_final', 0, -25, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_male AND c.chapter_no = 5 AND n.node_key = 'n_m5_c';


-- ============================================================
--  女主线「她的视角」
--  同一段日子，她记得的却是另一串细节。
--  情绪弧线：期待 → 疑惑 → 反复确认 → 悬着 → 开口
--  好感区间：最佳 m=80 / f=83
-- ============================================================

-- ---------- 第一章 · 借书 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '九月，图书馆的空调很足。你第三次把书碰掉，终于等到一只手伸过来。',
       'library', 'dialogue', 'n_f1_c'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_c', '旁白',
       '他蹲在你旁边，抬头看你。你要——',
       'library', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_thanks', '你',
       '「谢谢。」你接过书，指尖碰到了他的手，你没有躲开。',
       'library', 'dialogue', 'n_f1_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_cold', '你',
       '你抽回书，说了句「不用」，转身就走。他在原地站了两秒。',
       'library', 'dialogue', 'n_f1_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f1_end', '旁白',
       '你后来才知道，那天他是特意换到你能看见的位置坐下的。',
       'library', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 1;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_thanks', '认真道谢，并记住他的样子', 'n_f1_thanks', 6, 5, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND n.node_key = 'n_f1_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_cold', '冷冷地说不用，然后走开', 'n_f1_cold', -12, -2, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 1 AND n.node_key = 'n_f1_c';

-- ---------- 第二章 · 误解 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十月，你在自习室看见他。他总是坐在能看见你的位置，从来不坐更近。',
       'classroom', 'dialogue', 'n_f2_c'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_c', '旁白',
       '你发了条消息：「今天有点累。」他隔了四个小时才回。你要——',
       'classroom', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_trust', '你',
       '「可能他在忙吧。」你替他找了个理由，然后继续写完了那道题。',
       'classroom', 'dialogue', 'n_f2_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_doubt', '你',
       '「他是不是……其实没那么在意。」这句话你在心里转了一整晚。',
       'dorm', 'dialogue', 'n_f2_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_c2', '他',
       '「昨天手机没电了。」他停了一下，「不是不想回你。」你——',
       'classroom', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_talk', '你',
       '「下次没电前先跟我说一声，我会乱想。」你说得很直白。',
       'classroom', 'dialogue', 'n_f2_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_avoid', '你',
       '「嗯，没事。」你把话咽了回去，只回了一个笑脸。',
       'classroom', 'dialogue', 'n_f2_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f2_end', '旁白',
       '有些误会不是谁做错了，只是两个人都在等对方先解释。',
       'street', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 2;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_trust', '相信他，继续把心事讲给他听', 'n_f2_trust', 8, 6, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND n.node_key = 'n_f2_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_doubt', '开始怀疑，把消息删掉不回', 'n_f2_doubt', -10, -8, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND n.node_key = 'n_f2_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_talk', '把不安说出来，问清楚', 'n_f2_talk', 6, 10, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND n.node_key = 'n_f2_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_avoid', '假装什么都没发生', 'n_f2_avoid', -6, -12, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 2 AND n.node_key = 'n_f2_c2';

-- ---------- 第三章 · 传闻 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十一月，隔壁班开始传你们的事。传的内容，比你们之间真实发生的多十倍。',
       'cafe', 'dialogue', 'n_f3_c'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_c', '旁白',
       '朋友来问你：「你们是不是在一起了？」你要——',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_yes', '你',
       '「大概……算是吧。」你说完，心跳得比实话还快。',
       'cafe', 'dialogue', 'n_f3_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_no', '你',
       '「没有，我们只是同学。」你说得很熟练，熟练得让自己难受。',
       'cafe', 'dialogue', 'n_f3_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_c2', '旁白',
       '第二天他在食堂坐得比平时远。你要——',
       'cafe', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_ask', '你',
       '你端着汤走过去，在他对面坐下，「昨天的传闻，我想听你说。」',
       'cafe', 'dialogue', 'n_f3_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_silent', '你',
       '你没有过去。低头喝汤，汤很烫，足够你用一整个午休。',
       'cafe', 'dialogue', 'n_f3_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f3_end', '旁白',
       '传闻从来没有停过。只有你们自己知道那天中午发生了什么。',
       'cafe', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 3;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_confirm', '承认「好像是的」', 'n_f3_yes', 5, 8, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND n.node_key = 'n_f3_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_refuse', '否认，说只是同学', 'n_f3_no', 0, -10, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND n.node_key = 'n_f3_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_ask', '直接过去问清楚', 'n_f3_ask', 8, 6, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND n.node_key = 'n_f3_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_notask', '算了，低下头', 'n_f3_silent', -4, -8, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 3 AND n.node_key = 'n_f3_c2';

-- ---------- 第四章 · 一把伞 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十一月最后一场雨。他站在便利店门口，看着雨，没有要走的意思。',
       'rain', 'dialogue', 'n_f4_c'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_c', '旁白',
       '你有一把伞，伞只够一个人。你要——',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_wait', '你',
       '你收了伞，站到他旁边。两个人一起看了二十分钟的雨。',
       'rain', 'dialogue', 'n_f4_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_left', '你',
       '你从另一边走了。走的时候，你听见自己松了一口气。',
       'rain', 'dialogue', 'n_f4_c2'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_c2', '他',
       '「伞给你。」他把伞递过来，手一直在抖。你要——',
       'rain', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_share', '你',
       '你接过来，又把伞塞回他手里，「一起走。」',
       'rain', 'dialogue', 'n_f4_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_refuse', '你',
       '「你留着吧。」你接过伞，走了。伞很重，你一路都没打开。',
       'rain', 'dialogue', 'n_f4_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_end', '旁白',
       '那天夜里下了很久的雨。天亮的时候，伞在你书包里，已经干了。',
       'rain', 'dialogue', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_wait', '收伞，站到他旁边', 'n_f4_wait', 10, 8, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND n.node_key = 'n_f4_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_pass', '从另一边走掉', 'n_f4_left', -12, -15, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND n.node_key = 'n_f4_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_together', '把伞塞回去：一起走', 'n_f4_share', 12, 10, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND n.node_key = 'n_f4_c2';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_take', '接过伞自己走', 'n_f4_refuse', -8, -14, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND n.node_key = 'n_f4_c2';

-- 隐藏结局的唯一入口：把伞还回去却什么都不说。
-- 「他想要的不是伞，是一句回应」→ 女方好感微涨（f +6），男方好感重挫（m -25），
-- 造出「f 高、但 m 明显掉队」这一在其它任何组合里都不存在的签名。
-- 数值标定：最优路线 m=80/f=83，本选项替换掉 f 最高的 o_together(+10)
-- 后为 m=43 / f=79 —— 刚好越过 f≥78 阈值、且远低于 m≥58。
INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_silent', '把伞还给他，什么也不说', 'n_f4_hold', -25, 6, 3
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 4 AND n.node_key = 'n_f4_c2';

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f4_hold', '他',
       '他接过伞，看了你两秒，「……那算了。」他转身走进了雨里。',
       'rain', 'dialogue', 'n_f4_end'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 4;

-- ---------- 第五章 · 走廊 ----------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_start', '旁白',
       '十二月，毕业季。同一条走廊，你已经走了四年，他只走了一年。',
       'corridor', 'dialogue', 'n_f5_c'
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f5_c', '旁白',
       '他在楼梯口站了很久，像是在等谁先开口。你要——',
       'corridor', 'choice', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id, 'n_f_final', '旁白',
       '原来同一条走廊，从两个人的视角看，是两段完全不同的回忆。',
       'corridor', 'ending', NULL
FROM chapters c WHERE c.route_id = @r_female AND c.chapter_no = 5;

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_first', '「这次我先说 —— 我一直在等你开口。」', 'n_f_final', 25, 30, 1
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND n.node_key = 'n_f5_c';

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id, 'o_goodbye', '「祝你以后一切都好。」然后转身', 'n_f_final', 0, -25, 2
FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
WHERE c.route_id = @r_female AND c.chapter_no = 5 AND n.node_key = 'n_f5_c';


-- ============================================================
--  结局（每条线 4 个，含 1 个隐藏结局）
--
--  阈值依据（由 scripts/calibrate.js 实测得出，勿随意改数值）：
--    男线全最优路线 = 男 70 / 女 85
--    女线全最优路线 = 男 80 / 女 83
--  所以「满好感线」阈值取 m ≥ 55 / f ≥ 78：需要全程基本选对，
--  但不至于只有唯一一条完美路线能达成。
--
--  判定顺序：非隐藏优先（id 升序）→ 隐藏结局。
--  四组条件互斥且完备，覆盖所有可能的 (m, f) 组合。
-- ============================================================

-- 男主线：
--   f < 30              → 一个人的体面（她走了）
--   30 ≤ f < 78         → 各自安好
--   f ≥ 78 且 m ≥ 55    → 双向奔赴
--   f ≥ 78 且 m < 55    → 原来那天你也在【隐藏】
--   第四条的入口是第四章 o_run（m -25 / f +5）——
--   那条「把伞塞过去就跑」的沉默路线会让 m 掉队而 f 依然很高。
INSERT INTO endings (route_id, ending_key, title, description, condition_json, is_hidden) VALUES
  (@r_male, 'e_true', '双向奔赴',
   '你们都在该开口的时候开了口。这件事比什么都难，所以格外珍贵。',
   '{"all":[{"affection_female":{">=":78}},{"affection_male":{">=":55}}]}', 0),
  (@r_male, 'e_apart', '各自安好',
   '没有对错，只是没能走到同一个方向。你们都好好的，这就够了。',
   '{"all":[{"affection_female":{">=":30}},{"affection_female":{"<":78}}]}', 0),
  (@r_male, 'e_lonely', '一个人的体面',
   '她走了，你留在原地。你把体面守得很好，好到只剩下体面。',
   '{"affection_female":{"<":30}}', 0),
  (@r_male, 'e_quiet', '原来那天你也在',
   '你把伞塞给她就跑了，什么也没说。她在原地站了很久 —— 久到多年以后，她还记得那天。',
   '{"all":[{"affection_female":{">=":78}},{"affection_male":{"<":55}}]}', 1);

-- 女主线：
--   f < 30              → 错过
--   30 ≤ f < 78         → 各自努力
--   f ≥ 78 且 m ≥ 58    → 原来你也在这里
--   f ≥ 78 且 m < 58    → 伞一直在他那里【隐藏】
--   第四条的入口是第四章 o_silent（m -25 / f +4）。
INSERT INTO endings (route_id, ending_key, title, description, condition_json, is_hidden) VALUES
  (@r_female, 'e_true', '原来你也在这里',
   '你终于明白他当时为什么沉默 —— 他只是在等你先开口。',
   '{"all":[{"affection_female":{">=":78}},{"affection_male":{">=":58}}]}', 0),
  (@r_female, 'e_apart', '各自努力',
   '你们在同一个屋檐下错开了很多年。偶尔想起来，还是会笑一下。',
   '{"all":[{"affection_female":{">=":30}},{"affection_female":{"<":78}}]}', 0),
  (@r_female, 'e_miss', '错过',
   '你以为他不爱。其实他只是没说出口，而你也没有再问一次。',
   '{"affection_female":{"<":30}}', 0),
  (@r_female, 'e_umbrella', '伞一直在他那里',
   '那天他说「伞给你」，你把它塞了回去，什么也没说。他把伞带回了家，一直没再用过。',
   '{"all":[{"affection_female":{">=":78}},{"affection_male":{"<":58}}]}', 1);
