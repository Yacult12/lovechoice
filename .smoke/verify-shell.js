/**
 * 验证 CI 里 shell 命令的 find 语义
 *   node verify-shell.js
 *
 * 起因：BOM 检查那步在 CI 上失败——
 *   head: error reading './server/node_modules/ipaddr.js': Is a directory
 *   ./server/node_modules/express-rate-limit/license.md 含 UTF-8 BOM
 * 原因是 find 表达式写错：
 *   -path ./node_modules -prune  只排除了根目录的 node_modules，
 *   但依赖实际在 server/node_modules 和 .smoke/node_modules 下；
 *   且 -o 优先级导致缺 -type f，目录被当成文件读。
 *
 * 这里在 Node 里实现 find 的等价遍历，复现同一套语义来验证。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'ms-playwright']);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

/** 等价于 find . -type d -name node_modules -prune -o -type f <ext> -print */
function findFiles(roots, exts, pruneDirs = new Set(['node_modules', '.git'])) {
  const out = [];
  const walk = (p) => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
      if (pruneDirs.has(path.basename(p))) return;   // prune
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    } else {
      if (exts.some((x) => p.endsWith(x))) out.push(p);   // -type f
    }
  };
  roots.forEach((r) => walk(path.join(ROOT, r)));
  return out;
}

console.log('\n=== CI shell 语义校验 ===\n');

// ---------- 1. BOM 检查步骤 ----------
console.log('[1] BOM 检查 find 表达式');
const bomTargets = findFiles(['.'], ['.js', '.json', '.md', '.yml', '.sql']);
check('找到了待检查文件', bomTargets.length > 0, '结果为空，等于没检查');

const inNodeModules = bomTargets.filter((f) => f.includes('node_modules'));
check('排除了所有层级的 node_modules',
  inNodeModules.length === 0,
  '仍命中: ' + inNodeModules.slice(0, 3).join(', '));

const dirsIncluded = bomTargets.filter((f) => {
  try { return fs.statSync(path.join(ROOT, f)).isDirectory(); } catch { return false; }
});
check('只匹配文件、不匹配目录（-type f）',
  dirsIncluded.length === 0,
  '混进了目录: ' + dirsIncluded.slice(0, 3).join(', '));

console.log('    待检查文件 ' + bomTargets.length + ' 个');

// ---------- 2. 语法检查步骤 ----------
console.log('\n[2] 语法检查 find 表达式');
const syntaxTargets = [
  ...findFiles(['server/src', 'server/scripts'], ['.js']),
  ...findFiles(['client/assets/js'], ['.js']),
  // .smoke 只扫顶层，不递归进 node_modules
  ...fs.readdirSync(path.join(ROOT, '.smoke'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join('.smoke', f))
];
check('语法检查有目标文件', syntaxTargets.length > 0);
check('语法检查排除了 node_modules',
  !syntaxTargets.some((f) => f.includes('node_modules')),
  'playwright 有 600+ 文件，扫进去会极慢');

const smokeJsCount = fs.readdirSync(path.join(ROOT, '.smoke'))
  .filter((f) => f.endsWith('.js')).length;
// 上限跟着实际脚本数走。以前卡 40 是「防止 find 误把目录当文件」那次的产物，
// 后来补了 verify-scenes / verify-scene-layer / verify-live-* / verify-layer-pixels
// 等一串验证脚本，早就超了 —— 阈值比现实低，断言就成了摆设。
check('.smoke 顶层 JS 文件数合理',
  smokeJsCount > 5 && smokeJsCount < 80, '实际 ' + smokeJsCount);
console.log('    将检查 ' + syntaxTargets.length + ' 个 JS 文件');

// ---------- 3. BOM 实际内容 ----------
console.log('\n[3] 这些文件真的没有 BOM 吗');
const withBom = bomTargets.filter((f) => {
  // bomTargets 已是绝对路径，不能再 join ROOT（会拼成 ROOT+C:\...）
  const b = fs.readFileSync(f);
  return b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
});
check('无任何文件带 BOM', withBom.length === 0,
  '带 BOM: ' + withBom.slice(0, 5).join(', '));

// ---------- 4. 空结果要报错 ----------
console.log('\n[4] 健壮性');
// 若 find 真的返回空，while 循环不会执行，failed 仍是 0，会误报通过。
// 这里确认我们的目标文件确实非空，避免这种假绿。
check('目标文件非空（BOM 检查不会假绿）', bomTargets.length >= 50,
  '只有 ' + bomTargets.length + ' 个，若为 0 说明 find 写错了');
check('语法检查目标非空', syntaxTargets.length >= 20,
  '只有 ' + syntaxTargets.length + ' 个');

// ---------- 5. ci.yml 里的表达式确实是修好的版本 ----------
console.log('\n[5] ci.yml 表达式检查');
const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
check('用了 -type f（排除目录）', /-type f/.test(yml));
check('用了 -type d -name node_modules -prune（排除所有层级）',
  /-type d -name node_modules -prune/.test(yml));
check('不再使用旧的 -path ./node_modules -prune',
  !/-path \.\/node_modules -prune/.test(yml),
  '旧写法只能排除根目录');
check('语法检查也排除了 node_modules',
  /\.smoke -type d -name node_modules -prune/.test(yml));
check('失败提示给出了可执行的修复命令', /fix-encoding\.js/.test(yml));

// ---------- 5. Node 版本约束 ----------
console.log('\n[5] Node 版本');
const ciYaml = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
const nv = /NODE_VERSION:\s*'?([\d.]+)'?/.exec(ciYaml);
check('ci.yml 声明了 Node 版本', !!nv, '未找到 NODE_VERSION');
if (nv) {
  const ver = nv[1];
  const minor = parseFloat(ver);
  check('Node 版本 >= 22.15（undici@8 的 zstd 要求）',
    minor >= 22.15,
    `当前 ${ver} —— 实测 22.14 会在加载 jsdom 时抛 ` +
    `"Cannot read properties of undefined (reading 'bind')"`);
  check('Node 版本已精确到小数位（不能只写 22）',
    /\d+\.\d+/.test(ver), `写成 '22' 会拉到 22.14 而非 22.20`);
}
check('流水线内有 zstd 版本断言',
  /createZstdDecompress/.test(ciYaml),
  '缺这道断言，下次依赖升级又会把 CI 弄挂');
check('断言失败时给出了修复指引',
  /22\.15/.test(ciYaml) && /22\.20/.test(ciYaml));

console.log('\n' + '='.repeat(50));
console.log(fail === 0
  ? `  全部通过 ${pass} 项 ✅ shell 语义正确`
  : `  通过 ${pass} / 失败 ${fail}`);
console.log('='.repeat(50));
process.exit(fail ? 1 : 0);