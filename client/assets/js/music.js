/* ============================================================
   背景音乐：全站单例，从进入游戏起一直播放，不随剧情切换

   设计要点
   - 用 HTMLAudioElement 循环播放，loop = true，剧情跳转不会打断。
   - 浏览器策略：首次交互前不允许自动播放。所以进入 auth 页时
     立刻 play() 一次（用户正在点「注册」按钮，算交互），
     之后靠 loop 持续播放。播放失败静默忽略，等下一次交互再试。
   - 用户可在顶栏手动开关，状态记在 localStorage。
   - 音量固定偏低（0.35），避免盖过文字阅读。
   ============================================================ */
(function (global) {
  'use strict';

  var SRC = './assets/audio/bgm.mp3';
  var VOLUME = 0.35;

  var audio = null;
  var started = false;
  var lastError = null;

  function ensure() {
    if (audio) return audio;
    audio = new Audio();
    audio.src = SRC;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = VOLUME;
    return audio;
  }

  /** 尝试播放，失败不抛（浏览器可能还没允许自动播放） */
  function play() {
    var a = ensure();
    if (a.paused) {
      var p = a.play();
      // Chrome 会因为没有用户交互而 reject，这是预期内的，静默处理
      if (p && typeof p.catch === 'function') {
        p.catch(function (err) {
          lastError = err;
        });
      }
    }
    started = true;
  }

  function pause() {
    if (audio) audio.pause();
    started = false;
  }

  /** 音量淡出，用于结局等需要安静的场合（当前版本默认不淡出） */
  function fadeOut(ms, done) {
    var a = ensure();
    var steps = 20;
    var i = 0;
    var from = a.volume;
    var timer = setInterval(function () {
      i += 1;
      a.volume = Math.max(0, from * (1 - i / steps));
      if (i >= steps) {
        clearInterval(timer);
        a.volume = VOLUME;
        if (done) done();
      }
    }, (ms || 600) / steps);
  }

  /**
   * 根据用户偏好启动。用户已在 auth 页交互过，此时播放能成功。
   */
  function init() {
    var want = global.Store && Store.musicOn ? Store.musicOn() : true;
    if (want) play();

    // 页面从后台切回前台时，若音乐被浏览器暂停则恢复
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      var on = global.Store && Store.musicOn ? Store.musicOn() : true;
      if (on) play();
    });

    // 首次任意交互后再试一次，绕开自动播放限制
    var tried = false;
    var onFirstTouch = function () {
      if (tried) return;
      tried = true;
      var on = global.Store && Store.musicOn ? Store.musicOn() : true;
      if (on) play();
      document.removeEventListener('pointerdown', onFirstTouch);
      document.removeEventListener('keydown', onFirstTouch);
    };
    document.addEventListener('pointerdown', onFirstTouch);
    document.addEventListener('keydown', onFirstTouch);
  }

  function toggle() {
    var on = global.Store && Store.musicOn ? Store.musicOn() : true;
    if (on) {
      if (global.Store) Store.setMusicOn(false);
      pause();
    } else {
      if (global.Store) Store.setMusicOn(true);
      play();
    }
    return !on;
  }

  function isOn() {
    return global.Store && Store.musicOn ? Store.musicOn() : true;
  }

  global.Music = {
    init: init,
    play: play,
    pause: pause,
    toggle: toggle,
    isOn: isOn,
    fadeOut: fadeOut,
    SRC: SRC
  };
})(window);