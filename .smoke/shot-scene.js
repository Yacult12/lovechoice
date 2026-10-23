/**
 * 截图：剧情页的完整画面（含背景人物层、章节过场卡、启示卡）
 *   node shot-scene.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://121.40.54.103:8080';
const TOKEN = process.env.LC_TOKEN
  || (fs.existsSync(process.env.TEMP + '\\lc-token.txt')
    ? fs.readFileSync(process.env.TEMP + '\\lc-token.txt', 'utf8').trim()
    : '');
const OUT = path.join(__dirname, 'screenshots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
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

    // 过场卡
    const cc = await page.$('.chapter-card');
    if (cc) {
      await page.screenshot({ path: path.join(OUT, `stage-ch${ch}-card.png`) });
      console.log('  ✓ stage-ch' + ch + '-card.png');
      await cc.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(OUT, `stage-ch${ch}.png`) });
    console.log('  ✓ stage-ch' + ch + '.png');
  }

  await browser.close();
  console.log('\n截图目录: ' + OUT + '\n');
})();
