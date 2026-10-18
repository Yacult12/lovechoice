/**
 * 定位 api-audit 里 fetch failed 的具体位置
 *   node probe.js
 */
const API = 'http://127.0.0.1:3000/api';
let token = '';

async function call(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token && !opts.noAuth) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

const U = 'probe_' + Date.now().toString(36);

(async () => {
  const reg = await call('POST', '/auth/register', { username: U, password: 'probe123456' });
  token = reg.json?.data?.token || '';
  console.log('注册:', reg.status);

  const steps = [
    ['GET', '/me/stats'],
    ['GET', '/me/history'],
    ['GET', '/me/endings'],
    ['GET', '/saves'],
    ['GET', '/saves/5'],
    ['GET', '/saves/99'],
    ['GET', '/play/state?routeCode=male&slot=5'],
    ['POST', '/play/tick', { routeCode: 'male', slot: 5, seconds: 30 }],
    ['POST', '/play/settle', { routeCode: 'male', slot: 5 }],
    ['GET', '/story/endings'],
    ['GET', '/meta'],
    ['PUT', '/saves/6', { affectionMale: 30, affectionFemale: 40 }],
    ['DELETE', '/saves/6'],
  ];

  for (const [m, p, b] of steps) {
    try {
      const r = await call(m, p, b);
      const shape = r.json?.data ? Object.keys(r.json.data) : (r.json ? Object.keys(r.json) : null);
      console.log(`  ${m.padEnd(6)} ${p.padEnd(34)} → ${r.status}  data=${JSON.stringify(shape)}`);
    } catch (e) {
      console.log(`  ${m.padEnd(6)} ${p.padEnd(34)} → 💥 ${e.message}  ${e.cause?.message || ''}`);
    }
  }
})();