'use strict';

/**
 * 可达好感组合分析
 *   node scripts/analyze-affection.js
 *
 * 用途：给隐藏结局定阈值，并确认 4 个结局的命中率分布合理。
 *
 * 踩过的坑
 * --------
 * 1. Math.max(...arr) 在组合数到 20 万时会爆栈
 *    （Maximum call stack size exceeded）—— 改用 reduce。
 * 2. 帕累托前沿不能用双重循环找支配点，O(n²) 在 24 万点上跑不完。
 *    正确做法：按 m 降序排序，扫描时记录「见过的最大 f」，
 *    只有 f 创新高的点才是前沿点，O(n log n)。
 * 3. 结局条件里的「not」必须真的被支持 ——
 *    隐藏结局靠它从 e_bond 的判定范围里排除出来，
 *    否则隐藏结局永远轮不到判定。
 */

const male = require('./story/male');
const female = require('./story/female');
const endings = require('./story/endings');

/** 把一条线的所有选择节点摊平成「每点一个选项」 */
function flatten(data) {
  const groups = [];
  data.chapters.forEach((ch) => {
    ch.nodes.filter((n) => n.type === 'choice').forEach((n) => {
      groups.push(n.options.map((o) => ({ m: o.m || 0, f: o.f || 0, key: o.key })));
    });
  });
  return groups;
}

/** 混合进制穷举（某个点有 3 个选项时，位掩码覆盖不到） */
function allCombos(groups) {
  const sizes = groups.map((g) => g.length);
  const total = sizes.reduce((a, b) => a * b, 1);
  const out = new Array(total);
  for (let i = 0; i < total; i++) {
    let idx = i;
    let m = 0, f = 0;
    for (let g = 0; g < groups.length; g++) {
      const p = groups[g][idx % sizes[g]];
      idx = Math.floor(idx / sizes[g]);
      m += p.m;
      f += p.f;
    }
    out[i] = { m, f };
  }
  return out;
}

/** 复刻 endingService.evaluateCondition */
function evaluate(condition, ctx) {
  if (!condition) return true;
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    return false;
  }
  for (const [k, exp] of Object.entries(condition)) {
    if (k === 'all') {
      if (!Array.isArray(exp) || !exp.every((s) => evaluate(s, ctx))) return false;
      continue;
    }
    if (k === 'any') {
      if (!Array.isArray(exp) || !exp.some((s) => evaluate(s, ctx))) return false;
      continue;
    }
    if (k === 'not') {
      if (evaluate(exp, ctx)) return false;
      continue;
    }
    const actual = { affection_male: ctx.m, affection_female: ctx.f }[k];
    if (actual === undefined) return false;
    if (typeof exp === 'object' && exp !== null) {
      for (const [op, val] of Object.entries(exp)) {
        const ok = {
          '>=': actual >= val, '>': actual > val,
          '<=': actual <= val, '<': actual < val,
          '==': actual === val, '!=': actual !== val
        }[op];
        if (!ok) return false;
      }
    } else if (actual !== exp) {
      return false;
    }
  }
  return true;
}

function analyze(route, data) {
  const groups = flatten(data);
  const combos = allCombos(groups);

  console.log(`\n${'='.repeat(64)}`);
  console.log(`  ${route} · ${combos.length} 种选择组合 · ${groups.length} 个抉择点`);
  console.log('='.repeat(64));

  // ---- 上下限（用 reduce，别用 spread）----
  let maxM = -Infinity, minM = Infinity;
  let maxF = -Infinity, minF = Infinity;
  combos.forEach((c) => {
    if (c.m > maxM) maxM = c.m;
    if (c.m < minM) minM = c.m;
    if (c.f > maxF) maxF = c.f;
    if (c.f < minF) minF = c.f;
  });
  console.log(`  理论上限：自己 ${maxM} / 对方 ${maxF}`);
  console.log(`  理论下限：自己 ${minM} / 对方 ${minF}`);

  // ---- 帕累托前沿：按自己降序扫，f 创新高才是前沿点 ----
  const sorted = combos.slice().sort((a, b) => b.m - a.m || b.f - a.f);
  const pareto = [];
  let bestF = -Infinity;
  sorted.forEach((p) => {
    if (p.f > bestF) { pareto.push(p); bestF = p.f; }
  });
  console.log(`  帕累托前沿（${pareto.length} 点，自己↓对方↑）：`);
  const show = pareto.length <= 24 ? pareto : pareto.filter((_, i) => i % Math.ceil(pareto.length / 20) === 0);
  show.forEach((p) => console.log(`    自己 ${String(p.m).padStart(4)} / 对方 ${String(p.f).padStart(4)}`));

  // ---- 结局可达性 ----
  console.log('');
  console.log('  结局可达性：');
  const list = endings[route];
  const order = [...list].sort((a, b) => (a.isHidden ? 1 : 0) - (b.isHidden ? 1 : 0));
  const hits = {};
  for (const c of combos) {
    let hit = null;
    for (const e of order) {
      if (evaluate(e.condition, { m: c.m, f: c.f })) { hit = e.key; break; }
    }
    hits[hit || '__none__'] = (hits[hit || '__none__'] || 0) + 1;
  }
  let unreachable = 0;
  list.forEach((e) => {
    const n = hits[e.key] || 0;
    if (n === 0) unreachable++;
    const pctv = ((n / combos.length) * 100).toFixed(1);
    console.log(
      `    ${n > 0 ? '✓' : '✗'} ${e.key.padEnd(11)} ${String(n).padStart(7)} 次 ` +
      `(${pctv.padStart(5)}%)${e.isHidden ? '  [隐藏]' : ''}`
    );
  });
  console.log(`    ${hits.__none__ ? '✗' : '✓'} 无匹配：${hits.__none__ || 0} 次`);

  // 分布健康度：任一结局超过 50% 都算失衡
  const maxShare = Math.max(...list.map((e) => hits[e.key] || 0)) / combos.length;
  const balanced = maxShare <= 0.5;
  console.log(`    ${balanced ? '✓' : '⚠'} 分布：最大占比 ${(maxShare * 100).toFixed(1)}%` +
    (balanced ? '' : '  （某个结局占比过半，其他结局玩家几乎遇不到）'));
  console.log(`    ${unreachable === 0 ? '✓' : '✗'} 可达 ${list.length - unreachable}/${list.length}`);

  return { unreachable, balanced, maxShare, hits, combos };
}

const m = analyze('male', male);
const f = analyze('female', female);

console.log(`\n${'='.repeat(64)}`);
const bad = m.unreachable + f.unreachable;
if (bad === 0) {
  console.log('  ✅ 全部结局可达');
} else {
  console.log(`  ❌ ${bad} 个结局不可达`);
}
if (!m.balanced || !f.balanced) {
  console.log('  ⚠ 结局分布失衡，需要调阈值');
}
console.log('='.repeat(64));
process.exit(bad ? 1 : 0);
