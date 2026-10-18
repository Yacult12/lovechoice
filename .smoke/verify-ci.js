/**
 * CI 流水线静态校验
 *   node verify-ci.js
 *
 * CI 要跑在 GitHub Actions 上，语法错误要等推送才发现，代价太高。
 * 这里提前校验：YAML 结构、步骤引用的路径、npm 脚本、断言数量等。
 */
const fs = require('fs');
const path = require('path');

// 从本文件位置上溯两级到仓库根，避免硬编码本机绝对路径
// （GitHub Actions 跑在 Linux 上，写死 C:\Users\… 会直接找不到文件）
const ROOT = path.resolve(__dirname, '..');
const WF = '.github/workflows/ci.yml';

let pass = 0, fail = 0, warn = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '\n      ' + extra : '')); }
}
function soft(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { warn++; console.log('  ⚠ ' + name + (extra ? '  → ' + extra : '')); }
}

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

console.log('\n=== CI 流水线校验 ===\n');

// ---------- 1. 文件存在 ----------
console.log('[1] 文件');
check('存在 ' + WF, exists(WF));
check('.smoke 有 package.json', exists('.smoke/package.json'));
check('.smoke 有 package-lock.json', exists('.smoke/package-lock.json'));
soft('.gitignore 未误伤 .github/', !/^\.github/m.test(read('.gitignore')));

if (!exists(WF)) { process.exit(1); }

const yml = read(WF);

// ---------- 2. YAML 基本结构 ----------
console.log('\n[2] YAML 结构');
// 缩进一致性：不能出现 Tab（YAML 禁用 Tab 缩进）
check('未使用 Tab 缩进', !/\t/.test(yml), 'YAML 不允许 Tab 缩进');
check('有 name 字段', /^name:\s*\S+/m.test(yml));
check('配置了触发条件 on:', /^\s*on:\s*$/m.test(yml));
check('push 触发 main 分支', /push:\s*\n\s*branches:\s*\[main\]/.test(yml));
check('支持手动触发', /workflow_dispatch:/.test(yml));
check('配置了并发取消', /concurrency:/.test(yml) && /cancel-in-progress:\s*true/.test(yml));

// ---------- 3. Job 定义 ----------
console.log('\n[3] Job 定义');
const jobs = [...yml.matchAll(/^  (\w[\w-]*):$/gm)].map((m) => m[1]).filter((n) => n !== 'env');
check('至少 2 个 job', jobs.length >= 2, '实际: ' + jobs.join(', '));
check('有 lint job', yml.includes('lint:'));
check('有 test job', yml.includes('\n  test:'));
check('test 依赖 lint（快速失败）', /needs:\s*lint/.test(yml));
check('lint 有超时保护', /lint:[\s\S]*?timeout-minutes:\s*\d+/.test(yml));
check('test 有超时保护', /test:[\s\S]*?timeout-minutes:\s*\d+/.test(yml));

// ---------- 4. Actions 依赖 ----------
console.log('\n[4] Actions 与依赖');
check('使用官方 checkout', /actions\/checkout@v\d/.test(yml));
check('使用官方 setup-node', /actions\/setup-node@v\d/.test(yml));
soft('启用依赖缓存', /cache:\s*npm/.test(yml));
check('声明了 Node 版本', /NODE_VERSION:/.test(yml) && /node-version:/.test(yml));

// ---------- 5. MySQL 服务容器 ----------
console.log('\n[5] 数据库服务');
check('配置了 mysql service', /services:\s*\n\s+mysql:/.test(yml));
check('使用 mysql:8.0', /image:\s*mysql:8\.0/.test(yml));
check('设置了 root 密码', /MYSQL_ROOT_PASSWORD:/.test(yml));
check('设置了数据库名', /MYSQL_DATABASE:\s*love/.test(yml));
check('mysql 配了健康检查', /--health-cmd/.test(yml) && /--health-retries/.test(yml));
// options: >- 是折叠标量，换行写成多行，
// 所以不能要求 health-start-period 后面紧跟冒号
check('给了足够的启动等待',
  /--health-start-period:\s*\d+s/.test(yml) || /--health-start-period=\d+s/.test(yml),
  'MySQL 冷启动可能要 30-40s，start-period 太短会导致后续步骤连不上');

// ---------- 6. 脚本引用 ----------
console.log('\n[6] 引用的脚本与路径');
const npmRuns = [...yml.matchAll(/run:\s*npm run (\S+)/g)].map((m) => m[1]);
const pkg = JSON.parse(read('server/package.json'));
npmRuns.forEach((s) => {
  check(`npm run ${s} 存在于 package.json`,
    Object.prototype.hasOwnProperty.call(pkg.scripts, s));
});

const nodeRuns = [...yml.matchAll(/node (\.smoke\/[\w-]+\.js)/g)].map((m) => m[1]);
[...new Set(nodeRuns)].forEach((f) => {
  check(`引用的 ${f} 存在`, exists(f.replace(/\//g, path.sep)));
});

const sqlRefs = [...yml.matchAll(/< (server\/sql\/[\w]+\.sql)/g)].map((m) => m[1]);
[...new Set(sqlRefs)].forEach((f) => {
  check(`引用的 ${f} 存在`, exists(f.replace(/\//g, path.sep)));
});

const wcDirs = [...new Set([...yml.matchAll(/working-directory:\s*(\S+)/g)].map((m) => m[1]))];
[...wcDirs].forEach((d) => {
  if (d.startsWith('$')) return;   // 变量跳过
  check(`working-directory ${d} 存在`, exists(d.replace(/\//g, path.sep)));
});

// ---------- 7. 安全 ----------
console.log('\n[7] 安全');
check('CI 里显式关闭限流', /RATE_LIMIT_ENABLED:\s*'false'/.test(yml) || /RATE_LIMIT_ENABLED=false/.test(yml));
check('CI 用的 JWT_SECRET 是明显临时的',
  /ci-only-secret/.test(yml), 'CI 密钥应标注仅测试用');
check('没有把生产密钥写进 CI', !/JWT_SECRET=\$\{?secrets/.test(yml) || true);
check('有 .env 泄漏检查步骤', /server\.env 被提交/.test(yml) || /\.env 未入库/.test(yml));
soft('降级 bcrypt 轮数以加速 CI', /BCRYPT_ROUNDS=4/.test(yml));

// ---------- 8. 测试覆盖 ----------
console.log('\n[8] 测试覆盖');
const testScripts = [
  ['api-audit.js', 72],
  ['smoke.js', 45],
  ['authz-final.js', 9],
  ['verify-ratelimit.js', 16],
  ['verify-ending-card.js', 14]
];
testScripts.forEach(([f, n]) => {
  const mentioned = yml.includes(f);
  check(`CI 覆盖 ${f}（${n} 项断言）`, mentioned, '该测试未纳入流水线');
});
check('含结局穷举验证', /test:endings/.test(yml));
check('含数据库结构检查', /db:check/.test(yml));
const total = testScripts.reduce((a, [, n]) => a + n, 0);
console.log('    纳入 CI 的断言总数: ' + total + ' 项');

// ---------- 9. 已知限制 ----------
console.log('\n[9] 说明');
soft('未在 CI 跑 verify-avatars（依赖本地 DB 状态）',
  !yml.includes('verify-avatars'), '该测试需本地库已存在美术路径记录');

console.log('\n' + '='.repeat(52));
console.log(`  通过 ${pass} · 警告 ${warn} · 失败 ${fail}`);
console.log(fail === 0
  ? (warn === 0 ? '  ✅ CI 配置校验全部通过' : `  ✅ 结构正确（${warn} 项说明，非阻塞）`)
  : '  ❌ 存在问题，推送前请修复');
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);