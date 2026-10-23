/**
 * 背景音乐轮播时序验证（真跑一遍）
 *   node verify-music-rotation.js
 *
 * 用假的 Audio 对象模拟 HTMLAudioElement，
 * 手动触发 onended，看音乐是不是按「30 秒 → 停 5 秒 → 下一首」接续。
 *
 * 检查项
 *   1. 第一首是 稳稳的幸福
 *   2. 一首放完静默 5 秒，然后接下一首
 *   3. 三首轮完一圈回到第一首
 *   4. 轮播期间切页面/切幕不会打断当前这一段
 *   5. 关掉音乐后不再自动续播
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
ck('第一首是 稳稳的幸福',
  played[0] && played[0].endsWith('/steady.mp3'), played[0]);

// ---------- 一首放完：静默 5 秒 ----------
console.log('\n[2] 一首放完后静默 5 秒再接下一首');
inst.finish();
ck('放完暂不播下一首', played.length === 1, 'played=' + played.length);
const gap = pendingTimers();
ck('排定了一个静默计时器', gap.length === 1, 'pending=' + gap.length);
ck('静默时长正好 5 秒',
  gap.length === 1 && gap[0].at === now + 5000,
  gap.length ? 'at=' + gap[0].at + ' now=' + now : '无计时器');

advanceTime(4000);
ck('4 秒时还没开始下一首', played.length === 1, 'played=' + played.length);
advanceTime(1500);
ck('5 秒后开始下一首', played.length === 2, 'played=' + played.length);
ck('下一首是 La La Land',
  played[1] && played[1].endsWith('/lalaland.mp3'), played[1]);

// ---------- 继续轮播 ----------
console.log('\n[3] 三首轮一圈');
inst.finish();
ck('La La Land 放完先静默', played.length === 2, 'played=' + played.length);
advanceTime(5000);
ck('静默后接 我走以后',
  played[2] && played[2].endsWith('/afterleave.mp3'), played[2]);

inst.finish();
ck('我走以后 放完先静默', played.length === 3, 'played=' + played.length);
advanceTime(5000);
ck('三首轮完回到 稳稳的幸福',
  played[3] && played[3].endsWith('/steady.mp3'), played[3]);

// ---------- 切页面 / 切幕不打断 ----------
console.log('\n[4] 切页面与切幕不打断当前段');
const before = played.length;
win.Music.forChapter(3);
win.Music.forScene();
ck('没有插播新的一段', played.length === before, 'played=' + played.length);
ck('当前 src 没被改掉', inst.src.endsWith('/steady.mp3'), inst.src);

// ---------- 关掉音乐 ----------
console.log('\n[5] 关掉后不再续播');
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
