'use strict';

/**
 * Q 版立绘生成器
 *
 * 风格参考米哈游 Q 版：头身比约 1:2.2（原作写实风是 1:7），
 * 大头 + 圆脸 + 杏眼 + 腮红 + 小巧的身体，轮廓全部用圆角曲线。
 *
 * 关键设计
 * --------
 * 1) 头身比：头高 ≈ 全身 45%，身体只占 55%。
 *    Q 版的可爱感主要来自这个比例，不是来自五官细节。
 * 2) 眼睛是绝对主角：占脸宽 55%+，虹膜带渐变 + 双高光 + 下睫毛。
 * 3) 腮红是第二主角：两团粉晕，是「可爱」最廉价的来源。
 * 4) 身体极简：豆豆眼式的小手小脚，衣服只用色块 + 简单领口。
 * 5) 轮廓线：不用描边，用深色块压边（更接近赛璐璐上色）。
 *
 * 情绪表现
 * --------
 *   smile  弯月眼 + 张嘴笑 + 腮红浓
 *   soft   半闭眼 + 微笑 + 腮红淡
 *   away   眼神偏向一侧 + 闭嘴 + 无腮红
 *   down   垂眼 + 嘴角向下 + 眉压低
 */

const { seeded, wrapSvg } = require('./common');

const W = 460;
const H = 700;

/* ============================================================
   配色
   ============================================================ */

const BOY = {
  hair: '#3a4257',
  hairLit: '#525c76',
  hairDark: '#262c3b',
  skin: '#f6d9c4',
  skinShade: '#e0b79a',
  skinDeep: '#c99b7e',
  blush: '#ff9db0',
  eye: '#3c4a6b',
  eyeLit: '#7e93c4',
  cloth: '#54627d',
  clothDark: '#3d4860',
  clothLit: '#6d7d9c',
  shoe: '#2b3040',
  mouth: '#a35a58',
  mouthIn: '#e39a96',
};

const GIRL_STAGES = {
  1: {
    name: '初见·马尾',
    hair: '#4a3a52',
    hairLit: '#6a5474',
    hairDark: '#33263a',
    cloth: '#f0e6d8',
    clothDark: '#d6c8b6',
    clothLit: '#fff8ee',
    accent: '#e8899f',
    tie: '#8fa8d8',
    shoe: '#4a3f52',
  },
  2: {
    name: '靠近·披肩',
    hair: '#4a3a52',
    hairLit: '#6a5474',
    hairDark: '#33263a',
    cloth: '#e4dcf0',
    clothDark: '#c6bcd8',
    clothLit: '#f4eefc',
    accent: '#e8899f',
    tie: '#8fa8d8',
    shoe: '#4a3f52',
  },
  3: {
    name: '传情·长发',
    hair: '#4a3a52',
    hairLit: '#6a5474',
    hairDark: '#33263a',
    cloth: '#dfe8f2',
    clothDark: '#c2cede',
    clothLit: '#f2f8ff',
    accent: '#e8899f',
    tie: '#7f9fd4',
    shoe: '#4a3f52',
  },
  4: {
    name: '裂痕·淡雅',
    hair: '#453a4e',
    hairLit: '#63526e',
    hairDark: '#2e2637',
    cloth: '#d8dce6',
    clothDark: '#b9bfcc',
    clothLit: '#eef1f7',
    accent: '#d97f96',
    tie: '#8b95b5',
    shoe: '#454050',
  },
  5: {
    name: '和解·暖调',
    hair: '#4e3d52',
    hairLit: '#715674',
    hairDark: '#352838',
    cloth: '#f2e2dc',
    clothDark: '#dcc4bc',
    accent: '#eb8fa2',
    tie: '#93a9d6',
    shoe: '#4a3f52',
  },
};

/* ============================================================
   五官组件
   ============================================================ */

/** 杏眼：虹膜渐变 + 双高光 + 下睫毛 */
function eyeOpen(p, cx, cy, r, look = 0) {
  const dx = look * r * 0.32;
  return `
<!-- 眼白 -->
<ellipse cx="${cx + dx}" cy="${cy}" rx="${r}" ry="${r * 1.12}" fill="#fdfbfa"/>
<!-- 上眼睑投影 -->
<path d="M${cx + dx - r} ${cy} Q${cx + dx} ${cy - r * 1.3} ${cx + dx + r} ${cy}
         L${cx + dx + r} ${cy - r * 0.1} Q${cx + dx} ${cy - r * 0.6} ${cx + dx - r} ${cy - r * 0.1} Z"
      fill="${p.eye}" opacity="0.16"/>
<!-- 虹膜 -->
<circle cx="${cx + dx}" cy="${cy + r * 0.1}" r="${r * 0.78}" fill="url(#iris)"/>
<!-- 瞳孔 -->
<circle cx="${cx + dx}" cy="${cy + r * 0.16}" r="${r * 0.4}" fill="#1b2136"/>
<!-- 下缘反光 -->
<path d="M${cx + dx - r * 0.5} ${cy + r * 0.55} Q${cx + dx} ${cy + r * 0.8} ${cx + dx + r * 0.5} ${cy + r * 0.55}"
      fill="none" stroke="${p.eyeLit}" stroke-width="${r * 0.16}" stroke-linecap="round" opacity="0.75"/>
<!-- 主高光 -->
<circle cx="${cx + dx - r * 0.3}" cy="${cy - r * 0.42}" r="${r * 0.3}" fill="#ffffff" opacity="0.95"/>
<!-- 次高光 -->
<circle cx="${cx + dx + r * 0.34}" cy="${cy + r * 0.34}" r="${r * 0.15}" fill="#ffffff" opacity="0.6"/>
<!-- 上睫毛 -->
<path d="M${cx + dx - r * 1.02} ${cy - r * 0.42} Q${cx + dx} ${cy - r * 1.34} ${cx + dx + r * 1.02} ${cy - r * 0.5}"
      fill="none" stroke="#2b2436" stroke-width="${r * 0.26}" stroke-linecap="round"/>
<!-- 下睫毛 -->
<path d="M${cx + dx - r * 0.66} ${cy + r * 0.86} Q${cx + dx} ${cy + r * 1.16} ${cx + dx + r * 0.6} ${cy + r * 0.88}"
      fill="none" stroke="#2b2436" stroke-width="${r * 0.16}" stroke-linecap="round" opacity="0.7"/>`;
}

/** 弯月笑眼 */
function eyeSmile(p, cx, cy, r) {
  return `
<path d="M${cx - r} ${cy + r * 0.28} Q${cx} ${cy - r * 0.86} ${cx + r} ${cy + r * 0.2}"
      fill="none" stroke="#2b2436" stroke-width="${r * 0.3}" stroke-linecap="round"/>`;
}

/** 垂眼（down）：上睑压低，虹膜被切掉一半 */
function eyeDown(p, cx, cy, r) {
  return `
<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.05}" fill="#fdfbfa"/>
<path d="M${cx - r} ${cy - r * 0.1} Q${cx} ${cy - r * 1.3} ${cx + r} ${cy - r * 0.1}
         L${cx + r} ${cy + r * 0.5} Q${cx} ${cy - r * 0.3} ${cx - r} ${cy + r * 0.5} Z" fill="url(#iris)"/>
<circle cx="${cx}" cy="${cy + r * 0.3}" r="${r * 0.4}" fill="#1b2136"/>
<path d="M${cx - r * 0.9} ${cy - r * 0.5} Q${cx} ${cy - r * 1.3} ${cx + r * 0.9} ${cy - r * 0.56}"
      fill="none" stroke="#2b2436" stroke-width="${r * 0.28}" stroke-linecap="round"/>`;
}

/** 腮红 */
function blush(p, cx, cy, rx, ry, opacity = 0.55) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${p.blush}" opacity="${opacity}"/>`;
}

/* ============================================================
   男生
   ============================================================ */

/**
 * Q 版男生
 * @param {string} mood smile | soft | away | down
 */
function chibiBoy(mood) {
  const p = BOY;

  // 几何：头心 (230, 236)，头半径 150；身体 340~700
  const headX = 230, headY = 236, headR = 150;

  const defs = `
<radialGradient id="iris" cx="0.5" cy="0.28" r="0.75">
  <stop offset="0%" stop-color="${p.eyeLit}"/>
  <stop offset="55%" stop-color="${p.eye}"/>
  <stop offset="100%" stop-color="#232c44"/>
</radialGradient>
<radialGradient id="aura" cx="0.5" cy="0.36" r="0.55">
  <stop offset="0%" stop-color="#7fa8ff" stop-opacity="0.20"/>
  <stop offset="100%" stop-color="#7fa8ff" stop-opacity="0"/>
</radialGradient>
<linearGradient id="hairG" x1="0.2" y1="0" x2="0.5" y2="1">
  <stop offset="0%" stop-color="${p.hairLit}"/>
  <stop offset="100%" stop-color="${p.hairDark}"/>
</linearGradient>
<linearGradient id="skinG" x1="0.3" y1="0" x2="0.5" y2="1">
  <stop offset="0%" stop-color="${p.skin}"/>
  <stop offset="100%" stop-color="${p.skinShade}"/>
</linearGradient>
<linearGradient id="clothG" x1="0.2" y1="0" x2="0.4" y2="1">
  <stop offset="0%" stop-color="${p.clothLit}"/>
  <stop offset="100%" stop-color="${p.clothDark}"/>
</linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
  <stop offset="80%" stop-color="#0b0a10" stop-opacity="0"/>
  <stop offset="100%" stop-color="#0b0a10" stop-opacity="1"/>
</linearGradient>`;

  const eyeY = headY + 26;
  const eyeR = 40;
  const eyeL = headX - 62;
  const eyeR2 = headX + 62;

  let eyes, brows, mouth, blushOp = 0.5, look = 0;

  if (mood === 'smile') {
    eyes = eyeSmile(p, eyeL, eyeY, eyeR) + eyeSmile(p, eyeR2, eyeY, eyeR);
    brows = `<path d="M${headX - 108} ${eyeY - 62} Q${headX - 62} ${eyeY - 82} ${headX - 20} ${eyeY - 66}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.75"/>
             <path d="M${headX + 20} ${eyeY - 66} Q${headX + 62} ${eyeY - 82} ${headX + 108} ${eyeY - 62}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.75"/>`;
    mouth = `<path d="M${headX - 34} ${headY + 96} Q${headX} ${headY + 140} ${headX + 34} ${headY + 96}
                   Q${headX} ${headY + 108} ${headX - 34} ${headY + 96} Z" fill="${p.mouth}"/>
             <path d="M${headX - 26} ${headY + 100} Q${headX} ${headY + 112} ${headX + 26} ${headY + 100}
                   Q${headX} ${headY + 124} ${headX - 26} ${headY + 100} Z" fill="#fff8f2"/>`;
    blushOp = 0.62;
  } else if (mood === 'down') {
    eyes = eyeDown(p, eyeL, eyeY, eyeR) + eyeDown(p, eyeR2, eyeY, eyeR);
    brows = `<path d="M${headX - 110} ${eyeY - 50} Q${headX - 62} ${eyeY - 74} ${headX - 18} ${eyeY - 56}"
             fill="none" stroke="${p.hairDark}" stroke-width="10" stroke-linecap="round" opacity="0.8"/>
             <path d="M${headX + 18} ${eyeY - 56} Q${headX + 62} ${eyeY - 74} ${headX + 110} ${eyeY - 50}"
             fill="none" stroke="${p.hairDark}" stroke-width="10" stroke-linecap="round" opacity="0.8"/>`;
    mouth = `<path d="M${headX - 26} ${headY + 108} Q${headX} ${headY + 88} ${headX + 26} ${headY + 108}"
             fill="none" stroke="${p.mouth}" stroke-width="7" stroke-linecap="round"/>`;
    blushOp = 0.22;
  } else if (mood === 'away') {
    look = 1;
    eyes = eyeOpen(p, eyeL, eyeY, eyeR, look) + eyeOpen(p, eyeR2, eyeY, eyeR, look);
    brows = `<path d="M${headX - 108} ${eyeY - 58} Q${headX - 62} ${eyeY - 76} ${headX - 20} ${eyeY - 62}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.7"/>
             <path d="M${headX + 20} ${eyeY - 62} Q${headX + 62} ${eyeY - 76} ${headX + 108} ${eyeY - 58}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.7"/>`;
    mouth = `<path d="M${headX - 22} ${headY + 102} L${headX + 22} ${headY + 102}"
             fill="none" stroke="${p.mouth}" stroke-width="7" stroke-linecap="round"/>`;
    blushOp = 0.2;
  } else {
    // soft
    eyes = eyeOpen(p, eyeL, eyeY, eyeR) + eyeOpen(p, eyeR2, eyeY, eyeR);
    brows = `<path d="M${headX - 108} ${eyeY - 60} Q${headX - 62} ${eyeY - 78} ${headX - 20} ${eyeY - 64}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.7"/>
             <path d="M${headX + 20} ${eyeY - 64} Q${headX + 62} ${eyeY - 78} ${headX + 108} ${eyeY - 60}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.7"/>`;
    mouth = `<path d="M${headX - 24} ${headY + 100} Q${headX} ${headY + 118} ${headX + 24} ${headY + 100}"
             fill="none" stroke="${p.mouth}" stroke-width="7" stroke-linecap="round"/>`;
    blushOp = 0.45;
  }

  const body = `
<!-- ===== 身体（Q 版：短手短脚）===== -->
<!-- 腿 -->
<path d="M170 596 L170 676 Q170 692 186 692 L212 692 Q226 692 226 676 L226 596 Z" fill="${p.skinShade}"/>
<path d="M234 596 L234 676 Q234 692 248 692 L274 692 Q290 692 290 676 L290 596 Z" fill="${p.skinShade}"/>
<!-- 鞋 -->
<path d="M164 672 Q158 700 180 704 L222 704 Q232 700 226 676 Z" fill="${p.shoe}"/>
<path d="M236 676 Q230 700 240 704 L282 704 Q304 700 298 672 Z" fill="${p.shoe}"/>
<!-- 身体（圆豆） -->
<path d="M132 700 Q136 470 230 462 Q324 470 328 700 Z" fill="url(#clothG)"/>
<!-- 领口 -->
<path d="M196 466 Q230 496 264 466 L272 480 Q230 512 188 480 Z" fill="${p.clothDark}"/>
<path d="M198 468 Q230 494 262 468 L266 474 Q230 500 194 474 Z" fill="#000" opacity="0.12"/>
<!-- 手（豆豆） -->
<ellipse cx="126" cy="530" rx="24" ry="28" fill="${p.skin}"/>
<ellipse cx="334" cy="530" rx="24" ry="28" fill="${p.skin}"/>
<ellipse cx="126" cy="530" rx="24" ry="28" fill="${p.skinShade}" opacity="0.25"/>
<ellipse cx="334" cy="530" rx="24" ry="28" fill="${p.skinShade}" opacity="0.25"/>
<!-- 脖子 -->
<path d="M204 372 L204 466 Q230 482 256 466 L256 372 Z" fill="${p.skinShade}"/>
<path d="M204 380 Q230 410 256 380 L256 398 Q230 424 204 398 Z" fill="${p.skinDeep}" opacity="0.5"/>`;

  const head = `
<!-- ===== 头（Q 版的绝对主角）===== -->
<!-- 脸 -->
<ellipse cx="${headX}" cy="${headY}" rx="${headR}" ry="${headR * 0.95}" fill="url(#skinG)"/>
<!-- 耳 -->
<ellipse cx="${headX - headR * 0.98}" cy="${headY + 10}" rx="20" ry="26" fill="${p.skinShade}"/>
<ellipse cx="${headX + headR * 0.98}" cy="${headY + 10}" rx="20" ry="26" fill="${p.skinShade}"/>
<!-- 头发（Q 版：厚刘海 + 圆润轮廓）-->
<path d="M${headX - headR} ${headY + 16}
         Q${headX - headR - 6} ${headY - headR * 0.92} ${headX} ${headY - headR * 0.98}
         Q${headX + headR + 6} ${headY - headR * 0.92} ${headX + headR} ${headY + 16}
         Q${headX + headR - 6} ${headY - 34} ${headX + headR * 0.5} ${headY - 46}
         Q${headX + headR * 0.2} ${headY - 20} ${headX - headR * 0.05} ${headY - 44}
         Q${headX - headR * 0.42} ${headY - 16} ${headX - headR * 0.66} ${headY - 40}
         Q${headX - headR * 0.92} ${headY - 24} ${headX - headR} ${headY + 16} Z"
      fill="url(#hairG)"/>
<!-- 头顶高光 -->
<ellipse cx="${headX - 40}" cy="${headY - headR * 0.62}" rx="46" ry="20"
         fill="#ffffff" opacity="0.13" transform="rotate(-18 ${headX - 40} ${headY - headR * 0.62})"/>
<!-- 鬓角 -->
<path d="M${headX - headR + 2} ${headY - 20} Q${headX - headR - 4} ${headY + 50} ${headX - headR + 12} ${headY + 76}
         Q${headX - headR + 22} ${headY + 40} ${headX - headR + 16} ${headY - 16} Z" fill="${p.hairDark}"/>
<path d="M${headX + headR - 2} ${headY - 20} Q${headX + headR + 4} ${headY + 50} ${headX + headR - 12} ${headY + 76}
         Q${headX + headR - 22} ${headY + 40} ${headX + headR - 16} ${headY - 16} Z" fill="${p.hairDark}"/>
<!-- 眉毛 -->
${brows}
<!-- 眼睛 -->
${eyes}
<!-- 鼻（Q 版小点）-->
<path d="M${headX} ${headY + 62} L${headX - 7} ${headY + 78} L${headX + 5} ${headY + 78}"
      fill="none" stroke="${p.skinDeep}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"/>
<!-- 嘴 -->
${mouth}
<!-- 腮红 -->
${blush(p, headX - 100, headY + 62, 42, 24, blushOp)}
${blush(p, headX + 100, headY + 62, 42, 24, blushOp)}`;

  const inner = `
<!-- 光晕 -->
<ellipse cx="${headX}" cy="${headY + 20}" rx="196" ry="210" fill="url(#aura)"/>
${body}
${head}
<!-- 底部淡出 -->
<rect x="60" y="560" width="340" height="140" fill="url(#fade)"/>`;

  return wrapSvg(W, H, inner, defs, 'preserveAspectRatio="xMidYMax meet"');
}

/* ============================================================
   女生
   ============================================================ */

/**
 * Q 版女生
 * @param {number} stage 1-5
 * @param {string} mood  smile | soft | away | down
 */
function chibiGirl(stage, mood) {
  const p = Object.assign({}, BOY, GIRL_STAGES[stage]);

  const headX = 230, headY = 236, headR = 148;

  const defs = `
<radialGradient id="iris" cx="0.5" cy="0.28" r="0.75">
  <stop offset="0%" stop-color="${p.eyeLit}"/>
  <stop offset="55%" stop-color="${p.eye}"/>
  <stop offset="100%" stop-color="#4a2f52"/>
</radialGradient>
<radialGradient id="aura" cx="0.5" cy="0.36" r="0.55">
  <stop offset="0%" stop-color="#ff9db0" stop-opacity="0.22"/>
  <stop offset="100%" stop-color="#ff9db0" stop-opacity="0"/>
</radialGradient>
<linearGradient id="hairG" x1="0.2" y1="0" x2="0.5" y2="1">
  <stop offset="0%" stop-color="${p.hairLit}"/>
  <stop offset="100%" stop-color="${p.hairDark}"/>
</linearGradient>
<linearGradient id="skinG" x1="0.3" y1="0" x2="0.5" y2="1">
  <stop offset="0%" stop-color="${p.skin}"/>
  <stop offset="100%" stop-color="${p.skinShade}"/>
</linearGradient>
<linearGradient id="clothG" x1="0.2" y1="0" x2="0.4" y2="1">
  <stop offset="0%" stop-color="${p.clothLit}"/>
  <stop offset="100%" stop-color="${p.clothDark}"/>
</linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
  <stop offset="80%" stop-color="#0b0a10" stop-opacity="0"/>
  <stop offset="100%" stop-color="#0b0a10" stop-opacity="1"/>
</linearGradient>`;

  const eyeY = headY + 26;
  const eyeR = 44;   // 女生眼睛更大
  const eyeL = headX - 64;
  const eyeR2 = headX + 64;

  let eyes, brows, mouth, blushOp = 0.6, look = 0;

  if (mood === 'smile') {
    eyes = eyeSmile(p, eyeL, eyeY, eyeR) + eyeSmile(p, eyeR2, eyeY, eyeR);
    brows = `<path d="M${headX - 112} ${eyeY - 66} Q${headX - 64} ${eyeY - 90} ${headX - 18} ${eyeY - 70}"
             fill="none" stroke="${p.hairDark}" stroke-width="8" stroke-linecap="round" opacity="0.8"/>
             <path d="M${headX + 18} ${eyeY - 70} Q${headX + 64} ${eyeY - 90} ${headX + 112} ${eyeY - 66}"
             fill="none" stroke="${p.hairDark}" stroke-width="8" stroke-linecap="round" opacity="0.8"/>`;
    mouth = `<path d="M${headX - 32} ${headY + 98} Q${headX} ${headY + 142} ${headX + 32} ${headY + 98}
                   Q${headX} ${headY + 110} ${headX - 32} ${headY + 98} Z" fill="${p.mouth}"/>
             <path d="M${headX - 24} ${headY + 102} Q${headX} ${headY + 114} ${headX + 24} ${headY + 102}
                   Q${headX} ${headY + 126} ${headX - 24} ${headY + 102} Z" fill="#fff8f2"/>`;
    blushOp = 0.7;
  } else if (mood === 'down') {
    eyes = eyeDown(p, eyeL, eyeY, eyeR) + eyeDown(p, eyeR2, eyeY, eyeR);
    brows = `<path d="M${headX - 114} ${eyeY - 52} Q${headX - 64} ${eyeY - 78} ${headX - 16} ${eyeY - 58}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.82"/>
             <path d="M${headX + 16} ${eyeY - 58} Q${headX + 64} ${eyeY - 78} ${headX + 114} ${eyeY - 52}"
             fill="none" stroke="${p.hairDark}" stroke-width="9" stroke-linecap="round" opacity="0.82"/>`;
    mouth = `<path d="M${headX - 24} ${headY + 110} Q${headX} ${headY + 92} ${headX + 24} ${headY + 110}"
             fill="none" stroke="${p.mouth}" stroke-width="7" stroke-linecap="round"/>`;
    blushOp = 0.25;
  } else if (mood === 'away') {
    look = 1;
    eyes = eyeOpen(p, eyeL, eyeY, eyeR, look) + eyeOpen(p, eyeR2, eyeY, eyeR, look);
    brows = `<path d="M${headX - 112} ${eyeY - 60} Q${headX - 64} ${eyeY - 82} ${headX - 18} ${eyeY - 64}"
             fill="none" stroke="${p.hairDark}" stroke-width="8" stroke-linecap="round" opacity="0.75"/>
             <path d="M${headX + 18} ${eyeY - 64} Q${headX + 64} ${eyeY - 82} ${headX + 112} ${eyeY - 60}"
             fill="none" stroke="${p.hairDark}" stroke-width="8" stroke-linecap="round" opacity="0.75"/>`;
    mouth = `<path d="M${headX - 20} ${headY + 104} L${headX + 20} ${headY + 104}"
             fill="none" stroke="${p.mouth}" stroke-width="7" stroke-linecap="round"/>`;
    blushOp = 0.28;
  } else {
    eyes = eyeOpen(p, eyeL, eyeY, eyeR) + eyeOpen(p, eyeR2, eyeY, eyeR);
    brows = `<path d="M${headX - 112} ${eyeY - 64} Q${headX - 64} ${eyeY - 86} ${headX - 18} ${eyeY - 68}"
             fill="none" stroke="${p.hairDark}" stroke-width="8" stroke-linecap="round" opacity="0.75"/>
             <path d="M${headX + 18} ${eyeY - 68} Q${headX + 64} ${eyeY - 86} ${headX + 112} ${eyeY - 64}"
             fill="none" stroke="${p.hairDark}" stroke-width="8" stroke-linecap="round" opacity="0.75"/>`;
    mouth = `<path d="M${headX - 22} ${headY + 102} Q${headX} ${headY + 120} ${headX + 22} ${headY + 102}"
             fill="none" stroke="${p.mouth}" stroke-width="7" stroke-linecap="round"/>`;
    blushOp = 0.52;
  }

  // 头发造型：按章节变化
  let hairBack = '';
  let hairFront = '';
  let accessory = '';

  if (stage === 1) {
    // 双马尾
    hairBack = `
<ellipse cx="${headX - 168}" cy="${headY + 70}" rx="52" ry="86" fill="${p.hairDark}"/>
<ellipse cx="${headX + 168}" cy="${headY + 70}" rx="52" ry="86" fill="${p.hairDark}"/>
<ellipse cx="${headX - 168}" cy="${headY + 40}" rx="34" ry="44" fill="${p.hair}" opacity="0.85"/>
<ellipse cx="${headX + 168}" cy="${headY + 40}" rx="34" ry="44" fill="${p.hair}" opacity="0.85"/>`;
    hairFront = `
<path d="M${headX - headR} ${headY + 18}
         Q${headX - headR - 4} ${headY - headR * 0.94} ${headX} ${headY - headR * 0.98}
         Q${headX + headR + 4} ${headY - headR * 0.94} ${headX + headR} ${headY + 18}
         Q${headX + headR - 10} ${headY - 40} ${headX + headR * 0.55} ${headY - 50}
         Q${headX + headR * 0.25} ${headY - 18} ${headX + headR * 0.02} ${headY - 48}
         Q${headX - headR * 0.34} ${headY - 14} ${headX - headR * 0.6} ${headY - 44}
         Q${headX - headR * 0.9} ${headY - 28} ${headX - headR} ${headY + 18} Z" fill="url(#hairG)"/>`;
    accessory = `
<path d="M${headX - 150} ${headY - 42} l-22 -18 M${headX - 150} ${headY - 42} l20 -22"
      stroke="${p.accent}" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
<path d="M${headX + 150} ${headY - 42} l22 -18 M${headX + 150} ${headY - 42} l-20 -22"
      stroke="${p.accent}" stroke-width="7" stroke-linecap="round" opacity="0.9"/>`;
  } else if (stage === 2) {
    // 披肩中长发
    hairBack = `
<path d="M${headX - headR - 8} ${headY - 40} Q${headX - headR - 30} ${headY + 220} ${headX - headR + 30} ${headY + 250}
         L${headX + headR - 30} ${headY + 250}
         Q${headX + headR + 30} ${headY + 220} ${headX + headR + 8} ${headY - 40} Z" fill="${p.hairDark}"/>`;
    hairFront = `
<path d="M${headX - headR} ${headY + 20}
         Q${headX - headR - 4} ${headY - headR * 0.94} ${headX} ${headY - headR * 0.98}
         Q${headX + headR + 4} ${headY - headR * 0.94} ${headX + headR} ${headY + 20}
         Q${headX + headR - 8} ${headY - 44} ${headX + headR * 0.5} ${headY - 52}
         Q${headX + headR * 0.18} ${headY - 16} ${headX} ${headY - 50}
         Q${headX - headR * 0.3} ${headY - 14} ${headX - headR * 0.58} ${headY - 46}
         Q${headX - headR * 0.88} ${headY - 30} ${headX - headR} ${headY + 20} Z" fill="url(#hairG)"/>`;
  } else if (stage === 3) {
    // 长发 + 侧发
    hairBack = `
<path d="M${headX - headR - 12} ${headY - 40} Q${headX - headR - 38} ${headY + 300} ${headX - headR + 24} ${headY + 336}
         L${headX + headR - 24} ${headY + 336}
         Q${headX + headR + 38} ${headY + 300} ${headX + headR + 12} ${headY - 40} Z" fill="${p.hairDark}"/>`;
    hairFront = `
<path d="M${headX - headR} ${headY + 20}
         Q${headX - headR - 4} ${headY - headR * 0.94} ${headX} ${headY - headR * 0.98}
         Q${headX + headR + 4} ${headY - headR * 0.94} ${headX + headR} ${headY + 20}
         Q${headX + headR - 6} ${headY - 46} ${headX + headR * 0.46} ${headY - 54}
         Q${headX + headR * 0.16} ${headY - 12} ${headX - headR * 0.04} ${headY - 50}
         Q${headX - headR * 0.36} ${headY - 10} ${headX - headR * 0.62} ${headY - 44}
         Q${headX - headR * 0.9} ${headY - 28} ${headX - headR} ${headY + 20} Z" fill="url(#hairG)"/>
<!-- 侧发 -->
<path d="M${headX + headR - 4} ${headY - 46} Q${headX + headR + 14} ${headY + 120} ${headX + headR - 26} ${headY + 190}
         Q${headX + headR - 6} ${headY + 110} ${headX + headR - 22} ${headY - 40} Z" fill="${p.hair}"/>`;
    accessory = `
<circle cx="${headX + 122}" cy="${headY - 52}" r="15" fill="${p.accent}"/>
<circle cx="${headX + 116}" cy="${headY - 58}" r="5" fill="#fff" opacity="0.65"/>`;
  } else if (stage === 4) {
    // 长发，略显疲惫
    hairBack = `
<path d="M${headX - headR - 12} ${headY - 40} Q${headX - headR - 36} ${headY + 300} ${headX - headR + 22} ${headY + 330}
         L${headX + headR - 22} ${headY + 330}
         Q${headX + headR + 36} ${headY + 300} ${headX + headR + 12} ${headY - 40} Z" fill="${p.hairDark}"/>`;
    hairFront = `
<path d="M${headX - headR} ${headY + 20}
         Q${headX - headR - 4} ${headY - headR * 0.94} ${headX} ${headY - headR * 0.98}
         Q${headX + headR + 4} ${headY - headR * 0.94} ${headX + headR} ${headY + 20}
         Q${headX + headR - 8} ${headY - 42} ${headX + headR * 0.44} ${headY - 50}
         Q${headX + headR * 0.14} ${headY - 14} ${headX - headR * 0.06} ${headY - 46}
         Q${headX - headR * 0.38} ${headY - 12} ${headX - headR * 0.6} ${headY - 42}
         Q${headX - headR * 0.88} ${headY - 28} ${headX - headR} ${headY + 20} Z" fill="url(#hairG)"/>`;
  } else {
    // 第 5 章：长发 + 温柔，披肩
    hairBack = `
<path d="M${headX - headR - 14} ${headY - 40} Q${headX - headR - 40} ${headY + 306} ${headX - headR + 26} ${headY + 340}
         L${headX + headR - 26} ${headY + 340}
         Q${headX + headR + 40} ${headY + 306} ${headX + headR + 14} ${headY - 40} Z" fill="${p.hairDark}"/>
<!-- 发尾微卷 -->
<ellipse cx="${headX - 122}" cy="${headY + 322}" rx="30" ry="24" fill="${p.hair}"/>
<ellipse cx="${headX + 122}" cy="${headY + 322}" rx="30" ry="24" fill="${p.hair}"/>`;
    hairFront = `
<path d="M${headX - headR} ${headY + 20}
         Q${headX - headR - 4} ${headY - headR * 0.94} ${headX} ${headY - headR * 0.98}
         Q${headX + headR + 4} ${headY - headR * 0.94} ${headX + headR} ${headY + 20}
         Q${headX + headR - 6} ${headY - 46} ${headX + headR * 0.48} ${headY - 52}
         Q${headX + headR * 0.18} ${headY - 14} ${headX - headR * 0.02} ${headY - 50}
         Q${headX - headR * 0.34} ${headY - 12} ${headX - headR * 0.6} ${headY - 44}
         Q${headX - headR * 0.9} ${headY - 28} ${headX - headR} ${headY + 20} Z" fill="url(#hairG)"/>
<!-- 侧发 -->
<path d="M${headX - headR + 2} ${headY - 48} Q${headX - headR - 16} ${headY + 110} ${headX - headR + 22} ${headY + 178}
         Q${headX - headR + 2} ${headY + 104} ${headX - headR + 18} ${headY - 42} Z" fill="${p.hair}"/>`;
    accessory = `
<circle cx="${headX - 126}" cy="${headY - 50}" r="14" fill="${p.accent}"/>
<circle cx="${headX - 131}" cy="${headY - 56}" r="5" fill="#fff" opacity="0.7"/>`;
  }

  const body = `
<!-- ===== 身体（Q 版：短手短脚）===== -->
<path d="M172 600 L172 676 Q172 692 188 692 L214 692 Q228 692 228 676 L228 600 Z" fill="${p.skinShade}"/>
<path d="M236 600 L236 676 Q236 692 250 692 L276 692 Q292 692 292 676 L292 600 Z" fill="${p.skinShade}"/>
<path d="M166 674 Q158 700 182 704 L224 704 Q234 700 228 678 Z" fill="${p.shoe}"/>
<path d="M238 678 Q232 700 242 704 L284 704 Q308 700 300 674 Z" fill="${p.shoe}"/>
<!-- 身体 -->
<path d="M134 700 Q138 474 230 466 Q322 474 326 700 Z" fill="url(#clothG)"/>
<!-- 领口 + 领结 -->
<path d="M198 470 Q230 498 262 470 L270 484 Q230 514 190 484 Z" fill="${p.clothDark}"/>
<path d="M200 472 Q230 496 260 472 L264 478 Q230 502 196 478 Z" fill="#000" opacity="0.1"/>
<path d="M230 496 l-26 -16 l6 -12 l20 12 l20 -12 l6 12 z" fill="${p.tie}"/>
<circle cx="230" cy="484" r="7" fill="${p.tie}" opacity="0.8"/>
<!-- 裙摆 -->
<path d="M134 700 Q138 560 230 556 Q322 560 326 700 Z" fill="${p.clothDark}" opacity="0.55"/>
<!-- 手 -->
<ellipse cx="128" cy="534" rx="23" ry="27" fill="${p.skin}"/>
<ellipse cx="332" cy="534" rx="23" ry="27" fill="${p.skin}"/>
<ellipse cx="128" cy="534" rx="23" ry="27" fill="${p.skinShade}" opacity="0.22"/>
<ellipse cx="332" cy="534" rx="23" ry="27" fill="${p.skinShade}" opacity="0.22"/>
<!-- 脖子 -->
<path d="M206 376 L206 470 Q230 486 254 470 L254 376 Z" fill="${p.skinShade}"/>
<path d="M206 384 Q230 414 254 384 L254 402 Q230 428 206 402 Z" fill="${p.skinDeep}" opacity="0.45"/>`;

  const head = `
<!-- ===== 头 ===== -->
<ellipse cx="${headX}" cy="${headY}" rx="${headR}" ry="${headR * 0.95}" fill="url(#skinG)"/>
<ellipse cx="${headX - headR * 0.99}" cy="${headY + 12}" rx="19" ry="25" fill="${p.skinShade}"/>
<ellipse cx="${headX + headR * 0.99}" cy="${headY + 12}" rx="19" ry="25" fill="${p.skinShade}"/>
${hairBack}
${hairFront}
<ellipse cx="${headX - 44}" cy="${headY - headR * 0.6}" rx="48" ry="21"
         fill="#ffffff" opacity="0.15" transform="rotate(-18 ${headX - 44} ${headY - headR * 0.6})"/>
${brows}
${eyes}
<path d="M${headX} ${headY + 64} L${headX - 6} ${headY + 78} L${headX + 4} ${headY + 78}"
      fill="none" stroke="${p.skinDeep}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
${mouth}
${blush(p, headX - 102, headY + 64, 44, 25, blushOp)}
${blush(p, headX + 102, headY + 64, 44, 25, blushOp)}
${accessory}`;

  const inner = `
<ellipse cx="${headX}" cy="${headY + 20}" rx="196" ry="210" fill="url(#aura)"/>
${body}
${head}
<rect x="60" y="560" width="340" height="140" fill="url(#fade)"/>`;

  return wrapSvg(W, H, inner, defs, 'preserveAspectRatio="xMidYMax meet"');
}

module.exports = {
  BOY,
  GIRL_STAGES,
  MOODS: ['smile', 'soft', 'away', 'down'],
  chibiBoy,
  chibiGirl,
};
