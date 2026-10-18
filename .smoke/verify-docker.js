/**
 * Docker 资源静态校验（不需要装 Docker 就能查结构问题）
 *   node verify-docker.js
 */
const fs = require('fs');
const path = require('path');

// 项目根目录：从本文件位置向上两级（.smoke/verify-docker.js → 仓库根）
// 不用硬编码绝对路径 —— 否则在 Linux CI 上会去找 C:\Users\...
const ROOT = path.resolve(__dirname, '..');

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

console.log('\n=== Docker 资源静态校验 ===\n');

console.log('[1] 文件清单');
const required = [
  'docker-compose.yml',
  'server/Dockerfile',
  'server/.dockerignore',
  'server/sql/schema.sql',
  'client/Dockerfile',
  'client/docker/nginx.conf',
  'client/docker/config.js'
];
required.forEach((f) => check('存在 ' + f, exists(f)));
console.log('');

console.log('[2] docker-compose.yml');
const compose = read('docker-compose.yml');
check('定义了 mysql 服务', /^\s{2}mysql:/m.test(compose));
check('定义了 backend 服务', /^\s{2}backend:/m.test(compose));
check('定义了 frontend 服务', /^\s{2}frontend:/m.test(compose));
check('声明了命名卷 mysql-data', /^\s{2}mysql-data:/m.test(compose));
check('声明了网络 love', /^\s{2}love:/m.test(compose));
soft('顶层有 name: lovechoice', /^name:\s*lovechoice/m.test(compose));

const mysqlSection = compose.slice(compose.indexOf('  mysql:'), compose.indexOf('  backend:'));
check('mysql 端口只绑 127.0.0.1',
  /127\.0\.0\.1:\$\{DB_PORT/.test(mysqlSection),
  '未绑定回环地址，3306 会暴露到公网');

const backendSection = compose.slice(compose.indexOf('  backend:'), compose.indexOf('  frontend:'));
check('backend 端口只绑 127.0.0.1', /127\.0\.0\.1:\$\{BACKEND_PORT/.test(backendSection));

check('backend 依赖 mysql 健康',
  /depends_on:\s*\n\s+mysql:\s*\n\s+condition:\s*service_healthy/.test(compose));
check('frontend 依赖 backend 健康',
  /frontend:[\s\S]*?depends_on:\s*\n\s+backend:\s*\n\s+condition:\s*service_healthy/.test(compose));
soft('mysql 配了 healthcheck', /healthcheck:/.test(mysqlSection));
check('JWT_SECRET 用变量插值', /JWT_SECRET:\s*\$\{JWT_SECRET/.test(compose));
check('DB_PASSWORD 用变量插值', /DB_PASSWORD:\s*\$\{DB_PASSWORD/.test(compose));
check('前端端口可配', /\$\{WEB_PORT/.test(compose));
check('生产显式开启限流', /RATE_LIMIT_ENABLED:\s*"true"/.test(compose));

console.log('\n[3] 数据库初始化脚本');
const initdb = [...compose.matchAll(/\.\/(server\/sql\/[^\s:]+\.sql):\/docker-entrypoint-initdb\.d\/(\d\d)-/g)];
check('挂载了 initdb 脚本', initdb.length > 0);
const seq = initdb.map((m) => m[2]);
check('脚本编号顺序正确',
  JSON.stringify(seq) === JSON.stringify([...seq].sort()), '实际: ' + seq.join(','));
check('schema.sql 最先执行', initdb.some((m) => m[2] === '01' && m[1].includes('schema')));
initdb.forEach((m) => check(`引用的 ${m[1]} 存在`, exists(m[1])));

const schema = read('server/sql/schema.sql');
check('schema.sql 含 10 张表建表语句',
  (schema.match(/CREATE TABLE IF NOT EXISTS/g) || []).length === 10,
  '实际 ' + (schema.match(/CREATE TABLE IF NOT EXISTS/g) || []).length);
check('用 IF NOT EXISTS（可重复执行）', !/CREATE TABLE (?!IF NOT EXISTS)/.test(schema));
check('末尾恢复外键检查', /FOREIGN_KEY_CHECKS\s*=\s*1/.test(schema));
check('声明 utf8mb4', /utf8mb4/.test(schema));

console.log('\n[4] server/Dockerfile');
const backendDf = read('server/Dockerfile');
check('使用多阶段构建', /AS deps/.test(backendDf) && /AS runtime/.test(backendDf));
check('依赖层用 npm ci', /npm ci/.test(backendDf));
soft('拷贝 package*.json 到依赖层', /COPY package\*\.json/.test(backendDf));
check('切换到非 root 用户', /USER nodejs/.test(backendDf));
soft('使用 tini 处理信号', /tini/.test(backendDf));
check('暴露 3000', /EXPOSE 3000/.test(backendDf));
soft('配了 HEALTHCHECK', /HEALTHCHECK/.test(backendDf));
soft('设置 NODE_ENV=production', /NODE_ENV=production/.test(backendDf));

const di = read('server/.dockerignore');
check('.dockerignore 排除 node_modules', /node_modules/.test(di));
check('.dockerignore 排除 .env', /\.env/.test(di));
soft('.dockerignore 保留 .env.example', /!\.env\.example/.test(di));

console.log('\n[5] client/Dockerfile');
const frontDf = read('client/Dockerfile');
check('基于 nginx', /FROM nginx/.test(frontDf));
check('拷贝 nginx 配置', /COPY docker\/nginx\.conf/.test(frontDf));
check('拷贝静态资源', /COPY client\//.test(frontDf));
check('拷贝运行时配置', /docker\/config\.js/.test(frontDf));
check('暴露 80', /EXPOSE 80/.test(frontDf));
soft('有 HEALTHCHECK', /HEALTHCHECK/.test(frontDf));
check('build context 与 COPY 路径匹配',
  /context:\s*\.\s*\n\s*dockerfile:\s*client\/Dockerfile/.test(compose) && /COPY client\//.test(frontDf),
  'context 为仓库根时必须 COPY client/…');

console.log('\n[6] nginx 配置');
const nginx = read('client/docker/nginx.conf');
check('有 server 块', /server\s*\{/.test(nginx));
check('listen 80', /listen\s+80/.test(nginx));
// 剥掉整行注释和行尾注释后再校验结构，
// 否则注释里出现的 location 字样会被当成真实指令
const nginxNoComment = nginx.replace(/^\s*#.*$/gm, '').replace(/#.*$/gm, '');
const sStart = nginxNoComment.indexOf('server {');
const sEnd = nginxNoComment.lastIndexOf('}');
const locIdx = [...nginxNoComment.matchAll(/^\s*location\s+[^\s{]+/gm)].map((m) => m.index);
check('所有 location 都在 server 块内',
  locIdx.length > 0 && locIdx.every((i) => i > sStart && i < sEnd),
  '存在游离在 server 外的 location —— nginx 会启动失败');
check('至少有 4 个 location（config.js / healthz / api / assets / 入口）',
  locIdx.length >= 4, '实际 ' + locIdx.length);
check('/api 反代到 backend:3000', /proxy_pass\s+http:\/\/backend:3000/.test(nginx));
check('透传 X-Forwarded-For（限流依赖真实 IP）', /X-Forwarded-For/.test(nginx));
check('透传 X-Real-IP', /X-Real-IP/.test(nginx));
check('透传 X-Forwarded-Proto', /X-Forwarded-Proto/.test(nginx));
check('config.js 禁用缓存', /config\.js[\s\S]*?no-store/.test(nginx));
check('有 /healthz 端点', /location\s+=\s+\/healthz/.test(nginx));
check('静态资源 try_files', /try_files\s+\$uri\s+=404/.test(nginx));
check('开启 gzip', /gzip\s+on/.test(nginx));
soft('SVG 开启 gzip（31 张美术）', /image\/svg\+xml/.test(nginx));
check('未硬编码 HTTPS 跳转', !/return\s+301\s+https/.test(nginx));

console.log('\n[7] 运行时配置注入');
const cfg = read('client/docker/config.js');
check('config.js 设置 window.LOVE_API_BASE', /window\.LOVE_API_BASE/.test(cfg));
const idxHtml = read('client/index.html');
check('index.html 在 api.js 之前加载 config.js',
  idxHtml.indexOf('config.js') > -1 &&
  idxHtml.indexOf('config.js') < idxHtml.indexOf('assets/js/api.js'));
soft('config.js 加载失败有兜底', /onerror/.test(idxHtml));

const apiJs = read('client/assets/js/api.js');
check('api.js 读 window.LOVE_API_BASE', /LOVE_API_BASE/.test(apiJs));
check('api.js 对本地开发端口做例外',
  /5500/.test(apiJs) && /5600/.test(apiJs),
  '本地开发端口若不回退直连 3000，本地就跑不通');

console.log('\n' + '='.repeat(52));
console.log(`  通过 ${pass} · 警告 ${warn} · 失败 ${fail}`);
console.log(fail === 0
  ? (warn === 0 ? '  ✅ 静态校验全部通过' : `  ✅ 结构正确（${warn} 项建议，非阻塞）`)
  : '  ❌ 存在问题，请修复后再部署');
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);