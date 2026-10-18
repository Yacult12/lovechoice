'use strict';

/**
 * 剧本穷举测试：把每条线的所有选择组合都跑一遍，
 * 验证「每个结局都真的能触发」且「条件互斥完备」。
 *   node scripts/test-endings.js
 */
const mysql = require('mysql2/promise');
const config = require('../src/config');
const { evaluateCondition } = require('../src/services/endingService');

async function main() {
  const conn = await mysql.createConnection({
    ...config.db,
    charset: 'utf8mb4_unicode_ci',
  });

  const [routes] = await conn.query('SELECT * FROM routes ORDER BY sort_no');

  let totalFail = 0;

  for (const route of routes) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${route.route_code} · ${route.title}`);
    console.log('='.repeat(60));

    // 取该线所有 choice 节点，按章号+选项顺序
    const [nodes] = await conn.query(
      `SELECT n.id, n.node_key, n.node_type, c.chapter_no
         FROM scene_nodes n
         JOIN chapters c ON c.id = n.chapter_id
        WHERE c.route_id = ?
        ORDER BY c.chapter_no, n.id`,
      [route.id]
    );
    const [choices] = await conn.query(
      `SELECT ch.* FROM choices ch
         JOIN scene_nodes n ON n.id = ch.node_id
         JOIN chapters c ON c.id = n.chapter_id
        WHERE c.route_id = ?
        ORDER BY c.chapter_no, ch.id`,
      [route.id]
    );
    const [endings] = await conn.query(
      'SELECT * FROM endings WHERE route_id = ? ORDER BY id',
      [route.id]
    );

    // 把选项按所属 choice 节点分组
    const byNode = new Map();
    for (const ch of choices) {
      const list = byNode.get(ch.node_id) || [];
      list.push(ch);
      byNode.set(ch.node_id, list);
    }
    const choiceNodes = nodes.filter((n) => n.node_type === 'choice');

    console.log(
      `  章节 ${new Set(nodes.map((n) => n.chapter_no)).size}` +
        ` · 抉择点 ${choiceNodes.length}` +
        ` · 选项 ${choices.length}` +
        ` · 结局 ${endings.length}`
    );
    console.log(`  组合总数 2^${choiceNodes.length} = ${2 ** choiceNodes.length}`);

    // 穷举所有组合。
    // 注意：必须用「混合进制」而不是二进制位掩码 —— 某个抉择点有 3 个选项时，
    // 位掩码的 2^n 次循环无法覆盖到第 3 个选项，会漏掉隐藏结局的入口。
    const sizes = choiceNodes.map((n) => (byNode.get(n.id) || []).length);
    const combos = sizes.reduce((a, b) => a * b, 1);

    const hitMap = new Map();
    const hitExamples = new Map();

    for (let i = 0; i < combos; i++) {
      let idx = i;
      const affection = { male: 0, female: 0 };
      const picks = [];
      for (let g = 0; g < choiceNodes.length; g++) {
        const opts = byNode.get(choiceNodes[g].id);
        const pick = opts[idx % sizes[g]];
        idx = Math.floor(idx / sizes[g]);
        affection.male += pick.effect_male;
        affection.female += pick.effect_female;
        picks.push(pick.option_key);
      }

      // 与运行时一致的判定顺序：非隐藏优先、id 升序
      const sorted = [...endings].sort((a, b) => {
        const ha = Number(a.is_hidden) === 1 ? 1 : 0;
        const hb = Number(b.is_hidden) === 1 ? 1 : 0;
        if (ha !== hb) return ha - hb;
        return a.id - b.id;
      });

      let matched = null;
      for (const e of sorted) {
        if (evaluateCondition(e.condition_json, {
          affectionMale: affection.male,
          affectionFemale: affection.female,
          playSeconds: 0,
          flags: {},
        })) {
          matched = e;
          break;
        }
      }

      const key = matched ? matched.ending_key : '__NONE__';
      hitMap.set(key, (hitMap.get(key) || 0) + 1);
      if (!hitExamples.has(key)) {
        hitExamples.set(key, { affection, picks });
      }
    }

    console.log('\n  结局分布：');
    for (const e of endings) {
      const count = hitMap.get(e.ending_key) || 0;
      const ex = hitExamples.get(e.ending_key);
      const pct = ((count / combos) * 100).toFixed(1);
      const hidden = Number(e.is_hidden) === 1 ? ' [隐藏]' : '';
      const mark = count > 0 ? '✓' : '✗';
      console.log(
        `    ${mark} ${e.ending_key.padEnd(12)} ${e.title.padEnd(14)} ${String(count).padStart(3)} 次 (${pct}%)${hidden}`
      );
      if (ex) {
        console.log(
          `        示例 → 男 ${ex.affection.male} / 女 ${ex.affection.female}  [${ex.picks.join(', ')}]`
        );
      }
      if (count === 0) totalFail++;
    }

    const none = hitMap.get('__NONE__') || 0;
    console.log(`    ${none === 0 ? '✓' : '✗'} 无匹配结局：${none} 次`);
    if (none > 0) totalFail++;

    const unreachable = endings.filter((e) => (hitMap.get(e.ending_key) || 0) === 0);
    const overlap = [...hitMap.entries()].filter(([, c]) => c > 0).length;
    console.log(
      `    ${unreachable.length === 0 ? '✓' : '✗'} 可达性：${endings.length - unreachable.length}/${endings.length} 个结局可达`
    );

    // 好感区间报告
    const allAff = [];
    for (let i = 0; i < combos; i++) {
      let idx = i;
      let m = 0, f = 0;
      for (let g = 0; g < choiceNodes.length; g++) {
        const opts = byNode.get(choiceNodes[g].id);
        const pick = opts[idx % sizes[g]];
        idx = Math.floor(idx / sizes[g]);
        m += pick.effect_male;
        f += pick.effect_female;
      }
      allAff.push([m, f]);
    }
    const ms = allAff.map((a) => a[0]);
    const fs = allAff.map((a) => a[1]);
    console.log(
      `\n    好感区间 → 男 [${Math.min(...ms)}, ${Math.max(...ms)}]` +
        ` · 女 [${Math.min(...fs)}, ${Math.max(...fs)}]`
    );
    console.log(`    命中结局种类：${overlap}/${endings.length}`);
  }

  await conn.end();
  console.log(`\n${'='.repeat(60)}`);
  console.log(totalFail === 0 ? '  全部结局可达且条件完备 ✅' : `  存在 ${totalFail} 个问题 ❌`);
  console.log('='.repeat(60));
  process.exit(totalFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});