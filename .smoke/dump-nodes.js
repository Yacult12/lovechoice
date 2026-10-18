const mysql = require('c:/Users/何树吉/Desktop/love/server/node_modules/mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '123456', database: 'love'
  });
  const [r] = await c.query(
    'SELECT r.route_code rc, ch.chapter_no cn, n.node_key, n.node_type nt, n.speaker, n.content, n.next_node_key nk ' +
    'FROM scene_nodes n JOIN chapters ch ON ch.id=n.chapter_id JOIN routes r ON r.id=ch.route_id ' +
    'ORDER BY r.route_code, ch.chapter_no, n.id'
  );
  r.forEach((x) =>
    console.log([x.rc, 'C' + x.cn, x.node_key, x.nt, x.speaker, '→' + (x.nk || '-'), x.content].join(' | '))
  );
  await c.end();
})();