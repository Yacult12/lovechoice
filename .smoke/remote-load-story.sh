#!/bin/bash
# 加载新剧本到数据库
cd /opt/lovechoice

echo "=== 灌入前 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT 'routes',      COUNT(*) FROM routes
UNION ALL SELECT 'chapters',    COUNT(*) FROM chapters
UNION ALL SELECT 'scene_nodes', COUNT(*) FROM scene_nodes
UNION ALL SELECT 'choices',     COUNT(*) FROM choices
UNION ALL SELECT 'endings',     COUNT(*) FROM endings;" 2>/dev/null

echo ""
echo "=== 执行 full_story.sql ==="
docker compose exec -T mysql mysql -uroot -p123456 love < server/sql/full_story.sql 2>&1 | head -5
echo "  (无输出即无报错)"

echo ""
echo "=== 灌入后 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT 'routes',      COUNT(*) FROM routes
UNION ALL SELECT 'chapters',    COUNT(*) FROM chapters
UNION ALL SELECT 'scene_nodes', COUNT(*) FROM scene_nodes
UNION ALL SELECT 'choices',     COUNT(*) FROM choices
UNION ALL SELECT 'endings',     COUNT(*) FROM endings;" 2>/dev/null

echo ""
echo "=== 章节标题 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT r.route_code, c.chapter_no, c.title
  FROM chapters c JOIN routes r ON r.id = c.route_id
 ORDER BY r.sort_no, c.chapter_no;" 2>/dev/null

echo ""
echo "=== 结局清单 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT r.route_code, e.ending_key, e.title, e.is_hidden
  FROM endings e JOIN routes r ON r.id = e.route_id
 ORDER BY r.sort_no, e.id;" 2>/dev/null

echo ""
echo "=== 结局条件（看互斥与完备）==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT r.route_code, e.ending_key, e.condition_json
  FROM endings e JOIN routes r ON r.id = e.route_id
 ORDER BY r.sort_no, e.id;" 2>/dev/null