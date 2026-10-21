'use strict';

/**
 * 美术生成器 · 公共工具
 *
 * 全矢量手写 SVG，零外部依赖，体积小、任意分辨率不糊。
 */

/** 确定性伪随机：保证每次生成结果完全一致 */
function seeded(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 包装成 svg 文档。
 * 宽度/高度用 viewBox 逻辑尺寸，preserveAspectRatio 交给调用方决定。
 */
function wrapSvg(w, h, inner, defs = '', extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${extra}>
<defs>${defs}</defs>
${inner}
</svg>
`;
}

/** 写文件并打印体积 */
function write(dir, name, svg) {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(dir, name);
  fs.writeFileSync(file, svg.replace(/\n\s*\n/g, '\n'), 'utf8');
  const kb = (Buffer.byteLength(svg, 'utf8') / 1024).toFixed(1);
  console.log(`  ✓ ${name}  (${kb} KB)`);
  return file;
}

/**
 * 统一的暗角遮罩。
 * 背景图上下压暗，保证叠在上面的对白框永远可读。
 */
const VIGNETTE = `
<linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#0b0a10" stop-opacity="0.58"/>
  <stop offset="34%" stop-color="#0b0a10" stop-opacity="0.10"/>
  <stop offset="60%" stop-color="#0b0a10" stop-opacity="0.28"/>
  <stop offset="100%" stop-color="#0b0a10" stop-opacity="0.92"/>
</linearGradient>`;

/** 背景三段渐变 + 右上角辉光 */
function bgDefs(id, c1, c2, c3, glow, glowX = 0.72, glowY = 0.22) {
  return `
<linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1">
  <stop offset="0%" stop-color="${c1}"/>
  <stop offset="55%" stop-color="${c2}"/>
  <stop offset="100%" stop-color="${c3}"/>
</linearGradient>
<radialGradient id="${id}glow" cx="${glowX}" cy="${glowY}" r="0.7">
  <stop offset="0%" stop-color="${glow}" stop-opacity="0.55"/>
  <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
</radialGradient>`;
}

module.exports = { seeded, wrapSvg, write, VIGNETTE, bgDefs };
