/* ============================================================
   页面：登录 / 注册
   ============================================================ */
(function (global) {
  'use strict';
  var el = UI.el;

  function render(root) {
    var mode = 'login';
    var busy = false;

    var app = el('div.auth-wrap');
    root.innerHTML = '';
    root.appendChild(app);

    function draw() {
      UI.mount(app, [
        el('div.auth-card.card', [
          el('div.auth-logo', [
            el('div.mark', '💗'),
            el('h1', '拣 爱'),
            el('p', mode === 'login' ? '同一个故事，两种视角' : '创建账号，开始你的视角')
          ]),
          el('div#auth-err'),
          el('form', { onsubmit: submit }, [
            el('div.field', [
              el('label', '用户名'),
              el('input.input#f-user', {
                type: 'text', autocomplete: 'username', placeholder: '3-32 位字母 / 数字 / 下划线',
                value: (UI.$('#f-user') || {}).value || ''
              })
            ]),
            el('div.field', [
              el('label', '密码'),
              el('input.input#f-pass', {
                type: 'password',
                autocomplete: mode === 'login' ? 'current-password' : 'new-password',
                placeholder: '至少 6 位'
              })
            ]),
            mode === 'register' ? el('div.field', [
              el('label', '昵称（可选）'),
              el('input.input#f-nick', { type: 'text', placeholder: '游戏内显示的名字', maxlength: '32' })
            ]) : null,
            el('button.btn.btn-primary.btn-block.mt-16#f-submit', { type: 'submit' },
              mode === 'login' ? '登 录' : '注 册')
          ]),
          el('div.auth-switch', [
            mode === 'login' ? '还没有账号？' : '已经有账号了？',
            el('button', { type: 'button', onclick: function () { mode = mode === 'login' ? 'register' : 'login'; draw(); } },
              mode === 'login' ? '立即注册' : '去登录')
          ])
        ])
      ]);
    }

    function setErr(msg) {
      var box = UI.$('#auth-err', app);
      if (!box) return;
      UI.mount(box, msg ? el('div.auth-err', msg) : null);
    }

    function submit(e) {
      e.preventDefault();
      if (busy) return;

      var username = (UI.$('#f-user', app).value || '').trim();
      var password = UI.$('#f-pass', app).value || '';
      var nickInput = UI.$('#f-nick', app);
      var nickname = nickInput ? nickInput.value.trim() : '';

      setErr('');
      if (!username || !password) { setErr('请填写用户名和密码'); return; }
      if (mode === 'register' && password.length < 6) { setErr('密码至少 6 位'); return; }

      var btn = UI.$('#f-submit', app);
      busy = true;
      btn.disabled = true;
      btn.textContent = mode === 'login' ? '登录中…' : '注册中…';

      var payload = { username: username, password: password };
      if (mode === 'register' && nickname) payload.nickname = nickname;

      var call = mode === 'login' ? API.login(payload) : API.register(payload);

      call.then(function (data) {
        API.setToken(data.token);
        API.setUser(data.user);
        UI.toast(mode === 'login' ? '欢迎回来' : '注册成功，开始你的故事', 'ok');
        if (global.App) global.App.go('routes');
      }).catch(function (err) {
        busy = false;
        btn.disabled = false;
        btn.textContent = mode === 'login' ? '登 录' : '注 册';
        setErr(err.message || '操作失败');
      });
    }

    draw();
  }

  global.PageAuth = { render: render };
})(window);