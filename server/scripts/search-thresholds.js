'use strict';

/**
 * 结局阈值搜索
 *   node scripts/search-thresholds.js
 *
 * 用途：自动找一组让 4 个结局分布均衡的阈值。
 *
 * 背景
 * ----
 * 阈值不能拍脑袋定。之前的版本用「自己 >= 45 且对方 >= 45」，
 * 结果实测分布是：
 *   圆满 0.3% / 各自安好 13.5% / 错过 11.2% / 一个人的体面 75%
 * 「一个人���面」吃掉四分之三，「圆满」几乎遇不到 ——
 * 认真玩的人反而拿不到好结局，这是设计事故。
 *
 * 这个脚本遍历候选阈值，列出每组的四象限占比，
 * 按「最大占比尽量小」排序，直接给出推荐值。
 *
 * 隐藏结局单独搜：要求自己与对方同时够高，
 * 但命中数要在「几十到几百」这个量级 ——
 * 1 次是运气（玩家永远撞不上），0 次是 bug。
 */

const male = require('./story/male');
const female = require('./story/female');

function flatten(data) {
  const groups = [];
  data.chapters.forEach((ch) => {
    ch.nodes.filter((n) => n.type === 'choice').forEach((n) => {
      groups.push(n.options.map((o) => ({ m: o.m || 0, f: o.f || 0 })));
    });
  });
  return groups;
}

function allCombos(groups) {
  const sizes = groups.map((g) => g.length);
  const total = sizes.reduce((a, b) => a * b, 1);
  const out = new Array(total);
  for (let i = 0; i < total; i++) {
    let idx = i, m = 0, f = 0;
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

const combos = allCombos(flatten(male));
const N = combos.length;

console.log(`组合总数 ${N}\n`);

// ---------- 四象限阈值搜索 ----------
console.log('四象限阈值候选（自己界 / 对方界 → 四结局占比%）：');
console.log('  自己  对方 |  圆满   各自   错过   一个人  | 最大占比');

const results = [];
for (let ts = -40; ts <= 60; ts += 5) {
  for (let to = -40; to <= 60; to += 5) {
    let bond = 0, apart = 0, miss = 0, alone = 0;
    for (const c of combos) {
      const selfHigh = c.m >= ts;
      const otherHigh = c.f >= to;
      if (selfHigh && otherHigh) bond++;
      else if (selfHigh) apart++;
      else if (otherHigh) miss++;
      else alone++;
    }
    const p = (n) => (n / N) * 100;
    const max = Math.max(p(bond), p(apart), p(miss), p(alone));
    results.push({ ts, to, bond: p(bond), apart: p(apart), miss: p(miss), alone: p(alone), max });
  }
}

// 过滤：每个结局至少 3%（太低的玩家遇不到），最大占比不超过 45%
const viable = results.filter((r) =>
  r.bond >= 3 && r.apart >= 3 && r.miss >= 3 && r.alone >= 3 && r.max <= 45
);
viable.sort((a, b) => a.max - b.max);

console.log(`\n可用组合 ${viable.length} 组，前 12 名：`);
console.log('  自己  对方 |  圆满   各自   错过   一个人  | 最大占比');
viable.slice(0, 12).forEach((r) => {
  console.log(
    `  ${String(r.ts).padStart(4)}  ${String(r.to).padStart(4)} |` +
    ` ${r.bond.toFixed(1).padStart(6)} ${r.apart.toFixed(1).padStart(6)}` +
    ` ${r.miss.toFixed(1).padStart(6)} ${r.alone.toFixed(1).padStart(6)} |` +
    ` ${r.max.toFixed(1).padStart(7)}`
  );
});

if (viable.length) {
  const best = viable[0];
  console.log(`\n推荐：自己界 ${best.ts} / 对方界 ${best.to}`);
}

// ---------- 隐藏结局阈值搜索 ----------
console.log('\n隐藏结局阈值候选（自己界 / 对方界 → 命中组合数）：');
console.log('  自己  对方 |  命中数   占比');
const hiddens = [];
for (let hs = 40; hs <= 80; hs += 5) {
  for (let ho = 30; ho <= 70; ho += 5) {
    let n = 0;
    for (const c of combos) {
      if (c.m >= hs && c.f >= ho) n++;
    }
    // 目标：命中率 0.05% ~ 3%（玩家认真玩能撞上，但不是随便就撞上）
    if (n >= N * 0.0005 && n <= N * 0.03) {
      hiddens.push({ hs, ho, n, pctv: (n / N) * 100 });
    }
  }
}
hiddens.sort((a, b) => b.n - a.n);
hiddens.slice(0, 12).forEach((h) => {
  console.log(
    `  ${String(h.hs).padStart(4)}  ${String(h.ho).padStart(4)} |` +
    ` ${String(h.n).padStart(6)}  ${h.pctv.toFixed(3).padStart(6)}%`
  );
});
if (hiddens.length) {
  console.log(`\n隐藏结局推荐：自己界 ${hiddens[0].hs} / 对方界 ${hiddens[0].ho}` +
    `（${hiddens[0].n} 种组合）`);
}
