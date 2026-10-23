/**
 * 把五格插画渲染成一张对比图，方便肉眼检查
 *   node render-scenes.js
 *
 * 输出 .smoke/scene-preview.html —— 用浏览器打开即可。
 * 同时导出 scene-preview.png（若装了 playwright）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCENE = path.join(ROOT, 'client', 'assets', 'img', 'scene');
const OUT = path.join(__dirname, 'scene-preview.html');

const LABEL = {
  1: '初遇 · 聚会上对视，角落各人有自己的生活',
  2: '相处 · 并肩散步，中间留着舒服的距离',
  3: '矛盾 · 背对而立，安静压抑',
  4: '别离 · 独自向前走，身后淡淡的回忆',
  5: '圆满 · 两个独立的人，遥遥相望'
};

const cards = [1, 2, 3, 4, 5].map((n) => `
  <figure>
    <div class="paper">
      <img src="../client/assets/img/scene/chapter-${n}.svg" alt="第 ${n} 格" />
    </div>
    <figcaption>第 ${n} 格 · ${LABEL[n]}</figcaption>
  </figure>`).join('\n');

fs.writeFileSync(OUT, `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8" />
<title>章节插画预览</title>
<style>
  body { margin: 0; padding: 28px; background: #1a1a22; color: #e8e8f0;
         font: 15px/1.6 "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #9999aa; margin: 0 0 24px; font-size: 14px; }
  .paper { background: #faf9f6; border-radius: 10px; padding: 10px;
           box-shadow: 0 10px 30px rgba(0,0,0,.4); color: #2a2a28; }
  .paper img { display: block; width: 100%; border-radius: 6px; }
  figure { margin: 0 0 30px; }
  figcaption { margin-top: 8px; color: #b0b0c0; font-size: 13px; }
  .row { display: flex; gap: 18px; flex-wrap: wrap; }
  .row figure { flex: 1 1 420px; }
  .dark .paper { background: #23232e; color: #d8d8e0; }
</style></head>
<body>
  <h1>章节插画预览</h1>
  <p class="sub">浅色纸页 = 插画卡里的样子（黑线） · 同一份文件用 currentColor，切到暗底会自动变淡白线</p>
  ${cards}
  <h1 style="margin-top:40px">暗色舞台效果</h1>
  <div class="dark">
  ${cards}
  </div>
</body></html>
`, 'utf8');

console.log('已写入 ' + OUT);
