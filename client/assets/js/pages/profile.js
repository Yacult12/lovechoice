/* ============================================================
   页面：个人中心
   ============================================================ */
(function (global) {
  'use strict';
  var el = UI.el;

  function render(root) {
    root.innerHTML = '';
    var wrap = el('div.page-inner.narrow');
    root.appendChild(wrap);
    UI.mount(wrap, UI.loading('正在读取个人数据…'));

    Promise.all([
      API.me().catch(function () { return API.getUser(); }),
      API.stats().catch(function () { return null; }),
      API.myEndings().catch(function () { return { list: [] }; })
    ]).then(function (res) {
      var user = res[0] || {};
      var stats = res[1];
      var endings = res[2].list || [];

      UI.mount(wrap, [
        el('div.page-title', '个人中心'),

        el('div.card.mb-16', [
          el('div.row', [
            el('div.avatar-mini', { style: { width: '52px', height: '52px', fontSize: '20px' } },
              UI.initials(user.nickname || user.username)),
            el('div', [
              el('div', { style: { fontSize: '19px', fontWeight: '700' } },
                user.nickname || user.username || '未登录'),
              el('div.tiny.faint', '@' + (user.username || '—') + '　注册于 ' + UI.fmtDate(user.createdAt))
            ]),
            el('span.spacer'),
            el('button.btn.btn-sm', { onclick: editNickname.bind(null, user) }, '修改昵称'),
            el('button.btn.btn-sm', { onclick: changePassword }, '修改密码')
          ])
        ]),

        stats ? el('div.mb-16', [
          el('div.page-title', { style: { fontSize: '19px', marginBottom: '12px' } }, '统计'),
          el('div.stat-grid', [
            statBox(stats.saveCount, '存档数'),
            statBox(stats.choiceCount, '总选择数'),
            statBox(UI.fmtDuration(stats.totalPlaySeconds), '累计游玩'),
            statBox(stats.bestAffection.male, '他的好感峰值', 'var(--male)'),
            statBox(stats.bestAffection.female, '她的好感峰值', 'var(--female)'),
            statBox(stats.endings.unlocked + '/' + stats.endings.total, '结局收集', 'var(--warn)')
          ])
        ]) : null,

        stats && stats.routes ? el('div.mb-16', [
          el('div.page-title', { style: { fontSize: '19px', marginBottom: '12px' } }, '各线进度'),
          el('div.grid.grid-2', stats.routes.map(function (r) {
            var chapterPct = r.chaptersTotal ? Math.round(r.chaptersReached / r.chaptersTotal * 100) : 0;
            var endingPct = r.endingsTotal ? Math.round(r.endingsUnlocked / r.endingsTotal * 100) : 0;
            return el('div.card', [
              el('div.row.mb-8', [
                el('span.tag.' + (r.route.routeCode === 'male' ? 'male' : 'female'), r.route.title),
                el('span.spacer'),
                el('span.tiny.faint', r.choiceCount + ' 次选择')
              ]),
              el('div.tiny.faint.mb-8', '章节 ' + r.chaptersReached + '/' + r.chaptersTotal + '（' + chapterPct + '%）'),
              el('div.progress-bar', { style: { height: '5px', borderRadius: '5px', background: 'rgba(0,0,0,.35)', overflow: 'hidden', marginBottom: '10px' } },
                el('i', {
                  style: {
                    display: 'block', height: '100%', width: chapterPct + '%',
                    background: r.route.routeCode === 'male'
                      ? 'linear-gradient(90deg,var(--male),#8fb0ff)'
                      : 'linear-gradient(90deg,var(--female),#ffabc8)'
                  }
                })),
              el('div.tiny.faint.mb-8', '结局 ' + r.endingsUnlocked + '/' + r.endingsTotal + '（' + endingPct + '%）'),
              el('div.progress-bar', { style: { height: '5px', borderRadius: '5px', background: 'rgba(0,0,0,.35)', overflow: 'hidden' } },
                el('i', {
                  style: {
                    display: 'block', height: '100%', width: endingPct + '%',
                    background: 'linear-gradient(90deg,var(--warn),#ffe6b0)'
                  }
                }))
            ]);
          }))
        ]) : null,

        el('div.card.mb-16', [
          el('div.row.mb-8', [
            el('div', { style: { fontSize: '19px', fontWeight: '700' } }, '已解锁结局'),
            el('span.spacer'),
            el('span.tiny.faint', endings.length + ' 个')
          ]),
          endings.length
            ? el('div.row.wrap', endings.map(function (e) {
              return el('span.tag' + (e.isHidden ? '.warn' : '.ok'), [
                (e.routeCode === 'male' ? '♂' : '♀') + ' ' + e.title
              ]);
            }))
            : el('div.tiny.faint', '还没有解锁任何结局')
        ]),

        el('div.row.wrap', [
          el('button.btn', { onclick: function () { global.App.go('routes'); } }, '回到游戏'),
          el('button.btn.btn-ghost', { onclick: function () { global.App.go('gallery'); } }, '结局图鉴'),
          el('button.btn.btn-ghost', { onclick: function () { global.App.go('history'); } }, '选择回看'),
          el('span.spacer'),
          el('button.btn.btn-danger', {
            onclick: function () {
              UI.modal({
                title: '退出登录？',
                body: '本地保存的令牌会被清除，存档数据保留在服务器。',
                confirmText: '退出',
                danger: true,
                onConfirm: function () {
                  API.setToken(''); API.setUser('');
                  Store.clearAllScripts();
                  UI.toast('已退出登录', 'ok');
                  global.App.go('auth');
                }
              });
            }
          }, '退出登录')
        ])
      ]);
    }).catch(function (err) {
      UI.mount(wrap, el('div.card', [
        el('div.mb-16', '加载失败：' + (err.message || '')),
        el('button.btn.btn-primary', { onclick: function () { global.App.go('auth'); } }, '重新登录')
      ]));
    });

    function statBox(v, k, color) {
      return el('div.card.stat-box', [
        el('div.v', { style: color ? { color: color } : {} }, String(v)),
        el('div.k', k)
      ]);
    }

    function editNickname(user) {
      var input = el('input.input', {
        value: user.nickname || '',
        placeholder: '新的昵称',
        maxlength: '32'
      });
      UI.modal({
        title: '修改昵称',
        body: '留空则使用用户名。',
        confirmText: '保存',
        extra: input,
        onConfirm: function () {
          var v = input.value.trim();
          if (!v) { UI.toast('昵称不能为空', 'err'); return false; }
          return API.updateProfile({ nickname: v }).then(function (u) {
            API.setUser(u);
            UI.toast('昵称已更新', 'ok');
            global.App.go('profile');
          });
        }
      });
    }

    function changePassword() {
      var oldP = el('input.input', { type: 'password', placeholder: '当前密码' });
      var newP = el('input.input', { type: 'password', placeholder: '新密码（至少 6 位）' });
      UI.modal({
        title: '修改密码',
        body: '修改成功后需要重新登录。',
        confirmText: '确认修改',
        extra: el('div', { style: { display: 'grid', gap: '10px' } }, [
          el('div', [el('label', { style: { display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px' } }, '当前密码'), oldP]),
          el('div', [el('label', { style: { display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '5px' } }, '新密码'), newP])
        ]),
        onConfirm: function () {
          if (!oldP.value || newP.value.length < 6) { UI.toast('请填写完整，新密码至少 6 位', 'err'); return false; }
          return API.changePassword({ oldPassword: oldP.value, newPassword: newP.value })
            .then(function () {
              UI.toast('密码已修改，请重新登录', 'ok');
              setTimeout(function () {
                API.setToken(''); API.setUser('');
                global.App.go('auth');
              }, 900);
            });
        }
      });
    }
  }

  global.PageProfile = { render: render };
})(window);