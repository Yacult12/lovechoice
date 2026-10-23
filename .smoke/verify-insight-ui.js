/**
 * 章节启示卡片的浏览器端验证
 *   node verify-insight-ui.js [baseUrl]
 *
 * 静态检查通过不代表卡片真的会弹。
 *
 * ⚠️ 踩过的坑：上一版用 page.evaluate 里直接 fetch 接口来推进剧情，
 *    结果前端完全没收到 chapterComplete 事件 —— 卡片当然不弹。
 *    卡片是前端在处理 /api/play/* 的返回值时才渲染的，
 *    所以必须真的点 UI（点对白框 / 点选项按钮），让前端的
 *    doAdvance / doChoice 走完整链路。
 *
 * 另一个坑：章节过场卡每个存档位只弹一次（Store.chapterSeen），
 *    所以要用一个干净的 slot，或者先清掉 localStorage。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://121.40.54.103:8080';
const TOKEN = process.env.LC_TOKEN
  || fs.readFileSync(process.env.TEMP + '\\lc-token.txt', 'utf8').trim();

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
  console.log(C.b('\n=== 章节启示卡片验证（真实点击）===\n'));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 120));
  });

  try {
    // 清掉本地状态：章节过场卡「每档只弹一次」，
    // 不清的话第二次跑就看不到卡片了
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    // ⚠️ 箭头函数里没有 arguments，token 必须用显式参数传进去
    await page.evaluate((tok) => {
      localStorage.clear();
      localStorage.setItem('lovechoice_token', tok);
    }, TOKEN);
    await page.waitForTimeout(800);

    // ⚠️ 必须先删掉旧存档。
    //   /api/play/start 是「继续」语义 —— 账号上已有进度时会直接恢复到那一章，
    //   于是测试从第 5 章开始跑，看到的过场卡是「第五章」而不是「第二章」。
    //   启示显示的是 nextChapterNo-1 章，所以从第 5 章进就配第 4 章启示 ——
    //   逻辑没错，是测试前置条件没清干净。
    const cleared = await page.evaluate(async (tok) => {
      const H = { Authorization: 'Bearer ' + tok };
      const r = await fetch('/api/saves/0', { method: 'DELETE', headers: H });
      return r.status;
    }, TOKEN);
    console.log(C.d(`      清除旧存档: HTTP ${cleared}`));
    await page.waitForTimeout(400);

    // 进 male 线第 1 章
    await page.evaluate(() => window.App.go('play', { routeCode: 'male', chapterNo: 1 }));
    await page.waitForSelector('#stage', { timeout: 20000 });
    await page.waitForTimeout(1800);

    // ⚠️ 清空存档后首次进入，会先弹「第一章」的过场卡
    //   （nextChapterNo=1，对应的第 0 章启示不存在，正确跳过）。
    //   所以要先吃掉这张卡，再一路点到第 2 章。
    const first = await page.$('.chapter-card');
    if (first) {
      await first.click();
      await page.waitForTimeout(1200);
    }

    // 真的点 UI：优先点选项，没有选项就点对白框
    let sawChapterCard = false;
    let sawInsight = false;
    let clicks = 0;

    for (let i = 0; i < 80; i++) {
      if (await page.$('.insight-card')) { sawInsight = true; break; }

      const cc = await page.$('.chapter-card');
      if (cc) {
        const t = await cc.evaluate((e) => e.textContent.replace(/\s+/g, ' ').trim());
        // 目标是「第二章」的过场卡
        if (/第二章/.test(t)) { sawChapterCard = true; break; }
        await cc.click();
        await page.waitForTimeout(1200);
        continue;
      }

      const choice = await page.$('.choice-btn:not([disabled])');
      if (choice) {
        await choice.click();
        clicks++;
        await page.waitForTimeout(700);
        continue;
      }

      // 打字机没打完时点对白框会立刻打完，再点一次才推进
      const dlg = await page.$('.dialogue-box .text');
      if (dlg) {
        await dlg.click();
        clicks++;
        await page.waitForTimeout(450);
        continue;
      }
      await page.waitForTimeout(400);
    }

    console.log(C.d(`      点击了 ${clicks} 次`));
    ck('出现章节过场卡', sawChapterCard);

    if (sawChapterCard) {
      const txt = await page.$eval('.chapter-card', (e) => e.textContent.replace(/\s+/g, ' ').trim());
      ck('过场卡含章节标题', /第二章/.test(txt), txt.slice(0, 60));

      // 点掉过场卡，露出启示卡
      await page.click('.chapter-card');
      await page.waitForTimeout(1400);
    }

    // 启示卡
    const hasInsight = await page.$('.insight-card');
    ck('出现本章启示卡', !!hasInsight);

    if (hasInsight) {
      const info = await page.evaluate(() => {
        const card = document.querySelector('.insight-card');
        const illo = card.querySelector('.insight-illo');
        const body = card.querySelector('.insight-body');
        const title = card.querySelector('.insight-title');
        const r = card.getBoundingClientRect();
        return {
          title: title ? title.textContent.trim() : '',
          body: body ? body.textContent.trim() : '',
          illoSrc: illo ? illo.getAttribute('src') : null,
          illoComplete: illo ? illo.complete && illo.naturalWidth > 0 : false,
          illoW: illo ? illo.naturalWidth : 0,
          cardTop: Math.round(r.top),
          cardBottom: Math.round(r.bottom),
          vh: window.innerHeight,
          hasHint: !!card.querySelector('.insight-hint'),
          hasKicker: !!card.querySelector('.insight-kicker')
        };
      });

      ck('启示标题正确', /爱人先爱己/.test(info.title), info.title);
      ck('有 IN SIGHT 抬头', info.hasKicker, '');
      ck('启示正文非空', info.body.length > 40, info.body.length + ' 字');
      ck('启示正文含核心句',
        info.body.includes('安全感不是别人施舍给你的礼物'), info.body.slice(0, 50));
      ck('有插图', !!info.illoSrc, '缺 img');
      ck('插图引用正确', !!info.illoSrc && info.illoSrc.includes('chapter-'), info.illoSrc);
      ck('插图真的加载成功', info.illoComplete && info.illoW > 0, 'naturalWidth=' + info.illoW);
      ck('有「点击继续」提示', info.hasHint, '');
      ck('启示卡在视口内',
        info.cardTop >= -1 && info.cardBottom <= info.vh + 1,
        `top=${info.cardTop} bottom=${info.cardBottom} vh=${info.vh}`);

      await page.click('.insight-card');
      await page.waitForTimeout(1100);
      ck('点击后启示卡消失', !(await page.$('.insight-card')));
    }

    // 继续点击应该能进入第 2 章正文。
    // ⚠️ 这里必须每次重新取元素句柄 —— 复用旧句柄会因元素已被替换而超时。
    for (let i = 0; i < 12; i++) {
      const choice = await page.$('.choice-btn:not([disabled])');
      const dlg = choice ? null : await page.$('.dialogue-box .text');
      if (choice) {
        await choice.click({ timeout: 5000 }).catch(() => {});
      } else if (dlg) {
        await dlg.click({ timeout: 5000 }).catch(() => {});
      } else {
        break;
      }
      await page.waitForTimeout(450);
    }
    // ⚠️ 别断言「第二章」—— 12 次点击可能已经走到第 3 章。
    //   只要确认进入了第 2 章及以后即可。
    const nowChapter = await page.evaluate(() => {
      const t = document.querySelector('.stage-top .chapter-label, .stage-top .tiny');
      return t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
    });
    const chNo = Number((nowChapter.match(/第([一二三四五])章/) || [])[1]
      ? '一二三四五'.indexOf((nowChapter.match(/第([一二三四五])章/) || [])[1]) + 1
      : 0);
    ck('能继续进入第 2 章及以后', chNo >= 2, nowChapter.slice(0, 50));

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