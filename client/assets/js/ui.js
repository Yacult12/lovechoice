/* ============================================================
   UI 工具库：DOM 构建、Toast、Modal、格式化
   ============================================================ */
(function (global) {
  'use strict';

  // ---------- DOM ----------
  /** el('div.card', {onclick}, [children]) */
  function el(spec, attrs, children) {
    var parts = String(spec).split(/(?=[.#])/);
    var tag = parts[0] || 'div';
    var node = document.createElement(tag);

    parts.slice(1).forEach(function (p) {
      // 容错：忽略空 token（避免 'div.speaker.' 这类拼接产生空 class，
      // 在 jsdom / 严格实现下会抛 "The token provided must not be empty"）
      var token = p.slice(1);
      if (!token) return;
      if (p[0] === '.') node.classList.add(token);
      else if (p[0] === '#') node.id = token;
    });

    if (attrs && (typeof attrs !== 'object' || Array.isArray(attrs) || attrs instanceof Node)) {
      children = attrs; attrs = null;
    }

    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }

    append(node, children);
    return node;
  }

  function append(parent, children) {
    if (children === null || children === undefined || children === false) return parent;
    if (Array.isArray(children)) { children.forEach(function (c) { append(parent, c); }); return parent; }
    if (children instanceof Node) { parent.appendChild(children); return parent; }
    parent.appendChild(document.createTextNode(String(children)));
    return parent;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }
  function mount(node, children) { clear(node); append(node, children); return node; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ---------- Toast ----------
  function toast(msg, type, ms) {
    var host = document.getElementById('toast-host');
    if (!host) return;
    var t = el('div.toast' + (type ? '.' + type : ''), msg);
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(-10px)';
      setTimeout(function () { t.remove(); }, 320);
    }, ms || 2600);
  }

  // ---------- Modal ----------
  var modalStack = [];

  /**
   * modal({ title, body, confirmText, cancelText, danger, onConfirm })
   * onConfirm 可以返回 Promise；返回 false 阻止关闭。
   */
  function modal(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var mask = el('div.modal-mask');
      var box = el('div.modal', [
        el('h3', opts.title || '提示'),
        opts.body ? el('p', opts.body) : null,
        opts.extra || null,
        el('div.ops', [
          opts.cancelText === null ? null : el('button.btn.btn-ghost', {
            onclick: function () { close(false); }
          }, opts.cancelText || '取消'),
          el('button.btn' + (opts.danger ? '.btn-danger' : '.btn-primary'), {
            id: 'modal-ok',
            onclick: function () { confirm(); }
          }, opts.confirmText || '确定')
        ])
      ]);
      mask.appendChild(box);
      mask.addEventListener('click', function (e) {
        if (e.target === mask && opts.maskClosable !== false) close(false);
      });

      var entry = { mask: mask, close: close };
      modalStack.push(entry);
      document.getElementById('modal-host').appendChild(mask);

      function onKey(e) { if (e.key === 'Escape') close(false); }
      document.addEventListener('keydown', onKey);

      function confirm() {
        var btn = box.querySelector('#modal-ok');
        if (btn) btn.disabled = true;
        var r = opts.onConfirm ? opts.onConfirm() : true;
        Promise.resolve(r).then(function (v) {
          if (v === false) { if (btn) btn.disabled = false; return; }
          close(true);
        }).catch(function (err) {
          if (btn) btn.disabled = false;
          toast((err && err.message) || '操作失败', 'err');
        });
      }

      function close(v) {
        document.removeEventListener('keydown', onKey);
        mask.style.transition = 'opacity .2s';
        mask.style.opacity = '0';
        setTimeout(function () {
          mask.remove();
          modalStack = modalStack.filter(function (m) { return m !== entry; });
        }, 210);
        resolve(v);
      }
    });
  }

  function closeAllModals() {
    modalStack.slice().forEach(function (m) { m.close(false); });
  }

  // ---------- 格式化 ----------
  function fmtDate(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function fmtDuration(sec) {
    sec = Number(sec) || 0;
    if (sec < 60) return sec + ' 秒';
    var m = Math.floor(sec / 60);
    if (m < 60) return m + ' 分钟';
    var h = Math.floor(m / 60);
    return h + ' 小时 ' + (m % 60) + ' 分';
  }

  function clampPct(v, min, max) {
    v = Number(v) || 0;
    if (max === min) return 0;
    return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  }

  /** 差值显示：+12 / -8 / 0 */
  function deltaText(d) {
    d = Number(d) || 0;
    if (d > 0) return '+' + d;
    return String(d);
  }
  function deltaClass(d) {
    d = Number(d) || 0;
    return d > 0 ? 'up' : d < 0 ? 'down' : 'zero';
  }

  function initials(name) {
    name = String(name || '').trim();
    if (!name) return '?';
    return name.slice(0, 1).toUpperCase();
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function loading(text) {
    return el('div.loading', [el('div.spinner'), el('div.small', text || '加载中…')]);
  }

  function empty(icon, text, action) {
    return el('div.empty', [
      el('div.big', icon || '🫧'),
      el('div', text || '这里还什么都没有'),
      action ? el('div.mt-16', action) : null
    ]);
  }

  /**
   * 背景资源表：bgKey → 实体 SVG。
   * 找不到图时自动降级为渐变，保证任何剧本都不会开天窗。
   */
  /**
   * 美术资源路径一律从「站点根」起算，即 assets/img/...。
   *
   * ⚠️ 坑：相对 URL 由浏览器按 **文档地址**（http://host/）解析，
   * 不是按脚本文件所在目录。所以这里绝不能写 '../' 或 '../../'，
   * 从根目录再往上跳就越出站点范围、直接 404。
   */
  var IMG_BASE = 'assets/img/';

  var BG_IMAGES = {
    library:   IMG_BASE + 'bg/library.svg',
    classroom: IMG_BASE + 'bg/classroom.svg',
    street:    IMG_BASE + 'bg/street.svg',
    dorm:      IMG_BASE + 'bg/dorm.svg',
    corridor:  IMG_BASE + 'bg/corridor.svg',
    cafe:      IMG_BASE + 'bg/cafe.svg',
    rooftop:   IMG_BASE + 'bg/rooftop.svg',
    rain:      IMG_BASE + 'bg/rain.svg'
  };

  /** 章节背景图 key → 渐变降级方案 */
  var BG_PRESETS = {
    library: 'linear-gradient(150deg,#2b3350,#151a2b 60%,#0f1120)',
    classroom: 'linear-gradient(150deg,#3a3350,#1d1a2c 60%,#121019)',
    street: 'linear-gradient(150deg,#2e3b45,#1a2229 60%,#0f1418)',
    dorm: 'linear-gradient(150deg,#3d2f3f,#221a26 60%,#130f18)',
    corridor: 'linear-gradient(150deg,#3a2c3a,#1f1822 60%,#120e15)',
    cafe: 'linear-gradient(150deg,#4a3524,#241a12 60%,#140f0b)',
    rooftop: 'linear-gradient(150deg,#25405c,#141d29 60%,#0c1119)',
    rain: 'linear-gradient(150deg,#263043,#151a24 60%,#0d1017)',
    default: 'linear-gradient(150deg,#33304a,#1b1927 60%,#0f0e16)'
  };

  /** 取背景图 URL；剧本里没有对应图时返回 null（调用方回退渐变）。 */
  function bgImage(bgKey) {
    return BG_IMAGES[bgKey] || null;
  }

  /**
   * 归一化任意写法的立绘/背景路径为可加载的绝对 URL。
   * 容忍 DB 里遗留的 '../../img/...' 之类越界写法 —— 剥掉所有 ../ 前缀后重接 assets/。
   */
  function assetUrl(path) {
    if (!path) return '';
    var s = String(path).trim();
    if (/^(https?:)?\/\//.test(s) || s.charAt(0) === '/') return s;
    // 剥掉任意层级的 ../ 与 ./，再补上 assets/ 前缀
    var cleaned = s.replace(/^(\.\.\/|\.\/)+/, '');
    if (cleaned.indexOf('img/') === 0) return IMG_BASE + cleaned;
    return cleaned;
  }

  function bgStyle(bgKey) {
    var g = BG_PRESETS[bgKey] || BG_PRESETS.default;
    return { backgroundImage: g };
  }

  /** 依据 bgKey 猜测角色性别，用于给对白框上色 */
  function speakerClass(speaker) {
    if (!speaker) return 'narration';
    if (/旁白|字幕|narrat/i.test(speaker)) return 'narration';
    return '';
  }

  global.UI = {
    el: el, append: append, mount: mount, clear: clear, $: $, $$: $$,
    toast: toast, modal: modal, closeAllModals: closeAllModals,
    fmtDate: fmtDate, fmtDuration: fmtDuration, clampPct: clampPct,
    deltaText: deltaText, deltaClass: deltaClass, initials: initials,
    escapeHtml: escapeHtml, loading: loading, empty: empty,
    bgStyle: bgStyle, bgImage: bgImage, assetUrl: assetUrl,
    BG_IMAGES: BG_IMAGES, speakerClass: speakerClass
  };
})(window);