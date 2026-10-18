const mysql = require('c:/Users/何树吉/Desktop/love/server/node_modules/mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '123456', database: 'love'
  });

  const [rows] = await c.query(`
    SELECT r.route_code, ch.chapter_no, ch.title,
           n.node_type, n.speaker,
           CHAR_LENGTH(n.content) AS len,
           n.content
      FROM scene_nodes n
      JOIN chapters ch ON ch.id = n.chapter_id
      JOIN routes r ON r.id = ch.route_id
     ORDER BY r.route_code, ch.chapter_no, n.id
  `);

  const lens = rows.map((r) => r.len || 0);
  const sorted = [...lens].sort((a, b) => a - b);
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;

  console.log('=== 节点文案长度统计 ===');
  console.log('节点总数:', rows.length);
  console.log('平均字数:', avg.toFixed(1));
  console.log('中位数:', sorted[Math.floor(sorted.length / 2)]);
  console.log('最短:', sorted[0], '　最长:', sorted[sorted.length - 1]);
  console.log('');
  console.log('分布：');
  const buckets = { '<20': 0, '20-39': 0, '40-59': 0, '60-79': 0, '80+': 0 };
  for (const l of lens) {
    if (l < 20) buckets['<20']++;
    else if (l < 40) buckets['20-39']++;
    else if (l < 60) buckets['40-59']++;
    else if (l < 80) buckets['60-79']++;
    else buckets['80+']++;
  }
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`  ${k.padStart(6)} : ${'█'.repeat(Math.round(v / 2))} ${v}`);
  }

  console.log('\n=== 最短的 15 条（这些是「感觉太短」的元凶）===');
  rows.filter((r) => r.node_type === 'dialogue')
    .sort((a, b) => (a.len || 0) - (b.len || 0))
    .slice(0, 15)
    .forEach((r) => {
      console.log(`  [${r.route_code} C${r.chapter_no}] ${r.speaker}(${r.len}字) ${(r.content || '').slice(0, 40)}`);
    });

  console.log('\n=== 每章节点数 ===');
  const perChapter = {};
  for (const r of rows) {
    const k = `${r.route_code} C${r.chapter_no} ${r.title}`;
    perChapter[k] = (perChapter[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(perChapter)) console.log(`  ${k}: ${v} 节点`);

  await c.end();
})();