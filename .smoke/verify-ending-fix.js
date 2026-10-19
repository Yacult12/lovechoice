/**
 * 结局卡修复的回归验证
 *   node verify-ending-fix.js
 *
 * 背景：用户报告桌面端结局卡被截断（手机正常）。
 * 根因：.ending-overlay 用了 position:absolute，定位基准是 #stage。
 * #stage 是 flex 列容器，高度由子元素（顶栏 + 视口 + 对白框）撑开，
 * 实测只有 180~320px，而桌面视口有 1080px。
 * 卡片 460~490px 于是一大半落在遮罩外，被 #stage 的 overflow:hidden 裁掉。
 *
 * 修复：改成 position:fixed（基准是视口），并给卡片加 max-height 兜底。
 *
 * 本脚本直接对比「修复前 / 修复后」在同一批视口下的表现，
 * 避免只验「改完之后是好的」却没证明「改之前确实是坏的」。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://121.40.54.103:8080';
const TOKEN = process.env.LC_TOKEN
  || fs.readFileSync(process.env.TEMP + '\\lc-token.txt', 'utf8').trim();

const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`
};

const VPS = [
  { n: '手机375x667', w: 375, h: 667, m: true },
  { n: '手机412x915', w: 412, h: 915, m: true },
  { n: '平板768x1024', w: 768, h: 1024, m: true },
  { n: '笔记本1366x768', w: 1366, h: 768, m: false },
  { n: '桌面1920x1080', w: 1920, h: 1080, m: false },
  { n: '桌面2560x1440', w: 2560, h: 1440, m: false },
  { n: '扁窗1440x520', w: 1440, h: 520, m: false }
];

// 「坏的」CSS —— 复现修复前的状态，用于对照
const BAD_CSS = `
.ending-overlay{position:absolute !important;inset:0 !important;}
.ending-card{max-height:none !important;overflow:visible !important;}
`;

async function measure(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.ending-card');
    const ov = document.querySelector('.ending-overlay');
    const bs = Array.from(card.querySelectorAll('button'));
    const lb = bs[bs.length - 1].getBoundingClientRect();
    const r = card.getBoundingClientRect();
    const o = ov.getBoundingClientRect();
    return {
      vh: window.innerHeight,
      cardH: Math.round(r.height),
      cardTop: Math.round(r.top),
      ovH: Math.round(o.height),
      ovClientH: ov.clientHeight,
      ovScrollH: ov.scrollHeight,
      btnCount: bs.length,
      lastBottom: Math.round(lb.bottom),
      lastTop: Math.round(lb.top),
      cardClipped: r.bottom > o.bottom + 1,
      docH: document.documentElement.scrollHeight
    };
  });
}

(async () => {
  console.log(C.b('\n=== 结局卡截断问题 · 修复验证 ===\n'));
  console.log('  目标: ' + BASE);
  console.log(C.d('  对照组 = 注入修复前的 CSS；实验组 = 使用仓库里的修复版\n'));

  const browser = await chromium.launch();
  const rows = [];
  let badOk = 0, fixFail = 0;

  for (const vp of VPS) {
    const res = { n: vp.n };

    for (const mode of ['bad', 'fix']) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        isMobile: vp.m, hasTouch: vp.m
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.evaluate((t) => localStorage.setItem('lovechoice_token', t), TOKEN);
        await page.waitForTimeout(900);
        await page.evaluate(() => window.App.go('play', { routeCode: 'male', chapterNo: 5 }));
        await page.waitForSelector('#stage', { timeout: 20000 });
        await page.waitForTimeout(2200);

        // 叠加结局遮罩（真实 settle 数据）
        await page.evaluate(async (tk) => {
          const H = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' };
          const j = await (await fetch('/api/play/settle', {
            method: 'POST', headers: H,
            body: JSON.stringify({ routeCode: 'male', chapterNo: 5 })
          })).json();
          const d = j.data, aff = d.affection || {};
          const ov = document.createElement('div');
          ov.className = 'ending-overlay';
          const card = document.createElement('div');
          card.className = 'ending-card';
          card.innerHTML =
            '<div class="badge">E N D I N G</div><h2>' + d.ending.title + '</h2>' +
            '<p>' + d.ending.description + '</p>' +
            '<div class="final-aff">' +
            '<div><div class="v" style="color:var(--male)">' + aff.male + '</div><div class="k">他 · 好感</div></div>' +
            '<div><div class="v" style="color:var(--female)">' + aff.female + '</div><div class="k">她 · 好感</div></div>' +
            '</div><div class="tag ok mb-16">🎉 新结局已解锁，去图鉴看看</div>' +
            '<div class="row" style="justify-content:center;flex-wrap:wrap">' +
            '<button class="btn btn-primary">再走一遍</button><button class="btn">结局图鉴</button>' +
            '<button class="btn btn-ghost">返回</button>' +
            '<button class="btn btn-ghost">🏠 回到开始界面</button></div>';
          ov.appendChild(card);
          document.getElementById('stage').appendChild(ov);
        }, TOKEN);

        if (mode === 'bad') {
          await page.addStyleTag({ content: BAD_CSS });
        }
        await page.waitForTimeout(1000);
        res[mode] = await measure(page);

        if (mode === 'bad' && res.bad.lastBottom > res.bad.vh + 1) badOk++;
        if (mode === 'fix' && res.fix.lastBottom > res.fix.vh + 1) fixFail++;
      } catch (e) {
        res[mode] = { error: e.message.split('\n')[0], vh: vp.h };
        if (mode === 'fix') fixFail++;
      }
      await ctx.close();
    }
    rows.push(res);
  }

  await browser.close();

  console.log('  ' + C.d('视口'.padEnd(16) + '│' + C.d('修复前（对照组）').padEnd(34) + '│ 修复后'));
  console.log('  ' + C.d('─'.repeat(68)));
  rows.forEach((r) => {
    const b = r.bad || {}, f = r.fix || {};
    const bTxt = b.error ? 'ERR' : (b.lastBottom > b.vh + 1
      ? C.r('裁切 遮罩' + b.ovH + ' 钮' + b.lastBottom + '/' + b.vh)
      : C.g('正常 遮罩' + b.ovH + ' 钮' + b.lastBottom));
    const fTxt = f.error ? C.r('ERR ' + f.error.slice(0, 14)) : (f.lastBottom > f.vh + 1
      ? C.r('裁切 遮罩' + f.ovH + ' 钮' + f.lastBottom + '/' + f.vh)
      : C.g('正常 遮罩' + f.ovH + ' 钮' + f.lastBottom));
    console.log('  ' + r.n.padEnd(16) + '│ ' + bTxt.padEnd(34) + '│ ' + fTxt);
  });
  console.log('  ' + C.d('─'.repeat(68)));

  console.log('');
  console.log('  对照组复现出问题的视口: ' + C.r(badOk + ' / ' + rows.length) +
    (badOk === 0 ? C.d('  （未能复现，说明注入方式与真实场景仍有差异）') : C.g('  ✓ 已复现')));
  console.log('  修复后仍有问题的视口  : ' + (fixFail === 0 ? C.g('0 / ' + rows.length + '  ✓ 全部修复') : C.r(fixFail + ' / ' + rows.length)));
  console.log('');
  process.exit(fixFail ? 1 : 0);
})();