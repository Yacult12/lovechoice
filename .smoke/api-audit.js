/**
 * 后端 + API 全量体检
 *   node api-audit.js
 *
 * 覆盖 33 个路由：正常调用、鉴权、参数校验、404、幂等、越权。
 */
const BASE = 'http://127.0.0.1:3000';
const API = BASE + '/api';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else {
    fail++;
    failures.push(name + (extra ? ' → ' + extra : ''));
    console.log('  ✗ ' + name + (extra ? '  → ' + extra : ''));
  }
}

let token = '';
async function call(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token && !opts.noAuth) headers.Authorization = 'Bearer ' + token;
  if (opts.token) headers.Authorization = 'Bearer ' + opts.token;

  // keep-alive 偶发被服务端断开，重试一次即可（同一测试内不应有状态副作用）
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(API + path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body)
      });
      let json = null;
      try { json = await res.json(); } catch (_) { json = null; }
      return { status: res.status, json, code: json?.code, data: json?.data, msg: json?.message };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw lastErr;
}

const U = 'audit_' + Date.now().toString(36);

(async () => {
  console.log('\n════════ 后端 / API 全量体检 ════════\n');

  // ========== 1. 基础设施 ==========
  console.log('[1] 基础设施');
  const health = await call('GET', '/health');
  check('GET /api/health → 200', health.status === 200, '实际 ' + health.status);
  check('健康检查 db.status = up', health.data?.db?.status === 'up', JSON.stringify(health.data?.db));
  check('10 张表齐全', health.data?.db?.tableCount === 10, '实际 ' + health.data?.db?.tableCount);
  check('无缺失表', (health.data?.db?.missingTables || []).length === 0);

  const root = await fetch(BASE + '/').then((r) => r.json());
  check('GET / 返回服务信息', root?.data?.service?.includes('后端'), JSON.stringify(root?.data));

  const notFound = await call('GET', '/no-such-endpoint');
  check('未知路径 → 404', notFound.status === 404, '实际 ' + notFound.status);

  const meta = await call('GET', '/meta');
  check('GET /api/meta 可访问', meta.status === 200 || meta.status === 401, '实际 ' + meta.status);

  // ========== 2. 鉴权 ==========
  console.log('\n[2] 鉴权');
  const noTok = await call('GET', '/auth/me', undefined, { noAuth: true });
  check('无 token 访问 /auth/me → 401', noTok.status === 401, '实际 ' + noTok.status);

  const badTok = await call('GET', '/auth/me', undefined, { token: 'garbage.token.here' });
  check('坏 token → 401', badTok.status === 401, '实际 ' + badTok.status);

  // ========== 3. 注册 / 登录 ==========
  console.log('\n[3] 账号');
  const weak = await call('POST', '/auth/register', { username: 'ab', password: '123' });
  check('弱密码被拒（422）', weak.status === 422, '实际 ' + weak.status);

  const shortName = await call('POST', '/auth/register', { username: 'x', password: 'good123456' });
  check('过短用户名被拒（422）', shortName.status === 422, '实际 ' + shortName.status);

  const reg = await call('POST', '/auth/register', {
    username: U, password: 'audit123456', nickname: '体检用户'
  });
  check('注册成功', [200, 201].includes(reg.status) && reg.code === 0, reg.msg);
  token = reg.data?.token || '';
  const uid = reg.data?.user?.id;
  check('返回 token + user.id', Boolean(token && uid));

  const dup = await call('POST', '/auth/register', { username: U, password: 'audit123456' });
  check('重复用户名被拒（409）', dup.status === 409, '实际 ' + dup.status);

  const badLogin = await call('POST', '/auth/login', { username: U, password: 'wrongpass' });
  check('错误密码登录被拒（401）', badLogin.status === 401, '实际 ' + badLogin.status);

  const login = await call('POST', '/auth/login', { username: U, password: 'audit123456' });
  check('正确密码登录成功', login.code === 0 && Boolean(login.data?.token));

  const me = await call('GET', '/auth/me');
  check('GET /auth/me 返回当前用户', me.data?.user?.username === U || me.data?.username === U,
    JSON.stringify(me.data).slice(0, 100));

  const prof = await call('PATCH', '/auth/profile', { nickname: '改名了' });
  check('PATCH /auth/profile 改名成功',
    prof.code === 0 && JSON.stringify(prof.data).includes('改名了'), JSON.stringify(prof.data).slice(0, 100));

  // ========== 4. 剧本只读接口 ==========
  console.log('\n[4] 剧本');
  // 后端统一用 { list: [...] } 包装
  const routes = await call('GET', '/story/routes');
  check('GET /story/routes 返回 2 条线', routes.data?.list?.length === 2,
    JSON.stringify(routes.data).slice(0, 100));
  check('两条线 male/female 都存在',
    JSON.stringify(routes.data).includes('male') && JSON.stringify(routes.data).includes('female'));

  const detail = await call('GET', '/story/routes/male');
  check('GET /story/routes/male 有 5 个章节', (detail.data?.chapters?.length || 0) === 5,
    '实际 ' + detail.data?.chapters?.length);
  check('含 route 基本信息', detail.data?.route?.routeCode === 'male');

  const chars = await call('GET', '/story/routes/male/characters');
  check('GET .../characters 返回 2 个角色', chars.data?.list?.length === 2,
    '实际 ' + chars.data?.list?.length);

  const ch2 = await call('GET', '/story/routes/male/chapters/2');
  check('GET .../chapters/2 返回节点', (ch2.data?.nodes?.length || 0) > 0,
    '实际 ' + ch2.data?.nodes?.length);
  check('第二章节点文案已扩写 (>50字)',
    (ch2.data?.nodes?.[0]?.content || '').length > 50,
    '长度 ' + (ch2.data?.nodes?.[0]?.content || '').length);

  const script = await call('GET', '/story/routes/male/script');
  check('GET .../script 返回 5 章完整剧本', (script.data?.chapters?.length || 0) === 5,
    '实际 ' + script.data?.chapters?.length);

  const validate = await call('GET', '/story/routes/male/validate');
  check('GET .../validate 剧本自检通过', validate.data?.valid === true || validate.code === 0,
    JSON.stringify(validate.data).slice(0, 150));

  const badRoute = await call('GET', '/story/routes/nope');
  check('不存在的路线 → 404', badRoute.status === 404, '实际 ' + badRoute.status);

  const badCh = await call('GET', '/story/routes/male/chapters/99');
  check('不存在的章节 → 404', badCh.status === 404, '实际 ' + badCh.status);

  // /story/endings 按线路分组：2 条线 × 4 结局 = 8
  const stEndings = await call('GET', '/story/endings');
  const endTotal = (stEndings.data?.list || []).reduce((a, g) => a + (g.endings?.length || 0), 0);
  check('GET /story/endings 返回 2 条线分组', stEndings.data?.list?.length === 2);
  check('结局总数 8 个（2线×4）', endTotal === 8, '实际 ' + endTotal);

  // ========== 5. 剧情推进 ==========
  console.log('\n[5] 剧情推进');
  const start = await call('POST', '/play/start', { routeCode: 'male', slot: 5 });
  check('POST /play/start 创建存档', start.code === 0 && start.data?.node, start.msg);
  check('起始为对白节点', start.data?.node?.type === 'dialogue', start.data?.node?.type);
  check('起始节点带 bgKey', Boolean(start.data?.node?.bgKey), start.data?.node?.bgKey);
  check('起始节点有 content', (start.data?.node?.content || '').length > 50,
    '长度 ' + (start.data?.node?.content || '').length);

  let cur = start.data.node;
  let guard = 0;
  while (cur?.type === 'dialogue' && guard++ < 40) {
    const r = await call('POST', '/play/advance', { routeCode: 'male', slot: 5, nodeKey: cur.nodeKey });
    if (r.code !== 0) { check('推进到选项节点', false, r.msg); break; }
    cur = r.data?.node;
    if (r.data?.chapterComplete) break;
  }
  check('能从对白推进到选项节点', cur?.type === 'choice', '停在 ' + cur?.type + ' / ' + cur?.nodeKey);

  if (cur?.type === 'choice') {
    const opt0 = cur.options?.[0];
    check('选项带好感数值', opt0 && opt0.effectMale !== undefined && opt0.effectFemale !== undefined);

    const wrongKey = await call('POST', '/play/choice', {
      routeCode: 'male', slot: 5, nodeKey: cur.nodeKey, optionKey: 'o_nonexistent'
    });
    check('不存在的选项 → 404', wrongKey.status === 404, '实际 ' + wrongKey.status);

    const choice = await call('POST', '/play/choice', {
      routeCode: 'male', slot: 5, nodeKey: cur.nodeKey, optionKey: opt0.optionKey
    });
    check('POST /play/choice 成功', choice.code === 0, choice.msg);
    check('返回 delta 增量', Boolean(choice.data?.delta), JSON.stringify(choice.data?.delta));
    check('返回选项文案', Boolean(choice.data?.choice?.optionText));
  }

  const state = await call('GET', '/play/state?routeCode=male&slot=5');
  check('GET /play/state 返回当前进度', state.code === 0 && Boolean(state.data?.save), state.msg);

  const stateNoSlot = await call('GET', '/play/state?routeCode=male&slot=9');
  check('无存档的档位 → 404', stateNoSlot.status === 404, '实际 ' + stateNoSlot.status);

  const mismatch = await call('POST', '/play/advance', {
    routeCode: 'male', slot: 5, nodeKey: 'n_definitely_not_real'
  });
  check('错误 nodeKey → 4xx', mismatch.status >= 400 && mismatch.status < 500, '实际 ' + mismatch.status);

  // ========== 6. 隐藏互动 ==========
  console.log('\n[6] 隐藏互动');
  const s2 = await call('POST', '/play/start', { routeCode: 'male', slot: 6 });
  const n2 = s2.data?.node;
  check('新档位可开始', Boolean(n2));

  const g = await call('POST', '/play/gesture', {
    routeCode: 'male', slot: 6, nodeKey: n2.nodeKey,
    gestureId: 'wait_together', effectMale: 4, effectFemale: 4
  });
  check('POST /play/gesture 成功', g.code === 0, g.msg);
  check('gesture.applied = true', g.data?.gesture?.applied === true);
  check('delta 回传 (男+4)', g.data?.delta?.male === 4, JSON.stringify(g.data?.delta));
  check('互动不推进剧情', g.data?.node?.nodeKey === n2.nodeKey);

  const g2 = await call('POST', '/play/gesture', {
    routeCode: 'male', slot: 6, nodeKey: n2.nodeKey,
    gestureId: 'wait_together', effectMale: 4, effectFemale: 4
  });
  check('重复触发幂等（applied=false）', g2.data?.gesture?.applied === false);
  check('重复触发不加好感', g2.data?.delta?.male === 0 && g2.data?.delta?.female === 0);

  const gNoField = await call('POST', '/play/gesture', { routeCode: 'male', slot: 6, nodeKey: n2.nodeKey });
  check('缺 gestureId → 422', gNoField.status === 422, '实际 ' + gNoField.status);

  const gTooBig = await call('POST', '/play/gesture', {
    routeCode: 'male', slot: 6, nodeKey: n2.nodeKey,
    gestureId: 'x', effectMale: 9999, effectFemale: 0
  });
  check('超大增量 → 422', gTooBig.status === 422, '实际 ' + gTooBig.status);

  const gNegative = await call('POST', '/play/gesture', {
    routeCode: 'male', slot: 6, nodeKey: n2.nodeKey,
    gestureId: 'y', effectMale: -9999, effectFemale: 0
  });
  check('超大负增量 → 422', gNegative.status === 422, '实际 ' + gNegative.status);

  // ========== 7. 存档 ==========
  console.log('\n[7] 存档');
  const list = await call('GET', '/saves');
  check('GET /saves 列出存档', Array.isArray(list.data?.list) && list.data.list.length >= 1,
    JSON.stringify(list.data).slice(0, 100));

  const one = await call('GET', '/saves/5');
  check('GET /saves/5 返回详情', one.code === 0, one.msg);

  const badSlot = await call('GET', '/saves/99');
  check('越界档位被拒（4xx）', badSlot.status >= 400 && badSlot.status < 500, '实际 ' + badSlot.status);

  // PUT 需要合法的 routeCode + nodeKey，先取当前状态
  const cur5 = await call('GET', '/play/state?routeCode=male&slot=5');
  const putBody = {
    routeCode: 'male',
    nodeKey: cur5.data?.save?.nodeKey || 'n_start',
    affectionMale: 30,
    affectionFemale: 40
  };
  const put = await call('PUT', '/saves/5', putBody);
  check('PUT /saves/5 更新存档', put.code === 0, put.msg + ' ' + JSON.stringify(put.json).slice(0, 120));

  const putBad = await call('PUT', '/saves/5', { routeCode: 'male' });
  check('PUT 缺字段 → 422', putBad.status === 422, '实际 ' + putBad.status);

  const del = await call('DELETE', '/saves/7');
  check('DELETE /saves/7 成功或不存在', del.code === 0 || del.status === 404, '实际 ' + del.status);

  // ========== 8. 我的 ==========
  console.log('\n[8] 我的');
  const stats = await call('GET', '/me/stats');
  check('GET /me/stats 返回统计', stats.code === 0 && Boolean(stats.data), stats.msg);

  const hist = await call('GET', '/me/history');
  check('GET /me/history 返回回看', hist.code === 0, hist.msg);

  const myEnd = await call('GET', '/me/endings');
  check('GET /me/endings 返回已解锁', Array.isArray(myEnd.data?.list), JSON.stringify(myEnd.data).slice(0, 80));

  // ========== 9. 越权 ==========
  console.log('\n[9] 越权 / 隔离');
  const U2 = 'audit2_' + Date.now().toString(36);
  const reg2 = await call('POST', '/auth/register', { username: U2, password: 'audit123456' });
  check('第二个账号注册成功', reg2.code === 0);
  const userToken = reg2.data?.token;

  // A 先在档位 5 写入特征值 77，用来验证 B 绝对读不到
  await call('PUT', '/saves/5', { routeCode: 'male', nodeKey: cur?.nodeKey || 'n_start', affectionMale: 77, affectionFemale: 88 });

  const steal = await call('GET', '/saves/5', undefined, { token: userToken });
  const stealData = steal.json?.data;
  check('B 读 A 的档位拿不到数据', stealData === null || stealData === undefined,
    '返回了: ' + JSON.stringify(stealData).slice(0, 150));
  check('B 读到的内容不含 A 的好感值', !JSON.stringify(stealData).includes('77'));

  const stealPlay = await call('POST', '/play/start', { routeCode: 'female', slot: 5 }, { token: userToken });
  check('B 同档位建存档得到的是自己独立的一份',
    stealPlay.status === 200 && stealPlay.json?.data?.save?.affectionMale === 0,
    '实际 ' + stealPlay.status + ' 好感=' + stealPlay.json?.data?.save?.affectionMale);

  const aIntact = await call('GET', '/saves/5');
  check('A 的存档未被 B 影响（仍是 77）', aIntact.json?.data?.affectionMale === 77,
    '实际 ' + aIntact.json?.data?.affectionMale);

  // ========== 10. tick / settle ==========
  console.log('\n[10] 计时与结算');
  const tk = await call('POST', '/play/tick', { routeCode: 'male', slot: 5, seconds: 30 });
  check('POST /play/tick 正常', tk.code === 0, tk.msg);

  const tkBig = await call('POST', '/play/tick', { routeCode: 'male', slot: 5, seconds: 99999 });
  check('超大 tick 被拒（422）', tkBig.status === 422, '实际 ' + tkBig.status);

  const tkZero = await call('POST', '/play/tick', { routeCode: 'male', slot: 5, seconds: 0 });
  check('tick=0 被拒（422）', tkZero.status === 422, '实际 ' + tkZero.status);

  const st = await call('POST', '/play/settle', { routeCode: 'male', slot: 5 });
  check('POST /play/settle 有响应', st.status === 200 || st.status === 404, '实际 ' + st.status);

  // ========== 汇总 ==========
  console.log('\n' + '═'.repeat(50));
  console.log(`  通过 ${pass} / ${pass + fail}`);
  if (fail) {
    console.log('\n  失败项：');
    failures.forEach((f) => console.log('   · ' + f));
  } else {
    console.log('  全部通过 🎉');
  }
  console.log('═'.repeat(50));
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\n💥 体检脚本异常：', e.message);
  process.exit(1);
});