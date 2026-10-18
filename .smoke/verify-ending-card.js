/**
 * 用真实浏览器验证结局卡布局：卡片不能溢出视口，按钮必须可点。
 *   node verify-ending-card.js
 *
 * 直接构造一个「超高的结局卡」场景复现原 bug，
 * 再对比修复前后的表现。
 */
const { chromium } = require('playwright');
const path = require('path');

const CLIENT = 'http://127.0.0.1:5500';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

async function measureEndingCard(page, label) {
  // 造一个「比视口高」的结局卡：塞一段很长的描述 + 多个按钮
  await page.goto(CLIENT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const result = await page.evaluate(() => {
    // 造一个和真结局卡同样 class 的元素，内容刻意撑高
    const overlay = document.createElement('div');
    overlay.className = 'ending-overlay';
    overlay.style.zIndex = '9999';

    const card = document.createElement('div');
    card.className = 'ending-card';
    card.innerHTML = `
      <div class="badge">E N D I N G</div>
      <h2>双向奔赴</h2>
      <p>${'这是一段刻意写得很长的结局描述，用来把卡片撑出视口高度，测试滚动是否正常。'.repeat(3)}</p>
      <div class="final-aff">
        <div><div class="v" style="color:#5b8cff">70</div><div class="k">他 · 好感</div></div>
        <div><div class="v" style="color:#ff7ba8">85</div><div class="k">她 · 好感</div></div>
      </div>
      <div class="tag ok mb-16">🎉 新结局已解锁，去图鉴看看</div>
      <div class="row" style="justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" id="probeBtn">再走一遍</button>
        <button class="btn" id="probeBtn2">结局图鉴</button>
        <button class="btn btn-ghost" id="probeBtn3">返回</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const oRect = overlay.getBoundingClientRect();
    const cRect = card.getBoundingClientRect();

    // 遮罩能不能滚
    const canScroll = overlay.scrollHeight > overlay.clientHeight;
    const scrollable = canScroll
      ? (() => { overlay.scrollTop = overlay.scrollHeight; return overlay.scrollTop > 0; })()
      : false;

    // 最后一个按钮滚到底之后是否完整可见
    overlay.scrollTop = overlay.scrollHeight;
    const last = document.getElementById('probeBtn3');
    const lRect = last.getBoundingClientRect();

    return {
      viewportH: window.innerHeight,
      overlayH: Math.round(oRect.height),
      cardH: Math.round(cRect.height),
      cardTop: Math.round(cRect.top),
      canScroll,
      scrollable,
      scrollTopMax: Math.round(overlay.scrollHeight - overlay.clientHeight),
      // 关键：底部按钮必须落在视口内
      lastBtnTop: Math.round(lRect.top),
      lastBtnBottom: Math.round(lRect.bottom),
      lastBtnVisible: lRect.top >= 0 && lRect.bottom <= window.innerHeight,
      // 顶部 badge 也必须可见
      badgeTop: Math.round(card.getBoundingClientRect().top)
    };
  });

  console.log(`\n  [${label}]`);
  console.log(`    视口高 ${result.viewportH} / 遮罩高 ${result.overlayH} / 卡片高 ${result.cardH}`);
  console.log(`    可滚动: ${result.canScroll} → 实际能滚: ${result.scrollable} (最大 ${result.scrollTopMax}px)`);
  console.log(`    底部按钮 top=${result.lastBtnTop} bottom=${result.lastBtnBottom} 可见=${result.lastBtnVisible}`);
  return result;
}

(async () => {
  console.log('\n=== 结局卡布局验证 ===\n');

  const browser = await chromium.launch();
  const errors = [];

  // ---------- 桌面端 ----------
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
    page.on('pageerror', (e) => errors.push('desktop: ' + e.message));

    const r = await measureEndingCard(page, '桌面 1440×800');
    // 卡片比视口矮时不该有滚动条；关键看按钮是否可见可点
    check('桌面：卡片未超高时不产生多余滚动', r.canScroll === false, JSON.stringify(r));
    check('桌面：底部按钮完全可见', r.lastBtnVisible, `bottom=${r.lastBtnBottom} vs 视口 ${r.viewportH}`);
    check('桌面：卡片顶部从视口内开始', r.cardTop >= 0, 'top=' + r.cardTop);

    // 点击底部按钮，确认真的能响应（不被遮挡）
    const clicked = await page.evaluate(() => {
      const b = document.getElementById('probeBtn3');
      const rect = b.getBoundingClientRect();
      const elAtPoint = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return elAtPoint === b || b.contains(elAtPoint);
    });
    check('桌面：底部按钮可被命中（无遮挡）', clicked);
    await page.close();
  }

  // ---------- 手机端 iPhone 12 ----------
  {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });
    page.on('pageerror', (e) => errors.push('mobile: ' + e.message));

    const r = await measureEndingCard(page, 'iPhone 12 390×844');
    check('手机：底部按钮完全可见', r.lastBtnVisible, `bottom=${r.lastBtnBottom} vs 视口 ${r.viewportH}`);
    check('手机：卡片顶部从视口内开始', r.cardTop >= 0, 'top=' + r.cardTop);

    const clicked = await page.evaluate(() => {
      const b = document.getElementById('probeBtn3');
      const rect = b.getBoundingClientRect();
      const elAtPoint = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return elAtPoint === b || b.contains(elAtPoint);
    });
    check('手机：底部按钮可被命中（无遮挡）', clicked);
    await page.close();
  }

  // ---------- 小屏手机 SE：卡片真超高，原 bug 的复现场景 ----------
  {
    const page = await browser.newPage({
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true
    });
    page.on('pageerror', (e) => errors.push('se: ' + e.message));

    const r = await measureEndingCard(page, 'iPhone SE 320×568');
    check('小屏：卡片确实超出视口（复现 bug 场景）', r.cardH > r.viewportH,
      `卡片 ${r.cardH} vs 视口 ${r.viewportH}`);
    check('小屏：超高时遮罩可滚动（修复关键点）', r.scrollable, JSON.stringify(r));
    check('小屏：滚到底后底部按钮完全可见', r.lastBtnVisible,
      `bottom=${r.lastBtnBottom} vs 视口 ${r.viewportH}`);

    // 关键回归：修复前 place-items:center 会把顶部也挤出视口
    check('小屏：卡片顶部未被挤出视口（修复前会 <0）', r.cardTop >= 0,
      'top=' + r.cardTop);

    const clicked = await page.evaluate(() => {
      const o = document.querySelector('.ending-overlay');
      o.scrollTop = o.scrollHeight;
      const b = document.getElementById('probeBtn3');
      const rect = b.getBoundingClientRect();
      const elAtPoint = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return elAtPoint === b || b.contains(elAtPoint);
    });
    check('小屏：滚到底后按钮可被命中', clicked);
    await page.close();
  }

  // ---------- 横向滚动检查 ----------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    const noHScroll = await page.evaluate(() => {
      const o = document.createElement('div');
      o.className = 'ending-overlay';
      o.innerHTML = '<div class="ending-card"><h2>横向溢出测试</h2><p>' + '很长的中文描述'.repeat(40) + '</p></div>';
      document.body.appendChild(o);
      const de = document.documentElement;
      const overflow = de.scrollWidth > de.clientWidth;
      o.remove();
      return { overflow, scrollW: de.scrollWidth, clientW: de.clientWidth };
    });
    check('不产生横向滚动', noHScroll.overflow === false, JSON.stringify(noHScroll));
    await page.close();
  }

  check('无 JS 运行时错误', errors.length === 0, errors.join('; '));

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log(fail === 0 ? `  全部通过 ${pass} 项 🎉` : `  通过 ${pass} / 失败 ${fail}`);
  console.log('='.repeat(50));
  process.exit(fail ? 1 : 0);
})();