#!/bin/bash
cd /opt/lovechoice

echo "=== 孤儿检查：saves 是否还指向不存在的章节 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT COUNT(*) AS orphan_saves
  FROM saves s LEFT JOIN chapters c ON c.id = s.chapter_id
 WHERE c.id IS NULL;" 2>/dev/null

echo "=== 孤儿检查：choice_logs 是否还指向不存在的节点 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT COUNT(*) AS orphan_logs
  FROM choice_logs cl LEFT JOIN scene_nodes n ON n.id = cl.node_id
 WHERE n.id IS NULL;" 2>/dev/null

echo "=== 各表行数 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT 'users',        COUNT(*) FROM users
UNION ALL SELECT 'saves',        COUNT(*) FROM saves
UNION ALL SELECT 'choice_logs',  COUNT(*) FROM choice_logs
UNION ALL SELECT 'user_endings', COUNT(*) FROM user_endings
UNION ALL SELECT 'chapters',     COUNT(*) FROM chapters
UNION ALL SELECT 'scene_nodes',  COUNT(*) FROM scene_nodes
UNION ALL SELECT 'choices',      COUNT(*) FROM choices
UNION ALL SELECT 'endings',      COUNT(*) FROM endings;" 2>/dev/null

echo ""
echo "=== 剧本自检（后端 validate）==="
for code in male female; do
  echo "  --- $code"
  curl -s "http://127.0.0.1:8080/api/story/routes/$code/validate" | head -c 400
  echo ""
done