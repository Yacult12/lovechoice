'use strict';
/** 找出「f 很高但 m 偏低」的组合，校准隐藏结局阈值 */
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  const conn = await mysql.createConnection({ ...config.db, charset: 'utf8mb4_unicode_ci' });
  for (const rc of ['male', 'female']) {
    const [nodes] = await conn.query(
      `SELECT n.id, n.node_key, c.chapter_no
         FROM scene_nodes n JOIN chapters c ON c.id = n.chapter_id
         JOIN routes r ON r.id = c.route_id
        WHERE r.route_code = ? AND n.node_type = 'choice'
        ORDER BY c.chapter_no, n.id`,
      [rc]
    );
    const [choices] = await conn.query(
      `SELECT ch.* FROM choices ch
         JOIN scene_nodes n ON n.id = ch.node_id
         JOIN chapters c ON c.id = n.chapter_id
         JOIN routes r ON r.id = c.route_id
        WHERE r.route_code = ? ORDER BY c.chapter_no, ch.id`,
      [rc]
    );
    const byNode = new Map();
    for (const ch of choices) {
      const l = byNode.get(ch.node_id) || [];
      l.push(ch);
      byNode.set(ch.node_id, l);
    }
    const cn = nodes.map((n) => byNode.get(n.id));

    // 用混合进制穷举，完整覆盖每组选项
    const sizes = cn.map((g) => g.length);
    const total = sizes.reduce((a, b) => a * b, 1);
    console.log(`\n=== ${rc} ===  组合总数 ${total}`);
    console.log('  各抉择点选项数:', sizes.join(' × '));

    let bestF = -999;
    let bestFInfo = null;
    const rows = [];
    for (let i = 0; i < total; i++) {
      let idx = i;
      let m = 0, f = 0;
      const picks = [];
      for (let g = 0; g < cn.length; g++) {
        const p = cn[g][idx % sizes[g]];
        idx = Math.floor(idx / sizes[g]);
        m += p.effect_male;
        f += p.effect_female;
        picks.push(p.option_key);
      }
      rows.push({ m, f, picks });
      if (f > bestF) { bestF = f; bestFInfo = { m, f, picks }; }
    }

    console.log(`  最大 f = ${bestF}（此时 m = ${bestFInfo.m}）`);

    // 高 f 低 m 的 Pareto 前沿（只看 f>=60）
    const cand = rows.filter((r) => r.f >= 60).sort((a, b) => b.f - a.f || a.m - b.m);
    console.log('  f ≥ 60 的组合（按 f 降序，取前 8）：');
    for (const r of cand.slice(0, 8)) {
      console.log(`    f=${String(r.f).padStart(3)}  m=${String(r.m).padStart(4)}   ${r.picks.join(',')}`);
    }
    // f >= 78 的组合里 m 的范围
    const hi = rows.filter((r) => r.f >= 78);
    if (hi.length) {
      const ms = hi.map((r) => r.m);
      console.log(`  f ≥ 78 的组合共 ${hi.length} 个，m 范围 [${Math.min(...ms)}, ${Math.max(...ms)}]`);
    } else {
      const fmax = Math.max(...rows.map((r) => r.f));
      console.log(`  ⚠ 没有 f ≥ 78 的组合，最大 f = ${fmax}`);
    }
  }
  await conn.end();
})();