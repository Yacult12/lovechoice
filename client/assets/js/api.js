/* ============================================================
   API 封装层
   - 统一 BaseURL（本地直连 3000；上线后改成同源 /api 或写死域名）
   - 统一拆包 { code, message, data }
   - 统一带 JWT、401 自动跳登录
   ============================================================ */
(function (global) {
  'use strict';

  // 开发环境：前端 5500 / 8000 端口，接口走 3000
  var BASE = global.LOVE_API_BASE || 'http://127.0.0.1:3000';

  var TOKEN_KEY = 'lovechoice_token';
  var USER_KEY = 'lovechoice_user';

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function setUser(u) {
    try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); } catch (e) {}
  }

  /** 业务异常：带 code / httpStatus / details */
  function ApiError(message, code, httpStatus, details) {
    var e = new Error(message || '请求失败');
    e.name = 'ApiError';
    e.code = code;
    e.httpStatus = httpStatus;
    e.details = details || null;
    return e;
  }

  // 命中后端限流（429）时，让整个游戏进入短暂冷却，避免继续无意义地打接口。
  var RATE_LIMIT_COOLDOWN_MS = 8000;
  var rateLimitUntil = 0;

  function isRateLimited() {
    return Date.now() < rateLimitUntil;
  }

  function buildQuery(params) {
    if (!params) return '';
    var parts = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function request(method, path, body, options) {
    options = options || {};
    var url = BASE + path + buildQuery(options.query);
    var headers = { 'Accept': 'application/json' };
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';

    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    // 已被限流：在冷却期内直接失败，不再打后端
    if (isRateLimited()) {
      var left = Math.ceil((rateLimitUntil - Date.now()) / 1000);
      return Promise.reject(ApiError('操作太频繁，请 ' + left + ' 秒后再试', 40001, 429, null));
    }

    return fetch(url, {
      method: method,
      headers: headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
      signal: options.signal
    })
      .then(function (res) {
        return res.text().then(function (txt) {
          var payload;
          try { payload = txt ? JSON.parse(txt) : null; } catch (e) { payload = null; }
          if (!res.ok || !payload || typeof payload.code !== 'number' || payload.code !== 0) {
            var msg = (payload && payload.message) || ('请求失败（HTTP ' + res.status + '）');
            var code = payload && payload.code ? payload.code : res.status * 100;
            var details = payload && payload.details ? payload.details : null;

            // 命中限流：进入冷却，并读出后端给的等待秒数
            if (res.status === 429) {
              var retryAfter = Number(res.headers.get('Retry-After')) || RATE_LIMIT_COOLDOWN_MS / 1000;
              rateLimitUntil = Date.now() + retryAfter * 1000;
            }

            // 令牌失效：清理并跳登录。
            // 注意：登录/注册接口本身的 401（账号密码错误）不应触发跳转，
            // 否则会把登录页重渲染掉，用户看不到错误提示。
            if (res.status === 401 && token) {
              setToken(''); setUser(null);
              if (global.App && global.App.go) global.App.go('auth');
            }
            throw ApiError(msg, code, res.status, details);
          }
          return payload.data;
        });
      })
      .catch(function (err) {
        if (err && err.name === 'ApiError') throw err;
        throw ApiError('网络异常，请检查后端是否已启动', 0, 0, null);
      });
  }

  var api = {
    BASE: BASE,
    ApiError: ApiError,
    getToken: getToken,
    setToken: setToken,
    getUser: getUser,
    setUser: setUser,
    isLoggedIn: function () { return !!getToken(); },
    isRateLimited: isRateLimited,

    get: function (p, q) { return request('GET', p, null, { query: q }); },
    post: function (p, b) { return request('POST', p, b); },
    put: function (p, b) { return request('PUT', p, b); },
    patch: function (p, b) { return request('PATCH', p, b); },
    del: function (p) { return request('DELETE', p, null); },

    // ---- meta / health ----
    health: function () { return request('GET', '/api/health', null); },
    meta: function () { return request('GET', '/api/meta', null); },

    // ---- auth ----
    register: function (b) { return request('POST', '/api/auth/register', b); },
    login: function (b) { return request('POST', '/api/auth/login', b); },
    me: function () { return request('GET', '/api/auth/me', null); },
    updateProfile: function (b) { return request('PATCH', '/api/auth/profile', b); },
    changePassword: function (b) { return request('POST', '/api/auth/password', b); },

    // ---- story ----
    routes: function () { return request('GET', '/api/story/routes', null); },
    route: function (code) { return request('GET', '/api/story/routes/' + encodeURIComponent(code), null); },
    characters: function (code) { return request('GET', '/api/story/routes/' + encodeURIComponent(code) + '/characters', null); },
    chapterScript: function (code, no) {
      return request('GET', '/api/story/routes/' + encodeURIComponent(code) + '/chapters/' + no, null);
    },
    routeScript: function (code) {
      return request('GET', '/api/story/routes/' + encodeURIComponent(code) + '/script', null);
    },
    validate: function (code) {
      return request('GET', '/api/story/routes/' + encodeURIComponent(code) + '/validate', null);
    },
    endings: function (code) { return request('GET', '/api/story/endings', null, { query: { routeCode: code } }); },

    // ---- play ----
    start: function (b) { return request('POST', '/api/play/start', b); },
    state: function (q) { return request('GET', '/api/play/state', null, { query: q }); },
    advance: function (b) { return request('POST', '/api/play/advance', b); },
    choice: function (b) { return request('POST', '/api/play/choice', b); },
    enterChapter: function (b) { return request('POST', '/api/play/chapter', b); },
    settle: function (b) { return request('POST', '/api/play/settle', b); },
    tick: function (b) { return request('POST', '/api/play/tick', b); },

    // ---- saves ----
    saves: function () { return request('GET', '/api/saves', null); },
    save: function (slot) { return request('GET', '/api/saves/' + slot, null); },
    putSave: function (slot, b) { return request('PUT', '/api/saves/' + slot, b); },
    delSave: function (slot) { return request('DELETE', '/api/saves/' + slot, null); },

    // ---- me ----
    stats: function () { return request('GET', '/api/me/stats', null); },
    myEndings: function () { return request('GET', '/api/me/endings', null); },
    history: function (q) { return request('GET', '/api/me/history', null, { query: q }); }
  };

  global.API = api;
})(window);