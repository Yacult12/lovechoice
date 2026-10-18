/**
 * 越权测试复检：确保真的用 B 的 token
 *   node authz-check.js
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

(async () => {
  const A = 'authzA_' + Date.now().toString(36);
  const B = 'authzB_' + Date.now().toString(36);

  const ra = await raw('', 'POST', '/auth/register', { username: A, password: 'authz123456' });
  const rb = await raw('', 'POST', '/auth/register', { username: B, password: 'authz123456' });

  const ta = ra.json?.data?.token;
  const tb = rb.json?.data?.token;
  console.log('A token:', ta ? ta.slice(0, 24) + '…' : '(空)');
  console.log('B token:', tb ? tb.slice(0, 24) + '…' : '(空)');
  console.log('两个 token 不同:', ta !== tb);
  console.log('');

  // A 在档位 5 建存档
  const sa = await raw(ta, 'POST', '/play/start', { routeCode: 'male', slot: 5 });
  console.log('A 建档:', sa.status);

  // B 读 A 的档位
  const cross = await raw(tb, 'GET', '/saves/5');
  console.log('B 读 /saves/5 (A的存档) →', cross.status,
    cross.status === 404 ? '✅ 正确拒绝' : '❌ 越权！返回 ' + JSON.stringify(cross.json).slice(0, 150));

  // B 用 A 占用的档位开另一条线
  const conflict = await raw(tb, 'POST', '/play/start', { routeCode: 'female', slot: 5 });
  console.log('B 用档位5开female线 →', conflict.status,
    conflict.status === 409 ? '✅ 路线冲突' : conflict.status === 404 ? '✅ 无存档' : '❌ ' + JSON.stringify(conflict.json).slice(0, 150));

  // B 读 A 的回看
  const hist = await raw(tb, 'GET', '/me/history');
  console.log('B 读自己的回看 →', hist.status,
    JSON.stringify(hist.json?.data?.total) + ' 条（B 应为 0 或只有自己的）');

  // B 篡改 A 的存档
  const tamper = await raw(tb, 'PUT', '/saves/5', {
    routeCode: 'male', nodeKey: 'n_start', affectionMale: 100, affectionFemale: 100
  });
  console.log('B 改 A 的存档 →', tamper.status,
    tamper.status === 404 || tamper.status === 422 ? '✅ 被拒' : '❌ 越权写入！');
})();