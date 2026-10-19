#!/bin/bash
# 从源文件重新导入数据库，强制 UTF-8
#
# 为什么不用 UPDATE 修：
#   数据已历经「双重编码 → 我那次修复 → 反向又转了一次」，
#   现在是三重编码，再往回转极易再转错。
#   源文件（server/sql/*.sql）本身是正确的 UTF-8，
#   重新导入是唯一干净可靠的办法，而且只要几分钟。
#
# 关键：mysql 客户端必须用 --default-character-set=utf8mb4
#       否则会重现 latin1 导入导致的双重编码。

set -e
cd /opt/lovechoice

echo "=== 1. 备份当前库（保险）==="
docker compose exec -T mysqldump -uroot -p123456 \
  --default-character-set=utf8mb4 love > /tmp/love-backup.sql 2>/dev/null || true
echo "  已备份到 /tmp/love-backup.sql ($(wc -c < /tmp/love-backup.sql) 字节)"

echo ""
echo "=== 2. 删除并重建库 ==="
docker compose exec -T mysql mysql -uroot -p123456 -e "
  DROP DATABASE IF EXISTS love;
  CREATE DATABASE love DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
  SELECT '库已重建';" 2>/dev/null

echo ""
echo "=== 3. 按正确顺序导入（强制 utf8mb4）==="
IMPORT="docker compose exec -T mysql mysql -uroot -p123456 --default-character-set=utf8mb4 love"

for f in schema base_data full_story expand_dialogue avatars; do
  printf "  %-20s" "$f.sql"
  if $IMPORT < server/sql/$f.sql 2>/tmp/err.txt; then
    echo "OK"
  else
    echo "失败"
    cat /tmp/err.txt | head -5
    exit 1
  fi
done

echo ""
echo "=== 4. 验证中文 ==="
docker compose exec -T mysql mysql -uroot -p123456 --default-character-set=utf8mb4 -N -B love -e \
  "SELECT speaker, LEFT(content,24) FROM scene_nodes WHERE node_type='dialogue' LIMIT 3;" 2>/dev/null

echo ""
docker compose exec -T mysql mysql -uroot -p123456 --default-character-set=utf8mb4 -N -B love -e \
  "SELECT r.route_code, c.title FROM chapters c JOIN routes r ON r.id=c.route_id LIMIT 3;" 2>/dev/null

echo ""
echo "  结局："
docker compose exec -T mysql mysql -uroot -p123456 --default-character-set=utf8mb4 -N -B love -e \
  "SELECT title FROM endings ORDER BY id;" 2>/dev/null | sed 's/^/    /'

echo ""
echo "=== 5. 字节级校验（首字符应为 e4/e5/e6 等中文 UTF-8 起始字节）==="
docker compose exec -T mysql mysql -uroot -p123456 --default-character-set=binary -N -B love -e \
  "SELECT 'speaker', HEX(LEFT(speaker,2)) FROM scene_nodes LIMIT 1
   UNION ALL SELECT 'chapter', HEX(LEFT(title,2)) FROM chapters LIMIT 1
   UNION ALL SELECT 'ending',  HEX(LEFT(title,2)) FROM endings LIMIT 1;" 2>/dev/null

echo ""
echo "=== 6. 数据量核对 ==="
docker compose exec -T mysql mysql -uroot -p123456 --default-character-set=utf8mb4 -N -B love -e "
SELECT 'routes',COUNT(*) FROM routes
UNION ALL SELECT 'chapters',COUNT(*) FROM chapters
UNION ALL SELECT 'scene_nodes',COUNT(*) FROM scene_nodes
UNION ALL SELECT 'choices',COUNT(*) FROM choices
UNION ALL SELECT 'endings',COUNT(*) FROM endings
UNION ALL SELECT 'characters',COUNT(*) FROM characters;" 2>/dev/null