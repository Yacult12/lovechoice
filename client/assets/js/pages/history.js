/* ============================================================
   页面：选择回看（choice_logs）
   ============================================================ */
(function (global) {
  'use strict';
  var el = UI.el;

  var state = { routeCode: null, page: 1, pageSize: 12 };

  function render(root, ctx) {
    ctx = ctx || {};
    root.innerHTML = '';
    var wrap = el('div.page-inner');
    root.appendChild(wrap);

    if (ctx.routeCode) state.routeCode = ctx.routeCode;
    if (ctx.page) state.page = ctx.page;

    var mounted = false;

    function skeleton() {
      UI.mount(wrap, [
        el('div.page-title', '选择回看'),
        el('div.page-sub', '你做过的每一个决定，以及它给双方好感带来的变化。'),
        el('div#hist-tabs.row.wrap.mb-16'),
        el('div#hist-body', UI.loading('正在读取选择记录…'))
      ]);
    }

    function drawTabs(routes) {
      var host = UI.$('#hist-tabs', wrap);
      if (!host) return;
      UI.mount(host, [
        el('button.btn.btn-sm' + (state.routeCode === null ? '.btn-primary' : '.btn-ghost'), {
          onclick: function () { state.routeCode = null; state.page = 1; load(); }
        }, '全部'),
        routes.map(function (r) {
          return el('button.btn.btn-sm' + (state.routeCode === r.routeCode ? '.btn-primary' : '.btn-ghost'), {
            onclick: function () { state.routeCode = r.routeCode; state.page = 1; load(); }
          }, r.title);
        })
      ]);
    }

    var routes = [];

    function load() {
      API.routes().then(function (d) {
        routes = d.list || [];
        drawTabs(routes);
      }).catch(function () {});

      var q = { page: state.page, pageSize: state.pageSize };
      if (state.routeCode) q.routeCode = state.routeCode;

      API.history(q).then(function (data) {
        var list = data.list || [];
        var body = UI.$('#hist-body', wrap);
        if (!body) return;

        if (!list.length) {
          UI.mount(body, UI.empty('📜', '还没有选择记录', el('button.btn.btn-primary', {
            onclick: function () { global.App.go('routes'); }
          }, '去玩一局')));
          return;
        }

        var items = list.map(function (it) {
          return el('div.card.history-item', [
            el('div.top', [
              el('span.tag.' + (it.routeCode === 'male' ? 'male' : 'female'),
                it.routeCode === 'male' ? '他的视角' : '她的视角'),
              it.chapterNo ? el('span.tag', '第 ' + it.chapterNo + ' 章 · ' + (it.chapterTitle || '')) : null,
              el('span.spacer'),
              el('span.tiny.faint', UI.fmtDate(it.createdAt))
            ]),
            it.nodeContent ? el('div.ctx', it.nodeContent) : null,
            el('div.picked', [
              el('span.k', '你选择了：'),
              it.optionText || '（选项已删除）'
            ]),
            el('div.aff-diff', [
              affIt('他', it.affectionBefore.male, it.affectionAfter.male),
              affIt('她', it.affectionBefore.female, it.affectionAfter.female)
            ])
          ]);
        });

        UI.mount(body, [
          el('div.row.mb-16', [
            el('span.small.muted', '共 ' + data.total + ' 条记录'),
            el('span.spacer'),
            data.page > 1 ? el('button.btn.btn-sm', {
              onclick: function () { state.page--; load(); }
            }, '← 上一页') : null,
            data.hasMore ? el('button.btn.btn-sm', {
              onclick: function () { state.page++; load(); }
            }, '下一页 →') : null
          ]),
          items
        ]);

        // 滚到顶部
        if (!mounted) {
          mounted = true;
          root.scrollTop = 0;
        } else {
          root.scrollTop = 0;
        }
      }).catch(function (err) {
        var body = UI.$('#hist-body', wrap);
        if (body) UI.mount(body, el('div.card', '读取失败：' + (err.message || '')));
      });
    }

    function affIt(label, before, after) {
      var d = (after || 0) - (before || 0);
      return el('div.it', [
        el('span', label + '：'),
        el('span.before', String(before)),
        el('span.arrow', '→'),
        el('span.after', String(after)),
        el('span.delta.' + UI.deltaClass(d), '(' + UI.deltaText(d) + ')')
      ]);
    }

    skeleton();
    load();
  }

  global.PageHistory = { render: render };
})(window);