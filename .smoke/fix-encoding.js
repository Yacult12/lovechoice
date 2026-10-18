/**
 * 统一清理源文件的 UTF-8 BOM 和换行符
 *   node fix-encoding.js
 *
 * 为什么需要：
 *  1. BOM —— Windows 上带 BOM 的 JS 能正常跑，Linux/Node 上直接 SyntaxError。
 *     症状是「本地全过、CI 秒挂」，极难排查。
 *  2. 换行 —— 统一成 LF，与 .gitattributes 的要求一致。
 *
 * 已排除 node_modules 和二进制文件。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'ms-playwright', 'coverage']);

const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.json', '.sql', '.md', '.yml', '.yaml',
  '.css', '.html', '.svg', '.txt', '.example', '.gitignore', '.gitattributes'
]);

const stats = { bomRemoved: [], crlfFixed: [], checked: 0 };

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p);
      continue;
    }
    const ext = path.extname(e.name) || e.name;   // 处理 .gitignore 这类无扩展名
    if (!TEXT_EXT.has(ext)) continue;

    const buf = fs.readFileSync(p);
    stats.checked++;

    let isBom = false;
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      isBom = true;
    }

    let text = buf.toString('utf8');
    if (isBom) {
      text = text.slice(1);                       // 去掉 BOM 字符
      stats.bomRemoved.push(path.relative(ROOT, p));
    }

    if (text.includes('\r\n')) {
      text = text.replace(/\r\n/g, '\n');
      stats.crlfFixed.push(path.relative(ROOT, p));
    }

    if (isBom || stats.crlfFixed.includes(path.relative(ROOT, p))) {
      fs.writeFileSync(p, Buffer.from(text, 'utf8'));
    }
  }
}

walk(ROOT);

console.log('\n=== 编码与换行清理 ===\n');
console.log('扫描文本文件: ' + stats.checked + ' 个\n');

console.log('移除 BOM: ' + stats.bomRemoved.length + ' 个');
stats.bomRemoved.forEach((f) => console.log('  · ' + f));

console.log('\nCRLF 转 LF: ' + stats.crlfFixed.length + ' 个');
stats.crlfFixed.forEach((f) => console.log('  · ' + f));

if (!stats.bomRemoved.length && !stats.crlfFixed.length) {
  console.log('\n✅ 全部干净，无需处理');
} else {
  console.log('\n（换行会由 .gitattributes 在入库时统一，此处清理仅为本地一致）');
}
console.log('');