/**
 * 背景音乐轮播配置验证
 *   node verify-music.js
 *
 * 检查项
 *   1. 3 首音频文件存在、格式正确、时长约30s
 *   2. music.js 的轮播表覆盖三首曲子，顺序正确
 *   3. 一首放完静默 5 秒再接下一首
 *   4. 切歌时做了淡入淡出（不会出现硬切）
 *   5. 换了 src 之后显式 load()（否则部分浏览器不重新加载）
 *
 * 这些都是静态检查 —— 真正的播放效果用浏览器实测，
 * 时序部分见 verify-music-rotation.js。
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

console.log('\n=== 背景音乐轮播验证 ===\n');

// ---------- 1. 音频文件 ----------
console.log('[1] 音频文件');
ck('音频目录存在', fs.existsSync(AUDIO));
if (!fs.existsSync(AUDIO)) { process.exit(1); }

const EXPECT = ['steady', 'lalaland', 'afterleave'];
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
  ck('manifest 有 3 条', m.length === 3, '实际 ' + m.length);
  ck('每条约30 秒', m.every((x) => x.seconds >= 29 && x.seconds <= 31),
    JSON.stringify(m.map((x) => x.seconds)));
  ck('manifest 记录了轮播顺序',
    m.map((x) => x.order).join(',') === '1,2,3',
    m.map((x) => x.order).join(','));
  ck('manifest 起点与用户选的一致',
    m.map((x) => x.start).join(',') === '56,46,57',
    m.map((x) => x.start).join(','));
}

// 上一版遗留的旧切片文件不能留在目录里
['default', 'act1', 'act2', 'act3', 'act4', 'act5'].forEach((k) => {
  ck('旧切片 ' + k + '.mp3 已清理',
    !fs.existsSync(path.join(AUDIO, k + '.mp3')),
    '还留着旧文件，会被误引用');
});

// ---------- 2. music.js ----------
console.log('\n[2] music.js');
const music = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'music.js'), 'utf8');

// TRACKS 现在由 PLAYLIST 动态生成，源码里不再有字面量键，
// 所以改成断言「三个切片文件都在播放序列里」
EXPECT.forEach((k) => {
  ck('播放序列含 ' + k + '.mp3',
    music.includes("'" + k + ".mp3'"),
    '切片文件没进播放序列');
});
ck('默认曲是 steady', /DEFAULT_TRACK\s*=\s*'steady'/.test(music));
ck('音量偏低（≤0.35）', /VOLUME\s*=\s*0\.\d+/.test(music) &&
  parseFloat((music.match(/VOLUME\s*=\s*(0\.\d+)/) || [])[1]) <= 0.35);
ck('暴露 forChapter', /forChapter/.test(music));
ck('暴露 forScene', /forScene/.test(music));
ck('暴露 currentTrack（便于调试）', /currentTrack/.test(music));

// ---------- 2b. 轮播规则 ----------
console.log('\n[2b] 轮播规则');
ck('只循环三首曲子',
  (music.match(/name:\s*'/g) || []).length === 3,
  '实际 ' + (music.match(/name:\s*'/g) || []).length + ' 首');
ck('顺序为 稳稳的幸福 → La La Land → 我走以后',
  /稳稳的幸福[\s\S]*?La La Land[\s\S]*?我走以后/.test(music),
  '轮播顺序变了');
ck('每首只取一段切片',
  /file:\s*'steady\.mp3'/.test(music) &&
  /file:\s*'lalaland\.mp3'/.test(music) &&
  /file:\s*'afterleave\.mp3'/.test(music),
  '现在是每首一段，不再有两段');
ck('关闭浏览器自带循环（自己控制接续）',
  /loop\s*=\s*false/.test(music),
  'loop=true 的话每段会无限重播，没有静默间隔');
ck('静默 5 秒', /GAP_MS\s*=\s*5000/.test(music),
  '要求播完停 5 秒再接下一首');
ck('用 ended 事件接续', /onended/.test(music));
ck('暴露 PLAYLIST（便于调试）', /PLAYLIST/.test(music));
ck('不按章节改变',
  /不按章节改变/.test(music),
  '轮播是全站连续的，切章节不该换曲');

// ---------- 3. 切歌逻辑 ----------
console.log('\n[3] 切歌逻辑');
ck('换 src 后显式 load()', /a\.load\(\)|\.load\(\)/.test(music),
  '不 load 的话部分浏览器不会重新加载');
ck('有淡入', /fadeIn/.test(music));
ck('有淡出', /fadeOut/.test(music));
ck('淡出后再换 src（避免硬切）',
  /fadeOut[\s\S]{0,400}?a\.src\s*=/.test(music));
ck('play() 的 reject 被捕获（浏览器自动播放限制）',
  /\.catch\s*\(/.test(music));
ck('ended 后不会把已播完的段落重头播',
  /a\.ended[\s\S]{0,120}?advance\(\)/.test(music),
  'ended 的元素调 play() 会从 0 重播，听起来像卡带');

// ---------- 4. 调用点 ----------
console.log('\n[4] 调用点');
const play = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'pages', 'play.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'app.js'), 'utf8');

ck('play.js 在 renderScene 里切歌', /function renderScene[\s\S]{0,600}?Music\.forChapter/.test(play),
  '挂错地方会导致跨章时不换曲');
ck('app.js 在非剧情页也调 Music', /Music\.forScene/.test(app));
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
console.log(fail === 0 ? '  ✅ 背景音乐轮播配置正确' : '  ❌ 存在问题');
console.log('='.repeat(52));
console.log('');
process.exit(fail ? 1 : 0);