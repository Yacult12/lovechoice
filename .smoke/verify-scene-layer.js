/**
 * 背景人物层的布局验证
 *   node verify-scene-layer.js [baseUrl]
 *
 * 这个层是需求里最容易做错的地方，所以单独盯死三条：
 *   1. 它在主画面**下层** —— z-index 比立绘、对白都低，不能盖住文字
 *   2. 它**不挡交互**   —— pointer-events:none，玩家点它等于点背景
 *   3. 按钮照常可点     —— 选项按钮、顶栏按钮不受影响
 *
 * 另外确认：章节过场卡和启示卡都换成了浅色绘本页，
 * 且插画用的是连环画那一格（chapter-N.svg），不是旧的概念插图。
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
const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`
};
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ' + C.g('OK  ') + name); }
  else { fail++; console.log('  ' + C.r('FAIL') + ' ' + name + (extra ? C.d('  -> ' + extra) : '')); }
}

(async () => {
  console.log(C.b('\n=== 背景人物层验证 ===\n'));

  if (!TOKEN) {
    console.log(C.r('  没有 token，跳过（需要 LC_TOKEN 或 %TEMP%\\lc-token.txt）'));
    process.exit(0);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));

  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.evaluate((tok) => {
      localStorage.clear();
      localStorage.setItem('lovechoice_token', tok);
    }, TOKEN);
    await page.waitForTimeout(800);

    await page.evaluate(() => window.App.go('play', { routeCode: 'male', chapterNo: 1 }));
    await page.waitForSelector('#stage', { timeout: 20000 });
    await page.waitForTimeout(2000);

    // 过场卡挡着，先点掉
    const cc = await page.$('.chapter-card');
    if (cc) { await cc.click(); await page.waitForTimeout(1400); }

    // ---------- 1. 层存在 ----------
    const layer = await page.evaluate(() => {
      const el = document.querySelector('.scene-figures');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const fig = el.querySelector('.scene-figure');
      return {
        zIndex: cs.zIndex,
        pointerEvents: cs.pointerEvents,
        position: cs.position,
        hasImg: !!fig,
        // 现在是遮罩块，颜色由 background-color 给
        maskUrl: fig ? (getComputedStyle(fig).maskImage || getComputedStyle(fig).webkitMaskImage) : null,
        bgColor: fig ? getComputedStyle(fig).backgroundColor : null,
        imgW: fig ? Math.round(fig.getBoundingClientRect().width) : 0,
        imgH: fig ? Math.round(fig.getBoundingClientRect().height) : 0
      };
    });

    ck('背景人物层存在', !!layer);
    if (!layer) throw new Error('层不存在');

    // ---------- 2. 在主画面下层 ----------
    const z = await page.evaluate(() => {
      const pick = (sel) => {
        const e = document.querySelector(sel);
        return e ? parseInt(getComputedStyle(e).zIndex, 10) || 0 : null;
      };
      return {
        figures: pick('.scene-figures'),
        bg: pick('.scene-bg'),
        portrait: pick('.portrait'),
        bottom: pick('.stage-bottom'),
        top: pick('.stage-top')
      };
    });

    ck('层在立绘下面', z.figures < z.portrait, `figures=${z.figures} portrait=${z.portrait}`);
    ck('层在对白区下面', z.figures < z.bottom, `figures=${z.figures} bottom=${z.bottom}`);
    ck('层在顶栏下面', z.figures < z.top, `figures=${z.figures} top=${z.top}`);
    ck('层在背景图上面（否则看不见）', z.figures > z.bg, `figures=${z.figures} bg=${z.bg}`);

    // ---------- 3. 不挡交互 ----------
    ck('整层 pointer-events:none', layer.pointerEvents === 'none', layer.pointerEvents);

    // 点层所在的位置，事件应该落到它下面 —— 也就是背景/舞台
    const clickThrough = await page.evaluate(() => {
      const el = document.querySelector('.scene-figures');
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height * 0.3;
      const top = document.elementFromPoint(x, y);
      return {
        x: Math.round(x), y: Math.round(y),
        topClass: top ? (top.className || top.tagName) : null,
        inLayer: !!(top && top.closest && top.closest('.scene-figures'))
      };
    });
    ck('层不拦截点击（点不到层里的图）', !clickThrough.inLayer,
      '命中 ' + clickThrough.topClass);

    // ---------- 4. 按钮照常可点 ----------
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.stage-top button');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        hasBtn: true,
        label: b.textContent.trim().slice(0, 10),
        hit: top === b || (top && b.contains(top))
      };
    });
    ck('顶栏按钮可点', btn && btn.hit, btn ? '「' + btn.label + '」被挡' : '没找到按钮');

    // 选项按钮（如果有）
    const choice = await page.$('.choice-btn:not([disabled])');
    if (choice) {
      const ok = await page.evaluate(() => {
        const b = document.querySelector('.choice-btn:not([disabled])');
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top === b || b.contains(top);
      });
      ck('选项按钮可点', ok);
    } else {
      console.log(C.d('      （当前节点没有选项按钮，跳过）'));
    }

    // ---------- 5. 插画本身 ----------
    ck('层里有插画', layer.hasImg);
    ck('用遮罩着色（SVG 独立文档，currentColor 继承不到）',
      !!layer.maskUrl && /chapter-\d\.svg/.test(layer.maskUrl), layer.maskUrl);
    ck('遮罩块有实际尺寸', layer.imgW > 300 && layer.imgH > 150,
      layer.imgW + 'x' + layer.imgH);
    ck('线条颜色不是黑色（暗底上要看得见）',
      !!layer.bgColor && !/rgb\(0, 0, 0\)/.test(layer.bgColor), layer.bgColor);

    // ---------- 6. 文字没被压住 ----------
    const textOk = await page.evaluate(() => {
      const txt = document.querySelector('.dialogue-box .text');
      const layer = document.querySelector('.scene-figures');
      if (!txt || !layer) return null;
      const t = txt.getBoundingClientRect();
      const l = layer.getBoundingClientRect();
      // 对话框在图层上方（DOM 顺序 + z-index）
      const hit = document.elementFromPoint(t.left + 20, t.top + t.height / 2);
      return {
        hitInLayer: !!(hit && hit.closest && hit.closest('.scene-figures')),
        layerZ: parseInt(getComputedStyle(layer).zIndex, 10) || 0
      };
    });
    ck('文字没有被背景层压住', textOk && !textOk.hitInLayer, '层 z=' + (textOk && textOk.layerZ));

    // ---------- 7. 绘本页样式 ----------
    const paper = await page.evaluate(() => {
      const inner = document.querySelector('.insight-inner');
      if (!inner) return null;
      const cs = getComputedStyle(inner);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    if (paper) {
      ck('启示卡是浅色纸页', /rgb\(2[45][0-9], 2[45][0-9], 2[45][0-9]\)/.test(paper.bg), paper.bg);
    } else {
      console.log(C.d('      （当前没弹出启示卡，跳过纸页检查）'));
    }

    ck('无 JS 运行时错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  } catch (e) {
    ck('执行异常', false, e.message.split('\n')[0]);
  }

  await browser.close();

  console.log('');
  console.log('='.repeat(52));
  console.log(fail === 0
    ? C.g(C.b(`  全部通过 ${pass} 项`))
    : C.r(C.b(`  通过 ${pass} / 失败 ${fail}`)));
  console.log('='.repeat(52));
  console.log('');
  process.exit(fail ? 1 : 0);
})();
