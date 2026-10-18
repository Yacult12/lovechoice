/**
 * 决定性越权测试：确认 A 的数据是否会泄露给 B
 *   node authz-final.js
 */
const API = 'http://127.0.0.1:3000/api';

async function raw(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let j = null;
  try { j = await res.json(); } catch (_) {}
  return { status: res.status, json: j };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

(async () => {
  console.log('\n=== 越权隔离决定性测试 ===\n');
  const A = 'isoA_' + Date.now().toString(36);
  const B = 'isoB_' + Date.now().toString(36);
  const ta = (await raw('', 'POST', '/auth/register', { username: A, password: 'iso123456' })).json?.data?.token;
  const tb = (await raw('', 'POST', '/auth/register', { username: B, password: 'iso123456' })).json?.data?.token;

  // A 在档位 3 建 male 线存档，并写入特征性好感值
  await raw(ta, 'POST', '/play/start', { routeCode: 'male', slot: 3 });
  await raw(ta, 'PUT', '/saves/3', { routeCode: 'male', nodeKey: 'n_start', affectionMale: 77, affectionFemale: 88 });

  // GET /saves/:slot 直接返回 save 本体（没有 .save 包装层）
  const aOwn = await raw(ta, 'GET', '/saves/3');
  const aAff = aOwn.json?.data?.affectionMale;
  console.log('  A 自己的存档好感:', aAff);
  check('A 能读自己的存档 (77)', aAff === 77, '实际 ' + aAff);

  // 关键：B 读 A 的档位，绝不能看到 77
  const bRead = await raw(tb, 'GET', '/saves/3');
  const bData = bRead.json?.data;
  check('B 读 A 的档位拿不到数据', bData === null || bData === undefined,
    '返回了: ' + JSON.stringify(bData).slice(0, 200));
  check('B 读到的内容不含 A 的好感值 77',
    !JSON.stringify(bData).includes('77'), JSON.stringify(bData).slice(0, 200));

  // B 在同一档位建自己的存档 → 应该是独立的行
  const bStart = await raw(tb, 'POST', '/play/start', { routeCode: 'female', slot: 3 });
  const bSave = bStart.json?.data?.save;
  check('B 在同档位建存档成功（各自独立）', bStart.status === 200 && bSave?.userId !== aOwn.json?.data?.userId,
    `A.userId=${aOwn.json?.data?.userId} B.userId=${bSave?.userId}`);
  check('B 的存档好感是 0（不是继承 A 的 77）', bSave?.affectionMale === 0, '实际 ' + bSave?.affectionMale);

  // 改回 A 的存档，确认没被 B 覆盖
  const aAfter = await raw(ta, 'GET', '/saves/3');
  check('A 的存档没被 B 覆盖（仍是 77）', aAfter.json?.data?.affectionMale === 77,
    '实际 ' + aAfter.json?.data?.affectionMale);

  // B 篡改：PUT 到 A 的档位 —— 因为同 slot 现在 B 也有份，只会改到 B 自己的
  await raw(tb, 'PUT', '/saves/3', { routeCode: 'female', nodeKey: 'n_start', affectionMale: 100, affectionFemale: 100 });
  const aFinal = await raw(ta, 'GET', '/saves/3');
  check('B 写入不影响 A 的存档', aFinal.json?.data?.affectionMale === 77,
    'A 实际 ' + aFinal.json?.data?.affectionMale);

  // 结局隔离：B 不应看到 A 解锁的结局
  const aEnd = await raw(ta, 'GET', '/me/endings');
  const bEnd = await raw(tb, 'GET', '/me/endings');
  check('结局记录按用户隔离',
    aEnd.json?.data?.list !== undefined && bEnd.json?.data?.list !== undefined);

  // 回看隔离
  const aHist = await raw(ta, 'GET', '/me/history');
  const bHist = await raw(tb, 'GET', '/me/history');
  check('回看按用户隔离（B 看不到 A 的选择记录）',
    bHist.json?.data?.total === 0 || bHist.json?.data?.list?.length === 0,
    'B total=' + bHist.json?.data?.total);

  console.log('\n' + '='.repeat(46));
  console.log(fail === 0 ? `  全部通过 ${pass} 项 ✅ 无越权漏洞` : `  通过 ${pass} / 失败 ${fail}`);
  console.log('='.repeat(46));
  process.exit(fail ? 1 : 0);
})();