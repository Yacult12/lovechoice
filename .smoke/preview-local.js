/**
 * 本地预览：起一个静态服务器，用 playwright 截剧情页
 *   node preview-local.js
 *
 * 直接开 client/ 目录的静态服务，
 * 跳过后端（API 全部失败也不影响看布局）。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const OUT = path.join(__dirname, 'screenshots');
const PORT = 5610;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // 起静态服务
  const server = spawn('python', ['-m', 'http.server', String(PORT)], {
    cwd: CLIENT, stdio: 'ignore', shell: true
  });
  await new Promise((r) => setTimeout(r, 1500));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // 直接注入舞台，省得走登录
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() => {
    // 造一个最小的舞台，复刻 play.js 的 DOM 结构
    const app = document.querySelector('#app');
    app.innerHTML = '';
    const page1 = document.createElement('div');
    page1.className = 'page';
    const host = document.createElement('div');
    host.className = 'stage-host';
    const stage = document.createElement('div');
    stage.id = 'stage';
    const bg = document.createElement('div');
    bg.className = 'scene-bg';
    const fig = document.createElement('div');
    fig.className = 'scene-figures';
    const img = document.createElement('img');
    img.className = 'scene-figure';
    img.src = './assets/img/scene/chapter-1.svg';
    fig.appendChild(img);
    const top = document.createElement('div');
    top.className = 'stage-top';
    top.innerHTML = '<button class="btn btn-sm btn-ghost">← 返回</button>';
    const vp = document.createElement('div');
    vp.className = 'stage-viewport';
    const bottom = document.createElement('div');
    bottom.className = 'stage-bottom';
    bottom.innerHTML =
      '<div class="dialogue-box"><div class="speaker male">他</div>' +
      '<div class="text">十月，看剧组的聚会。你在人群边缘看见一个女生，她像在等人，勇气却只是站着。</div>' +
      '<div class="next-hint">点击继续 ▾</div></div>';
    stage.append(bg, fig, top, vp, bottom);
    host.appendChild(stage);
    page1.appendChild(host);
    app.appendChild(page1);
  });

  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'local-stage.png') });
  console.log('  ✓ local-stage.png');

  const m = await page.evaluate(() => {
    const g = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height) };
    };
    return { stage: g('#stage'), vp: g('.stage-viewport'), dlg: g('.dialogue-box'), fig: g('.scene-figure') };
  });
  console.log('  舞台高=' + m.stage.h + '  立绘区高=' + m.vp.h +
    '  对白框顶=' + m.dlg.top + '  插画高=' + m.fig.h + '  视口高=900');

  await browser.close();
  server.kill();
  process.exit(0);
})();
