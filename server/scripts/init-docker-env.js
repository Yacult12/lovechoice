/**
 * 生成生产用 .env（含随机 JWT 密钥）
 *   node scripts/init-docker-env.js
 *
 * 部署前跑一次，避免用示例里那个占位密钥上线。
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, '.env.docker.example');
const DST = path.join(ROOT, '.env');

if (!fs.existsSync(SRC)) {
  console.error('[init-env] 找不到 .env.docker.example');
  process.exit(1);
}

if (fs.existsSync(DST)) {
  console.log('[init-env] .env 已存在，未覆盖。');
  console.log('           如需重来，先手动删除 .env 再运行本脚本。');
  process.exit(0);
}

const secret = crypto.randomBytes(48).toString('hex');

const content = fs
  .readFileSync(SRC, 'utf8')
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);

fs.writeFileSync(DST, content, 'utf8');

console.log('[init-env] 已生成 .env');
console.log('');
console.log('  JWT_SECRET = ' + secret.slice(0, 16) + '…（' + secret.length + ' 位）');
console.log('');
console.log('  下一步：');
console.log('    1. 确认 DB_PASSWORD 与你的 MySQL 一致');
console.log('    2. 执行  deploy.bat  或  docker compose up -d --build');
console.log('');
console.log('  ⚠️  .env 已被 .gitignore 排除，不会进版本库。');