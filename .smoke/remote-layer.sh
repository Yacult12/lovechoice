#!/bin/bash
cd /opt/lovechoice
MY="docker compose exec -T mysql mysql -uroot -p123456"

echo "=== 逐层剥离，定位真实编码层数 ==="
$MY -N -B --default-character-set=binary love -e "
SELECT
  HEX(LEFT(speaker, 6))                AS raw,
  HEX(LEFT(CONVERT(UNHEX(HEX(speaker)) USING utf8mb4), 3)) AS cv1,
  HEX(LEFT(CONVERT(UNHEX(HEX(CONVERT(speaker USING utf8mb4))) USING utf8mb4), 3)) AS cv2
FROM scene_nodes WHERE node_type='dialogue' LIMIT 1;" 2>/dev/null

echo ""
echo "  raw  : 双重编码后的原始字节"
echo "  cv1  : 转一次后的结果（若为 e4b8xx 就是正确的中文）"
echo "  cv2  : 转两次的结果"

echo ""
echo "=== 修正后的方案：转两次 ==="
echo "  先用 mysql2 跑一段脚本试算"

docker exec lovechoice-backend node -e "
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: 'mysql', user: 'root', password: '123456',
    database: 'love', charset: 'utf8mb4'
  });

  const [r] = await c.query(
    \"SELECT HEX(LEFT(speaker,4)) hx, speaker FROM scene_nodes LIMIT 1\"
  );
  console.log('  原始 hex:', r[0].hx, ' 解码后:', r[0].speaker.slice(0,4));

  // 在 Node 里手工逆转双重编码
  const fix = (s) => Buffer.from(s, 'latin1').toString('utf8');
  const once = fix(r[0].speaker);
  console.log('  latin1→utf8 转一次:', once.slice(0, 6));

  const twice = fix(once);
  console.log('  再转一次         :', twice.slice(0, 6));

  await c.end();
})();
" 2>&1