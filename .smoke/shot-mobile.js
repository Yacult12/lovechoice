/**
 * 生成手机端结局卡截图，直观确认布局
 *   node shot-mobile.js
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  const build = `
    const overlay = document.createElement('div');
    overlay.className = 'ending-overlay';
    overlay.innerHTML = \`
      <div class="ending-card">
        <div class="badge">E N D I N G</div>
        <h2>双向奔赴</h2>
        <p>你们都在该开口的时候开了口。这件事比什么都难，所以格外珍贵。</p>
        <div class="final-aff">
          <div><div class="v" style="color:#5b8cff">70</div><div class="k">他 · 好感</div></div>
          <div><div class="v" style="color:#ff7ba8">85</div><div class="k">她 · 好感</div></div>
        </div>
        <div class="tag ok mb-16">🎉 新结局已解锁，去图鉴看看</div>
        <div class="row" style="justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary">再走一遍</button>
          <button class="btn">结局图鉴</button>
          <button class="btn btn-ghost">返回</button>
        </div>
      </div>\`;
    document.body.appendChild(overlay);
  `;

  // iPhone SE —— 卡片超高的那个场景
  const se = await browser.newPage({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });
  await se.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded' });
  await se.waitForTimeout(600);
  await se.evaluate(build);
  await se.waitForTimeout(400);
  await se.screenshot({ path: 'shot-se-top.png' });
  await se.evaluate(() => { document.querySelector('.ending-overlay').scrollTop = 9999; });
  await se.waitForTimeout(300);
  await se.screenshot({ path: 'shot-se-bottom.png' });
  await se.close();

  // iPhone 12
  const ip = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });
  await ip.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'domcontentloaded' });
  await ip.waitForTimeout(600);
  await ip.evaluate(build);
  await ip.waitForTimeout(400);
  await ip.screenshot({ path: 'shot-iphone12.png' });
  await ip.close();

  await browser.close();
  console.log('已生成 3 张截图');
})();