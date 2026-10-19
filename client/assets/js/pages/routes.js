/* ============================================================
   页面：线路选择（他的视角 / 她的视角）
   ============================================================ */
(function (global) {
  'use strict';
  var el = UI.el;

  var ICONS = { male: '♂', female: '♀' };

  /**
   * 打开「设置对方名字」弹窗。
   * 保存后立即刷新页面上所有已渲染的对白预览（如果有）。
   */
  function openNameModal(onSaved) {
    var cur = Store.partnerName();
    var input;

    UI.modal({
      title: '设置对方的名字',
      closable: true,
      body: el('div', [
        el('p.small.muted.mb-16',
          '剧本里原本用「他」「她」来指代对方。填一个名字后，' +
          '所有对白和旁白都会换成这个名字，看起来更像在说具体的人。'),
        el('div.field', [
          el('label', 'TA 的名字'),
          (input = el('input.input#f-partner', {
            type: 'text',
            maxlength: '12',
            placeholder: '例如：小满、阿泽、她',
            value: cur,
            autocomplete: 'off'
          }))
        ]),
        el('div.tiny.faint', '最多 12 个字。留空则沿用剧本里的「他 / 她」。')
      ]),
      confirmText: '保 存',
      cancelText: '取 消',
      onConfirm: function () {
        var v = (input.value || '').trim().slice(0, 12);
        Store.setPartnerName(v);
        UI.toast(v ? '之后的对白会显示「' + v + '」' : '已还原为「他 / 她」', 'ok');
        if (onSaved) onSaved(v);
      }
    });

    setTimeout(function () { if (input) input.focus(); }, 60);
  }

  /** 顶部的名字设置卡片 */
  function nameCard() {
    var cur = Store.partnerName();
    return el('div.card.mb-16', [
      el('div.row.wrap', [
        el('div', { style: { flex: '1', minWidth: '220px' } }, [
          el('div.small.muted', '对方的名字'),
          el('div.mt-4', cur
            ? el('span.tag.ok', { style: { fontSize: '14px' } }, cur)
            : el('span.tag', { style: { fontSize: '14px' } }, '未设置（对白里显示「他 / 她」）'))
        ]),
        el('button.btn.btn-sm', { onclick: function () { openNameModal(); } },
          cur ? '修改' : '现在设置')
      ])
    ]);
  }

  function render(root, ctx) {
    root.innerHTML = '';
    var wrap = el('div.page-inner');
    root.appendChild(wrap);
    UI.mount(wrap, UI.loading('正在读取故事线…'));

    var routeCode = (ctx && ctx.routeCode) || Store.lastRoute() || 'male';
    var slot = (ctx && ctx.slot !== undefined) ? ctx.slot : Store.lastSlot();

    Promise.all([API.routes(), API.saves(), API.myEndings().catch(function () { return { list: [] }; })])
      .then(function (res) {
        var routes = res[0].list || [];
        var saves = res[1].list || [];
        var unlocked = res[2].list || [];

        Store.setRoutesCache(routes);

        // 汇总每条线的进度
        function statOf(code) {
          var route = routes.filter(function (r) { return r.routeCode === code; })[0];
          if (!route) return null;

          var lineSaves = saves.filter(function (s) { return s.routeCode === code; });
          var chaptersReached = {};
          lineSaves.forEach(function (s) {
            if (s.chapterNo) chaptersReached[s.chapterNo] = true;
          });
          var reached = Object.keys(chaptersReached).length;

          var lineEnd = unlocked.filter(function (e) { return e.routeCode === code; });
          var hasSave = lineSaves.length > 0;

          return {
            route: route,
            hasSave: hasSave,
            reached: reached,
            chapterCount: route.chapterCount || 0,
            endingsUnlocked: lineEnd.length,
            endingsTotal: route.endingCount || 0,
            totalSeconds: lineSaves.reduce(function (a, s) { return a + (s.playSeconds || 0); }, 0)
          };
        }

        UI.mount(wrap, [
          el('div.page-title', '选择一条故事线'),
          el('div.page-sub', '同一个故事，从两个人的视角各走一遍 —— 你们的好感，会各自留下不同的痕迹。'),

          nameCard(),

          el('div.grid.grid-2', routes.map(function (r) {
            var st = statOf(r.routeCode) || {};
            var isMale = r.routeCode === 'male';
            var pct = st.chapterCount ? Math.min(100, Math.round((st.reached / st.chapterCount) * 100)) : 0;
            var endPct = st.endingsTotal ? Math.round(((st.endingsUnlocked || 0) / st.endingsTotal) * 100) : 0;

            return el('div.card.clickable.route-card.' + (isMale ? 'male' : 'female'), {
              onclick: function () {
                Store.setLastRoute(r.routeCode);
                if (global.App) global.App.go('play', { routeCode: r.routeCode, slot: slot });
              }
            }, [
              el('div.cover', ICONS[r.routeCode] || '💗'),
              el('div.body', [
                el('div.row.wrap.mb-8', [
                  el('h3', r.title),
                  st.hasSave ? el('span.tag.ok', '有存档') : el('span.tag', '未开始')
                ]),
                el('div.small.muted', r.description || ''),
                el('div.stats', [
                  el('span', '📖 ' + (st.chapterCount || 0) + ' 章'),
                  el('span', '🏁 ' + (st.endingsUnlocked || 0) + '/' + (st.endingsTotal || 0) + ' 结局'),
                  st.totalSeconds ? el('span', '⏱ ' + UI.fmtDuration(st.totalSeconds)) : null
                ]),
                el('div.tiny.faint.mb-8', '剧情进度 ' + pct + '%'),
                el('div.progress-bar', el('i', { style: { width: pct + '%' } })),
                el('div.tiny.faint.mb-8', '结局收集 ' + endPct + '%'),
                el('div.progress-bar', el('i', {
                  style: { width: endPct + '%', background: 'linear-gradient(90deg,var(--warn),#ffe0a3)' }
                })),
                el('button.btn.btn-primary.btn-block.mt-16', st.hasSave ? '继 续' : '开 始')
              ])
            ]);
          })),

          el('div.row.wrap.mt-24', [
            el('button.btn.btn-sm.btn-ghost', { onclick: function () { global.App.go('saves'); } }, '存档管理'),
            el('button.btn.btn-sm.btn-ghost', { onclick: function () { global.App.go('gallery'); } }, '结局图鉴'),
            el('button.btn.btn-sm.btn-ghost', { onclick: function () { global.App.go('history'); } }, '选择回看'),
            el('span.spacer'),
            el('span.tiny.faint', '当前档位：' + slot)
          ])
        ]);
      })
      .catch(function (err) {
        UI.mount(wrap, el('div.card', [
          el('div.mb-16', '加载失败：' + (err.message || '未知错误')),
          el('div.row', [
            el('button.btn.btn-primary', { onclick: function () { global.App.go('routes'); } }, '重试'),
            el('button.btn', { onclick: function () { global.App.go('auth'); } }, '返回登录')
          ])
        ]));
      });
  }

  global.PageRoutes = { render: render, openNameModal: openNameModal };
})(window);