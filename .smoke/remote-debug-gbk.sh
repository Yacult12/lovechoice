#!/bin/bash
# 排查游戏内中文乱码
echo "=== 1. 数据库里的中文是否正常 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e \
  "SELECT r.route_code, c.title FROM chapters c JOIN routes r ON r.id=c.route_id LIMIT 3;" 2>/dev/null

echo ""
echo "=== 2. API 返回的中文 ==="
curl -s http://127.0.0.1:8080/api/story/routes | head -c 400
echo ""

echo ""
echo "=== 3. 容器内SQL 文件的字节头（BOM 检测）==="
docker compose exec -T backend sh -c 'head -c 12 /app/sql/full_story.sql | od -An -tx1'

echo ""
echo "=== 4. 容器内 JS 文件字节头 ==="
docker compose exec -T backend sh -c 'head -c 12 /app/src/services/storyService.js | od -An -tx1'

echo ""
echo "=== 5. 前端静态资源字节头 ==="
docker compose exec -T frontend sh -c 'head -c 12 /usr/share/nginx/html/assets/js/pages/play.js | od -An -tx1'

echo ""
echo "=== 6. 实际抓一个剧情节点的中文 ==="
curl -s -X POST http://127.0.0.1:8080/api/play/start \
  -H 'Content-Type: application/json' \
  -d '{"routeCode":"male"}' | head -c 500
echo ""

echo ""
echo "=== 7. locale 与字符集 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B -e \
  "SHOW VARIABLES LIKE 'character_set%';" 2>/dev/null | head -6