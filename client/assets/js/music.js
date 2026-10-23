/* ============================================================
   背景音乐：全站单例，三首曲子轮播

   曲目（三首，共 6 段切片，每段 30 秒）
   --------------------------------------
     《稳稳的幸福》(伴奏)      洋澜一
       default.mp3   32-62s
       act2.mp3      95-125s
     《La La Land》(钢琴版)     知名不具
       act1.mp3      58-88s
       act5.mp3     150-180s
     《我走以后》(降调氛围版)    水仙LONE
       act3.mp3      72-102s
       act4.mp3     145-175s

   播放规则
   --------
     一首曲子的两段切片连着放，中间不停；
     一首放完，安静 10 秒，再接下一首；
     三首轮完一圈，回到第一首，继续。

   为什么要留这 10 秒
     切片只有 30 秒，同一首循环播放听久了会腻；
     而整首接近 4 分钟，全曲循环既占带宽也更容易听疲。
     30 秒音乐 + 10 秒留白，听起来像「一段一段放给你听」，
     读剧情的节奏也跟着被切成小节，读几段正好歇一下。

   设计要点
   - 换曲用淡出 → 换 src → 淡入，避免硬切。
   - 浏览器策略：首次交互前不允许自动播放。进入 auth 页时用户
     正在点「注册」按钮（算交互），此时 play() 能成功。
   - 用户可在顶栏手动开关，状态记在 localStorage。
   - 音量固定偏低（0.32），避免盖过文字阅读。

   ⚠️ 换曲时必须重新赋值 audio.src 并显式 load()，
   否则部分浏览器不会触发 canplay，卡在上一首。
   ============================================================ */
(function (global) {
  'use strict';

  /*
   * 轮播顺序：稳稳的幸福 → La La Land → 我走以后 → 稳稳的幸福 …
   *
   * 每首曲子可以有多段切片，按顺序连着放。
   * 一首的最后一个切片放完，静默 GAP_MS 后接下一首。
   */
  var SONGS = [
    {
      name: '稳稳的幸福',
      clips: ['default.mp3', 'act2.mp3']
    },
    {
      name: 'La La Land',
      clips: ['act1.mp3', 'act5.mp3']
    },
    {
      name: '我走以后',
      clips: ['act3.mp3', 'act4.mp3']
    }
  ];

  /* 扁平化成播放序列，每一项标记自己是不是本曲的最后一段 */
  var PLAYLIST = [];
  SONGS.forEach(function (song) {
    song.clips.forEach(function (file, i) {
      PLAYLIST.push({
        song: song.name,
        file: file,
        lastOfSong: i === song.clips.length - 1
      });
    });
  });

  /* 完整文件路径表（调试与外部引用用） */
  var TRACKS = {};
  PLAYLIST.forEach(function (step) {
    TRACKS[step.file.replace(/\.mp3$/, '')] = './assets/audio/' + step.file;
  });

  /* 曲子名 → 曲目 key（旧接口保留） */
  var TRACK_NAMES = {};
  SONGS.forEach(function (song) {
    song.clips.forEach(function (file) {
      TRACK_NAMES[file.replace(/\.mp3$/, '')] = song.name;
    });
  });

  var DEFAULT_TRACK = 'default';
  var FADE_MS = 900;
  var VOLUME = 0.32;

  /* 一首放完后的静默时长 */
  var GAP_MS = 10000;

  var audio = null;
  var currentIdx = -1;      // PLAYLIST 下标，-1 = 还没开始
  var lastError = null;
  var fadeTimer = null;
  var gapTimer = null;

  function ensure() {
    if (audio) return audio;
    audio = new Audio();
    // 自己控制接续，不靠 loop ——
    // 每段放完要静默 10 秒再接下一首，loop=true 做不到
    audio.loop = false;
    audio.preload = 'auto';
    audio.volume = 0;
    audio.onended = onEnded;
    audio.onerror = onError;
    return audio;
  }

  /* 当前曲名（调试用） */
  function currentSongName() {
    if (currentIdx < 0) return SONGS[0].name;
    return PLAYLIST[currentIdx].song;
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

  function clearGap() {
    if (gapTimer) {
      clearTimeout(gapTimer);
      gapTimer = null;
    }
  }

  /** 切到播放序列的下一段并淡入播放 */
  function advance() {
    var a = ensure();
    var nextIdx = (currentIdx + 1) % PLAYLIST.length;
    var step = PLAYLIST[nextIdx];

    fadeOut(FADE_MS / 2, function () {
      currentIdx = nextIdx;
      a.src = './assets/audio/' + step.file;
      try { a.load(); } catch (e) { /* 老浏览器忽略 */ }
      a.volume = 0;
      if (!wantPlaying()) return;
      var p = a.play();
      if (p && typeof p.catch === 'function') {
        p.then(function () { fadeIn(VOLUME); })
         .catch(function (err) { lastError = err; });
      } else {
        a.onloadeddata = function () { fadeIn(VOLUME); };
      }
    });
  }

  /** 从头开始（第一段） */
  function start() {
    currentIdx = -1;
    advance();
  }

  /** 一段放完 */
  function onEnded() {
    clearGap();
    if (!wantPlaying()) return;
    var step = PLAYLIST[currentIdx];
    if (!step) return;

    if (step.lastOfSong) {
      // 一首曲子放完：静默 10 秒再接下一首
      gapTimer = setTimeout(function () {
        gapTimer = null;
        if (!wantPlaying()) return;
        advance();
      }, GAP_MS);
      return;
    }
    // 同一首的下一段切片，直接接上，中间不停
    advance();
  }

  /** 音频加载失败：跳过这一段，别让音乐卡死 */
  function onError() {
    if (!wantPlaying()) return;
    advance();
  }

  /** 确保正在播（视口切回、开关打开时调用） */
  function ensurePlaying() {
    if (!wantPlaying()) return;
    clearGap();
    if (currentIdx < 0) { start(); return; }
    var a = ensure();

    /*
     * 刚放完但还在 10 秒静默期里 —— 这时 audio 已经 ended。
     * 直接 play() 会从头重播这一段（浏览器对 ended 的元素
     * 调 play() 会把 currentTime 归零），听起来像卡带了。
     * 正确做法是接着往下走。
     */
    if (a.ended) { advance(); return; }

    if (a.paused) {
      var p = a.play();
      if (p && typeof p.catch === 'function') {
        p.then(function () { fadeIn(VOLUME); })
         .catch(function (err) { lastError = err; });
      }
    }
  }

  /**
   * 剧情页调用：按当前幕切曲。
   *
   * 现在是纯轮播，不再按幕分配情绪 —— 每一段只有 30 秒，
   * 轮播节奏下幕与幕之间本来就会交叉，强行按幕换曲只会频繁打断。
   * 这里只保证音乐在放。
   */
  function forChapter(no) {
    ensurePlaying();
    return currentSongName();
  }

  /**
   * 非剧情页调用。
   *
   * 同理，轮播是连续的，离开剧情页不该把歌切回开头 ——
   * 否则每次进出剧情都会打断正在放的那一段。
   */
  function forScene() {
    ensurePlaying();
  }

  function play() {
    ensurePlaying();
  }

  function pause() {
    if (!audio) return;
    clearGap();
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
    if (want) start();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      ensurePlaying();
    });

    // 首次任意交互后再试一次，绕开自动播放限制
    var tried = false;
    var onFirstTouch = function () {
      if (tried) return;
      tried = true;
      if (wantPlaying()) ensurePlaying();
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
      clearGap();
      fadeOut(400);
      setTimeout(function () { if (audio) audio.pause(); }, 420);
    } else {
      if (global.Store) Store.setMusicOn(true);
      ensurePlaying();
    }
    return !on;
  }

  function isOn() { return wantPlaying(); }

  /** 当前曲目 key（调试用） */
  function currentTrack() {
    if (currentIdx < 0) return DEFAULT_TRACK;
    return PLAYLIST[currentIdx].file.replace(/\.mp3$/, '');
  }

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
    TRACKS: TRACKS,
    TRACK_NAMES: TRACK_NAMES,
    SONGS: SONGS,
    PLAYLIST: PLAYLIST,
    GAP_MS: GAP_MS,
    currentTrackName: currentSongName
  };
})(window);
