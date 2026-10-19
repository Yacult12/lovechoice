#!/bin/bash
# 服务器端验收
cd /opt/lovechoice

echo "=== 容器状态 ==="
docker compose ps --format "table {{.Service}}\t{{.Status}}"

echo ""
echo "=== 健康检查 ==="
curl -s http://127.0.0.1:8080/api/health || echo "（无响应）"

echo ""
echo ""
echo "=== 数据完整性 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e "
SELECT 'routes',      COUNT(*) FROM routes
UNION ALL SELECT 'chapters',    COUNT(*) FROM chapters
UNION ALL SELECT 'scene_nodes', COUNT(*) FROM scene_nodes
UNION ALL SELECT 'choices',     COUNT(*) FROM choices
UNION ALL SELECT 'endings',     COUNT(*) FROM endings
UNION ALL SELECT 'characters',  COUNT(*) FROM characters
UNION ALL SELECT 'users',       COUNT(*) FROM users;" 2>/dev/null

echo ""
echo "=== 结局清单（8 个应全部可达）==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e \
  "SELECT r.route_code, e.ending_key, e.title, e.is_hidden
     FROM endings e JOIN routes r ON r.id = e.route_id
    ORDER BY r.route_code, e.id;" 2>/dev/null

echo ""
echo "=== 内存占用 ==="
free -m | head -2
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}" 2>/dev/null