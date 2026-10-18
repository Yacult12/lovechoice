/* ============================================================
   本地状态仓库（localStorage）
   存放：当前线路、档位、剧本预缓存、章节过场标记、好感展示基线
   ============================================================ */
(function (global) {
  'use strict';

  var NS = 'lovechoice_';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); } catch (e) {}
  }
  function drop(key) {
    try { localStorage.removeItem(NS + key); } catch (e) {}
  }

  var store = {
    // ---------- 会话偏好 ----------
    lastRoute: function () { return read('lastRoute', null); },
    setLastRoute: function (v) { write('lastRoute', v); },
    lastSlot: function () { return read('lastSlot', 0); },
    setLastSlot: function (v) { write('lastSlot', Number(v) || 0); },

    // ---------- 剧本缓存（整线剧本，避免翻页重复请求） ----------
    cacheKey: function (routeCode) { return 'script_' + routeCode; },
    script: function (routeCode) { return read(store.cacheKey(routeCode), null); },
    setScript: function (routeCode, data) { write(store.cacheKey(routeCode), data); },
    clearScript: function (routeCode) { drop(store.cacheKey(routeCode)); },
    clearAllScripts: function () {
      ['male', 'female'].forEach(function (r) { drop('script_' + r); });
    },

    // ---------- 好感显示基线（用于播放 +N / -N 飘字） ----------
    affBase: function (routeCode) { return read('affBase_' + routeCode, null); },
    setAffBase: function (routeCode, m, f) { write('affBase_' + routeCode, { m: m, f: f }); },

    // ---------- 已看过的章节过场（同一存档内只弹一次） ----------
    chapterSeenKey: function (routeCode, slot) { return 'chapSeen_' + routeCode + '_' + slot; },
    chapterSeen: function (routeCode, slot) {
      var v = read(store.chapterSeenKey(routeCode, slot), []);
      return Array.isArray(v) ? v : [];
    },
    markChapterSeen: function (routeCode, slot, chapterNo) {
      var list = store.chapterSeen(routeCode, slot);
      if (list.indexOf(Number(chapterNo)) === -1) {
        list.push(Number(chapterNo));
        write(store.chapterSeenKey(routeCode, slot), list);
      }
    },
    resetChapterSeen: function (routeCode, slot) { drop(store.chapterSeenKey(routeCode, slot)); },

    // ---------- 打字机速度偏好 ----------
    typingSpeed: function () { return read('typingSpeed', 'normal'); },
    setTypingSpeed: function (v) { write('typingSpeed', v); },

    // ---------- 路由缓存（列表页数据） ----------
    routesCache: function () { return read('routesCache', null); },
    setRoutesCache: function (v) { write('routesCache', v); }
  };

  global.Store = store;
})(window);