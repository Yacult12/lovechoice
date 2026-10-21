'use strict';

/**
 * 让女线的选项数值严格镜像男线
 *   node scripts/sync-female-values.js
 *
 * 为什么用脚本而不是手改：
 *   两条线必须严格对称 —— 同一个 option_key 在两条线里
 *   「m 和 f 互换」，否则结局条件在一条线上成立、另一条线上不成立。
 *   23 处数值手改必错，而且以后改一边还会忘另一边。
 *
 * 判定方式（不是猜的，是靠脚本自己找的）：
 *   1. 解析 male.js，取出每个 option 的 m / f
 *   2. 解析 female.js，按 option_key 匹配
 *   3. 把 female 的 (m, f) 写成 male 的 (f, m)
 *
 * ⚠️ 若某个 option_key 在 male 里不存在，报错退出 ——
 *    宁可失败也不要静默产生不对称的剧本。
 */

const fs = require('fs');
const path = require('path');

const MALE = path.resolve(__dirname, 'story', 'male.js');
const FEMALE = path.resolve(__dirname, 'story', 'female.js');

/** 从剧本源文件里抠出 option 的 m / f */
function extractOptions(file) {
  const src = fs.readFileSync(file, 'utf8');
  const map = new Map();
  /*
   * 只抓「选项对象」，不要抓到节点对象。
   *
   * 坑：节点也有 key 字段（'n_m1_c1'），用宽泛的
   *   /key:\s*'([a-z0-9_]+)'[\s\S]*?m:.../  会连节点一起抓进来 ——
   *   节点的 key 后面「惰性匹配」会一路跨到文件里下一个 m:/f:，
   *   于是 n_f1_a1 这种节点 key 也被当成选项，key 集合校验直接报错。
   *
   * 两个约束一起用才稳：
   *   1. key 必须形如 cN_xxx（选项才用这个前缀，节点是 n_xxx）
   *   2. [^}]*? 不跨出当前对象字面量
   */
  const re = /key:\s*'(c\d+_[a-z0-9_]+)'[^}]*?m:\s*(-?\d+),\s*f:\s*(-?\d+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    map.set(m[1], { m: Number(m[2]), f: Number(m[3]) });
  }
  return map;
}

const male = extractOptions(MALE);
const femaleSrc = fs.readFileSync(FEMALE, 'utf8');
const female = extractOptions(FEMALE);

console.log(`男线选项 ${male.size} 个，女线选项 ${female.size} 个`);

// 断言：正则必须真的匹配到东西。
// 「0 个选项」不是「完美对称」，是「正则坏了」——
// 之前就因为这个静默通过了，后面所有数值检查都失去意义。
if (male.size === 0 || female.size === 0) {
  console.error('❌ 选项解析结果为空 —— 正则与源文件格式不匹配。');
  console.error('   （改 option_key 的命名格式后记得同步改这个正则）');
  process.exit(1);
}

// ---------- 校验 key 集合一致 ----------
const missingInMale = [...female.keys()].filter((k) => !male.has(k));
const missingInFemale = [...male.keys()].filter((k) => !female.has(k));
if (missingInMale.length || missingInFemale.length) {
  console.error('option_key 不一致，无法同步：');
  if (missingInMale.length) console.error('  女线有、男线没有: ' + missingInMale.join(', '));
  if (missingInFemale.length) console.error('  男线有、女线没有: ' + missingInFemale.join(', '));
  process.exit(1);
}

// ---------- 交换 ----------
let changed = 0;
let out = femaleSrc;
// 用回调形式替换，避免 $& 之类的特殊字符被当成引用
out = out.replace(
  /(key:\s*'o_[a-z0-9_]+'[\s\S]*?m:\s*)(-?\d+)(,\s*f:\s*)(-?\d+)/g,
  (full, pre, mVal, mid, fVal) => {
    const key = full.match(/key:\s*'(o_[a-z0-9_]+)'/)[1];
    const src = male.get(key);
    // 女线的 m 应等于男线的 f，女线的 f 应等于男线的 m
    return pre + src.f + mid + src.m;
  }
);

if (out !== femaleSrc) {
  fs.writeFileSync(FEMALE, out, 'utf8');
  changed = 1;
}

// ---------- 复核 ----------
const after = extractOptions(FEMALE);
let bad = 0;
after.forEach((v, k) => {
  const s = male.get(k);
  if (v.m !== s.f || v.f !== s.m) {
    bad++;
    console.error(`  不对称 ${k}: 女(m=${v.m},f=${v.f}) ≠ 男(f=${s.f},m=${s.m})`);
  }
});

console.log(changed ? '已写入 female.js' : 'female.js 已经是镜像的，无需修改');
console.log(bad === 0
  ? `✅ ${after.size} 个选项全部对称`
  : `❌ ${bad} 个选项不对称`);

// ---------- 打印三条极线路径 ----------
const sum = (keys) => keys.reduce((acc, k) => {
  const v = after.get(k);
  return { m: acc.m + v.m, f: acc.f + v.f };
}, { m: 0, f: 0 });

console.log('');
console.log('女线极线路径：');
console.log('  全选爱己(B) →', JSON.stringify(sum([...after.keys()].filter((k) => {
  const s = male.get(k);
  return s.m > 0 && s.f > 0;
}))));
console.log('  全选依附(A) →', JSON.stringify(sum([...after.keys()].filter((k) => {
  const s = male.get(k);
  return s.m < 0 && s.f > 0;
}))));

process.exit(bad ? 1 : 0);
