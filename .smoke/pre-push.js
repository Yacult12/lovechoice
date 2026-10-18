/*
 * ============================================================
 *   推送到 GitHub 前的准备与检查
 *
 *   node pre-push.js
 *
 *   在真正推送前把能查的问题都查掉 ——
 *   推送之后 CI 才报错，排查成本高得多。
 * ============================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('c:/Users/何树吉/Desktop/love');

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

console.log('\n=== 推送前检查 ===\n');

// ---------- 1. 密钥安全（最重要） ----------
console.log('[1] 密钥安全');
const gitignore = read('.gitignore');

// 递归扫描仓库里所有文件，找出敏感内容
const suspicious = [];
const SENSITIVE_PATTERNS = [
  { re: /JWT_SECRET\s*=\s*(?!please-change|your-|<|\$\{|ci-only|dev-only)[A-Za-z0-9_\-]{20,}/, why: '疑似真实 JWT 密钥' },
  { re: /DB_PASSWORD\s*=\s*(?!123456|\$\{|your-|<|password|whatever)[^\s#]{8,}/, why: '疑似真实数据库密码' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: '私钥文件' },
  { re: /AKIA[0-9A-Z]{16}/, why: 'AWS Access Key' },
  { re: /ghp_[A-Za-z0-9]{36}/, why: 'GitHub Personal Access Token' }
];

function walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    const r = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) { walk(full, r); continue; }
    if (!/\.(js|json|md|yml|yaml|env|sql|bat|txt|html|css)$/.test(entry.name)) continue;

    // 只扫「会进版本库」的文件。
    // .env / .env.docker 之类本来就被 gitignore 排除，
    // 扫它们只会误报—— 密钥存在那里是正常的，被提交才是问题。
    const ignored = r === '.env' || /\.env$/.test(r) ||
                    /\.env\.local$/.test(r) || /\.env\.production$/.test(r);
    if (ignored) continue;

    let content;
    try { content = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
    for (const { re, why } of SENSITIVE_PATTERNS) {
      if (re.test(content)) suspicious.push({ file: r, why });
    }
  }
}
walk(ROOT);

check('待提交文件中无真实密钥', suspicious.length === 0,
  suspicious.map((s) => s.file + ' → ' + s.why).join('\n      '));
check('.env 在 .gitignore 中', /^\.env$/m.test(gitignore));
check('.env.docker.example 在白名单', /!\.env\.docker\.example/.test(gitignore));

// 真正要紧的：提交历史里绝不能有 .env
// 直接读 .git 里已跟踪的文件清单
const gitDir = path.join(ROOT, '.git');
let trackedWithEnv = [];
if (fs.existsSync(gitDir)) {
  const idx = path.join(gitDir, 'index');
  if (fs.existsSync(idx)) {
    // 索引是二进制，用文本方式粗略提取路径（.env 文件名是明文的）
    const raw = fs.readFileSync(idx, 'latin1');
    const envPaths = raw.match(/[\w./-]*\.env[\w./-]*/g) || [];
    trackedWithEnv = [...new Set(envPaths)].filter((p) => /\/\.env$|\/\.env\.local$/.test('/' + p));
  }
}
check('版本库中不含 .env 文件', trackedWithEnv.length === 0,
  trackedWithEnv.join(', ') + ' ← 密钥曾被提交，必须从历史中清除');

// ---------- 2. 仓库卫生 ----------
console.log('\n[2] 仓库卫生');
check('.gitattributes 存在（换行符统一）', exists('.gitattributes'));
check('.gitignore 存在', exists('.gitignore'));
soft('.github/workflows/ci.yml 存在', exists('.github/workflows/ci.yml'));

const wt = read('DEPLOY.md');
soft('DEPLOY.md 记录了敏感项', /JWT_SECRET/.test(wt));

// ---------- 3. README 完整性 ----------
console.log('\n[3] 文档');
const readme = read('README.md');
soft('README 有安装说明', /npm install|npm ci/.test(readme));
soft('README 有启动说明', /npm run dev|npm start/.test(readme));
soft('README 提及测试', /test|测试/.test(readme));

// ---------- 4. 远程仓库配置 ----------
console.log('\n[4] 远程仓库');
const remoteFile = path.join(ROOT, '.git', 'config');
const cfg = fs.readFileSync(remoteFile, 'utf8');
const urlMatch = cfg.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(\S+)/);
const url = urlMatch ? urlMatch[1] : '';

console.log('    当前 origin: ' + (url || '(未配置)'));

const isPlaceholder = !url || /yourname|your-name|example\.com|username/i.test(url);
if (isPlaceholder) {
  soft('origin 仍是占位地址，需改成真实仓库', false,
    '推送前请执行：\n      git remote set-url origin https://github.com/<你的用户名>/lovechoice.git');
} else {
  check('origin 指向真实 GitHub 仓库',
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/.test(url), url);
  check('仓库名与项目一致', /love/i.test(url), url);
  // 分支名不能靠读 .git/refs 下的文件判断 ——
  // 提交过一次后 refs 会变成 packed-refs 单文件，目录反而是空的。
  // 这里改读 .git/HEAD 指向哪个 ref，最可靠。
  const headTxt = exists('.git/HEAD') ? read('.git/HEAD').trim() : '';
  const branch = headTxt.replace(/^ref: refs\/heads\//, '');
  check('当前分支为 main', branch === 'main', '实际分支: ' + branch);
}

// ---------- 5. 待提交内容 ----------
console.log('\n[5] 待提交内容');
const headRef = fs.existsSync(path.join(ROOT, '.git', 'HEAD'))
  ? fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim()
  : '';
soft('HEAD 指向分支而非游离提交', headRef.startsWith('ref:'), headRef);

console.log('');
console.log('    提交历史：');
// 读 .git/refs/heads/main
const mainRef = path.join(ROOT, '.git', 'refs', 'heads', 'main');
if (fs.existsSync(mainRef)) {
  const sha = fs.readFileSync(mainRef, 'utf8').trim();
  console.log('      ' + sha.slice(0, 8));
}

console.log('');
console.log('='.repeat(54));
console.log(`  通过 ${pass} · 警告 ${warn} · 失败 ${fail}`);
console.log('='.repeat(54));

if (fail > 0) {
  console.log('\n  ❌ 有必须修复的问题，不要推送。\n');
} else if (isPlaceholder) {
  console.log('\n  ⚠️  准备工作已完成，只差配置真实远程地址：\n');
  console.log('      git remote set-url origin https://github.com/Yacult12/lovechoice.git\n');
  console.log('      然后在 GitHub 上创建空仓库（不要勾选 README/.gitignore），再执行：\n');
  console.log('      git push -u origin main\n');
} else {
  console.log('\n  ✅ 可以推送：git push -u origin main\n');
}

process.exit(fail ? 1 : 0);