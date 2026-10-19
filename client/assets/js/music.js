/* ============================================================
   背景音乐：全站单例，按「幕」切换曲目，各自循环播放前奏段

   曲目安排
   ----------
     default 剧情之外（标题页/ 选线 / 图鉴 / 档案等非剧情界面）
     act1~5  对应第 1~5 幕

   设计要点
   - 每首只循环播放开头 30 秒（切片时已加淡入淡出，接缝听不出来），
     完整曲目接近 4 分钟，全曲循环会腻，而且占带宽。
   - 切幕时淡出旧曲 → 换src → 淡入新曲，避免硬切。
   - 浏览器策略：首次交互前不允许自动播放。进入 auth 页时用户
     正在点「注册」按钮（算交互），此时 play() 能成功。
   - 用户可在顶栏手动开关，状态记在 localStorage。
   - 音量固定偏低（0.32），避免盖过文字阅读。

   ⚠️ 换曲时必须重新赋值 audio.src 并显式 load()，
   否则部分浏览器不会触发 canplay，卡在上一首。
   ============================================================ */
(function (global) {
  'use strict';

  /* 幕 → 曲目文件 */
  var TRACKS = {
    default: './assets/audio/default.mp3',
    act1: './assets/audio/act1.mp3',
    act2: './assets/audio/act2.mp3',
    act3: './assets/audio/act3.mp3',
    act4: './assets/audio/act4.mp3',
    act5: './assets/audio/act5.mp3'
  };

  var DEFAULT_TRACK = 'default';
  var FADE_MS = 900;
  var VOLUME = 0.32;

  var audio = null;
  var currentKey = null;
  var lastError = null;
  var fadeTimer = null;

  function ensure() {
    if (audio) return audio;
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    return audio;
  }

  function srcFor(key) {
    return TRACKS[key] || TRACKS[DEFAULT_TRACK];
  }

  /** 淡入到目标音量 */
  function fadeIn(to, ms, done) {
    var a = ensure();
    clearInterval(fadeTimer);
    var steps = 18;
    var i = 0;
    var from = a.volume;
    fadeTimer = setInterval(function () {
      i += 1;
      a.volume = from + (to - from) * (i / steps);
      if (i >= steps) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        a.volume = to;
        if (done) done();
      }
    }, (ms || FADE_MS) / steps);
  }

  /** 淡出到 0，完成后回调 */
  function fadeOut(ms, done) {
    var a = ensure();
    if (a.paused) { if (done) done(); return; }
    clearInterval(fadeTimer);
    var steps = 18;
    var i = 0;
    var from = a.volume;
    fadeTimer = setInterval(function () {
      i += 1;
      a.volume = Math.max(0, from * (1 - i / steps));
      if (i >= steps) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        a.volume = 0;
        if (done) done();
      }
    }, (ms || FADE_MS) / steps);
  }

  function wantPlaying() {
    return global.Store && Store.musicOn ? Store.musicOn() : true;
  }

  /** 载入并播放指定幕的曲子 */
  function load(key, thenPlay) {
    var a = ensure();
    var next = srcFor(key);
    if (a.src && a.src.indexOf(next) >= 0 && !a.paused) {
      // 已经是这一首且在播，直接淡入即可
      if (thenPlay && wantPlaying()) fadeIn(VOLUME);
      return;
    }

    currentKey = key;
    fadeOut(FADE_MS / 2, function () {
      a.src = next;
      try { a.load(); } catch (e) { /* 老浏览器忽略 */ }
      if (!thenPlay || !wantPlaying()) return;
      var p = a.play();
      if (p && typeof p.catch === 'function') {
        p.then(function () { fadeIn(VOLUME); })
         .catch(function (err) { lastError = err; });
      } else {
        a.onloadeddata = function () { fadeIn(VOLUME); };
      }
    });
  }

  /** 剧情页调用：按当前幕切曲 */
  function forChapter(no) {
    var key = DEFAULT_TRACK;
    var n = Number(no);
    if (n >= 1 && n <= 5) key = 'act' + n;
    if (key === currentKey) {
      // 同一幕重复进入，音量可能已被淡出到 0，兜一下
      if (wantPlaying() && audio && audio.paused) load(key, true);
      else if (wantPlaying() && audio && audio.volume < VOLUME * 0.5) fadeIn(VOLUME);
      return;
    }
    load(key, true);
  }

  /** 非剧情页调用：切回默认曲 */
  function forScene() {
    if (currentKey === DEFAULT_TRACK) {
      if (wantPlaying() && audio && audio.paused) load(DEFAULT_TRACK, true);
      return;
    }
    load(DEFAULT_TRACK, true);
  }

  function play() {
    var key = currentKey || DEFAULT_TRACK;
    if (!audio || !audio.src) { load(key, true); return; }
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.then(function () { fadeIn(VOLUME); }).catch(function (e) { lastError = e; });
    }
  }

  function pause() {
    if (!audio) return;
    clearInterval(fadeTimer);
    fadeTimer = null;
    audio.pause();
  }

  /** 结局等需要安静的场合 */
  function fadeOutFor(ms, done) {
    fadeOut(ms || FADE_MS, done);
  }

  function init() {
    var want = wantPlaying();
    if (want) load(DEFAULT_TRACK, true);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (wantPlaying()) play();
    });

    // 首次任意交互后再试一次，绕开自动播放限制
    var tried = false;
    var onFirstTouch = function () {
      if (tried) return;
      tried = true;
      if (wantPlaying()) play();
      document.removeEventListener('pointerdown', onFirstTouch);
      document.removeEventListener('keydown', onFirstTouch);
    };
    document.addEventListener('pointerdown', onFirstTouch);
    document.addEventListener('keydown', onFirstTouch);
  }

  function toggle() {
    var on = wantPlaying();
    if (on) {
      if (global.Store) Store.setMusicOn(false);
      fadeOut(400);
      setTimeout(function () { if (audio) audio.pause(); }, 420);
    } else {
      if (global.Store) Store.setMusicOn(true);
      load(currentKey || DEFAULT_TRACK, true);
    }
    return !on;
  }

  function isOn() { return wantPlaying(); }
  function currentTrack() { return currentKey || DEFAULT_TRACK; }

  global.Music = {
    init: init,
    play: play,
    pause: pause,
    toggle: toggle,
    isOn: isOn,
    fadeOut: fadeOutFor,
    forChapter: forChapter,
    forScene: forScene,
    currentTrack: currentTrack,
    TRACKS: TRACKS
  };
})(window);