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
  const U = 'shape_' + Date.now().toString(36);
  const t = (await raw('', 'POST', '/auth/register', { username: U, password: 'shape123456' })).json?.data?.token;

  await raw(t, 'POST', '/play/start', { routeCode: 'male', slot: 4 });
  const put = await raw(t, 'PUT', '/saves/4', { routeCode: 'male', nodeKey: 'n_start', affectionMale: 77, affectionFemale: 88 });
  console.log('PUT /saves/4 →', put.status);
  console.log('PUT 返回:', JSON.stringify(put.json).slice(0, 300));
  console.log('');

  const g = await raw(t, 'GET', '/saves/4');
  console.log('GET /saves/4 →', g.status);
  console.log('完整响应:', JSON.stringify(g.json, null, 2).slice(0, 700));
})();