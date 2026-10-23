/**
 * 生成章节插画（手绘简笔画连环画）
 *   node build-scenes.js
 *
 * 五格连环画，每格对应一章：
 *   1 初遇   聚会上两人初次对视；角落有人独自看书、有人和朋友聊天
 *   2 相处   并肩散步，中间留有舒服的距离；远处路人各自独处
 *   3 矛盾   背对而立，距离拉开，安静压抑
 *   4 别离   一人独自向前走，背影平静，身后散落淡淡的回忆
 *   5 圆满   两个独立小人各守自己的小世界，遥遥温柔相望
 *
 * 风格：极简单线简笔画、柔和细轮廓、极浅灰淡填充、干净留白、透明背景。
 *
 * ⚠️ 为什么用脚本生成而不是直接写 .svg 文件
 *   写文件时中文在 .svg 扩展名下会被编码破坏（同一段文字写成 .js 就正常），
 *   表现是 SVG 里混入控制字符、解析直接失败。
 *   从 .js 模板字符串生成可以绕开这个问题。
 *
 * 描边统一用 currentColor：
 *   - 插画卡（浅色纸页）→ 接近黑的柔和轮廓
 *   - 游戏内背景层（暗色舞台）→ 淡白轮廓
 *   同一份文件适配两种底色，不用做两套。
 */
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', 'client', 'assets', 'img', 'scene');

/* ---------- 画笔 ---------- */
const INK = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const INK2 = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const PALE = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"';
const FAINT = 'fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.16"';
const FILL = 'fill="currentColor" fill-opacity="0.05"';
const FILL2 = 'fill="currentColor" fill-opacity="0.03"';

/* ---------- 人物 ---------- *
 *
 * 火柴人：圆头 + 细线身体 + 四肢，靠姿态和物件区分角色。
 * 没有五官（要求里明确不要五官特写），情绪只用身体语言表达。
 */

/** 短发（男生） */
function headShort() {
  return `    <circle cx="0" cy="-158" r="14" ${FILL}/>
    <path d="M-13 -165 q13 -13 26 0" ${INK}/>`;
}

/** 长发（女生） */
function headLong() {
  return `    <path d="M-16 -152 q0 -24 16 -24 q16 0 16 24 l0 14 q-16 8 -32 0 z" ${FILL2}/>
    <path d="M-16 -152 q0 -24 16 -24 q16 0 16 24 l0 14 q-16 8 -32 0" ${INK}/>
    <circle cx="0" cy="-156" r="13" ${FILL}/>`;
}

/** 背影（看不到脸） */
function headBack() {
  return `    <circle cx="0" cy="-158" r="14" ${FILL2} stroke="currentColor" stroke-width="1.6"/>`;
}

/**
 * 通用人物。
 * o.x      站位（脚下地面线）
 * o.s      缩放
 * o.mirror 左右翻转
 * o.head   'short' | 'long' | 'back'
 * o.arms   'down' | 'clasp' | 'swing' | 'talk' | 'listen' | 'hold'
 * o.legs   'stand' | 'walk' | 'walk2'
 */
function person(o) {
  const x = o.x, y = o.y === undefined ? 430 : o.y;
  const s = o.s === undefined ? 1 : o.s;
  /*
   * 镜像：scale(-s 1)。
   *
   * ⚠️ 不能写成 scale(s scale(-1 1)) —— 嵌套 scale 不是合法的
   * transform，浏览器会整条丢弃，于是这个人凭空消失。
   * （第一版就是这么写的，第三格少了一个人。）
   */
  const mir = o.mirror ? -s : s;
  const head = o.head === 'long' ? headLong() : o.head === 'back' ? headBack() : headShort();

  const ARMS = {
    down: `
    <path d="M0 -132 L-20 -104 L-16 -74" ${INK}/>
    <path d="M0 -132 L20 -104 L16 -74" ${INK}/>`,
    clasp: `
    <path d="M0 -132 L-16 -104 L3 -90" ${INK}/>
    <path d="M0 -132 L16 -106 L8 -90" ${INK}/>
    <circle cx="5" cy="-90" r="3.4" ${FILL}/>`,
    swing: `
    <path d="M0 -132 L-22 -108 L-10 -80" ${INK}/>
    <path d="M0 -132 L18 -100 L26 -118" ${INK}/>`,
    talk: `
    <path d="M0 -132 L-20 -106 L-14 -76" ${INK}/>
    <path d="M0 -132 L26 -116 L40 -124" ${INK}/>
    <path d="M40 -124 q7 -3 12 2" ${INK2}/>`,
    listen: `
    <path d="M0 -132 L20 -104 L16 -74" ${INK}/>
    <path d="M0 -132 L-18 -108 L-10 -86 L-2 -88" ${INK}/>`,
    hold: `
    <path d="M0 -132 L-18 -108 L-6 -96" ${INK}/>
    <path d="M0 -132 L18 -108 L6 -96" ${INK}/>`
  };

  const LEGS = {
    stand: `
    <path d="M0 -50 L-11 0 M0 -50 L11 0" ${INK}/>`,
    walk: `
    <path d="M0 -50 L-14 0 M0 -50 L14 0" ${INK}/>`,
    walk2: `
    <path d="M0 -50 L-18 0 M0 -50 L10 0" ${INK}/>`
  };

  return `<g transform="translate(${x} ${y}) scale(${mir} 1)">
${head}
    <path d="M0 -144 L0 -50" ${INK}/>
${ARMS[o.arms || 'down']}
${LEGS[o.legs || 'stand']}
  </g>`;
}

/* ---------- 道具 ---------- */

/** 手里的书（摊开） */
function bookOpen(dy) {
  return `    <path d="M-16 ${dy - 8} L0 ${dy - 16} L16 ${dy - 8} L16 ${dy + 8} L0 ${dy} L-16 ${dy + 8} z" ${FILL2}/>
    <path d="M-16 ${dy - 8} L0 ${dy - 16} L16 ${dy - 8} L16 ${dy + 8} L0 ${dy} L-16 ${dy + 8} z" ${INK2}/>
    <path d="M0 ${dy - 16} L0 ${dy}" ${INK2}/>`;
}

/** 书架（第一格角落） */
function shelf() {
  return `  <g opacity="0.85">
    <path d="M62 250 H166 M62 316 H166" ${INK2}/>
    <path d="M62 250 V392 M166 250 V392" ${INK2}/>
    <path d="M78 258 h14 v34 h-14 z M100 258 h14 v34 h-14 z" ${FILL2}/>
    <path d="M124 258 h14 v34 h-14 z M146 258 h12 v34 h-12 z" ${FILL2}/>
    <path d="M80 324 h12 v32 h-12 z M102 324 h12 v32 h-12 z" ${FILL2}/>
    <path d="M124 324 h14 v32 h-14 z" ${FILL2}/>
  </g>`;
}

/** 气泡（聊天） */
function bubble() {
  return `  <g>
    <path d="M762 214 h72 a16 16 0 0 1 16 16 v22 a16 16 0 0 1 -16 16 h-30 l-10 12 l-2 -12 h-30 a16 16 0 0 1 -16 -16 v-22 a16 16 0 0 1 16 -16 z" ${FILL2}/>
    <path d="M762 214 h72 a16 16 0 0 1 16 16 v22 a16 16 0 0 1 -16 16 h-30 l-10 12 l-2 -12 h-30 a16 16 0 0 1 -16 -16 v-22 a16 16 0 0 1 16 -16 z" ${INK2}/>
  </g>`;
}

/** 画架（第五格：他的爱好） */
function easel() {
  return `  <g>
    <path d="M168 286 H244 M168 286 V386 M244 286 V386" ${INK2}/>
    <path d="M206 386 L194 430 M206 386 L218 430" ${INK2}/>
    <path d="M180 300 H232 V368 H180 Z" ${FILL2}/>
    <path d="M180 300 H232 V368 H180 Z" ${INK2}/>
  </g>`;
}

/** 盆栽（第五格：她的爱好） */
function plant() {
  return `  <g>
    <path d="M712 388 h52 l-5 30 h-42 z" ${FILL2}/>
    <path d="M712 388 h52 l-5 30 h-42 z" ${INK2}/>
    <path d="M738 388 c0 -18 -8 -27 -15 -32 c9 7 13 16 14 32" ${INK2}/>
    <path d="M738 388 c0 -22 8 -32 16 -37 c-7 10 -10 20 -10 37" ${INK2}/>
  </g>`;
}

/** 地面线 */
function ground() {
  return `  <path d="M56 430 H904" ${FAINT}/>`;
}

/* 坐姿的人（第二格远处）—— 单独写，不能用 person() 的站姿 */
function sitPerson(o) {
  const x = o.x, y = o.y;
  return `<g transform="translate(${x} ${y}) scale(${o.s || 0.78})">
  <circle cx="0" cy="-58" r="13" ${FILL}/>
  <path d="M-12 -64 q12 -12 24 0" ${INK}/>
  <path d="M0 -45 L0 -6" ${INK}/>
  <path d="M0 -36 L-20 -22 L-24 -4" ${INK}/>
  <path d="M0 -36 L20 -26 L26 -8" ${INK}/>
  <path d="M0 -6 L-20 0 M0 -6 L20 0" ${INK}/>
</g>`;
}

/* ---------- 组装五格 ---------- */

const SCENES = {};

/* 第一格 · 初遇 */
SCENES[1] = {
  label: '第一格 · 初遇',
  desc: '聚会上两人初次对视；角落有人独自看书、有人和朋友聊天',
  body: [
    shelf(),
    bubble(),
    person({ x: 118, y: 430, s: 0.86, head: 'short', arms: 'hold', legs: 'stand' }),
    person({ x: 806, y: 430, s: 0.86, head: 'long', arms: 'talk', legs: 'stand' }),
    person({ x: 872, y: 430, s: 0.86, head: 'short', arms: 'down', legs: 'stand' }),
    person({ x: 412, y: 430, head: 'short', arms: 'clasp', legs: 'stand' }),
    person({ x: 548, y: 430, head: 'long', arms: 'down', legs: 'stand' })
  ]
};

/* 第二格 · 相处 */
SCENES[2] = {
  label: '第二格 · 相处',
  desc: '并肩散步，中间留有舒服的距离；远处路人各自独处',
  body: [
    person({ x: 108, y: 430, s: 0.8, head: 'short', arms: 'down', legs: 'walk' }),
    `  <g opacity="0.8">
    <path d="M800 396 H900" ${INK2}/>
    <path d="M808 396 L800 430 M892 396 L900 430" ${INK2}/>
  </g>`,
    sitPerson({ x: 828, y: 396 }),
    person({ x: 424, y: 430, head: 'short', arms: 'talk', legs: 'walk2' }),
    person({ x: 544, y: 430, head: 'long', arms: 'listen', legs: 'walk' })
  ]
};

/* 第三格 · 矛盾 */
SCENES[3] = {
  label: '第三格 · 矛盾',
  desc: '两人背对而立，距离拉开，安静压抑',
  body: [
    `  <path d="M480 232 V430" stroke="currentColor" stroke-width="1" stroke-dasharray="2 8" opacity="0.22"/>`,
    person({ x: 384, y: 430, head: 'short', arms: 'down', legs: 'walk2', mirror: true }),
    person({ x: 576, y: 430, head: 'long', arms: 'hold', legs: 'walk' })
  ]
};

/* 第四格 · 别离 */
SCENES[4] = {
  label: '第四格 · 别离',
  desc: '一人独自向前走，背影平静；身后散落淡淡的回忆',
  body: [
    `  <g opacity="0.34">
    ${person({ x: 214, y: 430, s: 0.86, head: 'short', arms: 'down', legs: 'stand' })}
    ${person({ x: 316, y: 430, s: 0.86, head: 'long', arms: 'down', legs: 'stand' })}
  </g>`,
    `  <g opacity="0.3">
    <circle cx="150" cy="300" r="1.8" fill="currentColor"/>
    <circle cx="380" cy="268" r="1.5" fill="currentColor"/>
    <circle cx="262" cy="236" r="1.3" fill="currentColor"/>
  </g>`,
    person({ x: 664, y: 430, head: 'back', arms: 'down', legs: 'walk' })
  ]
};

/* 第五格 · 圆满 */
SCENES[5] = {
  label: '第五格 · 圆满',
  desc: '两个独立小人各守自己的小世界，遥遥温柔相望',
  body: [
    easel(),
    plant(),
    person({ x: 288, y: 430, head: 'short', arms: 'talk', legs: 'stand' }),
    person({ x: 372, y: 430, s: 0.82, head: 'long', arms: 'down', legs: 'stand' }),
    person({ x: 660, y: 430, head: 'long', arms: 'down', legs: 'stand' }),
    person({ x: 800, y: 430, s: 0.82, head: 'short', arms: 'talk', legs: 'stand' })
  ]
};

/* ---------- 输出 ---------- */
fs.mkdirSync(OUT, { recursive: true });

Object.keys(SCENES).forEach((n) => {
  const s = SCENES[n];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540" role="img" aria-label="${s.label}：${s.desc}">
<!--
  ${s.label}
  ${s.desc}

  手绘简笔画连环画的一格。描边用 currentColor：
  放进浅色纸页时是柔和黑线，放进暗色舞台时是淡白线。
-->
<g ${INK}>
${ground()}
${s.body.join('\n')}
</g>
</svg>
`;
  const file = path.join(OUT, 'chapter-' + n + '.svg');
  fs.writeFileSync(file, svg, 'utf8');
  console.log('  ✓ chapter-' + n + '.svg  ' + s.label + '  (' + Buffer.byteLength(svg) + ' 字节)');
});

console.log('\n输出目录: ' + OUT + '\n');
