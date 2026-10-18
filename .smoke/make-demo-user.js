/**
 * 创建一个体验账号，返回用户名密码
 *   node make-demo-user.js
 */
const BASE = 'http://127.0.0.1:3000/api';

(async () => {
  const uname = 'player' + Date.now().toString(36).slice(-6);
  const pwd = 'play123456';

  const res = await fetch(BASE + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uname, password: pwd, nickname: '体验者' })
  });
  const j = await res.json();

  console.log('用户名:', uname);
  console.log('密码  :', pwd);
  console.log('状态  :', res.status, j.message || '');
})();