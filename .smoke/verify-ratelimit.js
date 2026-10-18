/**
 * 限流验证：临时用极低的阈值起一个后端实例，验证三层限流真的生效。
 *   node verify-ratelimit.js
 *
 * 用独立端口 + 独立进程，不影响正在跑的开发服务器（3000）。
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3999;
let BASE = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

async function call(method, p, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + p, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  let j = null;
  try { j = await res.json(); } catch (_) {}
  return {
    status: res.status,
    json: j,
    retryAfter: res.headers.get('Retry-After'),
    limit: res.headers.get('RateLimit-Limit'),
    remaining: res.headers.get('RateLimit-Remaining')
  };
}

function startServer(env, port) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'src', 'server.js')], {
      env: { ...process.env, ...env, PORT: String(port), NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let settled = false;
    const onData = (d) => {
      // 关键：即使已经启动完成也必须继续消费 stdout，
      // 否则子进程的管道缓冲写满后会自己阻塞住（表现为测试卡死）。
      if (settled) return;
      out += d.toString();
      if (out.includes('已启动')) {
        settled = true;
        resolve(p);
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('exit', (c) => { if (!settled) reject(new Error('服务退出 code=' + c + '\n' + out)); });
    setTimeout(() => { if (!settled) reject(new Error('启动超时\n' + out)); }, 20000);
  });
}

(async () => {
  console.log('\n=== 限流验证（独立实例 :' + PORT + '）===\n');

  // 阈值调得很低，方便快速打满
  const proc = await startServer({
    RATE_LIMIT_ENABLED: 'true',
    RATE_LIMIT_MAX: '20',            // 全局 20 次/分钟
    RATE_LIMIT_WRITE_MAX: '5',       // 写操作 5 次/分钟
    RATE_LIMIT_AUTH_MAX: '3'         // 登录注册 3 次/15分钟
  }, PORT);
  console.log('  测试实例已启动\n');

  try {
    // ---------- 1. 健康检查应汇报限流已开启 ----------
    const h = await call('GET', '/api/health');
    check('健康检查走通（未被限流挡住）', h.status === 200, '实际 ' + h.status);
    check('健康检查汇报 rateLimit.enabled = true', h.json?.data?.rateLimit?.enabled === true,
      JSON.stringify(h.json?.data?.rateLimit));
    check('健康检查带出三层阈值',
      Boolean(h.json?.data?.rateLimit?.global && h.json?.data?.rateLimit?.write && h.json?.data?.rateLimit?.auth),
      JSON.stringify(h.json?.data?.rateLimit));
    console.log('  配置:', JSON.stringify(h.json?.data?.rateLimit));
    console.log('');

    // ---------- 2. 健康检查连打不触发限流 ----------
    let healthOk = 0;
    for (let i = 0; i < 30; i++) {
      const r = await call('GET', '/api/health');
      if (r.status === 200) healthOk++;
    }
    check('健康检查连打 30 次全部 200（不受全局限流影响）', healthOk === 30, '实际通过 ' + healthOk + '/30');

    // ---------- 3. auth 限流 ----------
    const authResults = [];
    for (let i = 0; i < 6; i++) {
      authResults.push(await call('POST', '/api/auth/login', { username: 'nobody_' + i, password: 'x12345678' }));
    }
    const got429 = authResults.filter((r) => r.status === 429);
    check('登录连打 6 次后被限流 (429)', got429.length > 0,
      '状态码: ' + authResults.map((r) => r.status).join(','));
    const first429 = authResults.find((r) => r.status === 429);
    check('429 返回统一错误体 code=40001', first429?.json?.code === 40001,
      JSON.stringify(first429?.json).slice(0, 120));
    check('429 带 Retry-After 头', Boolean(first429?.retryAfter), '值=' + first429?.retryAfter);
    check('429 带标准限流响应头 RateLimit-Limit', Boolean(first429?.limit), '值=' + first429?.limit);
    console.log('  登录状态码序列:', authResults.map((r) => r.status).join(', '));
    console.log('');

    // ---------- 4. 全局限流 ----------
    // auth 已把连接计数用掉一部分，换个新实例单独测全局
    const PORT2 = 3998;
    BASE = `http://127.0.0.1:${PORT2}`;
    const proc2 = await startServer({
      RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_MAX: '15',
      RATE_LIMIT_WRITE_MAX: '1000',
      RATE_LIMIT_AUTH_MAX: '1000'
    }, PORT2);
    try {
      // 用合法的 story 只读接口打全局（不需要 token）
      const codes = [];
      for (let i = 0; i < 25; i++) {
        codes.push((await call('GET', '/api/story/routes')).status);
      }
      const g429 = codes.filter((c) => c === 429).length;
      const g200 = codes.filter((c) => c === 200).length;
      check('全局限流在 15 次后生效', g429 > 0, `200=${g200} 429=${g429}`);
      check('有请求成功通过（限流不是从一开始就拦）', g200 > 0, '200 数量=' + g200);
      console.log('  全局状态码序列:', codes.join(', '));

      // 限流后仍返回标准头
      const last = await call('GET', '/api/story/routes');
      check('限流命中时返回 429', last.status === 429, '实际 ' + last.status);
    } finally {
      proc2.kill();
    }
    console.log('');

    // ---------- 5. 限流关闭时完全不影响 ----------
    const PORT3 = 3997;
    BASE = `http://127.0.0.1:${PORT3}`;
    const proc3 = await startServer({
      RATE_LIMIT_ENABLED: 'false',
      RATE_LIMIT_MAX: '1',          // 极端阈值也不该生效
      RATE_LIMIT_AUTH_MAX: '1'
    }, PORT3);
    try {
      let okCount = 0;
      for (let i = 0; i < 12; i++) {
        if ((await call('GET', '/api/story/routes')).status === 200) okCount++;
      }
      check('RATE_LIMIT_ENABLED=false 时完全不拦（12/12 通过）', okCount === 12, '实际 ' + okCount + '/12');
      const h3 = await call('GET', '/api/health');
      check('健康检查汇报 enabled = false', h3.json?.data?.rateLimit?.enabled === false,
        JSON.stringify(h3.json?.data?.rateLimit));
    } finally {
      proc3.kill();
    }
    console.log('');

    // ---------- 6. 生产环境阈值校验 ----------
    // 生产模式会先校验 JWT_SECRET / DB_PASSWORD，
    // 所以这里必须把它们给成合法值，否则报的是另一个错。
    // 同理 .env 里写着 NODE_ENV=development，dotenv 会覆盖子进程传入的值，
    // 所以凡是测生产行为，都必须显式带上 RATE_LIMIT_ENABLED 一起钉死。
    const bad = spawn(process.execPath, ['-e',
      'try { require(' + JSON.stringify(path.join(__dirname, '..', 'server', 'src', 'config', 'index.js')) +
      '); console.log("NO_ERROR"); } catch (e) { console.log("THREW:" + e.message); }'
    ], {
      env: {
        NODE_ENV: 'production',
        RATE_LIMIT_ENABLED: 'true',
        JWT_SECRET: 'x'.repeat(48),
        DB_PASSWORD: 'whatever',
        RATE_LIMIT_MAX: '0',
        RATE_LIMIT_AUTH_MAX: '10',
        PATH: process.env.PATH
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let badOut = '';
    const collect = (d) => { badOut += d.toString(); };
    bad.stdout.on('data', collect);
    bad.stderr.on('data', collect);
    await new Promise((r) => bad.on('close', r));
    check('生产环境 RATE_LIMIT_MAX=0 会被配置校验拦下',
      badOut.includes('必须为正整数'), badOut.trim().slice(0, 200));

    // 反证：合法阈值时配置能正常加载。
    // 必须显式给 RATE_LIMIT_ENABLED —— .env 里写着 NODE_ENV=development，
    // dotenv 会覆盖子进程传进去的 NODE_ENV，所以要连它一起钉死。
    const good = spawn(process.execPath, ['-e',
      'const c = require(' + JSON.stringify(path.join(__dirname, '..', 'server', 'src', 'config', 'index.js')) +
      '); console.log("OK:" + JSON.stringify(c.rateLimit.enabled));'
    ], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        RATE_LIMIT_ENABLED: 'true',
        JWT_SECRET: 'x'.repeat(48),
        DB_PASSWORD: 'whatever',
        RATE_LIMIT_MAX: '300'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let goodOut = '';
    const collect2 = (d) => { goodOut += d.toString(); };
    good.stdout.on('data', collect2);
    good.stderr.on('data', collect2);
    await new Promise((r) => good.on('close', r));
    check('生产环境合法阈值时正常加载，限流开启',
      goodOut.includes('OK:true'), goodOut.trim().slice(0, 200));

    // 生产环境 + 未显式关闭 → 应自动开启（防止上线忘配）
    const auto = spawn(process.execPath, ['-e',
      'const c = require(' + JSON.stringify(path.join(__dirname, '..', 'server', 'src', 'config', 'index.js')) +
      '); console.log("AUTO:" + JSON.stringify(c.rateLimit.enabled));'
    ], {
      env: {
        NODE_ENV: 'production',
        RATE_LIMIT_ENABLED: '',
        JWT_SECRET: 'x'.repeat(48),
        DB_PASSWORD: 'whatever',
        PATH: process.env.PATH
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let autoOut = '';
    const collect3 = (d) => { autoOut += d.toString(); };
    auto.stdout.on('data', collect3);
    auto.stderr.on('data', collect3);
    await new Promise((r) => auto.on('close', r));
    check('生产环境未显式配置时限流自动开启',
      autoOut.includes('AUTO:true'), autoOut.trim().slice(0, 200));

  } finally {
    proc.kill();
  }

  console.log('\n' + '='.repeat(48));
  console.log(fail === 0 ? `  全部通过 ${pass} 项 🎉` : `  通过 ${pass} / 失败 ${fail}`);
  console.log('='.repeat(48));
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\n💥 异常:', e.message);
  process.exit(1);
});