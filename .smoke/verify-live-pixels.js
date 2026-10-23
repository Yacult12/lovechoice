/**
 * 线上验证：背景人物层真的画在画面上
 *   node verify-live-pixels.js
 *
 * 与 verify-layer-pixels.js 同样的像素级检查，
 * 但直接打线上站点，验证部署后的实际效果。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const BASE = process.argv[2] || 'http://121.40.54.103:8080';
const TOKEN = process.env.LC_TOKEN
  || (fs.existsSync(process.env.TEMP + '\\lc-token.txt')
    ? fs.readFileSync(process.env.TEMP + '\\lc-token.txt', 'utf8').trim()
    : '');
const OUT = path.join(__dirname, 'screenshots');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}

/** 区域灰度直方图（走文件，管道会丢字节） */
function regionHistogram(file, x, y, w, h) {
  const tmp = path.join(OUT, '_live.raw');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file,
    '-vf', `crop=${w}:${h}:${x}:${y},format=gray`, '-f', 'rawvideo', tmp]);
  const buf = fs.readFileSync(tmp);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < buf.length; i++) hist[buf[i]]++;
  return { hist, total: buf.length };
}

(async () => {
  console.log('\n=== 线上背景层 · 像素级验证 ===\n');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.evaluate((tok) => {
    localStorage.clear();
    localStorage.setItem('lovechoice_token', tok);
  }, TOKEN);
  await page.waitForTimeout(1000);

  for (const ch of [1, 3, 5]) {
    await page.evaluate((c) => window.App.go('play', { routeCode: 'male', chapterNo: c }), ch);
    await page.waitForSelector('#stage', { timeout: 20000 });
    await page.waitForTimeout(2500);
    const cc = await page.$('.chapter-card');
    if (cc) { await cc.click(); await page.waitForTimeout(1600); }

    const withF = path.join(OUT, `_live-with-${ch}.png`);
    const withoutF = path.join(OUT, `_live-without-${ch}.png`);
    await page.screenshot({ path: withF });
    await page.evaluate(() => { document.querySelector('.scene-figures').style.visibility = 'hidden'; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: withoutF });

    const a = regionHistogram(withF, 200, 300, 880, 400);
    const b = regionHistogram(withoutF, 200, 300, 880, 400);
    const TH = 60;
    const ca = a.hist.slice(TH).reduce((x, y) => x + y, 0);
    const cb = b.hist.slice(TH).reduce((x, y) => x + y, 0);
    const peak = Math.max(...a.hist.map((v, i) => (v > 0 ? i : 0)));

    console.log(`  \x1b[2m第 ${ch} 章：亮像素 ${ca}（隐藏后 ${cb}），峰值灰度 ${peak}\x1b[0m`);
    ck(`第 ${ch} 章：背景人物可见`, ca - cb > 200, `多出 ${ca - cb}`);
    ck(`第 ${ch} 章：线条够亮`, peak >= 80, '峰值 ' + peak);
  }

  // 舞台布局
  const m = await page.evaluate(() => {
    const g = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height) };
    };
    return { stage: g('#stage'), vp: g('.stage-viewport'), dlg: g('.dialogue-box'), vh: window.innerHeight };
  });
  ck('舞台撑满视口', m.stage.h >= m.vh - 2, m.stage.h + '/' + m.vh);
  ck('立绘区有高度', m.vp.h > 300, String(m.vp.h));
  ck('对白框在底部', m.dlg.top > m.vh * 0.6, '顶=' + m.dlg.top);

  await browser.close();

  console.log('\n' + '='.repeat(52));
  console.log('  通过 ' + pass + ' / 失败 ' + fail);
  console.log(fail === 0 ? '  ✅ 线上背景层正常' : '  ❌ 存在问题');
  console.log('='.repeat(52));
  console.log('');
  process.exit(fail ? 1 : 0);
})();
