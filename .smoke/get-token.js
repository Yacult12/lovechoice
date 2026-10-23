/**
 * 拿一个可用的登录 token
 *   node get-token.js
 *
 * 之前的脚本靠 %TEMP%\lc-token.txt 里那份旧 token，
 * 一旦后端重启（换 JWT 密钥）就 401，测试全挂。
 * 这里直接用测试账号登录现拿。
 */
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://121.40.54.103:8080';
const OUT = path.join(process.env.TEMP || '.', 'lc-token.txt');

const USER = process.env.LC_USER || 'tester01';
const PASS = process.env.LC_PASS || 'Test123456';

(async () => {
  let res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS })
  });

  if (!res.ok) {
    // 账号不存在就注册一个
    res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: USER, password: PASS, nickname: '测试员' })
    });
  }

  const j = await res.json();
  const token = j.data && j.data.token;
  if (!token) {
    console.error('登录/注册失败：', JSON.stringify(j).slice(0, 300));
    process.exit(1);
  }

  fs.writeFileSync(OUT, token, 'utf8');
  console.log('token 已写入 ' + OUT);
  console.log('用户：' + USER);
})();
