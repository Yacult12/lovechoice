/* ============================================================
   页面：结局图鉴
   ============================================================ */
(function (global) {
  'use strict';
  var el = UI.el;

  function render(root, ctx) {
    ctx = ctx || {};
    root.innerHTML = '';
    var wrap = el('div.page-inner');
    root.appendChild(wrap);
    UI.mount(wrap, UI.loading('正在读取结局…'));

    var routeCode = ctx.routeCode || Store.lastRoute() || null;

    function load() {
      Promise.all([
        API.routes(),
        routeCode ? API.endings(routeCode) : Promise.resolve(null),
        API.myEndings().catch(function () { return { list: [] }; })
      ]).then(function (res) {
        var routes = res[0].list || [];
        var unlocked = res[2].list || [];

        var unlockedById = {};
        unlocked.forEach(function (u) { unlockedById[u.endingId] = u; });

        if (!routeCode) routeCode = routes.length ? routes[0].routeCode : null;

        var tabs = el('div.row.wrap.mb-24', routes.map(function (r) {
          var lineUnlocked = unlocked.filter(function (u) { return u.routeCode === r.routeCode; }).length;
          return el('button.btn.btn-sm' + (r.routeCode === routeCode ? '.btn-primary' : '.btn-ghost'), {
            onclick: function () { routeCode = r.routeCode; load(); }
          }, [
            r.title,
            el('span.tiny.faint', { style: { marginLeft: '6px' } }, lineUnlocked + '/' + r.endingCount)
          ]);
        }));

        if (!routeCode) {
          UI.mount(wrap, UI.empty('📕', '还没有任何故事线', el('button.btn.btn-primary', {
            onclick: function () { global.App.go('routes'); }
          }, '去选择')));
          return;
        }

        API.endings(routeCode).then(function (data) {
          var endings = data.endings || [];
          var unlockedCount = endings.filter(function (e) { return e.unlocked; }).length;

          UI.mount(wrap, [
            el('div.page-title', '结局图鉴'),
            el('div.page-sub', '同一条故事线，不同的好感度走向会通向不同的结局。隐藏结局需要特殊条件才会出现。'),
            tabs,

            el('div.card.mb-16', [
              el('div.row', [
                el('div', [
                  el('div.tiny.faint.mb-8', '收集进度'),
                  el('div', { style: { fontSize: '22px', fontWeight: '700' } },
                    unlockedCount + ' / ' + endings.length)
                ]),
                el('span.spacer'),
                el('div', { style: { width: '190px' } }, [
                  el('div.progress-bar', { style: { height: '8px', borderRadius: '8px', background: 'rgba(0,0,0,.35)', overflow: 'hidden' } },
                    el('i', {
                      style: {
                        display: 'block', height: '100%',
                        width: (endings.length ? (unlockedCount / endings.length * 100) : 0) + '%',
                        background: 'linear-gradient(90deg,var(--warn),#ffe6b0)'
                      }
                    })
                  )
                ])
              ])
            ]),

            endings.length
              ? el('div.ending-grid', endings.map(function (e) {
                var rec = unlockedById[e.id];
                return el('div.card.ending-card-item' + (e.unlocked ? '' : '.locked'), [
                  el('div.ic', e.unlocked ? (e.isHidden ? '🌙' : '🏁') : '🔒'),
                  el('h4', e.unlocked ? e.title : (e.isHidden ? '？？？' : '未解锁')),
                  el('p', e.unlocked ? (e.description || '') : '走一遍这条故事线来解锁它。'),
                  el('div.mt-16', [
                    e.isHidden ? el('span.tag.warn', '隐藏结局') : el('span.tag', '普通结局'),
                    e.unlocked && rec ? el('span.tiny.faint', { style: { marginLeft: '8px' } }, UI.fmtDate(rec.unlockedAt)) : null
                  ])
                ]);
              }))
              : UI.empty('🕳', '这条故事线还没有配置结局'),

            el('div.mt-24', [
              el('button.btn.btn-ghost', { onclick: function () { global.App.go('routes'); } }, '← 返回故事线')
            ])
          ]);
        });
      }).catch(function (err) {
        UI.mount(wrap, el('div.card', [
          el('div.mb-16', '读取失败：' + (err.message || '')),
          el('button.btn.btn-primary', { onclick: load }, '重试')
        ]));
      });
    }

    load();
  }

  global.PageGallery = { render: render };
})(window);