/**
 * 插画的几何自检
 *   node verify-scenes.js
 *
 * 用无头浏览器把每张 SVG 渲染出来，检查：
 *   1. SVG 能被解析、画到了画布上（不是空白）
 *   2. 所有图元都在画布范围内（不出血、不裁切）
 *   3. 人物不重叠（互相穿插会看起来脏）
 *   4. 描边用 currentColor（能适配浅色纸页 / 暗色舞台）
 *   5. 关键人物在预期位置（叙事要求的位置约束）
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SCENE = path.join(ROOT, 'client', 'assets', 'img', 'scene');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}

(async () => {
  console.log('\n=== 章节插画几何自检 ===\n');

  const files = [1, 2, 3, 4, 5].map((n) => `chapter-${n}.svg`);
  files.forEach((f) => ck(f + ' 存在', fs.existsSync(path.join(SCENE, f))));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });

  for (let i = 0; i < files.length; i++) {
    const n = i + 1;
    console.log(`\x1b[2m[第 ${n} 格]\x1b[0m`);

    const file = path.join(SCENE, files[i]);
    const svg = fs.readFileSync(file, 'utf8');

    // --- 静态检查 ---
    ck('是合法 SVG', svg.trimStart().startsWith('<svg') && svg.trimEnd().endsWith('</svg>'));
    ck('没有乱码', !svg.includes('\ufffd'));
    ck('描边用 currentColor', /stroke="currentColor"/.test(svg),
      '不用 currentColor 就没法适配深浅两种底色');
    ck('没有渐变/阴影/滤镜（要求里明确不要）',
      !/<(linearGradient|radialGradient|filter|pattern)/i.test(svg));
    ck('没有彩色（只有 currentColor 和黑白色值）',
      !/#[0-9a-f]{3,6}/i.test(svg.replace(/currentColor/g, '')),
      '出现了硬编码颜色');

    // --- 渲染检查 ---
    //
    // 注意：不能直接 goto SVG 文件 —— 那样 document 是 SVGDocument，
    // createElement('canvas') 会造出 SVG 元素而不是 canvas。
    // 所以先开一个空白 HTML 页，再把 SVG 当 <img> 画到 canvas 上数墨量。
    await page.goto('about:blank');
    await page.evaluate((markup) => {
      const div = document.createElement('div');
      div.id = 'probe';
      div.innerHTML = markup;
      document.body.appendChild(div);
    }, svg);
    await page.waitForTimeout(150);

    const info = await page.evaluate(() => {
      const svg = document.querySelector('#probe svg');
      if (!svg) return null;
      const shapes = svg.querySelectorAll('path, circle, rect, line, ellipse');

      /*
       * 包围盒必须换算到 viewBox 坐标系。
       *
       * getBBox() 返回的是元素「自身坐标系」里的值 ——
       * 祖先 <g transform="translate(...)"> 的位移不算进去，
       * 直接拿来跟 960x540 比会得到一堆负数。
       * 所以这里用 getBoundingClientRect（已是屏幕坐标），
       * 再按 SVG 显示尺寸换算回 viewBox 单位。
       */
      const svgRect = svg.getBoundingClientRect();
      const scaleX = 960 / (svgRect.width || 960);
      const scaleY = 540 / (svgRect.height || 540);

      let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      const items = [];
      shapes.forEach((s) => {
        const r = s.getBoundingClientRect();
        if (!r || (r.width === 0 && r.height === 0)) return;
        const x = (r.left - svgRect.left) * scaleX;
        const y = (r.top - svgRect.top) * scaleY;
        const w = r.width * scaleX;
        const h = r.height * scaleY;
        items.push({ tag: s.tagName, x, y, w, h });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      });
      // 实际画出来的墨量：数一下非透明像素
      const c = document.createElement('canvas');
      c.width = 480; c.height = 270;
      const ctx = c.getContext('2d');
      const data = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      return new Promise((res) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 480, 270);
          const d = ctx.getImageData(0, 0, 480, 270).data;
          let ink = 0;
          for (let p = 0; p < d.length; p += 4) {
            if (d[p + 3] > 12) ink++;
          }
          res({
            count: items.length,
            minX, minY, maxX, maxY,
            vbW: 960, vbH: 540,
            inkRatio: ink / (480 * 270),
            items
          });
        };
        img.onerror = () => res(null);
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
      });
    });

    if (!info) { ck('能渲染', false); continue; }

    ck('画出了东西', info.inkRatio > 0.002, '墨量 ' + (info.inkRatio * 100).toFixed(2) + '%');
    ck('图元数量合理（8~60）', info.count >= 8 && info.count <= 60, '实际 ' + info.count);
    ck('没有超出画布',
      info.minX >= -1 && info.minY >= -1 &&
      info.maxX <= info.vbW + 1 && info.maxY <= info.vbH + 1,
      `x ${info.minX.toFixed(0)}~${info.maxX.toFixed(0)}  y ${info.minY.toFixed(0)}~${info.maxY.toFixed(0)}`);
    ck('留白充足（不铺满）', info.inkRatio < 0.25,
      '墨量 ' + (info.inkRatio * 100).toFixed(1) + '%，太满了');

    /*
     * 叙事检查：每格要表达的东西必须真的在画面里。
     * 只看「画得出来」不够 —— 位置不对，意思就不对了。
     */
    const people = await page.evaluate(() => {
      const svg = document.querySelector('#probe svg');
      const svgRect = svg.getBoundingClientRect();
      const sx = 960 / (svgRect.width || 960);
      const sy = 540 / (svgRect.height || 540);
      // 直接定位到「人物组」：<g transform="translate(x y) scale(s 1)">
      const out = [];
      svg.querySelectorAll('g[transform]').forEach((g) => {
        const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform'));
        if (!m) return;
        const r = g.getBoundingClientRect();
        out.push({
          x: parseFloat(m[1]),
          groundY: parseFloat(m[2]),
          w: r.width * sx,
          cx: (r.left - svgRect.left) * sx + r.width * sx / 2
        });
      });
      return out;
    });

    // 期望：人物数、最小间距、关键位置
    const EXPECT = {
      1: { min: 5, desc: '角落 3 人 + 中间 2 人' },
      2: { min: 4, desc: '远处 2 人 + 并肩 2 人' },
      3: { min: 2, desc: '背对 2 人' },
      4: { min: 3, desc: '回忆 2 人 + 背影 1 人' },
      5: { min: 4, desc: '各带朋友共 4 人' }
    };
    const exp = EXPECT[n];
    ck(`人物数量符合「${exp.desc}」`, people.length >= exp.min,
      '实际 ' + people.length + ' 人');

    // 人物之间不能挤在一起（穿插会很脏）
    const sorted = people.slice().sort((a, b) => a.cx - b.cx);
    let minGap = Infinity;
    for (let i = 1; i < sorted.length; i++) {
      minGap = Math.min(minGap, sorted[i].cx - sorted[i - 1].cx);
    }
    ck('人物之间留有空隙（不重叠）', minGap > 30,
      '最近的两个只隔 ' + minGap.toFixed(0) + 'px');

    // 第三格：两人必须在画面中央左右分开、背对
    if (n === 3) {
      ck('两人分居画面左右（背对而立）',
        sorted.length === 2 && sorted[0].cx < 420 && sorted[1].cx > 540,
        sorted.map((p) => p.cx.toFixed(0)).join(' / '));
    }
    // 第四格：走向前方的背影必须在右边
    if (n === 4) {
      const right = sorted[sorted.length - 1];
      ck('独自前行的背影在画面右侧', right.cx > 600,
        '实际在 ' + right.cx.toFixed(0));
    }
    // 第五格：两个主角分居左右，中间留空
    if (n === 5) {
      const left = sorted[0].cx, right = sorted[sorted.length - 1].cx;
      ck('两个独立的人在左右两边（中间留空）', left < 400 && right > 600,
        left.toFixed(0) + ' / ' + right.toFixed(0));
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(52));
  console.log('  通过 ' + pass + ' / 失败 ' + fail);
  console.log(fail === 0 ? '  ✅ 插画几何正常' : '  ❌ 存在问题');
  console.log('='.repeat(52));
  console.log('');
  process.exit(fail ? 1 : 0);
})();
