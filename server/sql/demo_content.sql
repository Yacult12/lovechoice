-- ============================================================
-- 可选：把示例剧本补成「能完整玩通」的 demo（他 / 她 两条线各 3 章）
-- 执行方式：  npm run demo
-- 幂等：全部使用 ON DUPLICATE KEY UPDATE，可重复执行。
--
-- 剧本约定（非常重要）：
--   1) 每个 chapter 的 start_node 都是 'n_start'，节点 key 只在「章内」唯一，
--      所以跨章跳转由服务端用 chapter_id + start_node 精确定位完成。
--   2) 对白节点 node_type='dialogue' 的 next_node_key 留 NULL 表示「本章结束」，
--      服务端会自动把进度推进到下一章的第一节点。
--   3) 选项节点 node_type='choice' 自身不设 next_node_key，跳转写在 choices 表。
-- ============================================================

-- ------------------------------------------------------------
-- 男主线 · 第一章（n_start / n_first_choice 已由初始化脚本插入）
-- ------------------------------------------------------------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_helped','她','「谢谢你。」她抬头看了你一眼，睫毛在光里颤了一下。','library','dialogue','n_c1_end'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_ignored','旁白','你低头继续看书。脚步声很快消失在书架后面。','library','dialogue','n_c1_end'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_c1_end','旁白','九月的风穿过书架，你的名字，第一次被另一个人记住。','library','dialogue',NULL
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=NULL, bg_key=VALUES(bg_key), node_type=VALUES(node_type);

-- 男主线 · 第二章：两次选择
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_start','旁白','十月，你们开始在同一个自习室出现。','classroom','dialogue','n_m_c2_choice'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_m_c2_choice','她','「我最近有点累……」她声音很轻。你要怎么回应？','classroom','choice',NULL
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='choice', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_m_c2_listen','你','「那就都跟我说，今天什么都别扛着。」你放下笔。','classroom','dialogue','n_m_c2_gift_choice'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_m_c2_argue','你','「谁不累？我也没闲着。」话一出口，空气就凉了。','classroom','dialogue','n_m_c2_gift_choice'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_m_c2_gift_choice','旁白','回宿舍的路上，你路过一家还在营业的店。','street','choice',NULL
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='choice', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_m_c2_gift','她','「……你怎么知道我今天想吃这个。」她笑的时候有点想哭。','dorm','dialogue','n_c2_end'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_m_c2_no_gift','旁白','你什么都没买。手机屏幕亮了一整夜，两个人都在等对方先说。','dorm','dialogue','n_c2_end'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_c2_end','旁白','十月结束的时候，你发现沉默也是会累积的。','street','dialogue',NULL
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=NULL, bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_listen','放下笔，认真听她说完','n_m_c2_listen',25,25,1
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=1 AND c.chapter_no=2 AND n.node_key='n_m_c2_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_argue','说自己也累，让她别矫情','n_m_c2_argue',-10,-15,2
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=1 AND c.chapter_no=2 AND n.node_key='n_m_c2_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_gift','绕远路给她带一份宵夜','n_m_c2_gift',20,20,1
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=1 AND c.chapter_no=2 AND n.node_key='n_m_c2_gift_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_nothing','算了，各自冷静一下','n_m_c2_no_gift',0,0,2
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=1 AND c.chapter_no=2 AND n.node_key='n_m_c2_gift_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

-- 男主线 · 第三章：告白 / 沉默 → 结局节点
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_start','旁白','十二月，毕业季的走廊里全是道别的声音。','corridor','dialogue','n_m_c3_choice'
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=3
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_m_c3_choice','旁白','她站在楼梯口，手里握着一封没有署名的信。你说——','corridor','choice',NULL
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=3
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='choice', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_final','旁白','后来的故事，取决于你们两个人在那之前，一次次把对方放在心上的重量。','corridor','ending',NULL
FROM chapters c WHERE c.route_id=1 AND c.chapter_no=3
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='ending', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_confess','「信我收下了。这次换我先说。」','n_final',30,30,1
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=1 AND c.chapter_no=3 AND n.node_key='n_m_c3_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_silent','把话咽回去，说一句「路上小心」','n_final',0,-25,2
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=1 AND c.chapter_no=3 AND n.node_key='n_m_c3_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

-- ------------------------------------------------------------
-- 女主线 · 第一章
-- ------------------------------------------------------------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_start','旁白','九月，图书馆的空调很足。你的书掉在地上，一只手先你一步伸了过来。','library','dialogue','n_f_c1_choice'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_c1_choice','你','他蹲下去帮你捡书，抬眼看你。你要——','library','choice',NULL
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='choice', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_thanked','你','「谢谢。」你接过书，指尖碰到了他的手。','library','dialogue','n_f_c1_end'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_cold','你','你抽回书，说了句「不用」，转身就走。他在原地站了两秒。','library','dialogue','n_f_c1_end'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_c1_end','旁白','你后来才知道，那天他是特意坐在你斜后方的。','library','dialogue',NULL
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=1
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=NULL, bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_thanks','认真说声谢谢，并记住了他的样子','n_f_thanked',15,15,1
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=1 AND n.node_key='n_f_c1_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_cold','冷冷地说不用，然后走开','n_f_cold',-10,-5,2
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=1 AND n.node_key='n_f_c1_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

-- ------------------------------------------------------------
-- 女主线 · 第二章（你没做错什么，只是没有说出口）
-- ------------------------------------------------------------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_start','旁白','十月，你开始在自习室看到他。他总坐在能看见你的位置。','classroom','dialogue','n_f_c2_choice'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_c2_choice','旁白','你发了条消息说「今天有点累」，他隔了很久才回。','classroom','choice',NULL
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='choice', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_trust','你','「可能他在忙吧。」你替那句迟到的回复找了个理由。','classroom','dialogue','n_f_c2_choice2'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_doubt','你','「他是不是……其实没那么在意。」这句话你在心里转了一整晚。','dorm','dialogue','n_f_c2_choice2'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_c2_choice2','旁白','第二天他发来一句「昨天手机没电了」。你——','classroom','choice',NULL
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='choice', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_explain','你','「下次没电前先跟我说一声，我会乱想。」你把话说得很直白。','classroom','dialogue','n_f_c2_end'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_avoid','你','「嗯，没事。」你把话咽了回去，只回了一个笑脸。','classroom','dialogue','n_f_c2_end'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_c2_end','旁白','有些误会不是谁做错了，只是两个人都在等对方先解释。','street','dialogue',NULL
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=2
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=NULL, bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_trust','相信他，继续把心事讲给他听','n_f_trust',25,20,1
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=2 AND n.node_key='n_f_c2_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_doubt','开始怀疑，把消息删掉不回','n_f_doubt',-15,-10,2
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=2 AND n.node_key='n_f_c2_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_explain','把不安说出来，问清楚','n_f_explain',15,15,1
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=2 AND n.node_key='n_f_c2_choice2'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_avoid','假装什么都没发生','n_f_avoid',0,-10,2
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=2 AND n.node_key='n_f_c2_choice2'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

-- ------------------------------------------------------------
-- 女主线 · 第三章 → 结局
-- ------------------------------------------------------------
INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_start','旁白','十二月，走廊里全是道别。你终于明白自己想要的答案是什么。','corridor','dialogue','n_f_c3_choice'
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=3
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), next_node_key=VALUES(next_node_key), bg_key=VALUES(bg_key), node_type=VALUES(node_type);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_c3_choice','旁白','他在楼梯口站了很久，像是在等谁先开口。你说——','corridor','choice',NULL
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=3
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='choice', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO scene_nodes (chapter_id, node_key, speaker, content, bg_key, node_type, next_node_key)
SELECT c.id,'n_f_final','旁白','原来同一条走廊，从两个人的视角看，是两段完全不同的回忆。','corridor','ending',NULL
FROM chapters c WHERE c.route_id=2 AND c.chapter_no=3
ON DUPLICATE KEY UPDATE content=VALUES(content), speaker=VALUES(speaker), node_type='ending', next_node_key=NULL, bg_key=VALUES(bg_key);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_confess','「这次我先说——我一直在等你开口。」','n_f_final',30,30,1
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=3 AND n.node_key='n_f_c3_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);

INSERT INTO choices (node_id, option_key, option_text, next_node_key, effect_male, effect_female, sort_no)
SELECT n.id,'o_leave','「祝你以后一切都好。」然后转身离开','n_f_final',0,-25,2
FROM scene_nodes n JOIN chapters c ON c.id=n.chapter_id
WHERE c.route_id=2 AND c.chapter_no=3 AND n.node_key='n_f_c3_choice'
ON DUPLICATE KEY UPDATE option_text=VALUES(option_text), next_node_key=VALUES(next_node_key), effect_male=VALUES(effect_male), effect_female=VALUES(effect_female);
