-- ============================================================
-- 剧本扩写：把每句台词从 ~25 字扩到 ~70-110 字
--
-- 原来的问题：台词像剧本提纲，不像人在说话。
-- 一句「谢谢你」就翻页，玩家根本进不去那个场景。
--
-- 改写原则：
--   1. 每句至少给一个**具体的物理细节**（温度、声音、气味、光线）
--   2. 旁白承担**环境 + 时间 + 心理**，不只是交代事件
--   3. 台词保留口语的犹疑感，用「……」和短句断节奏
--   4. 同一节点不重复信息，每句都往前推进一步
--
-- 只改 content，node_key / 选项 / 好感数值全部不动，
-- 所以结局判定和已有存档都不受影响。
-- ============================================================

-- ---------- 他的线 ----------

-- 第一章 · 初见
UPDATE scene_nodes SET content = '九月，图书馆的空调开得太冷，冷到你能看见自己说话时的白气。她坐在你斜后方第三排，你已经数过三次——书从她手里滑下去，砸在地板上，声音在整层楼都听得见。前两次她只是弯腰捡起来，第三次她停住了，手按在书封上，没有动。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '这一次，书直接滑到她脚边，封面朝下摊开，停在你鞋尖旁边。她没有立刻去捡。她只是抬起头，看着你，那种眼神不像是在等别人帮她——更像是在等一个反应，等你说点什么，做点什么，任何能打破这个安静的东西。空调在头顶嗡嗡地响，你们之间隔着大概两米。'
WHERE node_key = 'n_m1_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '「谢谢。」她弯腰的时候刘海整个垂下来，挡住了半张脸，让你看不见她的表情。她把书立起来，指腹在掉漆的封面上擦了一下，像是在确认什么。「其实……我是故意的。」她说得很轻，轻到你必须屏住呼吸才能听清，「书掉在你那边，比较容易。」'
WHERE node_key = 'n_m1_helped' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '你把书推了回去，说了句「下次小心」。声音不大，语气也不算冷，但那四个字落地之后，整段对话就结束了。她笑了一下——那个笑很难懂，不像尴尬，也不像不高兴，更像是在确认某件事。她把书抱在怀里，重新低头看下去，再没往你这边看过一眼。'
WHERE node_key = 'n_m1_ignored' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '九月的最后一周，你开始记住她翻书的节奏。大概每四分钟一页，遇到难的地方会停久一点，指尖在页边来回摸。那一周你什么也没多做，只是开始在图书馆待到比她晚。你没想过这是为什么，只是觉得那段时间，走得晚一点比较合理。'
WHERE node_key = 'n_m1_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 1
);

-- 第二章 · 靠近
UPDATE scene_nodes SET content = '十月，教室的窗户关不严，风从缝里钻进来，把桌上的卷子吹得哗哗响。你们的位置隔了两排——不远不近，近到你能看见她抬头，远到你们不必说话。第七节课下课，她没有像往常一样立刻走，而是趴在桌上，很久没有动。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「我最近有点累……」她声音很轻，几乎是半句就断了。手指绕着笔转了两圈，又停住。她没有看你，但也没有把脸完全转开，就那样卡在中间，像在等你替她把后半句补完。教室里的其他人都在收东西，椅子拖动的声音显得特别吵。'
WHERE node_key = 'n_m2_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「那就都说给我听，今天什么都别扛着。」你把手里的笔放下了，笔尖滚到桌沿，掉在地上。她愣了一下——大概没料到你会这么直接。接下来的二十分钟，她说了很多，你一句都没插。她的声音慢慢变稳，而你第一次发现，听一个人说话也可以是一件很累、又很舒服的事。'
WHERE node_key = 'n_m2_listen' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「谁不累。」话一出口，你就知道说错了。你想说的是「我也累」，但那三个字听起来像是在嫌她矫情。她停住了，笔在手里被捏得更紧，然后「哦」了一声，重新低下头去。那一整节晚自习你们都没再说话，空气凉得像是从那扇破窗灌进来的。'
WHERE node_key = 'n_m2_argue' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '晚上十点，回宿舍的路要绕一大段，才经过那家还亮着灯的店。你其实可以直接走另一条，近五分钟，什么都不用买。你站在路口看了三秒那盏灯，然后拐了过去。'
WHERE node_key = 'n_m2_c2' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「……你怎么知道我今天想吃这个。」她接过袋子的时候愣了一下，然后笑了，笑到眼睛有点亮。灯光从侧面打过来，她的脸有一半是暖的。她低头翻了一下袋子里的东西，声音有点抖：「我今天什么都没说啊。」'
WHERE node_key = 'n_m2_gift' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '你什么都没买。你走了那条近路，回宿舍，洗漱，上床。手机屏幕在黑暗里亮了一整夜——十一次，你看了十一次。每次都告诉自己再等五分钟就睡。凌晨两点你终于把手机扣过去，想着明天再说吧。明天她大概也已经睡了。'
WHERE node_key = 'n_m2_skip' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '十月结束的时候，你发现沉默是会累积的。不是那种一次性的、能靠一句「算了」抵消的沉默，而是一层一层摞起来的：她不再主动问你在干嘛，你也不再特意绕远。两个人都还坐在那个位置上，但中间好像多了一堵透明的墙，谁都没有再试着敲过。'
WHERE node_key = 'n_m2_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 2
);

-- 第三章 · 传闻
UPDATE scene_nodes SET content = '十一月，隔壁班开始传你和她的事。传得比真的快，也比真的难听。你是在食堂听到的——一群人压着嗓子笑，你还没走过去，笑声就停了。那种安静比笑声更让人难受，因为它意味着他们都知道，只有你自己还不知道。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '朋友端着饭过来，在你旁边坐下，问得特别随意，好像只是问天气：「你俩是不是在一起了？」几个人跟着看过来。你嘴里还嚼着东西，喉咙忽然有点干。你知道只要一句话，这件事就会被定性——说「有」，它就成了真的；说「没有」，它就变成了你亲手掐死的。'
WHERE node_key = 'n_m3_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '「别瞎说。」你笑着把话挡回去，语气轻松得像在讲一个笑话。然后你抬起头，看向她在的方向——那一看，你就把这句否认的重量全暴露了。有人在笑，有人没笑。她低着头在吃饭，从头到尾没有抬起来过。'
WHERE node_key = 'n_m3_admit' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '「没有的事。」你说得很快，快到自己都听出了心虚。那四个字出去之后，桌上安静了两秒，有人「哦」了一声，有人笑着说「那没事」。你跟着笑，笑完低头扒饭，米粒在嘴里什么味道都没有。你不敢往她那个方向看，因为你知道如果看了，就得解释点什么。'
WHERE node_key = 'n_m3_deny' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '「他们说的是真的吗。」她把这句话问得很平，平到听不出任何情绪。但她没有看你——她盯着自己碗里的汤，手指在勺子柄上来回蹭。「我想听你说。」她补了一句，声音终于有了一点裂痕。食堂的嘈杂忽然变得很远，你只听见自己心跳的声音。'
WHERE node_key = 'n_m3_c2' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '「是真的。」你说完，她才抬起头。眼睛是红的，但没有掉下来。她看了你很久，久到旁边的人开始收餐盘。「你怎么不早讲。」她说，声音很稳，稳得像在陈述别人的事。奇怪的是，那一刻你反而宁愿她哭——她哭的话，你还能道歉。'
WHERE node_key = 'n_m3_truth' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '「你觉得呢。」你试图用一个玩笑把话滑过去。她配合地笑了一下——那个笑很短，像按错了开关。她站起来，把餐盘收了，动作很轻，轻到不打扰任何人。走之前她说了句「我吃完了」，语气礼貌得近乎陌生，像是你们已经很多年没说过话了。'
WHERE node_key = 'n_m3_joke' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '那天之后，你们在食堂坐得比从前远了两个座位。不远，只是刚好够一个人走过去而不需要打招呼。她开始习惯性地跟别人一起吃饭，笑声也多了。你发现自己开始数她跟谁坐在一起，数到第三个晚上才意识到自己在干什么。'
WHERE node_key = 'n_m3_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 3
);

-- 第四章 · 雨夜
UPDATE scene_nodes SET content = '十一月最后一场雨，下得毫无预兆。放学铃响的时候天已经黑了一半，她站在教学楼门口，没带伞。她看着雨，脚往前挪了半步，又收回来。伞在你手里，一把。你在雨棚下站了大概三分钟，一直没动。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '雨很大，大到能见度只剩十几米。你手里只有一把伞——你带的，本来只是怕自己淋湿回家。你看着她，她也看到你了。她没有走过来，只是往这边看了一眼，然后低下头去。那一眼很短，但你确定她看见你了，因为她的脚尖转了个方向。'
WHERE node_key = 'n_m4_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '你把伞塞过去就跑。雨点砸在背上，很疼，你能感觉到温度一层一层被带走。跑出十米她才喊住你，声音被雨声切碎了一半——「喂！」你听见了，但你没有敢回头。你一直跑到校门口的便利店，整个人湿透，然后蹲在货架后面喘了很久很久。'
WHERE node_key = 'n_m4_umbrella' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '你把伞塞进她手里，转身走进了雨里。你没敢看她的表情，只记得伞柄是凉的，你的手是烫的，烫得握不住。走出很远之后你才放慢脚步，听见后面没有伞撑开的声音——她没有追上来。你不知道她是站在原地，还是也走进了雨里。'
WHERE node_key = 'n_m4_run' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '「我们是不是……不合适。」她说完这句就不说了，眼睛看着雨。伞在这时候显得特别没用——挡得住雨，挡不住这句话。她的刘海湿了一半，贴在脸上，她也不去拨。你听见自己心跳得很重，重到她应该也听得见。'
WHERE node_key = 'n_m4_c2' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '「是我不好。」你在雨里站住了，没有走，也没有再往前走。「你要走我不拦，但你得让我陪。」说完你才发现自己声音在抖。你不知道自己是怎么把这句话说完整的，只知道说完之后雨好像变小了，或者只是你不再听见了。'
WHERE node_key = 'n_m4_stay' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '「可能是吧。」你说完就走了。雨很大，理由很充分——你没有伞，你会感冒，明天还有事。你没有回头，但你走得很慢，慢得像在给谁留一个叫住你的机会。一直走到校门口你才停下，扶着墙站了一会儿，然后发现自己根本不知道该往哪边走。'
WHERE node_key = 'n_m4_left' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '那天夜里下了很久的雨，到早上四点才停。天亮的时候你们都没有发消息。她发来的是一个链接，凌晨四点二十七分——你点的那个外卖店的。你看了很久，最后回了一句「谢谢」，把那三个字删掉又打出来三遍，最后还是没有发出去。'
WHERE node_key = 'n_m4_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 4
);

-- 第五章 · 走廊
UPDATE scene_nodes SET content = '十二月，毕业季。走廊里全是道别的声音，和行李箱轮子在瓷砖上滚过的响声。有人在哭，有人在拍合照，照片一张一张地被塞进手机。所有人都在急着把最后几天变成很多很多张照片，而你站在楼梯口，忽然不知道自己在等什么。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 5
);

UPDATE scene_nodes SET content = '她在楼梯口站了很久，手里握着一封没有署名的信——纸边已经被捏得有点软了，说明她拿着它很久了。她看见你走过来，手指收紧了一下，又松开。她没有说话，也没有走。就那样站着，好像在等你先开口，或者等一个不用开口的答案。'
WHERE node_key = 'n_m5_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 5
);

UPDATE scene_nodes SET content = '后来的故事，取决于你们两个人在那之前，一次次把对方放在心上的重量。没有人会替你记住这些——只有你自己会记得：她翻书是每四分钟一页，她累了会把笔转两圈再停住，她笑的时候眼睛会先亮一下。这些东西加起来，是别人拿不走的。'
WHERE node_key = 'n_final' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'male' AND c.chapter_no = 5
);


-- ---------- 她的线 ----------

-- 第一章 · 借书
UPDATE scene_nodes SET content = '九月，图书馆的空调很足。她第三次把书碰掉，书脊磕在地板上的声音很闷。她蹲下去捡的时候刘海全垂下来，挡住了脸——她知道你坐在斜前方两米的地方，也知道你一定会回头。她数着你的反应延迟，比数自己的心跳还认真。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '他走过来了，在书旁边蹲下。空调的风从头顶吹下来，把你们之间的空气吹得很凉。他抬头看你——那个眼神很紧张，手都不知道该往哪儿放，最后停在书的封面上。你要——'
WHERE node_key = 'n_f1_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '「谢谢。」你接过书。两个人都没有立刻松手，书在中间悬了两秒，指尖碰到的地方比想象中凉。你没有躲开。你低着头看那只还留在封面上的手，然后决定就这样多停一会儿——反正他也没有要收回去的意思。'
WHERE node_key = 'n_f1_thanks' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '你抽回书，说了句「不用」。声音有点硬，硬到自己听着都觉得陌生。你站起来走的时候听见身后安静了两秒——那两秒里你一直在想，他是不是本来打算说什么。你没有回头，所以也没有看见他在原地站着，一直站到你走远。'
WHERE node_key = 'n_f1_cold' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 1
);

UPDATE scene_nodes SET content = '你后来才知道，那天他是特意换到你能看见的位置坐下的。他换座位那天是下午第二节，你记得，因为他换的时候把书从左边挪到了右边。也就是说——他挑那个位置的时候，就已经算好了光线，也算好了你抬头的时候会不会看见他。'
WHERE node_key = 'n_f1_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 1
);

-- 第二章 · 误解
UPDATE scene_nodes SET content = '十月，你在自习室看见他。他总是坐在能看见你的那个位置——你现在已经确定了，因为那个位置每天都被抢，而他不换。隔了两排，你看得清他的后脑勺和肩膀，看不清他的表情。他也从来没坐得更近过。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '你发了条消息：「今天有点累。」发出去之后你把手机扣在桌上，告诉自己他可能在忙。四十分钟过去了，两小时，三小时，快四小时的时候你把手机拿起来看了一眼——没有新消息。你又扣下去，然后发现自己一整个下午都没看进去那道题。'
WHERE node_key = 'n_f2_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「可能他在忙吧。」你替他找了个理由。这个理由你想了三个小时，从他可能在考试，想到他可能在开会，想到他手机没电。你用这个理由把剩下那道题写完了，写的过程中一个字都没看进去，但你还是写完了。'
WHERE node_key = 'n_f2_trust' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「他是不是……其实没那么在意。」这句话你在心里转了一整晚，转得越来越具体：他是不是只是顺手才捡的书，他是不是换座位只是因为那边空，他是不是连消息都没看到。你越想越清醒，清醒到睡不着。'
WHERE node_key = 'n_f2_doubt' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「昨天手机没电了。」他停了一下，那一下停得有点久，像在决定要不要继续说下去。「不是不想回你。」他说这句话的时候没有看屏幕，键盘敲得很慢。你看着那行字看了十几秒——你知道他不知道你昨晚经历了什么，但你还是想笑。'
WHERE node_key = 'n_f2_c2' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「下次没电前先跟我说一声，我会乱想。」你说得很直白。发出去之后你盯着屏幕，心跳得比那晚等消息的时候还快。你没有撤回，也没有补一句「开玩笑」。有些话你不想用玩笑包住。'
WHERE node_key = 'n_f2_talk' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '「嗯，没事。」你把真正想说的那句咽了回去，只回了一个笑脸。发完之后你退出了对话，又点进去看了两次，确认他有没有正在输入。他没有。你把手机锁屏，翻身面朝墙，心里想的是：说清楚是不是太贪心了。'
WHERE node_key = 'n_f2_avoid' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

UPDATE scene_nodes SET content = '有些误会不是谁做错了，只是两个人都在等对方先解释。你等了三天，他等了三天，两个人都在等对方先开口。最后什么都没有发生，误会就那么留在那里，像一层薄薄的冰，谁也不肯先踩碎。'
WHERE node_key = 'n_f2_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 2
);

-- 第三章 · 传闻
UPDATE scene_nodes SET content = '十一月，隔壁班开始传你们的事。传的内容，比你们之间真实发生的多十倍。有人说他每天在你楼下等，有人说你收到过一束花，有人说你们早就——你听到这些的时候，正在去教室的路上，走得很慢，慢到自己都没发现。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '朋友来问你，语气里带着那种「我都知道了」的意味：「你们是不是在一起了？」她问得并不恶意，但那句话落在耳朵里还是会有重量。你发现自己想立刻否认，又发现自己想承认——这两件事同时存在，把你卡在原地。'
WHERE node_key = 'n_f3_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '「大概……算是吧。」你说完，心跳得比实话还快。这句话不算撒谎，但也不是全部的实话——你们之间确实有一些什么，只是还没有一个名字。你说完就低下头，指尖把餐巾纸折了又折。'
WHERE node_key = 'n_f3_yes' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '「没有，我们只是同学。」你说得很熟练，熟练得让自己难受。这句话你练过的——在心里练过很多次，练到脱口而出没有一点延迟。说完你笑了一下，那个笑连你自己都不相信。你没有解释，因为解释就要承认。'
WHERE node_key = 'n_f3_no' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '第二天在食堂，他坐得比平时远。隔了三张桌子。你端着汤在原地站了一会儿，脚知道往哪边走，脑子却在算：走过去说什么？说「昨天传闻的事」？那听起来太刻意。你最后还是走了过去。'
WHERE node_key = 'n_f3_c2' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '你端着汤走过去，在他对面坐下。托盘碰到桌面的声音有点大，旁边的人抬头看了一眼。你把汤放下，看着他：「昨天的传闻，我想听你说。」你语气比自己想象的平静，平静到像是排练过——其实你确实排练过，在床上翻来覆去的时候。'
WHERE node_key = 'n_f3_ask' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '你没有过去。你低头喝汤，汤很烫，足够你用一整个午休来想「我现在过去会不会很突兀」。你想了四十分钟，汤凉了也没喝完。抬头的时候他已经走了，位置空着，餐盘收得干干净净。'
WHERE node_key = 'n_f3_silent' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

UPDATE scene_nodes SET content = '传闻从来没有停过。只有你们自己知道那天中午发生了什么——什么也没发生，或者只发生了一半。你回宿舍的路上又想起那个空掉的座位，想起自己坐了四十分钟的犹豫。你想，早知道刚才就过去了。'
WHERE node_key = 'n_f3_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 3
);

-- 第四章 · 一把伞
UPDATE scene_nodes SET content = '十一月最后一场雨。他站在便利店门口，靠着玻璃，手里什么也没有。雨下得很稳，没有要停的意思。他站了大概二十分钟，期间看了四次手机，又四次把手机放回口袋。你从另一侧过来，本来可以绕开。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '你有一把伞。伞只够一个人。你看着他被雨雾打湿的肩膀，忽然意识到他大概也没带——他不是那种会带伞的人，永远幻想自己不会遇上雨。你要——'
WHERE node_key = 'n_f4_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '你收了伞，站到他旁边。两个人一起看了二十分钟的雨，谁都没有说话。便利店的灯在你们背后亮着，把两个人的影子投在湿地面上，挨得很近。二十分钟里你想了很多，但最后你决定一句都不说。'
WHERE node_key = 'n_f4_wait' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '你从另一边走了。走的时候雨很凉，你听见自己松了一口气——你分不清是因为终于不用开口，还是因为你没有等到他先说话。那口气松下来的瞬间，你就知道你会后悔。'
WHERE node_key = 'n_f4_left' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '「伞给你。」他把伞递过来的时候，手一直在抖。他自己已经在雨里了，肩膀湿了一片，说话时牙齿轻轻打着颤。「我不远，走两步就到了。」他这么说的时候，脚却没有要动的意思。'
WHERE node_key = 'n_f4_c2' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '他接过伞，看了你两秒。那两秒里你看见他的嘴唇动了动，像是想说什么，最后只说出三个字：「……那算了。」然后他转身走进了雨里。你站在原地，伞在手里，重量忽然变得很具体。'
WHERE node_key = 'n_f4_hold' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '你接过来，又把伞塞回他手里。「一起走。」你说得很平静，平静到像是在说一件早就决定好的事。他愣了一下，接过伞柄，那只手还在抖。伞撑开的时候有点费劲，你伸手扶了一下，两个人都没说话，并排往雨里走。'
WHERE node_key = 'n_f4_share' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '「你留着吧。」你接过伞，走了。伞很重，你一路都没打开。走到宿舍楼下你才发现自己的刘海一直在滴水，顺着眉骨往下淌。你把伞抱在怀里上楼，进了门才敢把它打开——伞面上还是干的，只有你的肩膀湿透了。'
WHERE node_key = 'n_f4_refuse' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

UPDATE scene_nodes SET content = '那天夜里下了很久的雨，到早上四点才停。天亮的时候，伞在你书包里，已经干了。你把它拿出来，看了一会儿，又放回去。你想的是：明天要是有机会，我要把这句话说出来。明天很冷，但也许会有雨。'
WHERE node_key = 'n_f4_end' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 4
);

-- 第五章 · 走廊
UPDATE scene_nodes SET content = '十二月，毕业季。同一条走廊，你已经走了四年，他只走了一年。你还记得大一的时候在这条走廊上迷路，是谁带着你走到了教学楼。现在你站在同一段楼梯上，忽然很想让他再带你走一次。'
WHERE node_key = 'n_start' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 5
);

UPDATE scene_nodes SET content = '他在楼梯口站了很久，像是在等谁先开口。你走过去，在他旁边站定，隔了半步的距离。他手里那封没有署名的信已经被捂热了。你看着他，没有说话——这一次，你想先听他说。'
WHERE node_key = 'n_f5_c' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 5
);

UPDATE scene_nodes SET content = '原来同一条走廊，从两个人的视角看，是两段完全不同的回忆。他记得的是你换过座位的位置，你记得的是他换座位的那个下午。他记得雨和伞，你记得的是二十分钟的沉默。有些东西只有对着同一个人说出来，才能拼成一整个故事。'
WHERE node_key = 'n_final' AND chapter_id IN (
  SELECT c.id FROM chapters c JOIN routes r ON r.id = c.route_id
  WHERE r.route_code = 'female' AND c.chapter_no = 5
);