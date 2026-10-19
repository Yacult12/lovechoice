#!/bin/bash
cd /opt/lovechoice

echo "=== 数据库里存的立绘路径 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e \
  "SELECT r.route_code, c.char_key, c.name, c.avatar_url
     FROM characters c JOIN routes r ON r.id = c.route_id
    ORDER BY r.id, c.id;" 2>/dev/null

echo ""
echo "=== 服务器上的立绘文件 ==="
docker compose exec -T frontend ls -1 /usr/share/nginx/html/assets/img/avatar/ 2>/dev/null | head -30

echo ""
echo "=== 剧本里 node 引用的立绘（抽样）==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e \
  "SELECT DISTINCT speaker_avatar FROM scene_nodes
    WHERE speaker_avatar IS NOT NULL AND speaker_avatar <> ''
    LIMIT 10;" 2>/dev/null || echo "（无 speaker_avatar 列）"

echo ""
echo "=== scene_nodes 表结构（找立绘列名）==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e \
  "SHOW COLUMNS FROM scene_nodes;" 2>/dev/null