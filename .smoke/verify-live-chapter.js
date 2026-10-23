/**
 * 线上验证：背景层随章节换图
 *   node verify-live-chapter.js
 *
 * 上一版测试三次的像素数一模一样（3645）——
 * 说明三次其实停在了同一章，插画没换。
 * 这个脚本直接检查遮罩 URL 是不是跟着章节号变。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://121.40.54.103:8080';
const TOKEN = process.env.LC_TOKEN
  || (fs.existsSync(process.env.TEMP + '\\lc-token.txt')
    ? fs.readFileSync(process.env.TEMP + '\\lc-token.txt', 'utf8').trim()
    : '');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}

(async () => {
  console.log('\n=== 线上：背景层随章节换图 ===\n');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.evaluate((tok) => {
    localStorage.clear();
    localStorage.setItem('lovechoice_token', tok);
  }, TOKEN);
  await page.waitForTimeout(1000);

  const seen = [];

  for (const ch of [1, 2, 3, 4, 5]) {
    // 用 URL 跳章，App.go 的 ctx.chapter 才会被 play.js 认
    await page.evaluate((c) => { window.location.hash = '#/play/male/1?chapter=' + c; }, ch);
    await page.waitForTimeout(2600);

    const info = await page.evaluate(() => {
      const fig = document.querySelector('.scene-figure');
      const layer = document.querySelector('.scene-figures');
      const top = document.querySelector('.stage-top .tiny');
      return {
        mask: fig ? (getComputedStyle(fig).maskImage || getComputedStyle(fig).webkitMaskImage) : null,
        chapter: layer ? layer.dataset.chapter : null,
        label: top ? top.textContent.replace(/\s+/g, ' ').trim() : ''
      };
    });

    seen.push(info.mask);
    console.log(`  \x1b[2m请求第 ${ch} 章 → 实际 ${info.chapter} 章（${info.label}）  遮罩 ${String(info.mask).slice(-22)}\x1b[0m`);
  }

  ck('每次跳转都换成了不同的插画',
    new Set(seen).size === 5, '只出现 ' + new Set(seen).size + ' 种');

  // 遮罩 URL 里的章节号要跟 data-chapter 对得上
  const matched = await page.evaluate(() => {
    const fig = document.querySelector('.scene-figure');
    const layer = document.querySelector('.scene-figures');
    if (!fig || !layer) return null;
    const m = /chapter-(\d)\.svg/.exec(getComputedStyle(fig).maskImage || '');
    return { file: m ? m[1] : null, data: layer.dataset.chapter };
  });
  ck('遮罩文件名与当前章节一致', matched && matched.file === matched.data,
    matched ? matched.file + ' vs ' + matched.data : '无');

  await browser.close();

  console.log('\n' + '='.repeat(52));
  console.log('  通过 ' + pass + ' / 失败 ' + fail);
  console.log(fail === 0 ? '  ✅ 随章节换图正常' : '  ❌ 存在问题');
  console.log('='.repeat(52));
  console.log('');
  process.exit(fail ? 1 : 0);
})();
