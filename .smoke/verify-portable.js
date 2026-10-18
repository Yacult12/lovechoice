/**
 * 验证脚本不再依赖本机绝对路径（CI 跑在 Linux 上）
 *   node verify-portable.js
 *
 * 起因：GitHub Actions 第一次跑就因为这个挂了——
 *   path: '/home/runner/work/lovechoice/lovechoice/c:/Users/何树吉/Desktop/love/docker-compose.yml'
 * 说明硬编码的 Windows 绝对路径在别的系统上完全失效。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('\n=== 跨平台可移植性校验 ===\n');

// ---------- 1. 根目录能正确定位 ----------
console.log('[1] 根目录定位');
check('ROOT 能定位到含 docker-compose.yml 的目录',
  fs.existsSync(path.join(ROOT, 'docker-compose.yml')),
  'ROOT = ' + ROOT);
check('ROOT 能定位到 package.json',
  fs.existsSync(path.join(ROOT, 'server', 'package.json')));
check('ROOT 由 __dirname 推导（而非硬编码）',
  ROOT === path.resolve(__dirname, '..'));

// ---------- 2. 所有脚本不得含本机绝对路径 ----------
console.log('\n[2] 硬编码路径扫描');
const dirs = ['.smoke', 'server/scripts', 'server/src', 'client/assets/js'];
const patterns = [
  /[A-Za-z]:[\\/]Users[\\/]/,   // C:\Users\ 或 C:/Users/
  /[A-Za-z]:[\\/]Program Files/,
  /\/home\/[a-z]+\//,
  /Users[\\/]何树吉/
];

let scanned = 0;
const offenders = [];
for (const d of dirs) {
  const full = path.join(ROOT, d);
  if (!fs.existsSync(full)) continue;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      // 依赖目录不是我们的代码，跳过
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        walk(p);
        continue;
      }
      if (!e.name.endsWith('.js')) continue;
      // 本文件自己就包含用于检测的正则字面量，跳过自检
      if (e.name === path.basename(__filename)) continue;
      scanned++;
      const src = fs.readFileSync(p, 'utf8');
      // 只看代码行，注释里出现的示例路径不算
      const codeOnly = src
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n');
      if (patterns.some((re) => re.test(codeOnly))) {
        offenders.push(path.relative(ROOT, p));
      }
    }
  };
  walk(full);
}
check(`扫描 ${scanned} 个 JS 文件，无硬编码本机路径`,
  offenders.length === 0, '违规: ' + offenders.join(', '));

// ---------- 3. 关键文件能在 ROOT 下找到 ----------
console.log('\n[3] 关键文件可定位');
const mustFind = [
  'docker-compose.yml',
  '.github/workflows/ci.yml',
  'server/Dockerfile',
  'server/sql/schema.sql',
  'client/docker/nginx.conf',
  'client/docker/config.js',
  'client/index.html',
  'server/src/app.js',
  'client/assets/js/api.js'
];
mustFind.forEach((f) => {
  check('可定位 ' + f, fs.existsSync(path.join(ROOT, f)));
});

// ---------- 4. 验证器自身能跑 ----------
console.log('\n[4] 验证器自检');
['.smoke/verify-docker.js', '.smoke/verify-ci.js'].forEach((f) => {
  const p = path.join(ROOT, f);
  const src = fs.readFileSync(p, 'utf8');
  check(f + ' 用 __dirname 推导 ROOT',
    /path\.resolve\(__dirname,\s*'\.\.'\)/.test(src),
    '仍写死绝对路径');
});

// ---------- 5. 依赖可解析 ----------
console.log('\n[5] 依赖声明');
const smokePkg = JSON.parse(fs.readFileSync(path.join(ROOT, '.smoke/package.json'), 'utf8'));
check('.smoke 声明了 playwright（结局卡测试需要）',
  !!smokePkg.dependencies.playwright);
check('.smoke 声明了 mysql2（数据库脚本需要）',
  !!smokePkg.dependencies.mysql2,
  'CI 装依赖后会缺 mysql2');
check('.smoke 有 package-lock.json',
  fs.existsSync(path.join(ROOT, '.smoke/package-lock.json')));

const serverPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/package.json'), 'utf8'));
check('server 声明了 mysql2', !!serverPkg.dependencies.mysql2);

console.log('\n' + '='.repeat(50));
console.log(fail === 0
  ? `  全部通过 ${pass} 项 ✅ 可在 CI 环境运行`
  : `  通过 ${pass} / 失败 ${fail}`);
console.log('='.repeat(50));
process.exit(fail ? 1 : 0);