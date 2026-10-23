/**
 * 背景音乐轮播时序验证（真跑一遍）
 *   node verify-music-rotation.js
 *
 * 用假的 Audio 对象模拟 HTMLAudioElement，
 * 手动触发 onended，看音乐是不是按「30 秒 → 停 10 秒 → 下一首」接续。
 *
 * 检查项
 *   1. 第一首从 稳稳的幸福 的第一段开始
 *   2. 同一首的两段切片之间不停顿
 *   3. 一首放完静默 10 秒，然后接下一首
 *   4. 三首轮完一圈回到第一首
 *   5. 轮播期间切页面/切幕不会打断当前这一段
 *   6. 关掉音乐后不再自动续播
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32mOK  \x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (extra ? '\x1b[2m  -> ' + extra + '\x1b[0m' : '')); }
}

console.log('\n=== 背景音乐轮播时序验证 ===\n');

// ---------- 假 Audio ----------
let inst = null;
const played = [];

function makeAudio() {
  inst = {
    src: '', loop: false, preload: '', volume: 0, paused: true, ended: false,
    onended: null, onerror: null,
    load() { this.ended = false; },
    play() {
      this.paused = false;
      this.ended = false;
      played.push(this.src);
      return Promise.resolve();
    },
    pause() { this.paused = true; },
    /** 模拟这一段播完 */
    finish() {
      this.ended = true;
      this.paused = true;
      if (this.onended) this.onended();
    }
  };
  return inst;
}

const dom = new JSDOM(
  '<!DOCTYPE html><html><body><div id="app"></div></body></html>',
  {
    url: 'http://localhost:5500/',
    pretendToBeVisual: true,
    // outside-only：允许用 win.eval() 注入脚本，
    // 同时保证 window 是脚本可见的全局。
    // 不加这个选项时 win.eval 里的 window 未定义。
    runScripts: 'outside-only'
  }
);
const win = dom.window;
win.window = win;
win.Audio = function () { return makeAudio(); };

// Store / UI 的最小实现
win.localStorage.clear();
win.Store = {
  musicOn: () => win.localStorage.getItem('lovechoice_musicOn') !== 'false',
  setMusicOn: (v) => win.localStorage.setItem('lovechoice_musicOn', String(!!v))
};

win.eval(fs.readFileSync(path.join(ROOT, 'client/assets/js/music.js'), 'utf8'));

// ---------- 用假定时器控制时间 ----------
// jsdom 的 setTimeout 可以用 fake timers 推进，
// 但 music.js 用的是全局 setTimeout，jsdom window 上的实现可控。
let now = 0;
const timers = [];
const realSetTimeout = win.setTimeout;
win.setTimeout = (fn, ms) => {
  const id = timers.length;
  timers.push({ id, fn, at: now + (ms || 0) });
  return id;
};
win.clearTimeout = (id) => {
  const t = timers.find((x) => x.id === id);
  if (t) t.cleared = true;
};
/** 推进虚拟时钟 */
function advanceTime(ms) {
  now += ms;
  for (const t of timers) {
    if (t.cleared) continue;
    if (t.at <= now && !t.fired) { t.fired = true; t.fn(); }
  }
}
function pendingTimers() {
  return timers.filter((t) => !t.cleared && !t.fired);
}

// ---------- 启动 ----------
console.log('[1] 启动');
win.Store.setMusicOn(true);
win.Music.init();
ck('init 后开始播放', played.length === 1, 'played=' + played.length);
ck('第一段是 稳稳的幸福 的开头',
  played[0] && played[0].endsWith('/default.mp3'), played[0]);

// ---------- 同一首的第二段：不停顿 ----------
console.log('\n[2] 同一首的两段切片之间不停顿');
inst.finish();
ck('切到第二段时立刻播放，没有静默', played.length === 2, 'played=' + played.length);
ck('第二段是 act2.mp3（稳稳的幸福 后半）',
  played[1] && played[1].endsWith('/act2.mp3'), played[1]);
ck('没有排定 10 秒静默计时器', pendingTimers().length === 0,
  'pending=' + pendingTimers().length);

// ---------- 一首放完：静默 10 秒 ----------
console.log('\n[3] 一首放完后静默 10 秒再接下一首');
inst.finish();
ck('本曲末段放完，暂不播下一段', played.length === 2, 'played=' + played.length);
const gap = pendingTimers();
ck('排定了一个 10 秒的静默计时器', gap.length === 1, 'pending=' + gap.length);
ck('静默时长正好 10 秒',
  gap.length === 1 && gap[0].at === now + 10000,
  gap.length ? 'at=' + gap[0].at + ' now=' + now : '无计时器');

advanceTime(9000);
ck('9 秒时还没开始下一首', played.length === 2, 'played=' + played.length);
advanceTime(1500);
ck('10 秒后开始下一首', played.length === 3, 'played=' + played.length);
ck('下一首是 La La Land（act1.mp3）',
  played[2] && played[2].endsWith('/act1.mp3'), played[2]);

// ---------- 继续轮播 ----------
console.log('\n[4] 三首轮一圈');
inst.finish();              // act1 → act5（同一首第二段）
ck('La La Land 第二段是 act5.mp3',
  played[3] && played[3].endsWith('/act5.mp3'), played[3]);

inst.finish();              // act5 → 静默 10 秒 → act3（我走以后）
ck('La La Land 放完先静默', played.length === 4, 'played=' + played.length);
advanceTime(10000);
ck('静默后接 我走以后（act3.mp3）',
  played[4] && played[4].endsWith('/act3.mp3'), played[4]);

inst.finish();              // act3 → act4（同一首第二段）
ck('我走以后 第二段是 act4.mp3',
  played[5] && played[5].endsWith('/act4.mp3'), played[5]);

inst.finish();              // act4 → 静默 → 回到 default（轮完一圈）
advanceTime(10000);
ck('三首轮完回到 稳稳的幸福（default.mp3）',
  played[6] && played[6].endsWith('/default.mp3'), played[6]);

// ---------- 切页面 / 切幕不打断 ----------
console.log('\n[5] 切页面与切幕不打断当前段');
const before = played.length;
win.Music.forChapter(3);
win.Music.forScene();
ck('没有插播新的一段', played.length === before, 'played=' + played.length);
ck('当前 src 没被改掉', inst.src.endsWith('/default.mp3'), inst.src);

// ---------- 关掉音乐 ----------
console.log('\n[6] 关掉后不再续播');
win.Store.setMusicOn(false);
win.Music.pause();
const after = played.length;
inst.finish();
advanceTime(15000);
ck('关闭后即使播完也不续播', played.length === after, 'played=' + played.length);

// ---------- 汇总 ----------
console.log('\n' + '='.repeat(52));
console.log('  通过 ' + pass + ' / 失败 ' + fail);
console.log(fail === 0 ? '  ✅ 轮播时序正确' : '  ❌ 存在问题');
console.log('='.repeat(52));
console.log('');
process.exit(fail ? 1 : 0);
