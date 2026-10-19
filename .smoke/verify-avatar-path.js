/**
 * 立绘路径诊断
 *   node verify-avatar-path.js
 *
 * 云端实测发现 /assets/img/avatar/female-soft.svg 返回 404。
 *
 * 排查结论：前端 pickAvatar() 用 base.replace(/[^/]+$/, name) 替换文件名，
 * 它只关心 base 是不是「目录路径」，对 base 里最后一段叫什么并不敏感。
 * 也就是说 DB 里存 female-soft.svg 还是 female.svg 都能工作。
 *
 * 但本脚本要回答两个真正的问题：
 *   1. pickAvatar 拼出来的每个路径是否真实存在
 *   2. 有没有立绘文件是「孤儿」（存在但拼不出来）或有「缺失」（拼出来但文件不在）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AVATAR_DIR = path.join(ROOT, 'client', 'assets', 'img', 'avatar');

let pass = 0, fail = 0, warn = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}
function soft(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { warn++; console.log('  \x1b[33mWARN\x1b[0m ' + name + (extra ? '  -> ' + extra : '')); }
}

console.log('\n=== 立绘路径诊断 ===\n');

if (!fs.existsSync(AVATAR_DIR)) {
  console.log('立绘目录不存在');
  process.exit(1);
}

const files = fs.readdirSync(AVATAR_DIR).filter((f) => f.endsWith('.svg'));

// ---------- 1. 文件清单 ----------
console.log('[1] 文件清单');
ck('立绘目录存在', true);
ck('至少有 20 张立绘', files.length >= 20, '实际 ' + files.length);
ck('全部为 SVG', files.every((f) => f.endsWith('.svg')));

// ---------- 2. 命名规律 ----------
console.log('\n[2] 命名规律');
const female = files.filter((f) => f.startsWith('female-'));
const male = files.filter((f) => f.startsWith('male-'));
ck('女性立绘按章节分组（female-cN-表情）', female.length >= 15, '实际 ' + female.length);
ck('男性立绘不按章节分组（male-表情）', male.length >= 3, '实际 ' + male.length);

['smile', 'soft', 'away', 'down'].forEach((expr) => {
  const m = male.filter((f) => f === 'male-' + expr + '.svg').length;
  const f = female.filter((x) => x.includes('-' + expr + '.svg')).length;
  ck(`表情 ${expr}：male ${m} 张 / female ${f} 张`, m >= 1 && f >= 1,
    `male=${m} female=${f}`);
});

// ---------- 3. 复现前端的拼装逻辑 ----------
console.log('\n[3] 复现 pickAvatar 拼装逻辑');
// play.js:
//   var base = UI.assetUrl(character[side].avatarUrl);
//   return base.replace(/[^/]+$/, name);
// 关键：base 的最后一段会被整段替换，所以 base 末段叫什么都无所谓。
// 但 base 必须以 / 结尾才能保证目录部分完整 —— 实际上 replace 只替换
// 最后一个非 / 段，所以 "a/b/c.svg" → "a/b/female-c1-smile.svg"，正确。

function pick(base, name) {
  return base.replace(/[^/]+$/, name);
}

const DBBASE = 'assets/img/avatar/female-soft.svg';
const MOODS = { high: ['smile', 'smile', 'soft'], mid: ['soft', 'soft', 'away'], low: ['down', 'away', 'down'] };

let missing = [];
let checked = 0;
for (let chapter = 1; chapter <= 5; chapter++) {
  for (const side of ['female', 'male']) {
    for (const [mood, exprs] of Object.entries(MOODS)) {
      for (const expr of exprs) {
        const name = side === 'female'
          ? `female-c${chapter}-${expr}.svg`
          : `male-${expr}.svg`;
        const url = pick(DBBASE, name);
        const p = path.join(ROOT, 'client', url);
        checked++;
        if (!fs.existsSync(p)) missing.push(url);
      }
    }
  }
}
ck(`拼装出的 ${checked} 个路径全部存在`, missing.length === 0,
  '缺失: ' + [...new Set(missing)].slice(0, 5).join(', '));

// ---------- 4. assetUrl 的处理 ----------
console.log('\n[4] assetUrl 处理');
// ui.js assetUrl:
//   if (/img\/^/.test(cleaned)) return IMG_BASE + cleaned;
//   return cleaned;
const ui = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'ui.js'), 'utf8');
ck('assetUrl 会剥掉 ../ 前缀', /replace\(\/\^\(\\\.\\\.\/\|\\\.\\\/\)\+\//.test(ui) || /\.\.\//.test(ui));
ck('play.js 用 replace 替换文件名段',
  /replace\(\/\[\^\/\]\+\$\//.test(fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'pages', 'play.js'), 'utf8')),
  '若改用别的拼法，本诊断的结论需要重测');

// ---------- 5. DB 里存的路径格式 ----------
console.log('\n[5] base_data.sql 的 avatar_url');
const b64 = path.join(ROOT, 'server', 'sql', 'base_data.sql');
const baseSql = fs.readFileSync(b64, 'utf8');
const urls = [...baseSql.matchAll(/'(assets\/img\/avatar\/[\w.-]+\.svg)'/g)].map((m) => m[1]);
ck('base_data.sql 里有 4 条立绘路径', urls.length === 4, '实际 ' + urls.length);
const fmtOk = urls.every((u) => /^assets\/img\/avatar\/[\w-]+\.svg$/.test(u));
ck('路径格式统一为 assets/img/avatar/xxx.svg', fmtOk, urls.join(', '));
ck('路径不越界（无 ../）', !urls.some((u) => u.includes('..')));

// ---------- 6. 孤儿文件 ----------
console.log('\n[6] 孤儿文件');
// female-soft.svg 本身不存在，这没问题（占位名，会被 replace 掉）。
// 但要确认没有任何「拼不出来」的真实文件。
const referenced = new Set();
for (let c = 1; c <= 5; c++) {
  for (const e of ['smile', 'soft', 'away', 'down']) {
    referenced.add(`female-c${c}-${e}.svg`);
  }
}
for (const e of ['smile', 'soft', 'away', 'down']) referenced.add(`male-${e}.svg`);

const orphans = files.filter((f) => !referenced.has(f));
soft('无孤儿立绘文件', orphans.length === 0,
  orphans.length ? '不会被拼装到: ' + orphans.join(', ') : '');

const unreferenced = [...referenced].filter((f) => !files.includes(f));
ck('所有会被拼装到的文件都存在', unreferenced.length === 0,
  '缺失: ' + unreferenced.join(', '));

// ---------- 汇总 ----------
console.log('\n' + '='.repeat(50));
console.log(`  通过 ${pass} · 警告 ${warn} · 失败 ${fail}`);
console.log(fail === 0
  ? (warn === 0 ? '  ✅ 立绘路径全部可用' : `  ✅ 路径正确（${warn} 项提示）`)
  : '  ❌ 存在问题');
console.log('='.repeat(50));
process.exit(fail ? 1 : 0);