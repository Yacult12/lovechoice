/* ============================================================
   应用入口：极简 hash 路由 + 页面调度
   路由表：
     #/auth               登录/注册
     #/routes             故事线选择
     #/play/:route/:slot  剧情（可带 ?chapter=N）
     #/saves              存档管理
     #/gallery            结局图鉴
     #/history            选择回看
     #/profile            个人中心
   ============================================================ */
(function (global) {
  'use strict';

  var appRoot = document.getElementById('app');
  var leaveHooks = [];
  var el = UI.el;

  var ROUTES = [
    { name: 'auth',    path: /^\/auth$/,               page: 'PageAuth',    nav: false },
    { name: 'routes',  path: /^\/routes$/,             page: 'PageRoutes',  nav: true },
    { name: 'saves',   path: /^\/saves$/,              page: 'PageSaves',   nav: true },
    { name: 'gallery', path: /^\/gallery(?:\/(\w+))?$/, page: 'PageGallery', nav: true },
    { name: 'history', path: /^\/history$/,            page: 'PageHistory', nav: true },
    { name: 'profile', path: /^\/profile$/,            page: 'PageProfile', nav: true },
    { name: 'play',    path: /^\/play\/(\w+)(?:\/(\d+))?$/, page: 'PagePlay', nav: false }
  ];

  var NAV_ITEMS = [
    { name: 'routes',  hash: '#/routes',  text: '故事线' },
    { name: 'saves',   hash: '#/saves',   text: '存档' },
    { name: 'gallery', hash: '#/gallery', text: '结局图鉴' },
    { name: 'history', hash: '#/history', text: '回看' },
    { name: 'profile', hash: '#/profile', text: '我的' }
  ];

  var current = { name: null };

  function parseHash() {
    var raw = (location.hash || '').replace(/^#/, '');
    if (!raw || raw === '/') raw = '/routes';
    var qIdx = raw.indexOf('?');
    var path = qIdx === -1 ? raw : raw.slice(0, qIdx);
    var query = {};
    if (qIdx !== -1) {
      raw.slice(qIdx + 1).split('&').forEach(function (kv) {
        var p = kv.split('=');
        if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    }
    return { path: path, query: query };
  }

  function onLeave(fn) { leaveHooks.push(fn); }
  function fireLeave() {
    leaveHooks.forEach(function (fn) { try { fn(); } catch (e) {} });
    leaveHooks = [];
  }

  // ---------- 顶栏 ----------
  function buildTopbar(active) {
    if (current.name === 'play' || current.name === 'auth') return null;

    var user = API.getUser();

    return el('div.topbar', [
      el('a.logo', { href: '#/routes' }, [
        el('span.heart', '💗'),
        el('span', '他们的故事')
      ]),
      el('nav.nav', NAV_ITEMS.map(function (it) {
        return el('a', {
          href: it.hash,
          class: active === it.name ? 'active' : ''
        }, it.text);
      })),
      el('span.spacer'),
      user ? el('a.user-chip', { href: '#/profile' }, [
        el('span', user.nickname || user.username || '我'),
        el('span.avatar-mini', UI.initials(user.nickname || user.username))
      ]) : null
    ]);
  }

  // ---------- 渲染 ----------
  function render() {
    var parsed = parseHash();
    var matched = null;
    var params = [];

    for (var i = 0; i < ROUTES.length; i++) {
      var m = parsed.path.match(ROUTES[i].path);
      if (m) {
        matched = ROUTES[i];
        params = m.slice(1);
        break;
      }
    }

    // 未登录 → 一律回登录页
    if (!API.isLoggedIn() && matched && matched.name !== 'auth') {
      location.hash = '#/auth';
      return;
    }
    // 已登录还停在登录页 → 回故事线
    if (API.isLoggedIn() && (!matched || matched.name === 'auth')) {
      location.hash = '#/routes';
      return;
    }

    fireLeave();
    UI.closeAllModals();

    appRoot.innerHTML = '';
    current.name = matched ? matched.name : null;

    var topbar = buildTopbar(current.name);
    if (topbar) appRoot.appendChild(topbar);

    var page = el('div.page');
    appRoot.appendChild(page);

    var ctx = Object.assign({}, parsed.query);
    params.forEach(function (p, i) {
      if (p !== undefined) ctx['arg' + i] = p;
    });

    if (!matched) {
      UI.mount(page, el('div.page-inner', UI.empty('🧭', '页面不存在',
        el('a.btn.btn-primary', { href: '#/routes' }, '回到故事线'))));
      return;
    }

    try {
      global[matched.page].render(page, ctx);
    } catch (err) {
      console.error('[App] 页面渲染失败:', err);
      UI.mount(page, el('div.page-inner', el('div.card', [
        el('div.mb-16', '页面出错了：' + (err && err.message)),
        el('pre.tiny.faint', { style: { whiteSpace: 'pre-wrap', maxHeight: '220px', overflow: 'auto' } },
          (err && err.stack) || ''),
        el('a.btn.btn-primary.mt-16', { href: '#/routes' }, '回到故事线')
      ])));
    }

    page.scrollTop = 0;
  }

  /** 程序化跳转：go('play', { routeCode:'male', slot:0 }) */
  function go(name, params) {
    params = params || {};
    var hash = '#/' + name;

    if (name === 'play') {
      hash += '/' + (params.routeCode || Store.lastRoute() || 'male');
      if (params.slot !== undefined && params.slot !== null) hash += '/' + params.slot;
    }

    var q = [];
    if (params.chapter) q.push('chapter=' + params.chapter);
    if (params.routeCode && name !== 'play') q.push('routeCode=' + params.routeCode);
    if (params.page) q.push('page=' + params.page);
    if (q.length) hash += '?' + q.join('&');

    if (location.hash === hash) render();
    else location.hash = hash;
  }

  window.addEventListener('hashchange', render);
  global.App = { go: go, onLeave: onLeave, current: current, routes: ROUTES };

  // 首次进入：没 hash 就给一个默认
  if (!location.hash) location.hash = API.isLoggedIn() ? '#/routes' : '#/auth';
  render();
})(window);