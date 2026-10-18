/**
 * 前端冒烟测试（jsdom + 真实后端 API）
 * 覆盖：注册 → 线路选择 → 剧情推进（含跨章）→ 选择结算 → 结局 → 女主线
 *       → 存档 → 图鉴 → 回看 → 个人中心 → 路由守卫 → 美术资源加载
 *
 * 用法（需先启动后端 + 前端静态服务）：
 *   cd .smoke && node smoke.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const CLIENT = path.resolve(__dirname, '..', 'client');
const API = 'http://127.0.0.1:3000';

const SCRIPTS = [
  'assets/js/api.js',
  'assets/js/ui.js',
  'assets/js/store.js',
  'assets/js/pages/auth.js',
  'assets/js/pages/routes.js',
  'assets/js/pages/play.js',
  'assets/js/pages/saves.js',
  'assets/js/pages/gallery.js',
  'assets/js/pages/history.js',
  'assets/js/pages/profile.js',
  'assets/js/app.js',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0,
  fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    console.log('  ✗ ' + name + (extra ? '  → ' + extra : ''));
  }
}

(async () => {
  const html = fs.readFileSync(path.join(CLIENT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:5500/#/auth',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // jsdom 缺 fetch / sendBeacon
  window.fetch = (url, opts) => fetch(String(url).startsWith('http') ? url : API + url, opts);
  window.navigator.sendBeacon = () => true;

  const loaded = [];
  for (const rel of SCRIPTS) {
    const code = fs.readFileSync(path.join(CLIENT, rel), 'utf8');
    try {
      vm.runInContext(code, dom.getInternalVMContext(), { filename: rel });
      loaded.push(rel);
    } catch (e) {
      fail++;
      console.log('  ✗ 脚本加载失败: ' + rel + ' → ' + e.message);
    }
  }
  check(`全部 ${SCRIPTS.length} 个脚本加载无异常`, loaded.length === SCRIPTS.length);

  const app = window.document.getElementById('app');
  const q = (s) => window.document.querySelector(s);
  const qa = (s) => Array.from(window.document.querySelectorAll(s));
  const click = (n) => n && n.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  // ----------------------------------------------------------
  // 1. 登录
  // ----------------------------------------------------------
  console.log('\n[1] 登录页');
  await sleep(60);
  check('渲染登录表单', !!q('#f-user') && !!q('#f-pass'));
  check('未登录被守卫到 #/auth', window.location.hash === '#/auth', window.location.hash);

  const user = 'smoke' + Date.now().toString().slice(-8);
  click(q('.auth-switch button'));
  await sleep(80);
  q('#f-user').value = user;
  q('#f-pass').value = '123456';
  q('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(900);

  check('注册成功并跳转 #/routes', window.location.hash === '#/routes', window.location.hash);
  check('token 已写入 localStorage', !!window.localStorage.getItem('lovechoice_token'));
  check('显示顶栏导航', !!q('.topbar .nav'));

  // ----------------------------------------------------------
  // 2. 故事线选择
  // ----------------------------------------------------------
  console.log('\n[2] 故事线选择页');
  await sleep(700);
  const routeCards = qa('.route-card');
  check('渲染 2 条故事线', routeCards.length === 2, '实际 ' + routeCards.length);
  check(
    '含「他的视角」与「她的视角」',
    /他的视角/.test(app.textContent) && /她的视角/.test(app.textContent)
  );
  check('显示 5 章进度', /5 章/.test(app.textContent));

  // ----------------------------------------------------------
  // 3. 剧情页 · 他的视角
  // ----------------------------------------------------------
  console.log('\n[3] 剧情页 · 他的视角 0 号档');
  click(routeCards[0]);
  await sleep(1500);
  check('进入剧情页', window.location.hash.indexOf('#/play/male') === 0, window.location.hash);

  if (q('.chapter-card')) {
    click(q('.chapter-card'));
    await sleep(600);
  }
  check('存在对白框', !!q('.dialogue-box'));
  check('存在双好感度条', qa('.aff-bar').length === 2, '实际 ' + qa('.aff-bar').length);
  check('好感条标签为 他/她', /他的好感/.test(app.textContent) && /她的好感/.test(app.textContent));
  check('存在场景背景层', !!q('.scene-bg'));
  check('对白框有内容或说话人', !!q('.dialogue-box .text') && q('.dialogue-box').textContent.length > 2);

  // ----------------------------------------------------------
  // 4. 推进到选项
  // ----------------------------------------------------------
  console.log('\n[4] 推进到选项节点');
  let guard = 0,
    sawChoice = false;
  while (guard++ < 30) {
    if (q('.choice-btn')) {
      sawChoice = true;
      break;
    }
    const box = q('.dialogue-box');
    if (!box) break;
    click(box);
    await sleep(240);
    click(q('.dialogue-box'));
    await sleep(340);
    if (q('.chapter-card')) {
      click(q('.chapter-card'));
      await sleep(450);
    }
  }
  check('能推进到选项节点', sawChoice);
  const optCount = qa('.choice-btn').length;
  check('选项按钮数量 >= 2', optCount >= 2, '实际 ' + optCount);
  check('选项显示好感增减值', /\+?\d/.test(q('.choice-btn .eff') ? q('.choice-btn .eff').textContent : ''));

  // ----------------------------------------------------------
  // 5. 提交选择
  // ----------------------------------------------------------
  console.log('\n[5] 提交选择 → 好感结算');
  const before = qa('.aff-bar b').map((b) => Number(b.textContent));
  click(qa('.choice-btn')[0]);
  await sleep(900);
  const after = qa('.aff-bar b').map((b) => Number(b.textContent));
  check('好感度条数值发生变化', before[0] !== after[0] || before[1] !== after[1], JSON.stringify(before) + ' → ' + JSON.stringify(after));
  check('出现好感飘字或已更新', !!(q('.aff-pop') || after.join() !== before.join()));

  // ----------------------------------------------------------
  // 6. 跨章节直到结局
  // ----------------------------------------------------------
  console.log('\n[6] 跨章节自动推进 → 结局');
  guard = 0;
  let sawChapter = 0;
  while (guard++ < 60) {
    if (q('.ending-overlay')) break;
    if (q('.choice-btn')) {
      click(qa('.choice-btn')[0]);
      await sleep(760);
      continue;
    }
    if (q('.chapter-card')) {
      sawChapter++;
      click(q('.chapter-card'));
      await sleep(430);
      continue;
    }
    const box = q('.dialogue-box');
    if (!box) break;
    click(box);
    await sleep(200);
    click(q('.dialogue-box'));
    await sleep(300);
  }
  check('经历多次章节过场', sawChapter >= 4, '实际 ' + sawChapter);
  check('到达结局遮罩', !!q('.ending-overlay'), '未出现结局');
  const endTitle = q('.ending-overlay h2');
  check('结局卡有标题', !!endTitle && endTitle.textContent.length > 0, endTitle && endTitle.textContent);
  check('结局卡展示双方最终好感', qa('.ending-overlay .final-aff .v').length === 2);

  // ----------------------------------------------------------
  // 7. 女主线
  // ----------------------------------------------------------
  console.log('\n[7] 她的视角（双好感落点不同）');
  window.App.go('routes');
  await sleep(800);
  const cards2 = qa('.route-card');
  click(cards2[1]);
  await sleep(1400);
  check('进入女主线', window.location.hash.indexOf('#/play/female') === 0, window.location.hash);
  if (q('.chapter-card')) {
    click(q('.chapter-card'));
    await sleep(450);
  }

  guard = 0;
  while (guard++ < 60) {
    if (q('.ending-overlay')) break;
    if (q('.choice-btn')) {
      click(qa('.choice-btn')[0]);
      await sleep(760);
      continue;
    }
    if (q('.chapter-card')) {
      click(q('.chapter-card'));
      await sleep(430);
      continue;
    }
    const box = q('.dialogue-box');
    if (!box) break;
    click(box);
    await sleep(200);
    click(q('.dialogue-box'));
    await sleep(300);
  }
  check('女主线也能走到结局', !!q('.ending-overlay'));
  const fEnd = q('.ending-overlay h2');
  console.log('    他线结局: ' + (endTitle ? endTitle.textContent : '—') + '  |  她线结局: ' + (fEnd ? fEnd.textContent : '—'));

  // ----------------------------------------------------------
  // 8. 存档页
  // ----------------------------------------------------------
  console.log('\n[8] 存档管理');
  window.App.go('saves');
  await sleep(900);
  check('渲染 10 个档位', qa('.slot-card').length === 10, '实际 ' + qa('.slot-card').length);
  check('已占用档位显示好感条', qa('.slot-card.occupied').length >= 1);
  check('占用档位显示视角标签', !!qa('.slot-card .tag.male, .slot-card .tag.female').length);

  // ----------------------------------------------------------
  // 9. 结局图鉴
  // ----------------------------------------------------------
  console.log('\n[9] 结局图鉴');
  window.App.go('gallery');
  await sleep(900);
  check('渲染结局卡片', qa('.ending-card-item').length >= 2, '实际 ' + qa('.ending-card-item').length);
  check('已解锁结局不置灰', !!qa('.ending-card-item:not(.locked)').length);
  check('存在锁定结局', !!qa('.ending-card-item.locked').length);

  // ----------------------------------------------------------
  // 10. 回看页
  // ----------------------------------------------------------
  console.log('\n[10] 选择回看');
  window.App.go('history');
  await sleep(1000);
  check('渲染回看条目', qa('.history-item').length >= 2, '实际 ' + qa('.history-item').length);
  check('回看显示好感变化 before→after', !!q('.aff-diff .before') && !!q('.aff-diff .after') && !!q('.aff-diff .delta'));
  check('回看显示所选选项文案', /你选择了/.test(app.textContent));

  // ----------------------------------------------------------
  // 11. 个人中心
  // ----------------------------------------------------------
  console.log('\n[11] 个人中心');
  window.App.go('profile');
  await sleep(1000);
  check('渲染统计卡片', qa('.stat-box').length >= 4, '实际 ' + qa('.stat-box').length);
  check('显示两条线进度', qa('.card .progress-bar').length >= 2);
  check('显示已解锁结局标签', /结局收集/.test(app.textContent));

  // ----------------------------------------------------------
  // 12. 路由守卫
  // ----------------------------------------------------------
  console.log('\n[12] 路由守卫');
  window.location.hash = '#/play/male/0';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(700);
  check('已登录可直达剧情页', window.location.hash.indexOf('#/play/male') === 0);
  window.App.go('auth');
  await sleep(300);
  check('已登录访问 #/auth 被弹回故事线', window.location.hash === '#/routes', window.location.hash);

  // ----------------------------------------------------------
  // 13. 美术资源
  // ----------------------------------------------------------
  console.log('\n[13] 美术资源');
  const bgDir = path.join(CLIENT, 'assets', 'img', 'bg');
  const avDir = path.join(CLIENT, 'assets', 'img', 'avatar');
  const bgFiles = fs.existsSync(bgDir) ? fs.readdirSync(bgDir).filter((f) => f.endsWith('.svg')) : [];
  const avFiles = fs.existsSync(avDir) ? fs.readdirSync(avDir).filter((f) => f.endsWith('.svg')) : [];
  check('背景图 >= 8 张', bgFiles.length >= 8, '实际 ' + bgFiles.length);
  check('立绘 >= 7 张', avFiles.length >= 7, '实际 ' + avFiles.length);

  // 所有背景图都应是合法 SVG
  let badSvg = 0;
  for (const f of bgFiles.concat(avFiles)) {
    const dir = bgFiles.includes(f) ? bgDir : avDir;
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!c.startsWith('<svg') || !c.trimEnd().endsWith('</svg>') || /NaN|undefined/.test(c)) badSvg++;
  }
  check('全部 SVG 格式合法', badSvg === 0, badSvg + ' 个异常');

  // UI 层背景映射表应覆盖剧本用到的 bg_key
  const bgKeysInScript = await (await fetch(API + '/api/story/routes/male/script')).json();
  const usedKeys = new Set();
  for (const ch of (bgKeysInScript.data.chapters || [])) {
    for (const n of (ch.nodes || [])) if (n.bgKey) usedKeys.add(n.bgKey);
  }
  const mapped = [...usedKeys].filter((k) => window.UI.BG_IMAGES[k]);
  check(
    `剧本用到的 ${usedKeys.size} 种背景都有图`,
    mapped.length === usedKeys.size,
    '缺失: ' + [...usedKeys].filter((k) => !window.UI.BG_IMAGES[k]).join(',')
  );

  // 立绘路径应在 DB 中配置
  const chars = await (await fetch(API + '/api/story/routes/male/characters', {
    headers: { Authorization: 'Bearer ' + window.localStorage.getItem('lovechoice_token') },
  })).json();
  const withAvatar = (chars.data.list || []).filter((c) => c.avatarUrl);
  check('角色立绘路径已写入 DB', withAvatar.length === (chars.data.list || []).length, withAvatar.length + '/' + (chars.data.list || []).length);

  console.log('\n========================================');
  console.log('  通过 ' + pass + ' / ' + (pass + fail) + (fail ? '　失败 ' + fail : '　全部通过 🎉'));
  console.log('========================================');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\n冒烟测试异常:', e);
  process.exit(1);
});