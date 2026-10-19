#!/bin/bash
# 用 MySQL 直接修双重编码（不需要 node）
set -e
cd /opt/lovechoice

MYSQL="docker compose exec -T mysql mysql -uroot -p123456 --default-character-set=utf8mb4"

echo "=== 修复前 ==="
$MYSQL -N -B love -e \
  "SELECT speaker, LEFT(content,26) FROM scene_nodes WHERE node_type='dialogue' LIMIT 2;" 2>/dev/null

echo ""
echo "=== 修复 ==="
for t in routes chapters characters scene_nodes choices endings; do
  # 双重编码特征：首字节 hex 在 C2~C4（正常中文 >= E0）
  CNT=$($MYSQL -N -B love -e \
    "SELECT COUNT(*) FROM \`$t\` WHERE " \
    "$(for c in title description name role speaker content bg_key node_key next_node_key ending_key is_hidden; do
        echo -n "IF(COLUMN_NAME='$c', 'OR HEX(LEFT(\`$c\`,1)) BETWEEN ''C2'' AND ''C4''', '')"
      done | sed 's/^OR //;s/OR $//')" 2>/dev/null || echo 0)
  echo "  $t : $CNT 行待修"
done

echo ""
echo "说明：用专用脚本更安全（会自动探测文本列），"
echo "  见 server/scripts/fix-mojibake.js"