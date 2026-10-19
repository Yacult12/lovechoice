#!/bin/bash
cd /opt/lovechoice
MY="docker compose exec -T mysql mysql -uroot -p123456"

echo "=== 1. chapters.title 原始字节（应为 e4b896 之类）==="
$MY -N -B --default-character-set=binary love -e \
  "SELECT HEX(LEFT(title,3)) FROM chapters LIMIT 1;" 2>/dev/null

echo ""
echo "=== 2. routes.title 原始字节（已修好，对照）==="
$MY -N -B --default-character-set=binary love -e \
  "SELECT HEX(LEFT(title,1)) FROM routes LIMIT 1;" 2>/dev/null

echo ""
echo "=== 3. scene_nodes.speaker 原始字节 ==="
$MY -N -B --default-character-set=binary love -e \
  "SELECT HEX(LEFT(speaker,2)) FROM scene_nodes LIMIT 1;" 2>/dev/null

echo ""
echo "=== 4. 用 CONVERT 现场试算（不落库）==="
$MY -N -B --default-character-set=binary love -e \
  "SELECT HEX(LEFT(CONVERT(title USING utf8mb4),3)) FROM chapters LIMIT 1;" 2>/dev/null

echo ""
echo "=== 5. 检查是否有双重套娃（三重编码）==="
$MY -N -B --default-character-set=binary love -e \
  "SELECT HEX(LEFT(title,2)) FROM chapters LIMIT 1;" 2>/dev/null
echo "  若为 c383 说明已转过一次，需再转一次"