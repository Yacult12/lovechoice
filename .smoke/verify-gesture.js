/**
 * 验证隐藏互动端点：POST /api/play/gesture
 *   node verify-gesture.js
 */
const BASE = 'http://127.0.0.1:3000';

let token = '';
let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  return { status: res.status, json };
}

(async () => {
  console.log('\n=== 隐藏互动端点验证 ===\n');

  // 1) 注册一个测试账号
  const uname = 'gest_' + Date.now().toString(36);
  const reg = await api('POST', '/api/auth/register', {
    username: uname, password: 'test123456', nickname: '互动测试'
  });
  check('注册成功', [200, 201].includes(reg.status) && reg.json?.code === 0, JSON.stringify(reg.json).slice(0, 120));
  token = reg.json?.data?.token || '';

  // 2) 开始游戏（他的线，档位 9）
  const start = await api('POST', '/api/play/start', { routeCode: 'male', slot: 9 });
  check('开始游戏', start.status === 200, JSON.stringify(start.json).slice(0, 150));
  let node = start.json?.data?.node;
  console.log('  起始节点:', node?.nodeKey, '类型:', node?.type);

  // 3) 走到一个对白节点（起始就是 dialogue）
  check('起始为对白节点', node?.type === 'dialogue', '实际 ' + node?.type);

  // 4) 触发互动
  const g1 = await api('POST', '/api/play/gesture', {
    routeCode: 'male', slot: 9, nodeKey: node.nodeKey,
    gestureId: 'wait_together', effectMale: 4, effectFemale: 4
  });
  check('POST /api/play/gesture 返回 200', g1.status === 200, JSON.stringify(g1.json).slice(0, 200));
  check('返回 gesture.applied = true', g1.json?.data?.gesture?.applied === true);
  check('好感增量回传正确 (男+4/女+4)',
    g1.json?.data?.delta?.male === 4 && g1.json?.data?.delta?.female === 4,
    JSON.stringify(g1.json?.data?.delta));

  const affAfter1 = g1.json?.data?.save;
  console.log('  互动后好感: 男', affAfter1?.affectionMale, '女', affAfter1?.affectionFemale);

  // 5) 不推进剧情 —— nodeKey 应该没变
  check('互动不推进剧情（nodeKey 不变）', g1.json?.data?.node?.nodeKey === node.nodeKey,
    '现在在 ' + g1.json?.data?.node?.nodeKey);

  // 6) flag 已写入，重复触发应幂等
  const g2 = await api('POST', '/api/play/gesture', {
    routeCode: 'male', slot: 9, nodeKey: node.nodeKey,
    gestureId: 'wait_together', effectMale: 4, effectFemale: 4
  });
  check('重复触发幂等（applied=false）', g2.json?.data?.gesture?.applied === false);
  check('重复触发不再加好感 (delta 全 0)',
    g2.json?.data?.delta?.male === 0 && g2.json?.data?.delta?.female === 0);
  check('重复触发后好感不变',
    g2.json?.data?.save?.affectionMale === affAfter1?.affectionMale &&
    g2.json?.data?.save?.affectionFemale === affAfter1?.affectionFemale,
    `男 ${g2.json?.data?.save?.affectionMale} vs ${affAfter1?.affectionMale}`);

  // 7) 在 choice 节点上应被拒绝
  // 先推进到选项节点
  let cur = node;
  for (let i = 0; i < 5 && cur?.type === 'dialogue'; i++) {
    const r = await api('POST', '/api/play/advance', {
      routeCode: 'male', slot: 9, nodeKey: cur.nodeKey
    });
    cur = r.json?.data?.node;
  }
  console.log('  推进到:', cur?.nodeKey, '类型:', cur?.type);
  if (cur?.type === 'choice') {
    const g3 = await api('POST', '/api/play/gesture', {
      routeCode: 'male', slot: 9, nodeKey: cur.nodeKey,
      gestureId: 'hold_hand', effectMale: 3, effectFemale: 7
    });
    check('选项节点上拒绝互动（400）', g3.status === 400, '实际 ' + g3.status);
  } else {
    check('能推进到选项节点', false, '停在 ' + cur?.type);
  }

  // 8) 参数校验：缺 gestureId 应 422
  const bad = await api('POST', '/api/play/gesture', {
    routeCode: 'male', slot: 9, nodeKey: 'n_start'
  });
  check('缺 gestureId 被 schema 拦截（422）', bad.status === 422, '实际 ' + bad.status);

  // 9) 好感上限夹紧
  const big = await api('POST', '/api/play/gesture', {
    routeCode: 'male', slot: 9, nodeKey: node.nodeKey,
    gestureId: 'pocket_hand', effectMale: 999, effectFemale: 0
  });
  check('超大增量被 schema 拒绝（422）', big.status === 422, '实际 ' + big.status);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `  全部通过 ${pass} 项 🎉` : `  通过 ${pass} / 失败 ${fail}`);
  console.log('='.repeat(46));
  process.exit(fail ? 1 : 0);
})();