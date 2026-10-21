'use strict';

/**
 * 背景与插图生成器
 *
 * 背景：960x540 横版，柔和渐变 + 几何/光影装饰，上下压暗便于叠对白。
 * 插图：960x540 场景示意画（多人物剪影 + 象征性元素），
 *       用于「本章启示」卡片和章节过场，比纯背景更有信息量。
 *
 * 全部手写 SVG，无外部依赖。
 */

const { seeded, wrapSvg, VIGNETTE, bgDefs } = require('./common');

const BW = 960;
const BH = 540;

/* ============================================================
   背景
   ============================================================ */

/** 通用：地面 + 远处剪影 + 光斑 */
function scenery(defs, ground, silhouettes, lights, extra = '') {
  return `
${ground}
${silhouettes}
${lights}
${extra}
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`;
}

/** 地面带（梯形透视） */
function floor(y, fill, opacity = 1) {
  return `<path d="M0 ${y} L${BW} ${y} L${BW} ${BH} L0 ${BH} Z" fill="${fill}" opacity="${opacity}"/>`;
}

/** 窗户（室内场景常用） */
function windows(y, h, cols, fill, opacity = 0.3) {
  let s = '';
  const w = BW / (cols + 1);
  for (let i = 1; i <= cols; i++) {
    const x = i * w - w * 0.32;
    s += `<rect x="${x.toFixed(1)}" y="${y}" width="${(w * 0.64).toFixed(1)}" height="${h}" rx="6" fill="${fill}" opacity="${opacity}"/>`;
  }
  return s;
}

/** 书架（图书馆） */
function shelves(y, h) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const x = 40 + i * 190;
    s += `<rect x="${x}" y="${y}" width="120" height="${h}" rx="4" fill="#2a2438" opacity="0.55"/>`;
    for (let r = 0; r < 4; r++) {
      const by = y + 14 + r * (h / 4.4);
      s += `<rect x="${x + 6}" y="${by.toFixed(1)}" width="${(20 + (i * 7 + r * 11) % 60).toFixed(1)}" height="${(h / 6).toFixed(1)}" rx="2" fill="#4a4160" opacity="0.5"/>`;
    }
  }
  return s;
}

/** 课桌排（教室） */
function desks(y, rows) {
  let s = '';
  for (let r = 0; r < rows; r++) {
    const yy = y + r * 78;
    const inset = r * 46;
    const w = (BW - inset * 2) / 5;
    for (let c = 0; c < 5; c++) {
      const x = inset + c * w + 10;
      s += `<rect x="${x.toFixed(1)}" y="${yy}" width="${(w - 20).toFixed(1)}" height="26" rx="5" fill="#2f2942" opacity="${(0.62 - r * 0.08).toFixed(2)}"/>`;
      s += `<rect x="${(x + 14).toFixed(1)}" y="${yy + 26}" width="8" height="34" fill="#241f33" opacity="0.5"/>`;
    }
  }
  return s;
}

/** 城市楼房剪影 */
function city(y) {
  let s = '';
  const rnd = seeded(77);
  let x = -20;
  while (x < BW + 40) {
    const w = 46 + rnd() * 70;
    const h = 90 + rnd() * 190;
    s += `<rect x="${x.toFixed(0)}" y="${(y - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#1a1628" opacity="0.75"/>`;
    // 窗户
    for (let wy = y - h + 16; wy < y - 14; wy += 22) {
      for (let wx = x + 8; wx < x + w - 10; wx += 16) {
        if (rnd() > 0.62) {
          s += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="7" height="10" rx="1" fill="#ffd89b" opacity="${(0.25 + rnd() * 0.4).toFixed(2)}"/>`;
        }
      }
    }
    x += w + 8;
  }
  return s;
}

/** 树冠 */
function tree(x, y, r, c1, c2) {
  return `
<rect x="${x - 7}" y="${y}" width="14" height="${r * 1.5}" rx="6" fill="#241f33" opacity="0.7"/>
<circle cx="${x}" cy="${y - r * 0.5}" r="${r}" fill="${c1}" opacity="0.55"/>
<circle cx="${x - r * 0.6}" cy="${y + r * 0.05}" r="${r * 0.7}" fill="${c2}" opacity="0.45"/>
<circle cx="${x + r * 0.62}" cy="${y + r * 0.02}" r="${r * 0.72}" fill="${c2}" opacity="0.45"/>`;
}

/** 雨丝 */
function rain(count, seed) {
  const rnd = seeded(seed);
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = rnd() * (BW + 120) - 60;
    const y = rnd() * BH;
    const len = 22 + rnd() * 26;
    s += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - 9).toFixed(0)}" y2="${(y + len).toFixed(0)}" stroke="#b9d4ff" stroke-width="1.3" opacity="${(0.1 + rnd() * 0.22).toFixed(2)}"/>`;
  }
  return s;
}

/** 浮尘/光斑 */
function motes(count, seed, color = '#ffd9a0') {
  const rnd = seeded(seed);
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = rnd() * BW;
    const y = rnd() * BH;
    const r = 1.2 + rnd() * 3.4;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.06 + rnd() * 0.2).toFixed(2)}"/>`;
  }
  return s;
}

/** 桌面上的一对杯子（初遇/和解的意象） */
function twoCups(cx, cy) {
  return `
<ellipse cx="${cx - 26}" cy="${cy}" rx="17" ry="6" fill="#ffffff" opacity="0.1"/>
<ellipse cx="${cx + 26}" cy="${cy}" rx="17" ry="6" fill="#ffffff" opacity="0.1"/>
<path d="M${cx - 42} ${cy - 34} h30 v26 a6 6 0 0 1 -6 6 h-18 a6 6 0 0 1 -6 -6 z" fill="#e8d9c8" opacity="0.5"/>
<path d="M${cx + 12} ${cy - 34} h30 v26 a6 6 0 0 1 -6 6 h-18 a6 6 0 0 1 -6 -6 z" fill="#e8d9c8" opacity="0.42"/>
<path d="M${cx - 40} ${cy - 34} q14 -7 28 0" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.4"/>
<path d="M${cx + 14} ${cy - 34} q14 -7 28 0" stroke="#ffffff" stroke-width="2.4" fill="none" opacity="0.34"/>`;
}

/* ============================================================
   背景集合
   ============================================================ */

const BACKGROUNDS = {
  // 第一章 · 初遇：线下聚会
  party: (id) => {
    const d = bgDefs(id, '#3b2f52', '#4d3a63', '#2a2038', '#ff9db0', 0.5, 0.3);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(370, '#241c33', 0.9),
        // 彩灯串
        `<path d="M0 70 Q240 130 480 78 Q720 28 960 84" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.22"/>
         <path d="M0 70 Q240 130 480 78 Q720 28 960 84" stroke="#ffffff" stroke-width="1" fill="none" opacity="0.1"/>`,
        // 彩灯
        [110, 220, 330, 440, 560, 680, 800, 900].map((x, i) => {
          const y = 84 + Math.sin(i * 0.9) * 34;
          const c = ['#ff9db0', '#ffd89b', '#8fd4ff', '#c9a8ff'][i % 4];
          return `<circle cx="${x}" cy="${y.toFixed(0)}" r="8" fill="${c}" opacity="0.6"/>`;
        }).join(''),
        motes(34, 21)
      )
    };
  },

  // 第一章 · 图书馆自习
  library: (id) => {
    const d = bgDefs(id, '#2b3350', '#38405e', '#1e2438', '#9fc4ff', 0.74, 0.24);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(400, '#232a42', 0.92),
        shelves(150, 240) + windows(60, 130, 4, '#cfe2ff', 0.16),
        motes(40, 9, '#dbe8ff')
      )
    };
  },

  // 第一章 · 教室
  classroom: (id) => {
    const d = bgDefs(id, '#31384e', '#3e4661', '#232839', '#ffd89b', 0.24, 0.2);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(360, '#2a2f42', 0.9),
        windows(80, 150, 5, '#cfe2ff', 0.2) +
        `<rect x="0" y="0" width="${BW}" height="26" fill="#1e2333" opacity="0.5"/>`,
        desks(330, 3),
        motes(26, 33)
      )
    };
  },

  // 第二章 · 街道
  street: (id) => {
    const d = bgDefs(id, '#2c3a4d', '#3a4a5e', '#1e2836', '#ffb98a', 0.76, 0.28);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(392, '#20293a', 0.92),
        city(392) +
        `<rect x="0" y="300" width="${BW}" height="8" fill="#ffd89b" opacity="0.1"/>`,
        // 路灯
        `<rect x="120" y="200" width="8" height="200" fill="#1a2230" opacity="0.8"/>
         <circle cx="124" cy="196" r="13" fill="#ffcf8f" opacity="0.5"/>
         <ellipse cx="124" cy="240" rx="70" ry="90" fill="#ffcf8f" opacity="0.08"/>
         <rect x="820" y="220" width="8" height="180" fill="#1a2230" opacity="0.8"/>
         <circle cx="824" cy="216" r="12" fill="#ffcf8f" opacity="0.42"/>`,
        motes(20, 51, '#ffd9b0')
      )
    };
  },

  // 第二章 · 宿舍
  dorm: (id) => {
    const d = bgDefs(id, '#3a3350', '#47405e', '#2a2438', '#ffc98f', 0.3, 0.24);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(400, '#2b2540', 0.92),
        `<rect x="60" y="120" width="150" height="200" rx="8" fill="#2f2942" opacity="0.7"/>
         <rect x="60" y="150" width="150" height="8" fill="#463d5e" opacity="0.6"/>
         <rect x="60" y="230" width="150" height="8" fill="#463d5e" opacity="0.6"/>
         <rect x="250" y="150" width="60" height="70" rx="6" fill="#e8d9c8" opacity="0.2"/>
         <rect x="640" y="140" width="180" height="120" rx="8" fill="#2f2942" opacity="0.65"/>
         <rect x="660" y="160" width="60" height="80" rx="4" fill="#ffd89b" opacity="0.16"/>`,
        `<circle cx="300" cy="200" r="18" fill="#ffd89b" opacity="0.32"/>
         <ellipse cx="300" cy="260" rx="80" ry="110" fill="#ffd89b" opacity="0.07"/>`,
        motes(22, 71, '#ffe0b8')
      )
    };
  },

  // 第二章 · 咖啡厅
  cafe: (id) => {
    const d = bgDefs(id, '#46352c', '#594438', '#2f2420', '#ffc98f', 0.7, 0.26);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(400, '#33271f', 0.92),
        `<rect x="80" y="180" width="200" height="120" rx="10" fill="#2c2119" opacity="0.75"/>
         <rect x="100" y="200" width="160" height="80" rx="6" fill="#ffd89b" opacity="0.1"/>
         <rect x="640" y="300" width="240" height="16" rx="6" fill="#3a2b22" opacity="0.85"/>
         <rect x="660" y="316" width="14" height="84" fill="#3a2b22" opacity="0.7"/>
         <rect x="846" y="316" width="14" height="84" fill="#3a2b22" opacity="0.7"/>`,
        `<circle cx="180" cy="120" r="26" fill="#ffd89b" opacity="0.28"/>
         <ellipse cx="180" cy="200" rx="110" ry="140" fill="#ffd89b" opacity="0.08"/>`,
        twoCups(480, 330) + motes(24, 91, '#ffe0b8')
      )
    };
  },

  // 第三章 · 天台
  rooftop: (id) => {
    const d = bgDefs(id, '#2f4560', '#3e5a7a', '#1f2d40', '#ffd08a', 0.78, 0.2);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(400, '#243243', 0.92),
        city(400) +
        `<rect x="0" y="330" width="${BW}" height="14" fill="#2c3b4e" opacity="0.9"/>
         <rect x="0" y="344" width="${BW}" height="6" fill="#3d4f66" opacity="0.6"/>`,
        `<circle cx="740" cy="110" r="42" fill="#ffe6b0" opacity="0.32"/>
         <ellipse cx="740" cy="110" rx="150" ry="150" fill="#ffe6b0" opacity="0.09"/>`,
        motes(30, 13, '#ffe6c0')
      )
    };
  },

  // 第三章 · 雨夜
  rain: (id) => {
    const d = bgDefs(id, '#1e2a3d', '#2a3a52', '#131b28', '#8fb8ff', 0.66, 0.3);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(400, '#182231', 0.94),
        city(400) +
        `<rect x="0" y="320" width="${BW}" height="10" fill="#5b7ba8" opacity="0.16"/>`,
        `<ellipse cx="480" cy="200" rx="260" ry="200" fill="#8fb8ff" opacity="0.06"/>`,
        rain(150, 3) + rain(60, 17)
      )
    };
  },

  // 第四章 · 走廊
  corridor: (id) => {
    const d = bgDefs(id, '#2a2f42', '#353b52', '#1c2030', '#b8c8ff', 0.5, 0.5);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(360, '#232839', 0.9),
        // 透视走廊
        `<path d="M300 60 L660 60 L820 360 L140 360 Z" fill="#3a4159" opacity="0.45"/>
         <path d="M300 60 L340 60 L250 360 L140 360 Z" fill="#22283a" opacity="0.7"/>
         <path d="M660 60 L620 60 L710 360 L820 360 Z" fill="#22283a" opacity="0.7"/>
         <rect x="330" y="70" width="300" height="150" rx="8" fill="#8fa8e0" opacity="0.14"/>`,
        // 顶灯
        `<rect x="380" y="20" width="200" height="14" rx="7" fill="#e8f0ff" opacity="0.28"/>
         <ellipse cx="480" cy="80" rx="200" ry="120" fill="#c8d8ff" opacity="0.07"/>`,
        motes(18, 41, '#dbe8ff')
      )
    };
  },

  // 第四章 · 空房间
  emptyroom: (id) => {
    const d = bgDefs(id, '#33313f', '#3f3d4e', '#23222e', '#9aa8c8', 0.66, 0.36);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(370, '#282633', 0.9),
        `<rect x="110" y="150" width="180" height="140" rx="8" fill="#3a3849" opacity="0.7"/>
         <rect x="640" y="180" width="220" height="110" rx="8" fill="#3a3849" opacity="0.6"/>
         <rect x="300" y="330" width="360" height="12" rx="5" fill="#4a4759" opacity="0.55"/>`,
        `<rect x="380" y="40" width="240" height="12" rx="6" fill="#dce4ff" opacity="0.18"/>`,
        motes(20, 61, '#d8dcf0')
      )
    };
  },

  // 第五章 · 和解·天台黄昏
  sunset: (id) => {
    const d = bgDefs(id, '#5a3a52', '#8a5570', '#3a2436', '#ffd08a', 0.62, 0.42);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(400, '#33222f', 0.92),
        city(400) +
        `<rect x="0" y="330" width="${BW}" height="14" fill="#4a3040" opacity="0.85"/>`,
        `<circle cx="620" cy="190" r="62" fill="#ffdc9a" opacity="0.45"/>
         <ellipse cx="620" cy="190" rx="280" ry="200" fill="#ffb98a" opacity="0.14"/>`,
        motes(34, 81, '#ffd9b0')
      )
    };
  },

  // 第五章 · 日常·街角小店
  dailylife: (id) => {
    const d = bgDefs(id, '#404a5c', '#525e73', '#2c3442', '#ffcf8f', 0.7, 0.32);
    return {
      defs: d + VIGNETTE,
      inner: scenery(d,
        floor(400, '#333c4c', 0.92),
        `<rect x="90" y="150" width="230" height="190" rx="10" fill="#2b3340" opacity="0.8"/>
         <rect x="110" y="175" width="90" height="70" rx="6" fill="#ffd89b" opacity="0.2"/>
         <rect x="215" y="175" width="90" height="70" rx="6" fill="#ffd89b" opacity="0.14"/>
         <rect x="90" y="140" width="230" height="16" rx="6" fill="#4a566a" opacity="0.9"/>
         <rect x="640" y="300" width="230" height="14" rx="6" fill="#414d61" opacity="0.85"/>`,
        `<circle cx="160" cy="210" r="16" fill="#ffd89b" opacity="0.4"/>`,
        twoCups(500, 320) + motes(26, 101, '#ffe0b8')
      )
    };
  },
};

/* ============================================================
   插图（章节启示 / 过场）
   ============================================================ */

/**
 * 象征性场景插图。
 * 用抽象几何 + 剪影表达概念，不画具体人物。
 */
const ILLUSTRATIONS = {
  // 第一章：两个人在聚会上相遇，但中间隔着距离
  meet: (id) => {
    const d = bgDefs(id, '#3b2f52', '#4a3a60', '#2a2038', '#ff9db0', 0.5, 0.4);
    return {
      defs: d + VIGNETTE,
      inner: `
<circle cx="330" cy="250" r="52" fill="#ff9db0" opacity="0.22"/>
<circle cx="630" cy="250" r="52" fill="#8fa8d8" opacity="0.22"/>
<path d="M330 316 q-10 84 -50 116 h100 q-40 -32 -50 -116 z" fill="#ff9db0" opacity="0.3"/>
<path d="M630 316 q10 84 50 116 h-100 q40 -32 50 -116 z" fill="#8fa8d8" opacity="0.3"/>
<!-- 中间的心，尚未连起 -->
<path d="M480 196 c-16 -22 -56 -8 -56 20 c0 26 34 44 56 62 c22 -18 56 -36 56 -62 c0 -28 -40 -42 -56 -20 z"
      fill="none" stroke="#ff9db0" stroke-width="3" stroke-dasharray="7 8" opacity="0.75"/>
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`
    };
  },

  // 第一章启示：爱自己 —— 自己站稳
  selflove: (id) => {
    const d = bgDefs(id, '#2f4560', '#3d5a7a', '#1f2d40', '#9fd8ff', 0.5, 0.5);
    return {
      defs: d + VIGNETTE,
      inner: `
<circle cx="480" cy="230" r="56" fill="#9fd8ff" opacity="0.24"/>
<path d="M480 300 q-12 100 -56 140 h112 q-44 -40 -56 -140 z" fill="#9fd8ff" opacity="0.3"/>
<!-- 脚下的地面线 -->
<path d="M300 452 L660 452" stroke="#9fd8ff" stroke-width="3" opacity="0.5"/>
<!-- 自己给自己撑起的伞 -->
<path d="M330 220 a150 150 0 0 1 300 0 z" fill="none" stroke="#9fd8ff" stroke-width="3.5" opacity="0.7"/>
<rect x="476" y="220" width="8" height="230" rx="4" fill="#9fd8ff" opacity="0.55"/>
<circle cx="480" cy="200" r="8" fill="#9fd8ff" opacity="0.8"/>
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`
    };
  },

  // 第二章：边界 —— 两个人之间留出呼吸的距离
  boundary: (id) => {
    const d = bgDefs(id, '#3d3a52', '#4a4660', '#282636', '#b8a8ff', 0.5, 0.5);
    return {
      defs: d + VIGNETTE,
      inner: `
<circle cx="300" cy="250" r="48" fill="#ff9db0" opacity="0.22"/>
<circle cx="660" cy="250" r="48" fill="#8fa8d8" opacity="0.22"/>
<path d="M300 312 q-10 80 -46 110 h92 q-36 -30 -46 -110 z" fill="#ff9db0" opacity="0.28"/>
<path d="M660 312 q10 80 46 110 h-92 q36 -30 46 -110 z" fill="#8fa8d8" opacity="0.28"/>
<!-- 中间的留白：虚线圆 -->
<circle cx="480" cy="260" r="86" fill="none" stroke="#b8a8ff" stroke-width="2.5" stroke-dasharray="9 11" opacity="0.6"/>
<!-- 各自的地盘 -->
<path d="M180 452 q60 -40 120 -22" stroke="#ff9db0" stroke-width="3" fill="none" opacity="0.4"/>
<path d="M660 452 q60 -40 120 -22" stroke="#8fa8d8" stroke-width="3" fill="none" opacity="0.4"/>
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`
    };
  },

  // 第二章启示：珍惜 —— 手里捧着的东西
  cherish: (id) => {
    const d = bgDefs(id, '#4a3a2c', '#5c4838', '#332820', '#ffcf8f', 0.5, 0.4);
    return {
      defs: d + VIGNETTE,
      inner: `
<!-- 一双手捧着光 -->
<path d="M300 400 q90 -70 180 -34 q90 -36 180 34 q-90 40 -180 26 q-90 14 -180 -26 z"
      fill="#e8d9c8" opacity="0.24"/>
<circle cx="480" cy="286" r="52" fill="#ffcf8f" opacity="0.42"/>
<circle cx="480" cy="286" r="80" fill="#ffcf8f" opacity="0.14"/>
<!-- 细小的碎片：曾经的好 -->
<circle cx="404" cy="330" r="5" fill="#ffd89b" opacity="0.55"/>
<circle cx="556" cy="330" r="5" fill="#ffd89b" opacity="0.55"/>
<circle cx="440" cy="366" r="4" fill="#ffd89b" opacity="0.4"/>
<circle cx="524" cy="368" r="4" fill="#ffd89b" opacity="0.4"/>
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`
    };
  },

  // 第三章：止损 —— 剪断的线
  cut: (id) => {
    const d = bgDefs(id, '#402c34', '#503540', '#2c1e24', '#ff8f9a', 0.5, 0.5);
    return {
      defs: d + VIGNETTE,
      inner: `
<path d="M200 270 Q360 220 460 268" stroke="#ff9db0" stroke-width="4" fill="none" opacity="0.6"/>
<path d="M500 272 Q600 320 760 270" stroke="#8fa8d8" stroke-width="4" fill="none" opacity="0.6"/>
<!-- 断口 -->
<path d="M478 250 l-18 34 M494 258 l14 30" stroke="#ffd89b" stroke-width="3" opacity="0.7"/>
<circle cx="480" cy="268" r="9" fill="#ffd89b" opacity="0.5"/>
<!-- 剪刀的抽象：两道交叉的线 -->
<path d="M400 120 L560 250" stroke="#e8e2f0" stroke-width="3" opacity="0.35"/>
<path d="M560 120 L400 250" stroke="#e8e2f0" stroke-width="3" opacity="0.35"/>
<circle cx="480" cy="270" r="120" fill="none" stroke="#ff8f9a" stroke-width="2" stroke-dasharray="6 12" opacity="0.35"/>
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`
    };
  },

  // 第四章：放下 —— 松手
  letgo: (id) => {
    const d = bgDefs(id, '#2c3348', '#3a4258', '#1e2430', '#a8b8d8', 0.5, 0.3);
    return {
      defs: d + VIGNETTE,
      inner: `
<!-- 手松开，线向上飘走 -->
<path d="M300 420 q90 -46 180 -14" stroke="#e8d9c8" stroke-width="3" fill="none" opacity="0.4"/>
<path d="M480 406 C480 340 460 300 476 250 C490 204 470 160 500 120"
      stroke="#a8b8d8" stroke-width="2.6" fill="none" opacity="0.55" stroke-dasharray="10 9"/>
<circle cx="500" cy="116" r="9" fill="#a8b8d8" opacity="0.5"/>
<!-- 远处的一扇门 -->
<rect x="740" y="150" width="130" height="200" rx="6" fill="#ffd89b" opacity="0.12"/>
<rect x="740" y="150" width="130" height="200" rx="6" fill="none" stroke="#ffd89b" stroke-width="2" opacity="0.3"/>
<circle cx="852" cy="256" r="4" fill="#ffd89b" opacity="0.5"/>
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`
    };
  },

  // 第五章：安全感 —— 两个完整的人并肩
  together: (id) => {
    const d = bgDefs(id, '#4a3a5e', '#5c4a72', '#2e2540', '#ffc8d8', 0.5, 0.3);
    return {
      defs: d + VIGNETTE,
      inner: `
<!-- 各自脚下有地 -->
<path d="M250 452 L430 452" stroke="#8fa8d8" stroke-width="3" opacity="0.45"/>
<path d="M530 452 L710 452" stroke="#ff9db0" stroke-width="3" opacity="0.45"/>
<circle cx="340" cy="250" r="48" fill="#8fa8d8" opacity="0.26"/>
<circle cx="620" cy="250" r="48" fill="#ff9db0" opacity="0.26"/>
<path d="M340 312 q-10 80 -46 110 h92 q-36 -30 -46 -110 z" fill="#8fa8d8" opacity="0.3"/>
<path d="M620 312 q10 80 46 110 h-92 q36 -30 46 -110 z" fill="#ff9db0" opacity="0.3"/>
<!-- 完整的心：两个半圆合起来 -->
<path d="M480 190 c-14 -20 -52 -8 -52 18 c0 24 32 42 52 58 c20 -16 52 -34 52 -58 c0 -26 -38 -38 -52 -18 z"
      fill="#ff9db0" opacity="0.34"/>
<path d="M480 190 c-14 -20 -52 -8 -52 18 c0 24 32 42 52 58" fill="none" stroke="#8fa8d8" stroke-width="2" opacity="0.5"/>
<path d="M480 190 c14 -20 52 -8 52 18 c0 24 -32 42 -52 58" fill="none" stroke="#ff9db0" stroke-width="2" opacity="0.5"/>
<!-- 中间的连接不是束缚，是并肩 -->
<path d="M396 300 Q480 350 564 300" stroke="#ffd89b" stroke-width="2.5" fill="none" opacity="0.45" stroke-dasharray="8 8"/>
<rect x="0" y="0" width="${BW}" height="${BH}" fill="url(#vg)"/>`
    };
  },
};

/**
 * 生成一张背景或插图
 * @param {object} maker (id) => {defs, inner}
 */
function render(maker, seed = 1) {
  const id = 'g' + seed;
  const { defs, inner } = maker(id);
  return wrapSvg(BW, BH, inner, defs, 'preserveAspectRatio="xMidYMid slice"');
}

module.exports = { BW, BH, BACKGROUNDS, ILLUSTRATIONS, render };
