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

// 顺序陷阱：full_story 靠 route_code 查 routes.id，
// 基础数据脚本排在其后会导致 @r_male = NULL → ERROR 1048
const basePos = initdb.findIndex((m) => m[1].includes('base_data'));
const storyPos = initdb.findIndex((m) => m[1].includes('full_story'));
check('base_data.sql 在 full_story.sql 之前执行',
  basePos >= 0 && storyPos >= 0 && basePos < storyPos,
  '基础数据必须先灌，否则 full_story 的 route_id 会是 NULL');

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
check('拷贝 nginx 配置', /nginx\.conf/.test(frontDf));
check('拷贝静态资源', /COPY client\//.test(frontDf));
check('拷贝运行时配置', /config\.js/.test(frontDf));
check('暴露 80', /EXPOSE 80/.test(frontDf));
soft('有 HEALTHCHECK', /HEALTHCHECK/.test(frontDf));

// build context 为仓库根时，Dockerfile 里所有 COPY 源路径
// 都必须真实存在于仓库中 —— 这类错误本地静态检查看不出来，
// 只有 docker build 时才报 "not found"，白等好几分钟。
const frontContextIsRoot = /context:\s*\.\s*\n\s*dockerfile:\s*client\/Dockerfile/.test(compose);
if (frontContextIsRoot) {
  console.log('\n[5b] COPY 路径与 build context 匹配性');
  const copies = [...frontDf.matchAll(/^COPY\s+(?:--from=\S+\s+)?(\S+)\s+/gm)]
    .map((m) => m[1])
    .filter((p) => !p.includes('/app/') && !p.startsWith('/'));
  check('找到了 COPY 指令', copies.length > 0, '一条都没有');
  copies.forEach((src) => {
    const p = path.join(ROOT, src.replace(/\/$/, ''));
    check(`COPY 源存在: ${src}`, fs.existsSync(p),
      `build context 是仓库根，但 ${src} 不在仓库里`);
  });
  check('COPY 路径均带 client/ 前缀',
    copies.every((s) => s.startsWith('client/')),
    'context 为仓库根时漏了前缀，构建会报 not found');
}
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

/*
 * 缓存策略必须钉死。
 *
 * 踩过的坑：nginx 曾给 /assets/ 设了 30 天强缓存
 * （expires 30d + max-age=2592000），改完前端部署上去，
 * 老浏览器打开还是旧版，换台没登录过的浏览器才是新版。
 *
 * 强缓存让老浏览器 30 天内压根不回服务器问一次，
 * index.html 重新拉了也没用 —— 它引用的 JS 文件名没变，
 * 浏览器直接拿本地旧副本。
 */
console.log('\n[6b] 缓存策略');
const assetsLoc = nginxNoComment.slice(
  nginxNoComment.indexOf('location /assets/'),
  nginxNoComment.indexOf('location ^~ /assets/audio/')
);
check('/assets/ 不再设 30 天强缓存',
  !/expires\s+30d/.test(assetsLoc) && !/max-age=2592000/.test(assetsLoc),
  '强缓存会导致老浏览器永远拿不到新版');
check('/assets/ 声明 no-store',
  /location \/assets\/[\s\S]*?Cache-Control\s+"no-store/.test(nginxNoComment));
check('/assets/ 里重写了安全头',
  /location \/assets\/[\s\S]*?X-Content-Type-Options/.test(nginxNoComment),
  'location 内有 add_header 时 nginx 不再继承 server 级的，安全头会丢');
check('音频走协商缓存（no-cache）',
  /location \^~ \/assets\/audio\/[\s\S]*?no-cache/.test(nginxNoComment),
  '音频大，不能每次重下；但换曲后老浏览器必须能拿到新版');
check('音频仍开启 Accept-Ranges',
  /location \^~ \/assets\/audio\/[\s\S]*?Accept-Ranges bytes/.test(nginxNoComment));
check('入口 index.html 走 no-store',
  /location \/[\s\S]*?Cache-Control\s+"no-store/.test(nginxNoComment),
  '入口页必须每次重拉 —— 它带着资源版本戳，是全站换新的总开关');

console.log('\n[7] 运行时配置注入');
const cfg = read('client/docker/config.js');
check('config.js 设置 window.LOVE_API_BASE', /window\.LOVE_API_BASE/.test(cfg));
const idxHtml = read('client/index.html');
check('index.html 在 api.js 之前加载 config.js',
  idxHtml.indexOf('config.js') > -1 &&
  idxHtml.indexOf('config.js') < idxHtml.indexOf('assets/js/api.js'));
soft('config.js 加载失败有兜底', /onerror/.test(idxHtml));

// ---------- 7b. 版本戳（缓存炸弹的第二道保险） ----------
console.log('\n[7b] 资源版本戳');
check('index.html 的 CSS 引用带版本戳',
  /main\.css\?v=__LOVE_BUILD__/.test(idxHtml));
const scriptTags = [...idxHtml.matchAll(/src="\.\/assets\/js\/[^"]+\.js\?v=__LOVE_BUILD__"/g)];
check('所有 JS 引用都带版本戳',
  scriptTags.length >= 12,
  '实际 ' + scriptTags.length + ' 个 —— 漏一个就有一个文件会被旧缓存卡住');
check('Dockerfile 会替换版本占位符',
  /__LOVE_BUILD__/.test(frontDf) && /sed -i/.test(frontDf),
  '占位符没被替换，版本戳就永远是同一个字符串，等于没生效');
check('Dockerfile 替换失败会中断构建',
  /grep -q '__LOVE_BUILD__'[\s\S]{0,200}?exit 1/.test(frontDf));

const apiJs = read('client/assets/js/api.js');
check('api.js 读 window.LOVE_API_BASE', /LOVE_API_BASE/.test(apiJs));
check('api.js 对本地开发端口做例外',
  /5500/.test(apiJs) && /5600/.test(apiJs),
  '本地开发端口若不回退直连 3000，本地就跑不通');
check('api.js 请求禁用缓存',
  /cache:\s*'no-store'/.test(apiJs),
  'GET /api/play/state 被浏览器缓存住，老用户就会一直看旧进度');

console.log('\n' + '='.repeat(52));
console.log(`  通过 ${pass} · 警告 ${warn} · 失败 ${fail}`);
console.log(fail === 0
  ? (warn === 0 ? '  ✅ 静态校验全部通过' : `  ✅ 结构正确（${warn} 项建议，非阻塞）`)
  : '  ❌ 存在问题，请修复后再部署');
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);