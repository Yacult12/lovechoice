'use strict';

/**
 * 美术生成器总入口
 *   node scripts/generate-art.js
 *
 * 产出
 *   client/assets/img/bg/       场景背景（剧情页背景）
 *   client/assets/img/avatar/   Q 版立绘（对话页人物）
 *   client/assets/img/illu/     概念插图（章节启示 / 过场）
 *
 * 全部手写 SVG：零依赖、体积小、任意分辨率不糊、diff 友好。
 */

const fs = require('fs');
const path = require('path');

const { write } = require('./art/common');
const { chibiBoy, chibiGirl, MOODS } = require('./art/chibi');
const { BACKGROUNDS, ILLUSTRATIONS, render } = require('./art/scenes');

const IMG_DIR = path.resolve(__dirname, '..', '..', 'client', 'assets', 'img');
const BG_DIR = path.join(IMG_DIR, 'bg');
const AVATAR_DIR = path.join(IMG_DIR, 'avatar');
const ILLU_DIR = path.join(IMG_DIR, 'illu');

[BG_DIR, AVATAR_DIR, ILLU_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

console.log('\n生成背景图 →', BG_DIR);
Object.keys(BACKGROUNDS).forEach((name, i) => {
  write(BG_DIR, name + '.svg', render(BACKGROUNDS[name], i + 1));
});

console.log('\n生成概念插图 →', ILLU_DIR);
Object.keys(ILLUSTRATIONS).forEach((name, i) => {
  write(ILLU_DIR, name + '.svg', render(ILLUSTRATIONS[name], 100 + i));
});

console.log('\n生成 Q 版立绘 →', AVATAR_DIR);
console.log('  他 · Q 版短发 / 素T恤（形象固定，4 种情绪）');
MOODS.forEach((mood) => {
  write(AVATAR_DIR, `male-${mood}.svg`, chibiBoy(mood));
});

console.log('\n  她 · Q 版长发，形象随剧情推进演化（5 章 × 4 情绪）');
for (let stage = 1; stage <= 5; stage++) {
  MOODS.forEach((mood) => {
    write(AVATAR_DIR, `female-c${stage}-${mood}.svg`, chibiGirl(stage, mood));
  });
}

const count = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).length;
console.log('\n完成。');
console.log(`  背景 ${count(BG_DIR)} 张 · 插图 ${count(ILLU_DIR)} 张 · 立绘 ${count(AVATAR_DIR)} 张`);
console.log('');
