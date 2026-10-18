/**
 * 从现有库导出基础数据（routes / characters / chapters 的路由与角色定义）
 *   node export-base-data.js
 *
 * 缺口说明
 * 仓库里的 SQL 脚本只管剧情内容（scene_nodes / choices / endings），
 * 从来没有创建过 routes 和 characters 的数据 ——
 * 这两张表当初是我在数据库里手工插的。
 *
 * 后果：任何「从零建库」的流程（CI、Docker 初始化、换新机器）
 *       都会因为 routes 表为空而失败：
 *       ERROR 1048 (23000): Column 'route_id' cannot be null
 *       （full_story.sql 靠 route_code 查 id，查不到就是 NULL）
 *
 * 本脚本把这些基础数据固化成 SQL 文件，纳入版本库。
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'sql', 'base_data.sql');

const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
};

(async () => {
  const c = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '123456', database: 'love'
  });

  const [routes] = await c.query(
    `SELECT route_code, title, description, sort_no
       FROM routes ORDER BY id`
  );
  const [chars] = await c.query(
    `SELECT r.route_code, c.char_key, c.name, c.role, c.avatar_url
       FROM characters c JOIN routes r ON r.id = c.route_id
      ORDER BY r.id, c.id`
  );

  if (!routes.length) {
    console.error('[base-data] routes 表为空，无法导出。请先在数据库里补齐路由数据。');
    process.exit(1);
  }

  const out = [];
  out.push('-- ============================================================');
  out.push('--   基础数据（由 export-base-data.js 从现有库导出）');
  out.push('--');
  out.push('--   为什么必须有这个文件：');
  out.push('--   schema.sql 只建表，不灌数据。而 full_story.sql 第 18 行靠');
  out.push('--     SET @r_male := (SELECT id FROM routes WHERE route_code = \'male\');');
  out.push('--   拿路由 id。若 routes 表为空，@r_male 就是 NULL，后续 INSERT');
  out.push('--   会报 ERROR 1048 (23000): Column \'route_id\' cannot be null。');
  out.push('--');
  out.push('--   这批数据原先是我在数据库里手工插入的，仓库里没有，');
  out.push('--   导致 CI / Docker 初始化 / 换机重建 全部失败。');
  out.push('--');
  out.push('--   表：routes（故事线）、characters（角色定义）');
  out.push('--   执行顺序：schema.sql → base_data.sql → full_story.sql');
  out.push('-- ============================================================');
  out.push('');
  out.push('SET NAMES utf8mb4;');
  out.push('');
  out.push('-- ---------- 故事线 ----------');

  routes.forEach((r) => {
    out.push(
      `INSERT INTO routes (route_code, title, description, sort_no) VALUES\n` +
      `  (${q(r.route_code)}, ${q(r.title)}, ${q(r.description)}, ${q(r.sort_no)})\n` +
      `  ON DUPLICATE KEY UPDATE\n` +
      `    title = VALUES(title), description = VALUES(description), sort_no = VALUES(sort_no);`
    );
    out.push('');
  });

  out.push('-- ---------- 角色定义 ----------');
  // 按 route_code 分组。
  //
  // ⚠️ 这里用 UNION ALL 而不是 FROM (SELECT 'a','b') AS t —— 
  // 后者的派生表列全是无名字面量，t.char_key 取不到值，
  // 导入时直接报 Operand should contain 1 column(s)。
  const byRoute = {};
  chars.forEach((c) => { (byRoute[c.route_code] ||= []).push(c); });

  Object.keys(byRoute).forEach((rc) => {
    const list = byRoute[rc];
    const selects = list
      .map((c) => `  SELECT ${q(rc)} AS route_code, ${q(c.char_key)} AS char_key, ` +
                  `${q(c.name)} AS name, ${q(c.role)} AS role, ${q(c.avatar_url)} AS avatar_url`)
      .join('\n  UNION ALL\n');

    out.push(
      `INSERT INTO characters (route_id, char_key, name, role, avatar_url)\n` +
      `SELECT r.id, t.char_key, t.name, t.role, t.avatar_url\n` +
      `  FROM (\n${selects}\n  ) AS t\n` +
      `  JOIN routes r ON r.route_code = t.route_code\n` +
      `  ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url);`
    );
    out.push('');
  });

  out.push('-- ---------- 自检 ----------');
  out.push('-- 若下面两句的返回值不是预期数量，说明基础数据没灌进去：');
  out.push('--   SELECT COUNT(*) FROM routes;      -- 应为 ' + routes.length);
  out.push('--   SELECT COUNT(*) FROM characters;  -- 应为 ' + chars.length);
  out.push('');

  fs.writeFileSync(OUT, out.join('\n'), 'utf8');

  console.log('已导出 sql/base_data.sql');
  console.log('  routes     : ' + routes.length + ' 条 (' + routes.map((r) => r.route_code).join(', ') + ')');
  console.log('  characters : ' + chars.length + ' 条');
  console.log('');
  routes.forEach((r) => console.log('  · ' + r.route_code.padEnd(8) + r.title));

  await c.end();
})();