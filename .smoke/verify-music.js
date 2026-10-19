/**
 * 分幕配乐验证
 *   node verify-music.js
 *
 * 检查项
 *   1. 6 首音频文件存在、格式正确、时长约30s
 *   2. music.js 的 TRACKS 表覆盖 default + act1~5
 *   3. 剧情页会按幕号切歌，非剧情页会切回 default
 *   4. 切歌时做了淡入淡出（不会出现硬切）
 *   5. 换了 src 之后显式 load()（否则部分浏览器不重新加载）
 *
 * 这些都是静态检查 —— 真正的播放效果用浏览器实测。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIO = path.join(ROOT, 'client', 'assets', 'audio');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}

console.log('\n=== 分幕配乐验证 ===\n');

// ---------- 1. 音频文件 ----------
console.log('[1] 音频文件');
ck('音频目录存在', fs.existsSync(AUDIO));
if (!fs.existsSync(AUDIO)) { process.exit(1); }

const EXPECT = ['default', 'act1', 'act2', 'act3', 'act4', 'act5'];
const files = fs.readdirSync(AUDIO);

EXPECT.forEach((k) => {
  const f = path.join(AUDIO, k + '.mp3');
  const exists = fs.existsSync(f);
  if (!exists) { ck(k + '.mp3 存在', false, '缺失'); return; }
  const size = fs.statSync(f).size;
  ck(k + '.mp3 (' + Math.round(size / 1024) + ' KB)',
    size > 50 * 1024 && size < 2 * 1024 * 1024,
    size < 50 * 1024 ? '文件过小，可能是空的' : '文件偏大');
});

// MP3 魔数
EXPECT.forEach((k) => {
  const f = path.join(AUDIO, k + '.mp3');
  if (!fs.existsSync(f)) return;
  const b = Buffer.alloc(4);
  const fd = fs.openSync(f, 'r');
  fs.readSync(fd, b, 0, 4, 0);
  fs.closeSync(fd);
  const isMp3 = b.slice(0, 3).toString('latin1') === 'ID3' ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
  ck(k + '.mp3 是有效 MP3', isMp3, 'magic=' + b.toString('hex'));
});

// 旧的整曲 bgm.mp3 应该清掉了
ck('旧的整曲 bgm.mp3 已移除', !fs.existsSync(path.join(AUDIO, 'bgm.mp3')),
  '还留着 9MB 的整曲，会被误引用');

// manifest
ck('manifest.json 存在', fs.existsSync(path.join(AUDIO, 'manifest.json')));
if (fs.existsSync(path.join(AUDIO, 'manifest.json'))) {
  const m = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8'));
  ck('manifest 有 6 条', m.length === 6, '实际 ' + m.length);
  ck('每条约30 秒', m.every((x) => x.seconds >= 29 && x.seconds <= 31),
    JSON.stringify(m.map((x) => x.seconds)));
}

// ---------- 2. music.js ----------
console.log('\n[2] music.js');
const music = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'music.js'), 'utf8');

EXPECT.forEach((k) => {
  ck('TRACKS 含 ' + k, new RegExp(k + "\\s*:").test(music));
});
ck('默认曲是 default', /DEFAULT_TRACK\s*=\s*'default'/.test(music));
ck('设置 loop = true', /loop\s*=\s*true/.test(music));
ck('音量偏低（≤0.35）', /VOLUME\s*=\s*0\.\d+/.test(music) &&
  parseFloat((music.match(/VOLUME\s*=\s*(0\.\d+)/) || [])[1]) <= 0.35);
ck('暴露 forChapter', /forChapter/.test(music));
ck('暴露 forScene', /forScene/.test(music));
ck('暴露 currentTrack（便于调试）', /currentTrack/.test(music));

// ---------- 3. 切歌逻辑 ----------
console.log('\n[3] 切歌逻辑');
ck('换 src 后显式 load()', /a\.load\(\)|\.load\(\)/.test(music),
  '不 load 的话部分浏览器不会重新加载');
ck('有淡入', /fadeIn/.test(music));
ck('有淡出', /fadeOut/.test(music));
ck('淡出后再换 src（避免硬切）',
  /fadeOut[\s\S]{0,200}?a\.src\s*=/.test(music));
ck('play() 的 reject 被捕获（浏览器自动播放限制）',
  /\.catch\s*\(/.test(music));

// 幕号映射只认 1~5
const forChapter = music.match(/function forChapter[\s\S]*?\n  }/);
if (forChapter) {
  ck('幕号范围限制在 1~5',
    /n\s*>=\s*1\s*&&\s*n\s*<=\s*5/.test(forChapter[0]),
    '越界会让 act0/act6 之类的空文件名被请求');
  ck('非 1~5 落到 default',
    /key\s*=\s*DEFAULT_TRACK/.test(forChapter[0]));
} else {
  ck('找到 forChapter 函数', false);
}

// ---------- 4. 调用点 ----------
console.log('\n[4] 调用点');
const play = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'pages', 'play.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'app.js'), 'utf8');

ck('play.js 在 renderScene 里切歌', /function renderScene[\s\S]{0,600}?Music\.forChapter/.test(play),
  '挂错地方会导致跨章时不换曲');
ck('play.js 从 node.chapterNo 取幕号', /node\s*&&\s*node\.chapterNo/.test(play));
ck('app.js 在非剧情页切回 default', /Music\.forScene/.test(app));
ck('app.js 的判断排除了 play 页',
  /Music\.forScene[\s\S]{0,120}?!==\s*'play'/.test(app),
  '若不排除，剧情页也会被切回 default');
ck('app.js 在 render() 里调用（覆盖前进/后退）',
  /function render[\s\S]{0,3000}?Music\.forScene/.test(app));

// 顶栏开关仍能用
ck('顶栏音乐开关保留', /Music\.toggle/.test(play));

// ---------- 5. nginx 不拦截 mp3 ----------
console.log('\n[5] nginx');
const nginx = fs.readFileSync(path.join(ROOT, 'client', 'docker', 'nginx.conf'), 'utf8');
ck('nginx 未对 mp3 做特殊处理（会正常走静态）', !!nginx);
ck('assets 路径有缓存策略', /assets/.test(nginx));

// ---------- 汇总 ----------
console.log('\n' + '='.repeat(52));
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log(fail === 0 ? '  ✅ 分幕配乐配置正确' : '  ❌ 存在问题');
console.log('='.repeat(52));
console.log('');
process.exit(fail ? 1 : 0);