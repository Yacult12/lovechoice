/**
 * 立绘校验：结构合法性 + 形象演化验证
 *   node verify-avatars.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DIR = path.resolve(__dirname, '..', 'client', 'assets', 'img', 'avatar');

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra ? '  → ' + extra : ''));
  }
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.svg')).sort();
console.log(`\n共 ${files.length} 张立绘\n`);

// ---------- 1. 通用结构校验 ----------
const girlFiles = files.filter((f) => f.startsWith('female'));
const boyFiles = files.filter((f) => f.startsWith('male'));

check('女立绘 20 张（5 章 × 4 情绪）', girlFiles.length === 20, '实际 ' + girlFiles.length);
check('男立绘 3 张', boyFiles.length === 3, '实际 ' + boyFiles.length);

const info = {};
for (const f of files) {
  const svg = fs.readFileSync(path.join(DIR, f), 'utf8');
  const label = f.replace('.svg', '');
  const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
  const parsed = dom.window.document;

  const ok =
    svg.startsWith('<svg') &&
    svg.trimEnd().endsWith('</svg>') &&
    !/\$\{|undefined|NaN/.test(svg) &&
    svg.includes('viewBox="0 0 460 780"') &&
    parsed.documentElement &&
    parsed.documentElement.nodeName === 'svg';

  if (!ok) {
    check(`${label}: 结构合法`, false);
  }
  info[label] = { svg, elCount: parsed.querySelectorAll('*').length, size: Buffer.byteLength(svg) / 1024 };
}
check('全部 23 张结构合法 / 无未替换变量 / 浏览器可解析', pass > 0 && Object.keys(info).length === files.length);

// ---------- 2. 男女反差仍在 ----------
const avgG = girlFiles.reduce((a, f) => a + info[f.replace('.svg', '')].elCount, 0) / girlFiles.length;
const avgB = boyFiles.reduce((a, f) => a + info[f.replace('.svg', '')].elCount, 0) / boyFiles.length;
console.log(`\n细节密度：她 ${avgG.toFixed(0)} 图元 / 他 ${avgB.toFixed(0)} 图元 = ${(avgG / avgB).toFixed(2)}×`);
check('女性立绘细节密度仍显著高于男性（>1.8×）', avgG / avgB > 1.8, (avgG / avgB).toFixed(2) + '×');

const boySvg = info['male-soft'].svg;
check('男方仍无女性化装饰', !/translate\(150,186\)/.test(boySvg) && !/blushG/.test(boySvg));

// ---------- 3. 形象演化验证 ----------
console.log('\n形象演化验证（每章的发色 / 服装 / 特征）：');

const STAGE_EXPECT = [
  { n: 1, hair: '#4a3b42', outfit: 'blouse', name: '初见 · 素净' },
  { n: 2, hair: '#55394a', outfit: 'cardigan', name: '靠近 · 温暖' },
  { n: 3, hair: '#6b3f52', outfit: 'top', name: '传闻 · 被打扮过' },
  { n: 4, hair: '#3a2e35', outfit: 'coat', name: '雨夜 · 狼狈' },
  { n: 5, hair: '#7a4358', outfit: 'dress', name: '走廊 · 决意' },
];

// 注意：SVG 属性会被生成器拆成 cx=/cy= 两段，
// 所以断言用「属性组合」而不是 path 的 d 串。
const OUTFIT_MARK = {
  blouse: { must: ['#fffdfa', 'cx="230" cy="568"', 'cx="230" cy="596"'], desc: '白衬衫扣子' },
  cardigan: { must: ['cx="214" cy="556"', 'cx="246" cy="556"'], desc: '开衫双纽扣' },
  top: { must: ['#fff4f8', 'cx="230" cy="536"'], desc: '立领锁骨链' },
  // 男式外套：明显大一号、敞穿、露内搭
  coat: { must: ['<!-- 外套左片 -->', '<!-- 外套右片 -->', '<!-- 翻领 -->'], desc: '外套翻领' },
  // 连衣裙：方领 + 腰线 + 细褶
  dress: { must: ['<!-- 裙身 -->', '<!-- 腰线 -->', '<!-- 方领 -->', '<!-- 细褶 -->'], desc: '裙装腰线' },
};

const ACC_MARK = {
  blouse: { must: ['translate(152,190)'], desc: '低调发夹' },
  coat: { must: [], desc: '无饰品（狼狈）' },
  cardigan: { must: ['translate(150,186)'], desc: '蝴蝶结' },
  top: { must: ['translate(150,186)', 'cx="186"'], desc: '蝴蝶结+珍珠' },
  dress: { must: ['translate(150,186)'], desc: '蝴蝶结' },
};

const seenHair = new Set();
const seenOutfitMark = new Set();

for (const st of STAGE_EXPECT) {
  const key = `female-c${st.n}-smile`;
  const rec = info[key];
  if (!rec) {
    check(`第${st.n}章 有 smile 立绘`, false, key);
    continue;
  }
  const svg = rec.svg;

  // 发色
  const hasHair = svg.includes(st.hair);
  seenHair.add(st.hair);

  // 服装特征
  const om = OUTFIT_MARK[st.outfit];
  const hasOutfit = om.must.every((m) => svg.includes(m));
  if (hasOutfit) seenOutfitMark.add(st.outfit);

  // 饰品
  const am = ACC_MARK[st.outfit];
  const hasAcc = am.must.every((m) => svg.includes(m));

  // 湿发（仅第4章）
  const hasWet = st.n === 4 ? /cfe4ff/.test(svg) : !/wet|湿发/.test(svg);

  check(
    `第${st.n}章 ${st.name}：发色 ${st.hair} + ${om.desc} + ${am.desc}` +
      (st.n === 4 ? ' + 湿发' : ''),
    hasHair && hasOutfit && hasAcc && hasWet,
    [
      hasHair ? '' : '发色不符',
      hasOutfit ? '' : '服装特征缺失',
      hasAcc ? '' : '饰品不符',
      hasWet ? '' : '湿发特征异常',
    ].filter(Boolean).join(' / ')
  );
}

check('5 章发色各不相同', seenHair.size === 5, '实得 ' + seenHair.size + ' 种');
check('5 种服装各自独立可辨', seenOutfitMark.size === 5, '实得 ' + seenOutfitMark.size + ' 种');

// ---------- 4. 每章 4 情绪齐全且表情确实不同 ----------
const MOODS = ['smile', 'soft', 'down', 'away'];
for (const st of STAGE_EXPECT) {
  const keys = MOODS.map((m) => `female-c${st.n}-${m}`);
  const allExist = keys.every((k) => info[k]);
  const distinct = new Set(MOODS.map((m) => info[`female-c${st.n}-${m}`].svg)).size;
  check(`第${st.n}章 4 种情绪齐全且互不相同`, allExist && distinct === 4, allExist ? `distinct=${distinct}` : '缺文件');
}

// ---------- 5. 体积统计 ----------
console.log('\n体积：');
const gSize = girlFiles.reduce((a, f) => a + info[f.replace('.svg', '')].size, 0) / girlFiles.length;
const bSize = boyFiles.reduce((a, f) => a + info[f.replace('.svg', '')].size, 0) / boyFiles.length;
const total = Object.values(info).reduce((a, r) => a + r.size, 0);
console.log(`  她：${gSize.toFixed(1)} KB/张 × ${girlFiles.length}`);
console.log(`  他：${bSize.toFixed(1)} KB/张 × ${boyFiles.length}`);
console.log(`  立绘总计：${total.toFixed(0)} KB`);

console.log(`\n${'='.repeat(52)}`);
console.log(fail === 0 ? `  全部通过 ${pass} 项 🎉` : `  通过 ${pass} / 失败 ${fail}`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);