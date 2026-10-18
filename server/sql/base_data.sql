-- ============================================================
--   基础数据（由 export-base-data.js 从现有库导出）
--
--   为什么必须有这个文件：
--   schema.sql 只建表，不灌数据。而 full_story.sql 第 18 行靠
--     SET @r_male := (SELECT id FROM routes WHERE route_code = 'male');
--   拿路由 id。若 routes 表为空，@r_male 就是 NULL，后续 INSERT
--   会报 ERROR 1048 (23000): Column 'route_id' cannot be null。
--
--   这批数据原先是我在数据库里手工插入的，仓库里没有，
--   导致 CI / Docker 初始化 / 换机重建 全部失败。
--
--   表：routes（故事线）、characters（角色定义）
--   执行顺序：schema.sql → base_data.sql → full_story.sql
-- ============================================================

SET NAMES utf8mb4;

-- ---------- 故事线 ----------
INSERT INTO routes (route_code, title, description, sort_no) VALUES
  ('male', '他的视角', '从男主的角度走一遍这段感情', 1)
  ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description), sort_no = VALUES(sort_no);

INSERT INTO routes (route_code, title, description, sort_no) VALUES
  ('female', '她的视角', '从女主的角度重看同一段故事', 2)
  ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description), sort_no = VALUES(sort_no);

-- ---------- 角色定义 ----------
INSERT INTO characters (route_id, char_key, name, role, avatar_url)
SELECT r.id, t.char_key, t.name, t.role, t.avatar_url
  FROM (
  SELECT 'male' AS route_code, 'male' AS char_key, '他' AS name, 'protagonist' AS role, 'assets/img/avatar/male-soft.svg' AS avatar_url
  UNION ALL
  SELECT 'male' AS route_code, 'female' AS char_key, '她' AS name, 'partner' AS role, 'assets/img/avatar/female-soft.svg' AS avatar_url
  ) AS t
  JOIN routes r ON r.route_code = t.route_code
  ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url);

INSERT INTO characters (route_id, char_key, name, role, avatar_url)
SELECT r.id, t.char_key, t.name, t.role, t.avatar_url
  FROM (
  SELECT 'female' AS route_code, 'female' AS char_key, '她' AS name, 'protagonist' AS role, 'assets/img/avatar/female-soft.svg' AS avatar_url
  UNION ALL
  SELECT 'female' AS route_code, 'male' AS char_key, '他' AS name, 'partner' AS role, 'assets/img/avatar/male-soft.svg' AS avatar_url
  ) AS t
  JOIN routes r ON r.route_code = t.route_code
  ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url);

-- ---------- 自检 ----------
-- 若下面两句的返回值不是预期数量，说明基础数据没灌进去：
--   SELECT COUNT(*) FROM routes;      -- 应为 2
--   SELECT COUNT(*) FROM characters;  -- 应为 4
