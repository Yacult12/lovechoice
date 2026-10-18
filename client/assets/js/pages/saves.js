/* ============================================================
   页面：存档管理（0-9 档位）
   ============================================================ */
(function (global) {
  'use strict';
  var el = UI.el;

  function render(root, ctx) {
    ctx = ctx || {};
    root.innerHTML = '';
    var wrap = el('div.page-inner');
    root.appendChild(wrap);
    UI.mount(wrap, UI.loading('正在读取存档…'));

    var preselectRoute = ctx.routeCode || Store.lastRoute() || 'male';

    function load() {
      API.saves().then(function (data) {
        var list = data.list || [];
        var bySlot = {};
        list.forEach(function (s) { bySlot[s.slot] = s; });

        UI.mount(wrap, [
          el('div.page-title', '存档管理'),
          el('div.page-sub', '共 10 个档位。每条故事线各自记录独立的进度与双好感度，随时切换继续。'),

          el('div.slot-grid', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (slot) {
            var s = bySlot[slot];
            var occ = !!s;

            return el('div.card.slot-card' + (occ ? '.occupied' : ''), [
              el('div.slot-no', 'SLOT ' + String(slot).padStart(2, '0')),
              el('div.slot-name', occ ? (s.chapterTitle || ('第 ' + s.chapterNo + ' 章')) : '空档位'),
              occ ? el('div.row.wrap.mb-8', [
                el('span.tag.' + (s.routeCode === 'male' ? 'male' : 'female'),
                  s.routeCode === 'male' ? '他的视角' : '她的视角'),
                s.playSeconds ? el('span.tiny.faint', '⏱ ' + UI.fmtDuration(s.playSeconds)) : null
              ]) : el('div.tiny.faint', '尚未使用'),

              occ ? el('div.kv', [
                el('span', '节点'),
                el('span', s.nodeKey)
              ]) : null,
              occ ? el('div.kv', [
                el('span', '更新时间'),
                el('span', UI.fmtDate(s.updatedAt))
              ]) : null,

              occ ? el('div.mini-aff', [
                el('div.m', { title: '他 ' + s.affectionMale }, el('i', { style: { width: UI.clampPct(s.affectionMale, 0, 100) + '%' } })),
                el('div.f', { title: '她 ' + s.affectionFemale }, el('i', { style: { width: UI.clampPct(s.affectionFemale, 0, 100) + '%' } }))
              ]) : null,

              el('div.ops', [
                el('button.btn.btn-sm' + (occ ? '.btn-primary' : ''), {
                  onclick: function () {
                    Store.setLastSlot(slot);
                    global.App.go('play', { routeCode: occ ? s.routeCode : preselectRoute, slot: slot });
                  }
                }, occ ? '继续' : '开始'),
                occ ? el('button.btn.btn-sm.btn-ghost', {
                  title: '章节列表',
                  onclick: showChapters(s)
                }, '章节') : null,
                occ ? el('button.btn.btn-sm.btn-danger', {
                  onclick: function () {
                    UI.modal({
                      title: '删除档位 ' + slot + '？',
                      body: '该档位的进度与好感度会被清空，无法恢复。',
                      confirmText: '删除',
                      danger: true,
                      onConfirm: function () {
                        return API.delSave(slot).then(function () {
                          UI.toast('已删除', 'ok');
                          Store.resetChapterSeen(s.routeCode, slot);
                          load();
                        });
                      }
                    });
                  }
                }, '删除') : null
              ])
            ]);
          })),

          el('div.mt-24', [
            el('button.btn.btn-ghost', { onclick: function () { global.App.go('routes'); } }, '← 返回故事线')
          ])
        ]);
      }).catch(function (err) {
        UI.mount(wrap, el('div.card', [
          el('div.mb-16', '读取失败：' + (err.message || '')),
          el('button.btn.btn-primary', { onclick: load }, '重试')
        ]));
      });
    }

    /** 章节跳转弹窗 */
    function showChapters(save) {
      API.route(save.routeCode).then(function (data) {
        var chapters = data.chapters || [];
        var list = el('div', { style: { display: 'grid', gap: '8px' } },
          chapters.map(function (c) {
            var isHere = c.chapterNo === save.chapterNo;
            return el('div.row', {
              style: {
                padding: '10px 13px', borderRadius: '10px',
                background: isHere ? 'var(--panel-strong)' : 'transparent',
                border: '1px solid var(--border)'
              }
            }, [
              el('div', [
                el('div', { style: { fontWeight: '600', fontSize: '14px' } }, c.title),
                el('div.tiny.faint', '起始节点 ' + c.startNode + (isHere ? ' · 当前所在' : ''))
              ]),
              el('span.spacer'),
              el('button.btn.btn-sm', {
                disabled: isHere,
                onclick: function () {
                  UI.closeAllModals();
                  global.App.go('play', {
                    routeCode: save.routeCode,
                    slot: save.slot,
                    jumpChapter: c.chapterNo
                  });
                }
              }, isHere ? '当前' : '跳到这里')
            ]);
          })
        );

        UI.modal({
          title: '章节跳转 · 档位 ' + save.slot,
          body: '跳转到任意章节会覆盖该档位当前进度（好感度保留）。',
          confirmText: null,
          cancelText: '关闭',
          extra: list
        });
      });
    }

    load();
  }

  global.PageSaves = { render: render };
})(window);