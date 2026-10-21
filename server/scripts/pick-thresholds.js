'use strict';

/**
 * 结局阈值选点
 *   node scripts/pick-thresholds.js
 *
 * 用途：给 4 个结局找一组「分布均匀」的阈值。
 *
 * 坑：拍脑袋定阈值（比如「自己 >= 45 且对方 >= 45」）看着合理，
 * 但真实的好感分布不是均匀的 —— 讨好型选项也涨对方的好感，
 * 于是「对方 < 45」这个区间几乎为空，
 * 对应的结局命中率只有 0.1%，玩家根本遇不到。
 *
 * 这个脚本把全部组合的 (自己, 对方) 落到二维格子里，
 * 打印热力图，让阈值有据可依。
 */

const male = require('./story/male');
const female = require('./story/female');

function groups(data) {
  const out = [];
  data.chapters.forEach((ch) => {
    ch.nodes.filter((n) => n.type === 'choice').forEach((n) => out.push(n.options));
  });
  return out;
}

function allCombos(gs) {
  const sizes = gs.map((g) => g.length);
  const total = sizes.reduce((a, b) => a * b, 1);
  const out = [];
  for (let i = 0; i < total; i++) {
    let idx = i, m = 0, f = 0;
    for (let g = 0; g < gs.length; g++) {
      const p = gs[g][idx % sizes[g]];
      idx = Math.floor(idx / sizes[g]);
      m += p.m || 0;
      f += p.f || 0;
    }
    out.push({ m, f });
  }
  return out;
}

const STEP = 10;
const LO = -50;
const HI = 90;

function heat(combos, label) {
  const grid = new Map();
  combos.forEach((c) => {
    const gx = Math.floor((c.m - LO) / STEP);
    const gy = Math.floor((c.f - LO) / STEP);
    const k = gx + ':' + gy;
    grid.set(k, (grid.get(k) || 0) + 1);
  });

  console.log(`\n${label}  （格 = ${STEP}×${STEP}，数字 = 组合数）`);
  console.log('  对方↑');
  for (let gy = Math.ceil((HI - LO) / STEP) - 1; gy >= 0; gy--) {
    const f0 = LO + gy * STEP;
    let line = '  ' + String(f0).padStart(4) + ' │';
    for (let gx = 0; gx * STEP + LO <= HI; gx++) {
      const n = grid.get(gx + ':' + gy) || 0;
      line += n === 0 ? '   ·' : String(n).padStart(4);
    }
    console.log(line);
  }
  let axis = '       └';
  for (let gx = 0; gx * STEP + LO <= HI; gx++) {
    axis += '───';
  }
  console.log(axis);
  console.log('       自己→ ' + LO + ' … ' + HI);
}

function pct(combos, mMin, mMax, fMin, fMax) {
  let n = 0;
  combos.forEach((c) => {
    if (c.m >= mMin && (mMax === undefined || c.m < mMax) &&
        c.f >= fMin && (fMax === undefined || c.f < fMax)) n++;
  });
  return (n / combos.length * 100);
}

const mc = allCombos(groups(male));
const fc = allCombos(groups(female));

heat(mc, '男线 (自己=m, 对方=f) 分布');
heat(fc, '女线 (自己=f, 对方=m) 分布');

console.log('\n候选阈值下的四象限分布：');
console.log('  切点  自己高界  对方高界 |  圆满%  各自%  错过%  一个人%');
for (const t of [30, 35, 40, 45, 50, 55, 60]) {
  const bond = pct(mc, t, undefined, t, undefined);
  const apart = pct(mc, t, undefined, undefined, t);
  const miss = pct(mc, undefined, t, t, undefined);
  const alone = pct(mc, undefined, t, undefined, t);
  console.log(
    `  ${String(t).padStart(4)}  ${String(t).padStart(8)}  ${String(t).padStart(8)} |` +
    ` ${bond.toFixed(1).padStart(6)} ${apart.toFixed(1).padStart(6)}` +
    ` ${miss.toFixed(1).padStart(6)} ${alone.toFixed(1).padStart(6)}`
  );
}

console.log('\n隐藏结局候选（要求自己与对方同时够高）：');
console.log('  自己界  对方界 |  命中组合数  占比');
for (const mt of [55, 60, 65, 70, 75, 80]) {
  for (const ft of [40, 45, 50, 55, 60]) {
    const n = mc.filter((c) => c.m >= mt && c.f >= ft).length;
    if (n === 0) continue;
    console.log(`  ${String(mt).padStart(6)}  ${String(ft).padStart(6)} |` +
      ` ${String(n).padStart(10)}  ${(n / mc.length * 100).toFixed(2)}%`);
  }
}
