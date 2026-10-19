#!/bin/bash
echo "=== A. mysql2 连接用的字符集（关键）==="
docker compose exec -T backend node -e "
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: 'mysql', port: 3306, user: 'root',
    password: '123456', database: 'love'
  });
  const [r] = await c.query(
    'SHOW VARIABLES LIKE \"character_set%\"'
  );
  r.forEach(x => console.log('  ' + x.Variable_name.padEnd(28) + x.Value));
  await c.end();
})();
" 2>&1

echo ""
echo "=== B. 实际取一条剧情内容（模拟游戏内显示）==="
docker compose exec -T backend node -e "
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    host: 'mysql', port: 3306, user: 'root',
    password: '123456', database: 'love'
  });
  const [r] = await c.query(
    'SELECT speaker, content FROM scene_nodes WHERE node_type IN (\"dialogue\") LIMIT 3'
  );
  r.forEach(x => console.log('  ' + x.speaker + ': ' + String(x.content).slice(0, 40)));
  await c.end();
})();
" 2>&1

echo ""
echo "=== C. 前端 play.js 里是否有中文 ==="
docker compose exec -T frontend sh -c \
  'grep -o "第[一二三四五]章" /usr/share/nginx/html/assets/js/pages/play.js | head -3'

echo ""
echo "=== D. 前端 CSS 里的中文（字体名等）==="
docker compose exec -T frontend sh -c \
  'head -c 400 /usr/share/nginx/html/assets/css/main.css'