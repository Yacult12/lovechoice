-- ============================================================
--   数据库结构（由 export-schema.js 从真实库导出）
--   改动表结构后请重新运行该脚本，不要手改这个文件
--   库名: love    表数: 10
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────────────────────────
-- 表: chapters  章节
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `chapters` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '章节ID',
  `route_id` tinyint unsigned NOT NULL COMMENT '所属故事线',
  `chapter_no` tinyint unsigned NOT NULL COMMENT '第几章',
  `title` varchar(64) NOT NULL COMMENT '章节标题',
  `start_node` varchar(64) NOT NULL COMMENT '起始节点key',
  `is_published` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否已发布',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_route_chapter` (`route_id`, `chapter_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: characters  角色定义
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `characters` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `route_id` tinyint unsigned NOT NULL COMMENT '所属故事线',
  `char_key` varchar(32) NOT NULL COMMENT '角色代码，如 male/female',
  `name` varchar(32) NOT NULL COMMENT '角色名',
  `role` enum('protagonist','partner') NOT NULL COMMENT '主角/对方',
  `avatar_url` varchar(255) DEFAULT NULL COMMENT '立绘路径',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_route_char` (`route_id`, `char_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: choice_logs  玩家实际选择记录
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `choice_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id` bigint unsigned NOT NULL COMMENT '用户',
  `route_id` tinyint unsigned NOT NULL COMMENT '故事线',
  `choice_id` bigint unsigned NOT NULL COMMENT '选了哪个选项',
  `node_key` varchar(64) NOT NULL COMMENT '在哪个节点选的',
  `affection_male_before` smallint NOT NULL DEFAULT 0 COMMENT '选择前男方好感',
  `affection_female_before` smallint NOT NULL DEFAULT 0 COMMENT '选择前女方好感',
  `affection_male_after` smallint NOT NULL DEFAULT 0 COMMENT '选择后男方好感',
  `affection_female_after` smallint NOT NULL DEFAULT 0 COMMENT '选择后女方好感',
  `created_at` datetime DEFAULT 'CURRENT_TIMESTAMP',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_choice` (`choice_id`),
  UNIQUE KEY `idx_user_route` (`user_id`, `route_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: choices  选项定义
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `choices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '选项ID',
  `node_id` bigint unsigned NOT NULL COMMENT '所属节点',
  `option_key` varchar(64) NOT NULL COMMENT '选项key',
  `option_text` varchar(255) NOT NULL COMMENT '按钮文案',
  `next_node_key` varchar(64) NOT NULL COMMENT '选择后跳转节点',
  `effect_male` smallint NOT NULL DEFAULT 0 COMMENT '男方好感增量(可负)',
  `effect_female` smallint NOT NULL DEFAULT 0 COMMENT '女方好感增量(可负)',
  `sort_no` tinyint NOT NULL DEFAULT 0 COMMENT '选项排序',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_node` (`node_id`),
  UNIQUE KEY `uk_node_option` (`node_id`, `option_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: endings  结局定义
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `endings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT '结局ID',
  `route_id` tinyint unsigned NOT NULL COMMENT '所属故事线',
  `ending_key` varchar(64) NOT NULL COMMENT '结局key',
  `title` varchar(64) NOT NULL COMMENT '结局名',
  `description` varchar(500) DEFAULT NULL COMMENT '结局描述',
  `condition_json` json DEFAULT NULL COMMENT '达成条件JSON',
  `is_hidden` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否隐藏结局',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_route_ending` (`route_id`, `ending_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: routes  故事线定义
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `routes` (
  `id` tinyint unsigned NOT NULL AUTO_INCREMENT COMMENT '故事线ID',
  `route_code` varchar(16) NOT NULL COMMENT 'male/female',
  `title` varchar(64) NOT NULL COMMENT '展示名，如「他的视角」',
  `description` varchar(255) DEFAULT NULL COMMENT '一句话简介',
  `sort_no` tinyint NOT NULL DEFAULT 0 COMMENT '展示排序',
  PRIMARY KEY (`id`),
  UNIQUE KEY `route_code` (`route_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: saves  存档进度
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `saves` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '存档ID',
  `user_id` bigint unsigned NOT NULL COMMENT '所属用户',
  `slot` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '档位0-9',
  `route_id` tinyint unsigned NOT NULL COMMENT '当前故事线',
  `chapter_id` int unsigned DEFAULT NULL COMMENT '当前章节',
  `node_key` varchar(64) NOT NULL COMMENT '当前节点',
  `affection_male` smallint NOT NULL DEFAULT 0 COMMENT '男方好感当前值',
  `affection_female` smallint NOT NULL DEFAULT 0 COMMENT '女方好感当前值',
  `state_json` json DEFAULT NULL COMMENT '其他状态标记(flag/道具/已读)',
  `schema_version` int NOT NULL DEFAULT 1 COMMENT '存档结构版本',
  `play_seconds` int unsigned NOT NULL DEFAULT 0 COMMENT '累计游玩秒数',
  `updated_at` datetime DEFAULT 'CURRENT_TIMESTAMP',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user` (`user_id`),
  UNIQUE KEY `uk_user_slot` (`user_id`, `slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: scene_nodes  剧情节点
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `scene_nodes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '节点ID',
  `chapter_id` int unsigned NOT NULL COMMENT '所属章节',
  `node_key` varchar(64) NOT NULL COMMENT '剧本中的节点key',
  `speaker` varchar(32) DEFAULT NULL COMMENT '说话人，NULL=旁白',
  `content` text DEFAULT NULL COMMENT '对白正文',
  `bg_key` varchar(64) DEFAULT NULL COMMENT '背景图key',
  `node_type` enum('dialogue','choice','ending') NOT NULL DEFAULT 'dialogue' COMMENT '节点类型',
  `next_node_key` varchar(64) DEFAULT NULL COMMENT '线性推进的下一个节点',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_chapter` (`chapter_id`),
  UNIQUE KEY `uk_chapter_node` (`chapter_id`, `node_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: user_endings  用户已解锁结局
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_endings` (
  `user_id` bigint unsigned NOT NULL,
  `ending_id` int unsigned NOT NULL,
  `route_id` tinyint unsigned NOT NULL,
  `unlocked_at` datetime DEFAULT 'CURRENT_TIMESTAMP',
  PRIMARY KEY (`user_id`, `ending_id`),
  UNIQUE KEY `idx_user_route` (`user_id`, `route_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ────────────────────────────────────────────────────────────
-- 表: users  用户账号
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(32) NOT NULL COMMENT '登录名',
  `password_hash` varchar(100) NOT NULL COMMENT 'bcrypt哈希(60字符)',
  `nickname` varchar(32) DEFAULT NULL COMMENT '昵称',
  `created_at` datetime DEFAULT 'CURRENT_TIMESTAMP' COMMENT '注册时间',
  `last_login_at` datetime DEFAULT NULL COMMENT '最后登录时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
