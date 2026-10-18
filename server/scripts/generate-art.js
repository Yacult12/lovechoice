'use strict';

/**
 * 美术资源生成器：纯 Node 手写 SVG，输出到 client/assets/img/
 *   node scripts/generate-art.js
 *
 * 设计约束：
 *  - 背景：960x540，柔和渐变 + 几何/光影装饰，横版构图（16:9），上下压暗便于叠对白
 *  - 立绘：420x760，半身像，居中偏下，底部自然淡出，配合 stage 叠放
 *  - 全矢量、无外部依赖，体积小、加载快、任意分辨率不糊
 */

const fs = require('fs');
const path = require('path');

const IMG_DIR = path.resolve(__dirname, '..', '..', 'client', 'assets', 'img');
const BG_DIR = path.join(IMG_DIR, 'bg');
const AVATAR_DIR = path.join(IMG_DIR, 'avatar');

fs.mkdirSync(BG_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });

// ============================================================
// 工具
// ============================================================

function write(dir, name, svg) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, svg.replace(/\n\s*\n/g, '\n'), 'utf8');
  const kb = (Buffer.byteLength(svg, 'utf8') / 1024).toFixed(1);
  console.log(`  ✓ ${name}  (${kb} KB)`);
}

/** 确定性伪随机，保证每次生成结果一致 */
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function wrapSvg(w, h, inner, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
<defs>${defs}</defs>
${inner}
</svg>
`;
}

// ============================================================
// 背景图
// ============================================================

/** 顶部/底部压暗的渐变遮罩，保证对白框区域可读 */
const VIGNETTE = `
<linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#0b0a10" stop-opacity="0.55"/>
  <stop offset="38%" stop-color="#0b0a10" stop-opacity="0.12"/>
  <stop offset="62%" stop-color="#0b0a10" stop-opacity="0.30"/>
  <stop offset="100%" stop-color="#0b0a10" stop-opacity="0.90"/>
</linearGradient>`;

const BG_DEFS = (id, c1, c2, c3, glow) => `
<linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1">
  <stop offset="0%" stop-color="${c1}"/>
  <stop offset="55%" stop-color="${c2}"/>
  <stop offset="100%" stop-color="${c3}"/>
</linearGradient>
<radialGradient id="${id}glow" cx="0.72" cy="0.22" r="0.7">
  <stop offset="0%" stop-color="${glow}" stop-opacity="0.55"/>
  <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
</radialGradient>`;

function bgLibrary() {
  const d = `
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#2a2f45" stop-opacity="0"/>
  <stop offset="100%" stop-color="#141824" stop-opacity="0.9"/>
</linearGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0.6" y2="1">
  <stop offset="0%" stop-color="#cfd9ff" stop-opacity="0.16"/>
  <stop offset="100%" stop-color="#cfd9ff" stop-opacity="0"/>
</linearGradient>`;
  const rnd = seeded(11);
  let shelves = '';
  for (let i = 0; i < 4; i++) {
    const y = 150 + i * 62;
    let books = '';
    let x = 40;
    while (x < 900) {
      const w = 12 + Math.floor(rnd() * 20);
      const h = 30 + Math.floor(rnd() * 22);
      const hue = ['#5a6b9a', '#7c6b8f', '#6b7c94', '#8f7a6b', '#4f6070'][Math.floor(rnd() * 5)];
      books += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="${hue}" opacity="${(0.28 + rnd() * 0.3).toFixed(2)}"/>`;
      x += w + 3 + Math.floor(rnd() * 4);
    }
    shelves += `<rect x="30" y="${y}" width="900" height="5" rx="2" fill="#1b2030" opacity="0.85"/>${books}`;
  }
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
<rect width="960" height="540" fill="url(#skyglow)"/>
<!-- 窗光 -->
<path d="M620 -40 L860 -40 L700 400 L520 400 Z" fill="url(#beam)" opacity="0.5"/>
<rect x="612" y="-20" width="6" height="420" fill="#e8eeff" opacity="0.10"/>
<rect x="742" y="-20" width="4" height="420" fill="#e8eeff" opacity="0.08"/>
<!-- 书架 -->
${shelves}
<rect x="0" y="404" width="960" height="136" fill="url(#floor)"/>
<!-- 长桌 -->
<rect x="120" y="418" width="720" height="12" rx="4" fill="#39405a" opacity="0.7"/>
<rect x="160" y="430" width="10" height="60" fill="#2b3047" opacity="0.7"/>
<rect x="790" y="430" width="10" height="60" fill="#2b3047" opacity="0.7"/>
<!-- 书堆 -->
<rect x="300" y="404" width="86" height="8" rx="2" fill="#6b7c94" opacity="0.6"/>
<rect x="312" y="396" width="78" height="8" rx="2" fill="#8f7a6b" opacity="0.5"/>
<rect x="590" y="404" width="70" height="8" rx="2" fill="#5a6b9a" opacity="0.55"/>
<!-- 尘埃 -->
<circle cx="700" cy="120" r="2" fill="#fff" opacity="0.5"/>
<circle cx="740" cy="180" r="1.4" fill="#fff" opacity="0.35"/>
<circle cx="660" cy="230" r="1.6" fill="#fff" opacity="0.3"/>
<circle cx="780" cy="90" r="1.2" fill="#fff" opacity="0.4"/>
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#1a2138', '#131a2c', '#0d1120', '#7d9dff')}${d}${VIGNETTE}`);
}

function bgClassroom() {
  const d = `
<linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#4a4235" stop-opacity="0.9"/>
  <stop offset="100%" stop-color="#241f18" stop-opacity="1"/>
</linearGradient>
<linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#ffd9a0" stop-opacity="0.5"/>
  <stop offset="100%" stop-color="#ffb26b" stop-opacity="0.16"/>
</linearGradient>`;
  const rnd = seeded(23);
  let boards = '';
  for (let i = 0; i < 3; i++) {
    const y = 78 + i * 40;
    let line = '';
    let x = 60;
    while (x < 420) {
      const w = 40 + Math.floor(rnd() * 90);
      line += `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" fill="#d8e0f0" opacity="${(0.14 + rnd() * 0.16).toFixed(2)}"/>`;
      x += w + 14 + Math.floor(rnd() * 26);
    }
    boards += line;
  }
  let desks = '';
  for (let row = 0; row < 3; row++) {
    const y = 300 + row * 68;
    const off = row * 40;
    desks += `<rect x="${40 + off}" y="${y}" width="180" height="9" rx="3" fill="#4a4235" opacity="${0.75 - row * 0.12}"/>
<rect x="${240 + off}" y="${y}" width="180" height="9" rx="3" fill="#4a4235" opacity="${0.75 - row * 0.12}"/>
<rect x="${440 + off}" y="${y}" width="180" height="9" rx="3" fill="#4a4235" opacity="${0.75 - row * 0.12}"/>
<rect x="${640 + off}" y="${y}" width="180" height="9" rx="3" fill="#4a4235" opacity="${0.75 - row * 0.12}"/>`;
  }
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
<rect width="960" height="540" fill="url(#skyglow)"/>
<!-- 黑板 -->
<rect x="44" y="48" width="400" height="190" rx="6" fill="#1e2a26" opacity="0.9"/>
<rect x="44" y="48" width="400" height="190" rx="6" fill="none" stroke="#8a6a4a" stroke-width="4" opacity="0.5"/>
${boards}
<!-- 窗 -->
<rect x="640" y="52" width="280" height="180" rx="6" fill="url(#win)"/>
<rect x="640" y="52" width="280" height="180" rx="6" fill="none" stroke="#3a4258" stroke-width="5" opacity="0.7"/>
<rect x="776" y="52" width="5" height="180" fill="#3a4258" opacity="0.7"/>
<rect x="640" y="140" width="280" height="5" fill="#3a4258" opacity="0.7"/>
<!-- 地板 -->
<rect x="0" y="282" width="960" height="258" fill="url(#desk)"/>
<!-- 课桌 -->
${desks}
<!-- 窗外光斑 -->
<path d="M700 232 L900 232 L960 320 L640 320 Z" fill="#ffd9a0" opacity="0.08"/>
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#33304a', '#221f33', '#141220', '#ffb26b')}${d}${VIGNETTE}`);
}

function bgStreet() {
  const d = `
<linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#1e262e" stop-opacity="0.6"/>
  <stop offset="100%" stop-color="#0e1319" stop-opacity="1"/>
</linearGradient>
<radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0%" stop-color="#ffd98a" stop-opacity="0.55"/>
  <stop offset="100%" stop-color="#ffd98a" stop-opacity="0"/>
</radialGradient>`;
  const rnd = seeded(37);
  let buildings = '';
  for (let i = 0; i < 9; i++) {
    const x = i * 112 - 20;
    const w = 90 + Math.floor(rnd() * 40);
    const h = 190 + Math.floor(rnd() * 130);
    buildings += `<rect x="${x}" y="${300 - h}" width="${w}" height="${h}" fill="#171d26" opacity="${(0.7 + rnd() * 0.25).toFixed(2)}"/>`;
    for (let wy = 0; wy < 4; wy++) {
      for (let wx = 0; wx < 3; wx++) {
        if (rnd() > 0.55) continue;
        buildings += `<rect x="${x + 12 + wx * 26}" y="${300 - h + 16 + wy * 32}" width="14" height="18" rx="1.5" fill="#ffd98a" opacity="${(0.2 + rnd() * 0.5).toFixed(2)}"/>`;
      }
    }
  }
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
<rect width="960" height="540" fill="url(#skyglow)"/>
<!-- 远处建筑 -->
${buildings}
<!-- 路灯 -->
<rect x="180" y="150" width="6" height="230" fill="#222a35" opacity="0.9"/>
<circle cx="183" cy="146" r="90" fill="url(#lamp)"/>
<circle cx="183" cy="146" r="7" fill="#ffe6b0" opacity="0.9"/>
<rect x="700" y="180" width="5" height="200" fill="#222a35" opacity="0.85"/>
<circle cx="702" cy="177" r="70" fill="url(#lamp)" opacity="0.8"/>
<circle cx="702" cy="177" r="6" fill="#ffe6b0" opacity="0.8"/>
<!-- 地面 -->
<rect x="0" y="378" width="960" height="162" fill="url(#road)"/>
<rect x="0" y="378" width="960" height="2" fill="#4a5866" opacity="0.3"/>
<!-- 树影 -->
<ellipse cx="480" cy="430" rx="200" ry="40" fill="#0a0e12" opacity="0.45"/>
<!-- 雨丝 -->
${Array.from({ length: 34 }, () => {
    const x = Math.floor(rnd() * 960);
    const y = Math.floor(rnd() * 460);
    const l = 12 + Math.floor(rnd() * 18);
    return `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + l}" stroke="#cfe0f0" stroke-width="1" opacity="${(0.08 + rnd() * 0.14).toFixed(2)}"/>`;
  }).join('')}
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#26303c', '#18202a', '#0d1218', '#ffb26b')}${d}${VIGNETTE}`);
}

function bgDorm() {
  const d = `
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#3d3040" stop-opacity="0.5"/>
  <stop offset="100%" stop-color="#1a1420" stop-opacity="1"/>
</linearGradient>
<radialGradient id="deskLamp" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0%" stop-color="#ffc98a" stop-opacity="0.7"/>
  <stop offset="100%" stop-color="#ffc98a" stop-opacity="0"/>
</radialGradient>`;
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
<rect width="960" height="540" fill="url(#skyglow)"/>
<rect x="0" y="250" width="960" height="290" fill="url(#wall)"/>
<!-- 窗 -->
<rect x="600" y="70" width="300" height="200" rx="6" fill="#2a2438" opacity="0.85"/>
<rect x="600" y="70" width="300" height="200" rx="6" fill="none" stroke="#4a3f56" stroke-width="5"/>
<rect x="746" y="70" width="5" height="200" fill="#4a3f56"/>
<!-- 月光 -->
<circle cx="700" cy="128" r="26" fill="#e8e0ff" opacity="0.16"/>
<path d="M600 270 L900 270 L960 340 L560 340 Z" fill="#c8b8ff" opacity="0.06"/>
<!-- 桌 -->
<rect x="80" y="392" width="520" height="12" rx="4" fill="#4a3a34" opacity="0.9"/>
<rect x="110" y="404" width="10" height="76" fill="#332722" opacity="0.9"/>
<rect x="560" y="404" width="10" height="76" fill="#332722" opacity="0.9"/>
<!-- 台灯 -->
<rect x="180" y="356" width="8" height="36" fill="#2e2620"/>
<path d="M160 352 L210 352 L200 326 L170 326 Z" fill="#3d3229"/>
<circle cx="186" cy="372" r="70" fill="url(#deskLamp)"/>
<!-- 桌上物 -->
<rect x="290" y="378" width="60" height="14" rx="2" fill="#6b5a4b" opacity="0.85"/>
<rect x="296" y="366" width="48" height="12" rx="2" fill="#7d6a58" opacity="0.8"/>
<circle cx="420" cy="382" r="12" fill="#4a3f56" opacity="0.8"/>
<!-- 床 -->
<rect x="640" y="330" width="280" height="70" rx="10" fill="#3a2f3f" opacity="0.9"/>
<rect x="660" y="300" width="70" height="40" rx="12" fill="#584a62" opacity="0.85"/>
<rect x="660" y="396" width="240" height="90" fill="#2a2230" opacity="0.9"/>
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#3a2f3f', '#241d2b', '#130f18', '#ffc98a')}${d}${VIGNETTE}`);
}

function bgCorridor() {
  const d = `
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#2e2632" stop-opacity="0.7"/>
  <stop offset="100%" stop-color="#120e15" stop-opacity="1"/>
</linearGradient>
<linearGradient id="lightend" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#ffd9a0" stop-opacity="0.42"/>
  <stop offset="100%" stop-color="#ffb26b" stop-opacity="0.12"/>
</linearGradient>`;
  let tiles = '';
  for (let i = 0; i < 9; i++) {
    const y = 330 + i * 24;
    tiles += `<line x1="0" y1="${y}" x2="960" y2="${y}" stroke="#6a5a70" stroke-width="1" opacity="0.12"/>`;
  }
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
<rect width="960" height="540" fill="url(#skyglow)"/>
<!-- 走廊尽头 -->
<rect x="392" y="150" width="176" height="200" fill="url(#lightend)"/>
<rect x="392" y="150" width="176" height="200" fill="none" stroke="#4a3f4c" stroke-width="4" opacity="0.7"/>
<!-- 侧墙透视 -->
<path d="M0 60 L392 150 L392 350 L0 540 Z" fill="#241d28" opacity="0.85"/>
<path d="M960 60 L568 150 L568 350 L960 540 Z" fill="#241d28" opacity="0.85"/>
<!-- 门 -->
<rect x="90" y="150" width="130" height="220" rx="4" fill="#2e2432" opacity="0.8"/>
<rect x="96" y="160" width="118" height="96" rx="3" fill="#3a2c3e" opacity="0.7"/>
<rect x="740" y="150" width="130" height="220" rx="4" fill="#2e2432" opacity="0.8"/>
<rect x="746" y="160" width="118" height="96" rx="3" fill="#3a2c3e" opacity="0.7"/>
<!-- 地面 -->
<rect x="0" y="350" width="960" height="190" fill="url(#floor)"/>
${tiles}
<!-- 顶灯 -->
<rect x="420" y="52" width="120" height="10" rx="5" fill="#ffd9a0" opacity="0.4"/>
<circle cx="480" cy="240" r="130" fill="#ffb26b" opacity="0.06"/>
<!-- 行李箱 -->
<rect x="330" y="392" width="66" height="48" rx="6" fill="#4a3d50" opacity="0.85"/>
<rect x="352" y="382" width="10" height="14" rx="3" fill="#5a4a60" opacity="0.85"/>
<circle cx="346" cy="444" r="6" fill="#2a2230"/>
<circle cx="380" cy="444" r="6" fill="#2a2230"/>
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#33283a', '#201a26', '#110d14', '#ffb26b')}${d}${VIGNETTE}`);
}

function bgCafe() {
  const d = `
<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#4a3524" stop-opacity="0.6"/>
  <stop offset="100%" stop-color="#1c140e" stop-opacity="1"/>
</linearGradient>
<radialGradient id="warm" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0%" stop-color="#ffcf8a" stop-opacity="0.6"/>
  <stop offset="100%" stop-color="#ffcf8a" stop-opacity="0"/>
</radialGradient>`;
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
<rect width="960" height="540" fill="url(#skyglow)"/>
<!-- 吊灯 -->
<line x1="300" y1="0" x2="300" y2="90" stroke="#3a2c20" stroke-width="3"/>
<path d="M270 90 L330 90 L318 128 L282 128 Z" fill="#7a5a38"/>
<circle cx="300" cy="140" r="86" fill="url(#warm)"/>
<line x1="660" y1="0" x2="660" y2="70" stroke="#3a2c20" stroke-width="3"/>
<path d="M634 70 L686 70 L676 104 L644 104 Z" fill="#7a5a38"/>
<circle cx="660" cy="116" r="70" fill="url(#warm)" opacity="0.85"/>
<!-- 窗 -->
<rect x="60" y="70" width="200" height="220" rx="6" fill="#2e2418" opacity="0.8"/>
<rect x="60" y="70" width="200" height="220" rx="6" fill="none" stroke="#5a4530" stroke-width="5"/>
<!-- 吧台 -->
<rect x="0" y="360" width="960" height="180" fill="url(#wood)"/>
<rect x="0" y="352" width="960" height="12" rx="4" fill="#5c452e" opacity="0.9"/>
<!-- 杯子 -->
<rect x="420" y="326" width="42" height="30" rx="4" fill="#e8dcc8" opacity="0.85"/>
<ellipse cx="441" cy="327" rx="21" ry="5" fill="#6b4a2e" opacity="0.9"/>
<circle cx="441" cy="300" r="22" fill="#ffcf8a" opacity="0.12"/>
<rect x="500" y="332" width="34" height="24" rx="4" fill="#d8c8b0" opacity="0.8"/>
<rect x="700" y="330" width="38" height="26" rx="4" fill="#e8dcc8" opacity="0.75"/>
<!-- 座位 -->
<rect x="120" y="392" width="180" height="10" rx="4" fill="#6b503a" opacity="0.8"/>
<rect x="780" y="392" width="160" height="10" rx="4" fill="#6b503a" opacity="0.8"/>
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#43301f', '#2a1f15', '#140f0b', '#ffcf8a')}${d}${VIGNETTE}`);
}

function bgRooftop() {
  const d = `
<linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#1d3350" stop-opacity="0.2"/>
  <stop offset="100%" stop-color="#0c1119" stop-opacity="1"/>
</linearGradient>
<radialGradient id="moon" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0%" stop-color="#dfe8ff" stop-opacity="0.5"/>
  <stop offset="100%" stop-color="#dfe8ff" stop-opacity="0"/>
</radialGradient>`;
  const rnd = seeded(59);
  let stars = '';
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rnd() * 960);
    const y = Math.floor(rnd() * 320);
    const r = rnd() * 1.6 + 0.4;
    stars += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="#e8eeff" opacity="${(0.2 + rnd() * 0.6).toFixed(2)}"/>`;
  }
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
${stars}
<circle cx="760" cy="110" r="40" fill="#eef2ff" opacity="0.9"/>
<circle cx="760" cy="110" r="100" fill="url(#moon)"/>
<!-- 城市 -->
${Array.from({ length: 14 }, (_, i) => {
    const x = i * 72 - 10;
    const h = 60 + Math.floor(rnd() * 90);
    let win = '';
    for (let k = 0; k < 5; k++) {
      if (rnd() > 0.5) continue;
      win += `<rect x="${x + 8 + (k % 2) * 22}" y="${300 - h + 14 + Math.floor(k / 2) * 26}" width="12" height="16" rx="1.5" fill="#ffd98a" opacity="${(0.2 + rnd() * 0.45).toFixed(2)}"/>`;
    }
    return `<rect x="${x}" y="${300 - h}" width="62" height="${h}" fill="#101722" opacity="0.92"/>${win}`;
  }).join('')}
<rect x="0" y="300" width="960" height="30" fill="#0a0e14" opacity="0.9"/>
<rect x="0" y="330" width="960" height="210" fill="url(#sky2)"/>
<!-- 天台地面 -->
<rect x="0" y="396" width="960" height="144" fill="#1a222c"/>
<rect x="0" y="396" width="960" height="3" fill="#3a4757" opacity="0.5"/>
<!-- 栏杆 -->
<rect x="0" y="340" width="960" height="4" fill="#39434f" opacity="0.7"/>
${Array.from({ length: 24 }, (_, i) => `<rect x="${i * 40 + 10}" y="344" width="4" height="52" fill="#39434f" opacity="0.55"/>`).join('')}
<!-- 水箱 -->
<rect x="120" y="270" width="90" height="70" rx="6" fill="#1c2630" opacity="0.9"/>
<rect x="120" y="270" width="90" height="70" rx="6" fill="none" stroke="#39434f" stroke-width="3" opacity="0.6"/>
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#1a2a40', '#101a28', '#0a0e14', '#8fb0ff')}${d}${VIGNETTE}`);
}

function bgRain() {
  const d = `
<linearGradient id="wet" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#263043" stop-opacity="0.5"/>
  <stop offset="100%" stop-color="#0c1016" stop-opacity="1"/>
</linearGradient>
<radialGradient id="neon" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0%" stop-color="#ff8fb8" stop-opacity="0.45"/>
  <stop offset="100%" stop-color="#ff8fb8" stop-opacity="0"/>
</radialGradient>`;
  const rnd = seeded(71);
  return wrapSvg(960, 540, `
<rect width="960" height="540" fill="url(#sky)"/>
<rect width="960" height="540" fill="url(#skyglow)"/>
<!-- 建筑剪影 -->
${Array.from({ length: 7 }, (_, i) => `<rect x="${i * 145 - 30}" y="60" width="110" height="330" fill="#141a24" opacity="0.9"/>`).join('')}
<!-- 霓虹 -->
<circle cx="180" cy="200" r="86" fill="url(#neon)"/>
<rect x="150" y="176" width="60" height="48" rx="6" fill="#ff8fb8" opacity="0.32"/>
<circle cx="760" cy="180" r="70" fill="url(#neon)" opacity="0.7"/>
<rect x="734" y="158" width="52" height="44" rx="6" fill="#7ba8ff" opacity="0.28"/>
<!-- 伞面 -->
<path d="M300 400 Q480 250 660 400 Z" fill="#1a2230" opacity="0.95"/>
<path d="M300 400 Q480 250 660 400" fill="none" stroke="#3d4c60" stroke-width="3" opacity="0.6"/>
<rect x="476" y="398" width="8" height="90" fill="#2a3442" opacity="0.9"/>
<!-- 地面反光 -->
<rect x="0" y="400" width="960" height="140" fill="url(#wet)"/>
<ellipse cx="180" cy="440" rx="70" ry="14" fill="#ff8fb8" opacity="0.16"/>
<ellipse cx="760" cy="430" rx="60" ry="12" fill="#7ba8ff" opacity="0.14"/>
<!-- 雨 -->
${Array.from({ length: 130 }, () => {
    const x = Math.floor(rnd() * 960);
    const y = Math.floor(rnd() * 520);
    const l = 14 + Math.floor(rnd() * 26);
    return `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + l}" stroke="#cfe0f5" stroke-width="1" opacity="${(0.1 + rnd() * 0.2).toFixed(2)}"/>`;
  }).join('')}
<rect width="960" height="540" fill="url(#vg)"/>`,
    `${BG_DEFS('sky', '#232c3e', '#161c28', '#0c1016', '#ff8fb8')}${d}${VIGNETTE}`);
}

// ============================================================
// 角色立绘
//
// 核心设计：两位角色刻意做出「精致 / 朴素」的视觉反差 ——
//   女方：及腰长发 + 挑染高光 + 假睫毛 + 卧蚕 + 腮红 + 高光唇 + 蝴蝶结，
//         脸型偏小、脖子纤细、肩线柔和，色系统一暖粉，光晕更强。
//   男方：利落短发 + 无挑染 + 无腮红 + 单眼皮细线 + 宽肩素色 T 恤，
//         线条硬朗、色系统一冷蓝，光晕很弱。
// 同一场景里她的细节密度与亮度都明显高于他，视线自然被吸引过去。
// ============================================================

/**
 * 五个章节 = 五套形象。
 * 剧情推进 = 形象演化：从「素净、有点防备」到「被打扮过、狼狈、最后决意」。
 * 颜色与服装都随阶段变化，玩家一眼能看出故事走到哪儿了。
 */
const STAGES = {
  1: {
    name: '初见 · 素净',
    hair: '#4a3b42', hairLight: '#7a6169', hairShine: '#c9b0b8',
    coat: '#f4ece4', coatDark: '#d6c8bd', accent: '#c9a89a', aura: 0.32,
    outfit: 'blouse',
  },
  2: {
    name: '靠近 · 温暖',
    hair: '#55394a', hairLight: '#8b6376', hairShine: '#d8b4c4',
    coat: '#e9d5c2', coatDark: '#c9ab93', accent: '#d98a8a', aura: 0.36,
    outfit: 'cardigan',
  },
  3: {
    name: '传闻 · 被打扮过',
    hair: '#6b3f52', hairLight: '#a86a83', hairShine: '#e8bfd0',
    coat: '#e6a8bd', coatDark: '#c2768f', accent: '#ff7ba8', aura: 0.42,
    outfit: 'top',
  },
  4: {
    name: '雨夜 · 狼狈',
    hair: '#3a2e35', hairLight: '#68525d', hairShine: '#a08a94',
    coat: '#5f6b7a', coatDark: '#3f4a56', accent: '#7fa8d8', aura: 0.24,
    outfit: 'coat', wet: true,
  },
  5: {
    name: '走廊 · 决意',
    hair: '#7a4358', hairLight: '#bb7a95', hairShine: '#f0cfdd',
    coat: '#ffd0e2', coatDark: '#d98fb0', accent: '#ff5f96', aura: 0.5,
    outfit: 'dress',
  },
};

/**
 * 五种服装。素净 → 温暖 → 被打扮过 → 雨夜狼狈 → 决意盛装。
 * 每种都给不同的领口/肩线/配色，配合阶段色一起演化。
 */
const OUTFITS = {
  // 1. 素净白衬衫：领口小、扣到最上面一颗、袖口平直
  blouse: `
<path d="M196 512 Q230 546 264 512 L278 528 Q230 570 182 528 Z" fill="#fffdfa" opacity="0.95"/>
<path d="M196 512 Q230 546 264 512 L270 520 Q230 554 190 520 Z" fill="${'#d6c8bd'}" opacity="0.4"/>
<path d="M230 552 L230 600" stroke="#c9bcb2" stroke-width="1.6" opacity="0.7"/>
<circle cx="230" cy="568" r="3" fill="#c9bcb2"/>
<circle cx="230" cy="596" r="3" fill="#c9bcb2"/>`,

  // 2. 奶油色开衫：V 领内衬 + 两颗纽扣 + 针织纹
  cardigan: `
<path d="M188 508 Q230 560 272 508 L286 524 Q230 586 174 524 Z" fill="#fffaf3" opacity="0.9"/>
<path d="M188 508 Q230 560 272 508 L279 517 Q230 570 181 517 Z" fill="${'#c9ab93'}" opacity="0.28"/>
<path d="M188 508 L204 540 L196 780" fill="none" stroke="${'#c9ab93'}" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
<path d="M272 508 L256 540 L264 780" fill="none" stroke="${'#c9ab93'}" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
${Array.from({ length: 7 }, (_, i) => `<path d="M${130 + i * 30} 620 L${124 + i * 30} 700" stroke="#c9ab93" stroke-width="1.4" opacity="0.18"/>`).join('')}
<circle cx="214" cy="556" r="4" fill="#b89a80"/>
<circle cx="246" cy="556" r="4" fill="#b89a80"/>`,

  // 3. 精心打扮的针织上衣：小立领 + 锁骨链 + 亮片
  top: `
<path d="M192 510 Q230 548 268 510 L276 522 Q230 566 184 522 Z" fill="#fff4f8" opacity="0.95"/>
<path d="M192 510 Q230 548 268 510 L273 517 Q230 556 187 517 Z" fill="${'#c2768f'}" opacity="0.3"/>
<path d="M206 508 Q230 538 254 508" fill="none" stroke="#ffd98a" stroke-width="1.6" opacity="0.9"/>
<circle cx="230" cy="536" r="4" fill="#ffe6a8"/>
<circle cx="228.6" cy="534.6" r="1.3" fill="#fff"/>
${Array.from({ length: 12 }, () => `<circle cx="${(150 + Math.random() * 160).toFixed(0)}" cy="${(560 + Math.random() * 180).toFixed(0)}" r="2.2" fill="#fff" opacity="0.45"/>`).join('')}`,

  // 4. 男式外套（大）：敞穿、露出内搭、明显大一号
  coat: `
<!-- 内搭 -->
<path d="M200 512 Q230 544 260 512 L270 526 Q230 562 190 526 Z" fill="#e8dcd0" opacity="0.9"/>
<!-- 外套左片 -->
<path d="M104 780 Q112 566 176 514 L206 528 L188 780 Z" fill="url(#coatG)"/>
<!-- 外套右片 -->
<path d="M356 780 Q348 566 284 514 L254 528 L272 780 Z" fill="url(#coatG)"/>
<!-- 翻领 -->
<path d="M176 514 L206 528 L188 596 L162 548 Z" fill="${'#3f4a56'}" opacity="0.85"/>
<path d="M284 514 L254 528 L272 596 L298 548 Z" fill="${'#3f4a56'}" opacity="0.85"/>
<!-- 敞开的深色内里 -->
<path d="M206 528 L254 528 L272 780 L188 780 Z" fill="#2f3742" opacity="0.35"/>
<!-- 雨水反光 -->
<path d="M120 640 Q160 620 186 640 L184 664 Q150 650 118 664 Z" fill="#cfe4ff" opacity="0.16"/>
<path d="M300 700 Q336 684 352 700 L350 720 Q322 708 298 720 Z" fill="#cfe4ff" opacity="0.12"/>`,

  // 5. 盛装连衣裙：方领 + 腰线 + 细褶裙
  dress: `
<!-- 裙身 -->
<path d="M112 780 Q126 616 176 546 L284 546 Q334 616 348 780 Z" fill="url(#coatG)"/>
<!-- 腰线 -->
<path d="M164 592 Q230 612 296 592 L300 614 Q230 636 160 614 Z" fill="${'#d98fb0'}" opacity="0.55"/>
<!-- 方领 -->
<path d="M194 512 L266 512 L262 546 Q230 562 198 546 Z" fill="#fff6fa" opacity="0.95"/>
<path d="M194 512 L266 512 L264 520 Q230 534 196 520 Z" fill="${'#d98fb0'}" opacity="0.25"/>
<!-- 细褶 -->
${Array.from({ length: 6 }, (_, i) => `<path d="M${176 + i * 22} 620 L${160 + i * 28} 780" stroke="#d98fb0" stroke-width="1.6" opacity="0.22"/>`).join('')}
<!-- 亮片 -->
${Array.from({ length: 10 }, (_, i) => `<circle cx="${(170 + i * 14).toFixed(0)}" cy="${(640 + (i % 4) * 32).toFixed(0)}" r="2" fill="#fff" opacity="0.5"/>`).join('')}`,
};

/** 女方：甜美系立绘，细节密度高。stage 决定配色/服装，mood 决定表情。 */
function portraitGirl(opts) {
  const stage = STAGES[opts.stage] || STAGES[1];
  const P = Object.assign(
    {
      skin: '#fbe3d4',
      skinShade: '#e8c3ad',
      blush: '#f98aa4',
      iris: '#8a5a72',
      irisLight: '#d9a8bf',
      lip: '#e05a72',
      eye: '#4a3244',
    },
    stage,
    opts
  );
  const mood = opts.mood || 'smile';
  const wet = stage.wet ? true : false;

  const defs = `
<linearGradient id="hairG" x1="0.1" y1="0" x2="0.4" y2="1">
  <stop offset="0%" stop-color="${P.hairLight}"/>
  <stop offset="45%" stop-color="${P.hair}"/>
  <stop offset="100%" stop-color="${P.hair}"/>
</linearGradient>
<linearGradient id="skinG" x1="0.2" y1="0" x2="0.4" y2="1">
  <stop offset="0%" stop-color="#fff6f0"/>
  <stop offset="45%" stop-color="${P.skin}"/>
  <stop offset="100%" stop-color="${P.skinShade}"/>
</linearGradient>
<linearGradient id="coatG" x1="0.1" y1="0" x2="0.3" y2="1">
  <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
  <stop offset="40%" stop-color="${P.coat}"/>
  <stop offset="100%" stop-color="${P.coatDark}"/>
</linearGradient>
<linearGradient id="hairShineG" x1="0" y1="0" x2="1" y2="0.4">
  <stop offset="0%" stop-color="${P.hairShine}" stop-opacity="0"/>
  <stop offset="45%" stop-color="${P.hairShine}" stop-opacity="0.85"/>
  <stop offset="100%" stop-color="${P.hairShine}" stop-opacity="0"/>
</linearGradient>
<radialGradient id="irisG" cx="0.4" cy="0.3" r="0.8">
  <stop offset="0%" stop-color="${P.irisLight}"/>
  <stop offset="100%" stop-color="${P.iris}"/>
</radialGradient>
<radialGradient id="blushG" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0%" stop-color="${P.blush}" stop-opacity="0.5"/>
  <stop offset="100%" stop-color="${P.blush}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="aura" cx="0.5" cy="0.4" r="0.5">
  <stop offset="0%" stop-color="${P.accent}" stop-opacity="${P.aura}"/>
  <stop offset="100%" stop-color="${P.accent}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
  <stop offset="70%" stop-color="#0b0a10" stop-opacity="0"/>
  <stop offset="100%" stop-color="#0b0a10" stop-opacity="1"/>
</linearGradient>`;

  // 眼睛：大而亮，双眼皮 + 假睫毛 + 卧蚕 + 双高光
  const eyeWhite = mood === 'down' || mood === 'away' ? '#efe6ec' : '#fffafc';
  const lidDrop = mood === 'down' || mood === 'away' ? 6 : 0;
  const lashExtra = mood === 'smile' ? 2 : 0;

  const eyes = `
<!-- 双眼皮线 -->
<path d="M144 310 Q166 ${302 - lidDrop} 188 310" fill="none" stroke="${P.eye}" stroke-width="2" opacity="0.42" stroke-linecap="round"/>
<path d="M240 310 Q262 ${302 - lidDrop} 286 310" fill="none" stroke="${P.eye}" stroke-width="2" opacity="0.42" stroke-linecap="round"/>
<!-- 眼白 -->
<path d="M146 ${316 + lidDrop} Q166 ${302 + lidDrop} 186 ${316 + lidDrop} Q166 ${330} 146 ${316 + lidDrop} Z" fill="${eyeWhite}"/>
<path d="M242 ${316 + lidDrop} Q262 ${302 + lidDrop} 282 ${316 + lidDrop} Q262 ${330} 242 ${316 + lidDrop} Z" fill="${eyeWhite}"/>
<!-- 虹膜 -->
<circle cx="166" cy="${315 + lidDrop}" r="10.5" fill="url(#irisG)"/>
<circle cx="262" cy="${315 + lidDrop}" r="10.5" fill="url(#irisG)"/>
<!-- 瞳孔 -->
<circle cx="166" cy="${316 + lidDrop}" r="4.6" fill="#2b1a24"/>
<circle cx="262" cy="${316 + lidDrop}" r="4.6" fill="#2b1a24"/>
<!-- 上下眼线 -->
<path d="M145 ${315 + lidDrop} Q166 ${300 + lidDrop} 187 ${315 + lidDrop}" fill="none" stroke="#3a2230" stroke-width="3.4" stroke-linecap="round"/>
<path d="M241 ${315 + lidDrop} Q262 ${300 + lidDrop} 283 ${315 + lidDrop}" fill="none" stroke="#3a2230" stroke-width="3.4" stroke-linecap="round"/>
<path d="M150 ${322 + lidDrop} Q166 ${327 + lidDrop} 182 ${322 + lidDrop}" fill="none" stroke="#3a2230" stroke-width="1.4" opacity="0.5" stroke-linecap="round"/>
<path d="M246 ${322 + lidDrop} Q262 ${327 + lidDrop} 278 ${322 + lidDrop}" fill="none" stroke="#3a2230" stroke-width="1.4" opacity="0.5" stroke-linecap="round"/>
<!-- 假睫毛（外眼角上扬） -->
<path d="M145 ${314 + lidDrop} L136 ${308 + lidDrop - lashExtra}" stroke="#3a2230" stroke-width="2.2" stroke-linecap="round"/>
<path d="M283 ${314 + lidDrop} L292 ${308 + lidDrop - lashExtra}" stroke="#3a2230" stroke-width="2.2" stroke-linecap="round"/>
<!-- 卧蚕 -->
<path d="M150 ${326 + lidDrop} Q166 ${331 + lidDrop} 182 ${326 + lidDrop}" fill="none" stroke="${P.blush}" stroke-width="2" opacity="0.35" stroke-linecap="round"/>
<path d="M246 ${326 + lidDrop} Q262 ${331 + lidDrop} 278 ${326 + lidDrop}" fill="none" stroke="${P.blush}" stroke-width="2" opacity="0.35" stroke-linecap="round"/>
<!-- 高光 -->
<circle cx="161" cy="${310 + lidDrop}" r="4.2" fill="#fff" opacity="0.95"/>
<circle cx="257" cy="${310 + lidDrop}" r="4.2" fill="#fff" opacity="0.95"/>
<circle cx="170" cy="${320 + lidDrop}" r="2.1" fill="#fff" opacity="0.7"/>
<circle cx="266" cy="${320 + lidDrop}" r="2.1" fill="#fff" opacity="0.7"/>`;

  const mouth = {
    smile: `
<path d="M199 368 Q216 388 233 368 Q216 374 199 368 Z" fill="${P.lip}"/>
<path d="M204 373 Q216 381 228 373 Q216 377 204 373 Z" fill="#fff" opacity="0.55"/>
<circle cx="212" cy="376" r="2.4" fill="#fff" opacity="0.85"/>`,
    soft: `
<path d="M202 370 Q216 381 230 370 Q216 375 202 370 Z" fill="${P.lip}" opacity="0.9"/>
<circle cx="210" cy="374" r="1.8" fill="#fff" opacity="0.6"/>`,
    down: `
<path d="M204 380 Q216 370 228 380 Q216 375 204 380 Z" fill="${P.lip}" opacity="0.85"/>`,
    away: `
<path d="M203 375 Q216 379 229 375 Q216 372 203 375 Z" fill="${P.lip}" opacity="0.75"/>`,
  }[mood];

  return wrapSvg(460, 780, `
<!-- 光晕（比男方强） -->
<ellipse cx="230" cy="320" rx="238" ry="300" fill="url(#aura)"/>

<!-- ===== 后发（及腰长发）===== -->
<path d="M104 300 Q104 146 230 146 Q356 146 356 300
         L360 560 Q364 690 322 706 Q286 700 284 640
         L286 344 L174 344 L176 640 Q174 700 138 706
         Q96 690 100 560 Z" fill="url(#hairG)"/>
<!-- 发尾内层暗部 -->
<path d="M104 300 Q104 146 230 146 Q356 146 356 300 L360 560 Q364 690 322 706
         Q318 600 318 470 L318 344 L142 344 L142 470 Q142 600 138 706
         Q96 690 100 560 Z" fill="#000" opacity="0.10"/>

<!-- ===== 身体（窄肩、收腰）===== -->
<path d="M112 780 Q118 566 176 516 L284 516 Q342 566 348 780 Z" fill="url(#coatG)"/>
<!-- 肩部高光 -->
<path d="M150 566 Q176 528 200 522 L200 560 Q172 566 156 590 Z" fill="#fff" opacity="0.18"/>
<!-- 阶段服装 -->
${OUTFITS[stage.outfit] || OUTFITS.blouse}

<!-- ===== 脖子（纤细）===== -->
<path d="M208 436 L208 496 Q208 512 230 512 Q252 512 252 496 L252 436 Z" fill="url(#skinG)"/>
<path d="M208 436 Q230 466 252 436 L252 452 Q230 476 208 452 Z" fill="${P.skinShade}" opacity="0.42"/>
<!-- 锁骨 -->
<path d="M192 522 Q212 528 230 528 Q248 528 268 522" fill="none" stroke="${P.skinShade}" stroke-width="1.6" opacity="0.35"/>

<!-- ===== 脸（偏小的鹅蛋脸）===== -->
<ellipse cx="230" cy="316" rx="92" ry="114" fill="url(#skinG)"/>
<!-- 下巴收窄 -->
<path d="M174 392 Q230 448 286 392 Q278 428 230 436 Q182 428 174 392 Z" fill="${P.skin}" opacity="0.5"/>
<!-- 耳 -->
<ellipse cx="138" cy="324" rx="11" ry="20" fill="${P.skin}"/>
<ellipse cx="322" cy="324" rx="11" ry="20" fill="${P.skin}"/>
<path d="M136 318 Q142 324 136 332" fill="none" stroke="${P.skinShade}" stroke-width="1.6" opacity="0.6"/>

<!-- ===== 刘海（空气感 + 碎发）===== -->
<path d="M138 266 Q142 168 230 164 Q318 168 322 266
         Q306 224 286 236 Q272 200 240 214
         Q214 244 196 228 Q176 206 158 244 Q146 232 138 266 Z" fill="url(#hairG)"/>
<!-- 碎发 -->
<path d="M150 250 Q146 268 152 284" fill="none" stroke="${P.hair}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
<path d="M312 252 Q318 272 310 288" fill="none" stroke="${P.hair}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
<!-- 发丝高光带 -->
<path d="M156 210 Q204 178 268 196 Q226 200 186 226 Z" fill="url(#hairShineG)" opacity="0.75"/>
<path d="M170 236 Q216 214 288 236 Q228 232 178 254 Z" fill="url(#hairShineG)" opacity="0.45"/>

<!-- ===== 侧发（包脸）===== -->
<path d="M136 258 Q126 350 140 440 Q132 380 148 300 Z" fill="url(#hairG)"/>
<path d="M324 258 Q334 350 320 440 Q328 380 312 300 Z" fill="url(#hairG)"/>

<!-- ===== 腮红 ===== -->
<ellipse cx="176" cy="346" rx="30" ry="16" fill="url(#blushG)"/>
<ellipse cx="284" cy="346" rx="30" ry="16" fill="url(#blushG)"/>
<ellipse cx="170" cy="348" rx="9" ry="4" fill="${P.blush}" opacity="0.22"/>
<ellipse cx="290" cy="348" rx="9" ry="4" fill="${P.blush}" opacity="0.22"/>

<!-- ===== 眉（细长带弧）===== -->
<path d="M146 286 Q166 272 188 282" fill="none" stroke="${P.hair}" stroke-width="3.2" stroke-linecap="round" opacity="0.8"/>
<path d="M240 282 Q262 272 282 286" fill="none" stroke="${P.hair}" stroke-width="3.2" stroke-linecap="round" opacity="0.8"/>

<!-- ===== 眼 ===== -->
${eyes}

<!-- ===== 鼻（小翘鼻 + 高光）===== -->
<path d="M230 332 Q226 346 230 352" fill="none" stroke="${P.skinShade}" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/>
<ellipse cx="222" cy="336" rx="4" ry="2.4" fill="#fff" opacity="0.55"/>

<!-- ===== 嘴 ===== -->
${mouth}

<!-- ===== 蝴蝶结发饰（随阶段变化）===== -->
${
  stage.outfit === 'blouse'
    ? // 素净：一根低调的细发夹
      `<g transform="translate(152,190) rotate(-10)">
  <rect x="-18" y="-2.5" width="36" height="5" rx="2.5" fill="#b8a79c"/>
  <rect x="-18" y="-2.5" width="36" height="2" rx="1" fill="#fff" opacity="0.35"/>
</g>`
    : stage.outfit === 'coat'
      ? // 雨夜：什么都没有，只有湿发
        ''
      : // 其余阶段：蝴蝶结 + 小珍珠
        `<g transform="translate(150,186) rotate(-14)">
  <path d="M0 0 L-20 -11 L-20 11 Z" fill="${P.accent}"/>
  <path d="M0 0 L20 -11 L20 11 Z" fill="${P.accent}"/>
  <path d="M0 0 L-20 -11 L-20 11 Z" fill="#fff" opacity="0.18"/>
  <path d="M0 0 L20 -11 L20 11 Z" fill="#fff" opacity="0.28"/>
  <circle cx="0" cy="0" r="5" fill="#fff2f7"/>
  <circle cx="-1.4" cy="-1.4" r="1.8" fill="#fff"/>
</g>
<circle cx="186" cy="212" r="3.4" fill="#fffaf5" opacity="0.9"/>
<circle cx="185" cy="211" r="1.1" fill="#fff"/>`
}

${
  wet
    ? `<!-- ===== 雨夜：湿发（贴面、结绺、反光）===== -->
<path d="M142 268 Q136 330 146 396" fill="none" stroke="${P.hairLight}" stroke-width="9" stroke-linecap="round" opacity="0.9"/>
<path d="M318 268 Q326 336 316 404" fill="none" stroke="${P.hairLight}" stroke-width="9" stroke-linecap="round" opacity="0.9"/>
<path d="M104 470 Q118 600 138 700" fill="none" stroke="${P.hairLight}" stroke-width="11" stroke-linecap="round" opacity="0.55"/>
<path d="M356 470 Q344 600 322 700" fill="none" stroke="${P.hairLight}" stroke-width="11" stroke-linecap="round" opacity="0.55"/>
<!-- 湿发高光 -->
<path d="M150 200 Q200 176 264 192" fill="none" stroke="#cfe4ff" stroke-width="3.5" stroke-linecap="round" opacity="0.4"/>
<path d="M158 232 Q214 210 286 230" fill="none" stroke="#cfe4ff" stroke-width="2.5" stroke-linecap="round" opacity="0.28"/>
<!-- 落下的水珠 -->
<circle cx="140" cy="452" r="3" fill="#cfe4ff" opacity="0.55"/>
<circle cx="322" cy="470" r="2.4" fill="#cfe4ff" opacity="0.45"/>
<circle cx="152" cy="556" r="2.8" fill="#cfe4ff" opacity="0.4"/>
<circle cx="312" cy="600" r="2.2" fill="#cfe4ff" opacity="0.35"/>`
    : ''
}

<!-- ===== 底部淡出 ===== -->
<rect x="70" y="586" width="320" height="194" fill="url(#fade)"/>`,
    defs);
}

/** 男方：朴素立绘，细节少、线条硬、饱和度低 */
function portraitBoy(opts) {
  const P = Object.assign(
    {
      skin: '#e8cdb6',
      skinShade: '#c8a488',
      hair: '#2b3040',
      hairLight: '#414960',
      coat: '#4a5a72',
      coatDark: '#333f52',
      accent: '#5b8cff',
      eye: '#333c4e',
    },
    opts
  );
  const mood = opts.mood || 'soft';

  const defs = `
<linearGradient id="hairG" x1="0" y1="0" x2="0.3" y2="1">
  <stop offset="0%" stop-color="${P.hairLight}"/>
  <stop offset="100%" stop-color="${P.hair}"/>
</linearGradient>
<linearGradient id="skinG" x1="0.2" y1="0" x2="0.4" y2="1">
  <stop offset="0%" stop-color="${P.skin}"/>
  <stop offset="100%" stop-color="${P.skinShade}"/>
</linearGradient>
<linearGradient id="coatG" x1="0.1" y1="0" x2="0.3" y2="1">
  <stop offset="0%" stop-color="${P.coat}"/>
  <stop offset="100%" stop-color="${P.coatDark}"/>
</linearGradient>
<radialGradient id="aura" cx="0.5" cy="0.42" r="0.5">
  <stop offset="0%" stop-color="${P.accent}" stop-opacity="0.16"/>
  <stop offset="100%" stop-color="${P.accent}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
  <stop offset="72%" stop-color="#0b0a10" stop-opacity="0"/>
  <stop offset="100%" stop-color="#0b0a10" stop-opacity="1"/>
</linearGradient>`;

  // 眼睛：单眼皮细线，无高光
  const droop = mood === 'down' || mood === 'away' ? 4 : 0;
  const eyes = `
<path d="M150 ${318 + droop} Q166 ${310 + droop} 182 ${318 + droop}" fill="none" stroke="${P.eye}" stroke-width="3" stroke-linecap="round"/>
<path d="M242 ${318 + droop} Q258 ${310 + droop} 274 ${318 + droop}" fill="none" stroke="${P.eye}" stroke-width="3" stroke-linecap="round"/>
<circle cx="166" cy="${317 + droop}" r="4.5" fill="${P.eye}"/>
<circle cx="258" cy="${317 + droop}" r="4.5" fill="${P.eye}"/>`;

  const mouth = {
    soft: `<path d="M205 374 Q216 380 227 374" fill="none" stroke="${P.skinShade}" stroke-width="2.6" stroke-linecap="round"/>`,
    down: `<path d="M205 380 Q216 372 227 380" fill="none" stroke="${P.skinShade}" stroke-width="2.6" stroke-linecap="round"/>`,
    away: `<path d="M205 376 L227 376" fill="none" stroke="${P.skinShade}" stroke-width="2.6" stroke-linecap="round"/>`,
    smile: `<path d="M204 372 Q216 382 228 372" fill="none" stroke="${P.skinShade}" stroke-width="2.8" stroke-linecap="round"/>`,
  }[mood];

  return wrapSvg(460, 780, `
<!-- 光晕（很弱） -->
<ellipse cx="230" cy="330" rx="210" ry="270" fill="url(#aura)"/>

<!-- ===== 短发（利落，无挑染）===== -->
<path d="M130 300 Q130 168 230 164 Q330 168 330 300
         Q326 262 316 244 Q300 268 268 252
         Q246 214 208 244 Q176 270 152 250
         Q138 268 130 300 Z" fill="url(#hairG)"/>
<!-- 鬓角 -->
<path d="M132 288 Q128 330 138 366 Q132 330 140 296 Z" fill="url(#hairG)"/>
<path d="M328 288 Q332 330 322 366 Q328 330 320 296 Z" fill="url(#hairG)"/>

<!-- ===== 身体（宽肩、素色 T 恤）===== -->
<path d="M84 780 Q92 560 160 512 L300 512 Q368 560 376 780 Z" fill="url(#coatG)"/>
<!-- 简单圆领，无装饰 -->
<path d="M198 512 Q230 542 262 512 L272 524 Q230 558 188 524 Z" fill="${P.coatDark}"/>
<path d="M198 512 Q230 542 262 512 L266 518 Q230 548 194 518 Z" fill="#000" opacity="0.14"/>

<!-- ===== 脖子（略粗）===== -->
<path d="M204 438 L204 500 Q204 514 230 514 Q256 514 256 500 L256 438 Z" fill="url(#skinG)"/>
<path d="M204 438 Q230 466 256 438 L256 456 Q230 480 204 456 Z" fill="${P.skinShade}" opacity="0.45"/>

<!-- ===== 脸（方一点）===== -->
<ellipse cx="230" cy="316" rx="96" ry="114" fill="url(#skinG)"/>
<path d="M138 322 L138 356 M322 322 L322 356" stroke="${P.skinShade}" stroke-width="1.4" opacity="0.3" fill="none"/>
<!-- 耳 -->
<ellipse cx="136" cy="322" rx="11" ry="19" fill="${P.skinShade}" opacity="0.8"/>
<ellipse cx="324" cy="322" rx="11" ry="19" fill="${P.skinShade}" opacity="0.8"/>

<!-- ===== 眉毛（粗、直、淡）===== -->
<path d="M148 290 L184 286" stroke="${P.hair}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
<path d="M276 286 L312 290" stroke="${P.hair}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>

<!-- ===== 眼（单眼皮细线）===== -->
${eyes}

<!-- ===== 鼻（普通）===== -->
<path d="M230 334 L226 350 L234 350" fill="none" stroke="${P.skinShade}" stroke-width="2.4" stroke-linecap="round" opacity="0.5"/>

<!-- ===== 嘴 ===== -->
${mouth}

<!-- ===== 无腮红、无发饰、无光效 ===== -->

<!-- ===== 底部淡出 ===== -->
<rect x="70" y="592" width="320" height="188" fill="url(#fade)"/>`,
    defs);
}

// ============================================================
// 输出
// ============================================================

console.log('\n生成背景图 →', BG_DIR);
write(BG_DIR, 'library.svg', bgLibrary());
write(BG_DIR, 'classroom.svg', bgClassroom());
write(BG_DIR, 'street.svg', bgStreet());
write(BG_DIR, 'dorm.svg', bgDorm());
write(BG_DIR, 'corridor.svg', bgCorridor());
write(BG_DIR, 'cafe.svg', bgCafe());
write(BG_DIR, 'rooftop.svg', bgRooftop());
write(BG_DIR, 'rain.svg', bgRain());

console.log('\n生成角色立绘 →', AVATAR_DIR);

// 他 —— 朴素系，3 个情绪（形象不随章节变化）
console.log('  他 · 朴素短发 / 单眼皮 / 素T恤（形象固定）');
write(AVATAR_DIR, 'male-soft.svg', portraitBoy({ mood: 'soft' }));
write(AVATAR_DIR, 'male-down.svg', portraitBoy({ mood: 'down' }));
write(AVATAR_DIR, 'male-away.svg', portraitBoy({ mood: 'away' }));

// 她 —— 形象随章节演化：5 章 × 4 情绪
console.log('\n  她 · 形象随剧情推进演化：');
const MOODS = ['smile', 'soft', 'down', 'away'];
Object.keys(STAGES).forEach((k) => {
  const stage = STAGES[k];
  console.log(`    第${k}章 ${stage.name}　发色 ${stage.hair}　服装 ${stage.outfit}`);
  MOODS.forEach((mood) => {
    write(AVATAR_DIR, `female-c${k}-${mood}.svg`, portraitGirl({ stage: Number(k), mood: mood }));
  });
});

const total = 3 + Object.keys(STAGES).length * MOODS.length;
console.log(`\n完成。共 8 张背景 + ${total} 张立绘（男 3 + 女 ${Object.keys(STAGES).length * MOODS.length}）。\n`);

