/**
 * 背景人物层的像素级可见性检查
 *   node verify-layer-pixels.js
 *
 * 整帧平均差会被大片空场区稀释（人物只占画面一小块），
 * 所以这里直接看像素：
 *   1. 在「应该有人物」的区域里数出比背景亮一截的像素
 *   2. 报告这些像素的灰度值 —— 确认是线条被画出来了，不是噪声
 *   3. 同一块区域在「隐藏这层」后应该变干净
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const OUT = path.join(__dirname, 'screenshots');
const PORT = 5612;

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}

/**
 * 取一张图某个矩形区域的灰度直方图。
 *
 * 用文件而不是管道拿数据 —— spawnSync 走管道时 stdout 偶尔拿不全，
 * 而直方图少几个字节会得出「一个亮像素都没有」这种荒谬结论。
 */
function regionHistogram(file, x, y, w, h) {
  const tmp = path.join(OUT, '_region.raw');
  const res = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-i', file,
    '-vf', `crop=${w}:${h}:${x}:${y},format=gray`,
    '-f', 'rawvideo', tmp
  ], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.log('    ffmpeg 失败：' + (res.stderr || '').slice(0, 200));
    return { hist: new Array(256).fill(0), total: 0 };
  }
  const buf = fs.readFileSync(tmp);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < buf.length; i++) hist[buf[i]]++;
  return { hist, total: buf.length };
}

/** 统计「亮于阈值」的像素数与最高灰度 */
function brightStats(hist, total, threshold) {
  let n = 0;
  let max = 0;
  for (let v = threshold; v < 256; v++) {
    n += hist[v];
    if (hist[v] > 0) max = v;
  }
  return { n, max, pct: n / total * 100 };
}

(async () => {
  console.log('\n=== 背景人物层 · 像素级检查 ===\n');

  const server = spawn('python', ['-m', 'http.server', String(PORT)], {
    cwd: CLIENT, stdio: 'ignore'
  });
  await new Promise((r) => setTimeout(r, 1500));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

  const build = async (chapter) => {
    await page.evaluate((ch) => {
      const app = document.querySelector('#app');
      app.innerHTML = '';
      const p = document.createElement('div');
      p.className = 'page';
      const host = document.createElement('div');
      host.className = 'stage-host';
      const stage = document.createElement('div');
      stage.id = 'stage';
      const bg = document.createElement('div');
      bg.className = 'scene-bg';
      const fig = document.createElement('div');
      fig.className = 'scene-figures';
      const img = document.createElement('div');
      img.className = 'scene-figure';
      img.style.webkitMaskImage = 'url(./assets/img/scene/chapter-' + ch + '.svg)';
      img.style.maskImage = 'url(./assets/img/scene/chapter-' + ch + '.svg)';
      fig.appendChild(img);
      const vp = document.createElement('div');
      vp.className = 'stage-viewport';
      const bottom = document.createElement('div');
      bottom.className = 'stage-bottom';
      bottom.innerHTML =
        '<div class="dialogue-box"><div class="text">十月，看剧组的聚会。</div></div>';
      stage.append(bg, fig, vp, bottom);
      host.appendChild(stage);
      p.appendChild(host);
      app.appendChild(p);
    }, chapter);
    await page.waitForTimeout(800);
  };

  // 采样区：画面下半（人物所在的带），避开对白框
  const REGION = { x: 200, y: 300, w: 880, h: 400 };

  for (const ch of [1, 2, 3, 4, 5]) {
    await build(ch);

    const withF = path.join(OUT, `_px-with-${ch}.png`);
    const withoutF = path.join(OUT, `_px-without-${ch}.png`);
    await page.screenshot({ path: withF });
    await page.evaluate(() => { document.querySelector('.scene-figures').style.visibility = 'hidden'; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: withoutF });

    const a = regionHistogram(withF, REGION.x, REGION.y, REGION.w, REGION.h);
    const b = regionHistogram(withoutF, REGION.x, REGION.y, REGION.w, REGION.h);

    const TH = 60;
    const sa = brightStats(a.hist, a.total, TH);
    const sb = brightStats(b.hist, b.total, TH);

    const extra = sa.n - sb.n;
    console.log(`  \x1b[2m第 ${ch} 格：亮像素 ${sa.n}（隐藏后 ${sb.n}，多出 ${extra}），` +
      `峰值灰度 ${sa.max}\x1b[0m`);

    ck(`第 ${ch} 格：画出了可见的线条`, extra > 300,
      `只多出 ${extra} 个亮像素`);
    ck(`第 ${ch} 格：线条亮度够（峰值灰度 ≥ 90）`, sa.max >= 90,
      '峰值 ' + sa.max);
  }

  await browser.close();
  server.kill();

  console.log('\n' + '='.repeat(52));
  console.log('  通过 ' + pass + ' / 失败 ' + fail);
  console.log(fail === 0 ? '  ✅ 背景层确实画出来了' : '  ❌ 存在问题');
  console.log('='.repeat(52));
  console.log('');
  process.exit(fail ? 1 : 0);
})();
