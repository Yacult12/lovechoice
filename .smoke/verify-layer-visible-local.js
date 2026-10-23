/**
 * 背景人物层可见性验证（本地静态页）
 *   node verify-layer-visible-local.js
 *
 * 做法：同一页面截两张 —— 一张正常，一张隐藏这层 ——
 * 两者必须有差异，差异为 0 说明这层画了等于没画。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const OUT = path.join(__dirname, 'screenshots');
const PORT = 5611;

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}

/**
 * 两张图的平均绝对差。
 *
 * 只看下半部分 —— 人物在那儿（画面上半是空场区，
 * 本来就该是空的，算进去会把平均值稀释掉）。
 */
function diff(a, b) {
  const res = spawnSync('ffmpeg', [
    '-v', 'info', '-i', a, '-i', b,
    '-filter_complex',
    '[0:v]crop=iw:ih*0.55:0:ih*0.45[a];[1:v]crop=iw:ih*0.55:0:ih*0.45[b];' +
    '[a][b]blend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG',
    '-f', 'null', '-'
  ], { encoding: 'utf8' });
  const m = /YAVG=([\d.]+)/.exec((res.stderr || '') + (res.stdout || ''));
  return m ? parseFloat(m[1]) : 0;
}

(async () => {
  console.log('\n=== 背景人物层可见性（本地）===\n');

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
      const img = document.createElement('img');
      img.className = 'scene-figure';
      img.src = './assets/img/scene/chapter-' + ch + '.svg';
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
      p.appendChild(host);
      app.appendChild(p);
    }, chapter);
    await page.waitForTimeout(700);
  };

  for (const ch of [1, 2, 3, 4, 5]) {
    await build(ch);
    const withL = path.join(OUT, `_lv-with-${ch}.png`);
    const withoutL = path.join(OUT, `_lv-without-${ch}.png`);

    await page.screenshot({ path: withL });
    await page.evaluate(() => { document.querySelector('.scene-figures').style.visibility = 'hidden'; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: withoutL });

    const d = diff(withL, withoutL);
    ck(`第 ${ch} 格：背景层在画面上可见`, d > 0.15, '平均差 ' + d.toFixed(3));
  }

  // 布局检查
  await build(1);
  const m = await page.evaluate(() => {
    const g = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return {
        top: Math.round(r.top), h: Math.round(r.height),
        z: parseInt(cs.zIndex, 10) || 0, pe: cs.pointerEvents
      };
    };
    return {
      stage: g('#stage'), vp: g('.stage-viewport'), bottom: g('.stage-bottom'),
      dlg: g('.dialogue-box'), layer: g('.scene-figures'), fig: g('.scene-figure'),
      vh: window.innerHeight
    };
  });

  ck('舞台撑满视口', m.stage.h >= m.vh - 2, m.stage.h + ' / ' + m.vh);
  ck('立绘区有高度', m.vp.h > 300, String(m.vp.h));
  ck('对白框在底部', m.dlg.top > m.vh * 0.6, '顶=' + m.dlg.top);
  ck('背景层在立绘之下', m.layer.z < 3, 'z=' + m.layer.z);
  ck('背景层不对白区之下', m.layer.z < 5, 'z=' + m.layer.z);
  ck('整层不接收点击', m.layer.pe === 'none', m.layer.pe);
  ck('插画有实际尺寸', m.fig.h > 200, String(m.fig.h));

  await browser.close();
  server.kill();

  console.log('\n' + '='.repeat(52));
  console.log('  通过 ' + pass + ' / 失败 ' + fail);
  console.log(fail === 0 ? '  ✅ 背景层正常' : '  ❌ 存在问题');
  console.log('='.repeat(52));
  console.log('');
  process.exit(fail ? 1 : 0);
})();
