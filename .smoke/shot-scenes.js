/**
 * 用无头浏览器把插画预览页截图，肉眼确认画面对不对
 *   node shot-scenes.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'screenshots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('file:///' + path.join(__dirname, 'scene-preview.html').replace(/\\/g, '/'));
  await page.waitForTimeout(600);

  // 只截浅色纸页那一组
  const figures = await page.$$('figure');
  for (let i = 0; i < 5 && i < figures.length; i++) {
    await figures[i].screenshot({ path: path.join(OUT, `scene-${i + 1}.png`) });
    console.log('  ✓ scene-' + (i + 1) + '.png');
  }

  await browser.close();
  console.log('\n截图目录: ' + OUT + '\n');
})();
