#!/bin/bash
echo "=== 1. 数据库里该字段的原始字节 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B --default-character-set=binary love -e \
  "SELECT HEX(LEFT(content,4)) FROM scene_nodes WHERE node_type='dialogue' LIMIT 1;" 2>/dev/null
echo "  ↑ 若是 E69C A8 之类就是「他的」的 UTF-8 正确编码"

echo ""
echo "=== 2. 同一字段，强制 utf8mb4 读取 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B --default-character-set=utf8mb4 love -e \
  "SELECT speaker, LEFT(content,20) FROM scene_nodes WHERE node_type='dialogue' LIMIT 2;" 2>/dev/null

echo ""
echo "=== 3. 检查是否有二次编码（UTF-8 被当 latin1 存过一次）==="
echo "  正确「他」的 UTF-8 十六进制 : e4 b8 96"
echo "  乱码「æ—ç™½」对应的字节:  c3 a6 e2 80 94 c2 a7 c2 a6 c2 bd c3 a5"
docker compose exec -T mysql mysql -uroot -p123456 -N -B --default-character-set=binary love -e \
  "SELECT HEX(LEFT(speaker,3)) FROM scene_nodes WHERE node_type='dialogue' LIMIT 1;" 2>/dev/null

echo ""
echo "=== 4. 源 SQL 文件里的原始字节 ==="
echo "  本地 full_story.sql 的对应内容:"
docker compose exec -T backend sh -c \
  "grep -o '告白:.\{0,12\}' /app/sql/full_story.sql | head -1 | od -An -tx1 | head -2"

echo ""
echo "=== 5. 各表字符集 ==="
docker compose exec -T mysql mysql -uroot -p123456 -N -B love -e \
  "SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES
    WHERE TABLE_SCHEMA='love' LIMIT 4;" 2>/dev/null