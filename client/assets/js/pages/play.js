/* ============================================================
   页面：剧情（核心页）
   - 背景 / 立绘 / 对白打字机 / 选项按钮 / 双好感度条 / 章节过场 / 结局卡
   - 所有跳转都由 /api/play/* 的返回驱动，前端不含剧本逻辑
   ============================================================ */
(function (global) {
  'use strict';
  var el = UI.el;

  var SPEED = { fast: 12, normal: 28, slow: 55 };

  function render(root, ctx) {
    ctx = ctx || {};
    var routeCode = ctx.routeCode || Store.lastRoute() || 'male';
    var slot = ctx.slot !== undefined && ctx.slot !== null ? Number(ctx.slot) : Store.lastSlot();

    Store.setLastRoute(routeCode);
    Store.setLastSlot(slot);

    var isMale = routeCode === 'male';

    // ---------- DOM 骨架 ----------
    var bg = el('div.scene-bg');
    var stageTop = el('div.stage-top');
    var portraitBox = el('div.portrait');
    var dialogueArea = el('div.dialogue-area');
    var gestureTray = el('div.gesture-tray');
    var stage = el('div#stage', [bg, stageTop, portraitBox, dialogueArea, gestureTray]);

    var page = el('div.page', stage);
    root.innerHTML = '';
    root.appendChild(page);

    // ---------- 运行时状态 ----------
    var S = {
      busy: false,
      node: null,
      save: null,
      affection: { male: 0, female: 0 },
      typingTimer: null,
      typingFull: '',
      typingDone: true,
      routeMeta: null,
      character: null,
      pendingEnd: false,
      showAff: false,
      sceneFlare: null
    };

    // ============================================================
    // 顶栏
    // ============================================================
    /**
     * 顶栏。
     *
     * 好感度条默认**不在对白中出现** —— 数值会打断沉浸感。
     * 想看数值时点右上角「♡」按钮临时唤出，再点一次收起。
     * （选择结算的飘字仍会短暂出现，那是有意义的反馈。）
     */
    function renderTop() {
      UI.mount(stageTop, [
        el('button.btn.btn-sm.btn-ghost', { onclick: backToRoutes }, '← 返回'),

        el('div.affection-bars' + (S.showAff ? '.revealed' : ''), [
          affBar('male', '他'),
          affBar('female', '她')
        ]),

        el('span.spacer'),

        S.save ? el('span.tiny.faint', [
          el('div', (S.save.chapterTitle || '第 ' + (S.save.chapterNo || '?') + ' 章') + '　档位 ' + S.save.slot),
          S.save.playSeconds ? el('div', '⏱ ' + UI.fmtDuration(S.save.playSeconds)) : null
        ]) : null,

        // 对方的名字：点一下可随时改，改完立刻重画当前这句对白
        el('button.btn.btn-sm.btn-ghost', {
          title: '设置对方的名字',
          onclick: function () {
            openName();
          }
        }, '✎ ' + (Store.partnerName() || '名字')),

        el('button.btn.btn-sm.btn-ghost', {
          title: global.Music && Music.isOn() ? '关闭背景音乐' : '开启背景音乐',
          onclick: function () {
            if (!global.Music) return;
            var on = Music.toggle();
            renderTop();
            UI.toast(on ? '背景音乐已开启' : '背景音乐已关闭');
          }
        }, global.Music && Music.isOn() ? '🔊' : '🔇'),

        el('button.btn.btn-sm.btn-ghost', {
          title: S.showAff ? '隐藏好感度' : '查看好感度',
          onclick: function () {
            S.showAff = !S.showAff;
            renderTop();
          }
        }, '♡'),

        el('button.btn.btn-sm.btn-ghost', {
          title: '切换打字速度',
          onclick: function () {
            var order = ['fast', 'normal', 'slow'];
            var next = order[(order.indexOf(Store.typingSpeed()) + 1) % order.length];
            Store.setTypingSpeed(next);
            UI.toast('打字速度：' + speedLabel(next));
            renderTop();
          }
        }, '⏩ ' + speedLabel(Store.typingSpeed())),

        el('button.btn.btn-sm.btn-ghost', {
          onclick: function () {
            UI.modal({
              title: '存档管理',
              body: '跳到其它档位或章节？当前进度已自动保存。',
              confirmText: '打开存档页',
              cancelText: '取消',
              onConfirm: function () { global.App.go('saves'); }
            });
          }
        }, '☰ 菜单')
      ]);
    }

    function speedLabel(v) {
      return v === 'fast' ? '快' : v === 'slow' ? '慢' : '正常';
    }

    /**
     * 改名字的弹窗入口。
     * 保存后重画当前节点 —— 不重画的话，玩家会看到「他」突然变成新名字，
     * 但已经打出来的半句还是旧的，很出戏。
     */
    function openName() {
      var cur = Store.partnerName();
      var input;

      UI.modal({
        title: '设置对方的名字',
        body: el('div', [
          el('p.small.muted.mb-16',
            '剧本里用「他」「她」指代对方。填入名字后，所有对白和旁白都会替换成这个名字。'),
          el('div.field', [
            el('label', 'TA 的名字'),
            (input = el('input.input#f-partner-play', {
              type: 'text', maxlength: '12', placeholder: '留空则用「他 / 她」',
              value: cur, autocomplete: 'off'
            }))
          ]),
          el('div.tiny.faint', '最多 12 个字')
        ]),
        confirmText: '保 存',
        cancelText: '取 消',
        onConfirm: function () {
          var v = (input.value || '').trim().slice(0, 12);
          Store.setPartnerName(v);
          UI.toast(v ? '之后的对白会显示「' + v + '」' : '已还原为「他 / 她」', 'ok');
          // 重画当前这句，让替换立刻可见
          if (S.node) {
            stopTyping();
            S.typingDone = true;
            renderDialogueOrChoice(S.node);
          }
          renderTop();
        }
      });

      setTimeout(function () { if (input) input.focus(); }, 60);
    }

    function affBar(side, label) {
      var val = S.affection[side] || 0;
      return el('div.aff-bar.' + side, [
        el('div.lab', [el('span', label + '的好感'), el('b', String(val))]),
        el('div.track', el('i.fill#fill-' + side))
      ]);
    }

    function updateBars(deltas) {
      ['male', 'female'].forEach(function (side) {
        var bar = UI.$('#fill-' + side, stageTop);
        if (!bar) return;
        var pct = UI.clampPct(S.affection[side], 0, 100);
        bar.style.width = pct + '%';
        var d = deltas ? (deltas[side === 'male' ? 'male' : 'female'] || 0) : 0;
        if (d) {
          bar.classList.remove('bump');
          void bar.offsetWidth;
          bar.classList.add('bump');
          popAffection(side, d);
        }
        // 数值文本
        var lab = bar.closest('.aff-bar').querySelector('b');
        if (lab) lab.textContent = String(S.affection[side]);
      });
    }

    function popAffection(side, d) {
      var box = UI.$('#fill-' + side, stageTop);
      if (!box) return;
      var host = box.closest('.aff-bar');
      var pop = el('div.aff-pop.' + (d > 0 ? 'up' : 'down'), UI.deltaText(d));
      host.style.position = 'relative';
      host.appendChild(pop);
      setTimeout(function () { pop.remove(); }, 1600);
    }

    // ============================================================
    // 场景渲染
    // ============================================================
    /**
     * 立绘选择逻辑：
     *   - 她：文件名带章节号（female-c{章}-{表情}.svg），形象随剧情推进演化
     *   - 他：形象固定，只有表情变化
     * 情绪由当前好感推导（≥55 高、≥20 中、其余低）。
     */
    function moodOf(side) {
      var v = S.affection[side] || 0;
      if (v >= 55) return 'high';
      if (v >= 20) return 'mid';
      return 'low';
    }

    // 当前章节（1-5），用于挑选她的阶段形象
    function chapterNo() {
      var n = S.save && S.save.chapterNo ? Number(S.save.chapterNo) : 1;
      return Math.min(5, Math.max(1, n || 1));
    }

    // 情绪 → 表情候选
    var MOOD_FILES = {
      high: ['smile', 'smile', 'soft'],
      mid: ['soft', 'soft', 'away'],
      low: ['down', 'away', 'down']
    };

    function pickAvatar(side) {
      var base = UI.assetUrl((S.character && S.character[side] && S.character[side].avatarUrl) || '');
      if (!base) return '';

      var mood = moodOf(side);
      var list = MOOD_FILES[mood];
      // 同一情绪有多个表情时轮换，避免一直是同一张脸
      var idx = S.avatarTick = ((S.avatarTick || 0) + 1) % list.length;
      var expr = list[idx];

      var name = side === 'female'
        ? 'female-c' + chapterNo() + '-' + expr + '.svg'
        : 'male-' + expr + '.svg';

      return base.replace(/[^/]+$/, name);
    }

    function renderScene(node) {
      // 背景：优先实体图，没有就降级渐变；先淡出换图，再淡入，附带缓慢推近
      var key = node && node.bgKey ? node.bgKey : 'default';
      var cur = bg.dataset.bgKey;
      if (cur !== key) {
        bg.style.transition = 'opacity .45s';
        bg.style.opacity = '0.18';
        setTimeout(function () {
          var url = UI.bgImage(key);
          if (url) {
            // 图片加载成功就用图，失败自动回退渐变
            var probe = new Image();
            probe.onload = function () { bg.style.backgroundImage = 'url("' + url + '")'; };
            probe.onerror = function () { Object.assign(bg.style, UI.bgStyle(key)); };
            probe.src = url;
          } else {
            Object.assign(bg.style, UI.bgStyle(key));
          }
          bg.style.opacity = '1';
        }, cur ? 240 : 0);
        bg.dataset.bgKey = key;
      }

      // 立绘：按说话人决定显示谁
      var speaker = node && node.speaker ? String(node.speaker) : '';
      var want = 'none';
      if (speaker && !/旁白|narrat/i.test(speaker)) {
        want = 'male';
        if (/她|妳|女生/.test(speaker)) want = 'female';
        // 「你」= 主角视角不显示立绘
        if (/^你$/.test(speaker)) want = 'none';
      }
      if (S.pendingEnd) want = 'none';

      if (want !== 'none' && S.character && S.character[want]) {
        var url = pickAvatar(want);
        if (url) {
          var img = el('img', {
            src: url,
            alt: (S.character[want].name || '') + ' · ' + moodOf(want),
            style: { transform: want === 'male' ? 'translateX(-16%)' : 'translateX(16%)' }
          });
          // 兜底：阶段形象缺失时退回第 1 章，再不行就退回柔和表情
          img.addEventListener('error', function () {
            if (want === 'female' && /-c\d+-/.test(url)) {
              img.src = url.replace(/-c\d+-/, '-c1-');
            } else {
              img.src = url.replace(/-\w+\.svg$/, '-soft.svg');
            }
          });
          UI.mount(portraitBox, img);
        } else {
          UI.mount(portraitBox, el('div', {
            style: { fontSize: '92px', opacity: '.35', lineHeight: '1' }
          }, want === 'male' ? '♂' : '♀'));
        }
      } else {
        UI.mount(portraitBox, null);
      }
    }

    // ============================================================
    // 对白（打字机）
    // ============================================================
    function renderDialogue(node) {
      stopTyping();
      var isNarration = UI.speakerClass(node.speaker) === 'narration';
      // 走 renderText：把剧本里的「他」「她」换成玩家设置的名字
      var text = UI.renderText(node.content || '');

      var textNode = el('div.text' + (isNarration ? '.narration' : ''));
      var nextHint = el('div.next-hint', '点击继续 ▾');

      var box = el('div.dialogue-box', {
        onclick: onDialogueClick
      }, [
        node.speaker ? el('div.speaker.' + speakerTone(node.speaker), node.speaker) : null,
        textNode,
        nextHint
      ]);

      S.typingFull = text;
      S.typingDone = false;
      typewrite(textNode, text);

      UI.mount(dialogueArea, box);
    }

    function speakerTone(speaker) {
      var s = String(speaker || '');
      if (/^你$/.test(s)) return '';
      if (/她|妳/.test(s)) return 'female';
      if (/他/.test(s)) return 'male';
      return '';
    }

    function stopTyping() {
      if (S.typingTimer) { clearInterval(S.typingTimer); S.typingTimer = null; }
    }

    function typewrite(node, text) {
      var per = SPEED[Store.typingSpeed()] || SPEED.normal;
      var i = 0;
      node.textContent = '';
      stopTyping();
      S.typingTimer = setInterval(function () {
        i += 1;
        node.textContent = text.slice(0, i);
        if (i % 2 === 0) node.appendChild(el('span.caret'));
        if (i >= text.length) {
          stopTyping();
          node.textContent = text;
          S.typingDone = true;
        }
      }, per);
    }

    /** 点对白框：没打完就立刻打完；打完则推进 */
    function onDialogueClick() {
      if (S.busy || !S.node || !S.node.type || S.node.type !== 'dialogue') return;

      if (!S.typingDone) {
        stopTyping();
        var t = UI.$('.dialogue-box .text', dialogueArea);
        if (t) t.textContent = S.typingFull;
        S.typingDone = true;
        return;
      }
      doAdvance();
    }

    // ============================================================
    // 隐藏互动（小铃铛）
    //
    // 剧本推进之外，另开一条「动作线」：达到条件时舞台上浮现一个
    // 半透明的可点物（牵手 / 收外套 / 抹眼泪 / 借伞 …）。
    // 点了会播一小段独白，给双方加不同的好感，并记进 flags。
    //
    // 设计意图：让「爱」发生在一个选项框之外 —— 有时你只是想牵她的手，
    // 根本不需要理由，也不需要说话。
    // ============================================================

    // 条件：min 好感阈值（双方）、chapter 章节号、once 是否只触发一次
    var GESTURES = [
      {
        id: 'hold_hand',
        icon: '🤝',
        label: '牵住她的手',
        min: { female: 45 },
        chapter: [2, 3, 4, 5],
        once: false,
        reply: '她的手指凉凉的，很轻地回握了一下。「……你手好暖。」',
        effect: { male: 3, female: 7 }
      },
      {
        id: 'share_umbrella',
        icon: '☂',
        label: '把伞往她那边倾',
        min: { male: 40 },
        chapter: [3, 4, 5],
        once: false,
        reply: '雨落在你右肩。她侧过头看你，什么也没说，只是把伞柄往你手里塞了塞。',
        effect: { male: 6, female: 4 }
      },
      {
        id: 'coat_shoulders',
        icon: '🧥',
        label: '把外套披到她肩上',
        min: { female: 55 },
        chapter: [4, 5],
        once: true,
        reply: '外套很重，肩膀一沉。她拢了拢领口，没问是哪一件。',
        effect: { male: 4, female: 10 }
      },
      {
        id: 'wipe_tears',
        icon: '🤍',
        label: '替她擦掉眼泪',
        min: { female: 20 },
        chapter: [2, 3, 4, 5],
        once: false,
        reply: '她没躲。睫毛扫过你的指腹，像一小片羽毛。',
        effect: { male: 2, female: 8 }
      },
      {
        id: 'forehead_touch',
        icon: '🫧',
        label: '轻轻碰一下她的额头',
        min: { female: 70 },
        chapter: [5],
        once: true,
        reply: '她屏住呼吸，很久之后才慢慢吐出来。走廊的灯把你们两个的影子叠在一起。',
        effect: { male: 5, female: 12 }
      },
      {
        id: 'shoulder_squeeze',
        icon: '💭',
        label: '什么都不说，碰了碰他的肩',
        min: { male: 45 },
        chapter: [2, 3, 4, 5],
        once: false,
        reply: '他僵了半秒，然后慢慢靠过来一点，肩膀终于松下来。',
        effect: { male: 9, female: 3 }
      },
      {
        id: 'wait_together',
        icon: '⏳',
        label: '陪她多坐一会儿',
        min: {},
        chapter: [1, 2, 3, 4, 5],
        once: false,
        reply: '你们谁都没说话。窗外的人声一点点远了，这一刻不需要任何解释。',
        effect: { male: 4, female: 4 }
      },
      {
        id: 'pocket_hand',
        icon: '🫥',
        label: '把手揣进口袋里，然后牵起她的手',
        min: { female: 85 },
        chapter: [5],
        once: true,
        reply: '口袋很小，两只手挤在一起。她的指尖在你手心里画了一个字。',
        effect: { male: 6, female: 15 }
      }
    ];

    function gestureFlags(save) {
      var f = (save && save.state && save.state.flags) || {};
      return f;
    }

    /** 找出当前满足条件、且未触发过的互动 */
    function availableGestures() {
      var save = S.save || {};
      var ch = Number(save.chapterNo) || 1;
      var flags = gestureFlags(save);
      return GESTURES.filter(function (g) {
        if (g.once && flags['gx_' + g.id]) return false;
        if (g.chapter && g.chapter.indexOf(ch) === -1) return false;
        if (g.min && g.min.female !== undefined && (S.affection.female || 0) < g.min.female) return false;
        if (g.min && g.min.male !== undefined && (S.affection.male || 0) < g.min.male) return false;
        return true;
      });
    }

    /** 舞台左下角浮出可点的光点；只有一个，避免变成按钮墙 */
    function refreshGesture() {
      var host = UI.$('.gesture-tray', stage);
      if (!host) return;

      if (S.busy || S.pendingEnd || !S.node || S.node.type !== 'dialogue') {
        UI.mount(host, null);
        return;
      }
      var list = availableGestures();
      if (!list.length) {
        UI.mount(host, null);
        return;
      }

      // 稳定轮换：同一节点多次渲染时尽量保持同一个互动
      var key = S.node.nodeKey || '';
      var idx = 0;
      for (var i = 0; i < key.length; i++) { idx = (idx * 31 + key.charCodeAt(i)) % 100000; }
      var g = list[idx % list.length];

      UI.mount(host, el('button.gesture', {
        type: 'button',
        title: g.label,
        onclick: function () { doGesture(g); }
      }, [
        el('span.g-icon', g.icon),
        el('span.g-label', g.label)
      ]));
    }

    /** 播放一次互动：专属立绘光效 + 独白 + 好感结算 */
    function doGesture(g) {
      if (S.busy) return;
      S.busy = true;
      UI.mount(UI.$('.gesture-tray', stage), null);

      // 1) 光效
      S.sceneFlare = g.id;
      stage.classList.add('flare-' + g.id);

      // 2) 独白（复用对白样式）
      var who = g.effect.female >= g.effect.male ? '她' : '他';
      var box = el('div.dialogue-box.gesture-reply', [
        el('div.speaker.' + (who === '她' ? 'female' : 'male'), '❝ ' + g.label),
        el('div.text', UI.renderText(g.reply)),
        el('div.next-hint', '点击继续 ▾')
      ]);

      // 3) 结算：直接改本地状态并持久化到后端
      var before = { male: S.affection.male || 0, female: S.affection.female || 0 };
      var after = {
        male: before.male + (g.effect.male || 0),
        female: before.female + (g.effect.female || 0)
      };
      S.affection = after;
      S.save.affectionMale = after.male;
      S.save.affectionFemale = after.female;

      renderTop();
      updateBars({ male: g.effect.male || 0, female: g.effect.female || 0 });

      // 4) 记 flag（一次性互动不再出现）
      var flags = gestureFlags(S.save);
      flags['gx_' + g.id] = 1;
      S.save.state = S.save.state || {};
      S.save.state.flags = flags;

      API.post('/api/play/gesture', {
        routeCode: routeCode,
        slot: slot,
        nodeKey: S.node.nodeKey,
        gestureId: g.id,
        effectMale: g.effect.male || 0,
        effectFemale: g.effect.female || 0
      }).catch(function () { /* 网络失败不打断沉浸 */ });

      UI.mount(dialogueArea, box);
      box.addEventListener('click', function once() {
        box.removeEventListener('click', once);
        stage.classList.remove('flare-' + g.id);
        S.sceneFlare = null;
        S.busy = false;
        if (S.node && S.node.type === 'dialogue') drawNode();
      });
    }

    // ============================================================
    // 选项
    // ============================================================
    function renderChoices(node) {
      stopTyping();
      S.typingDone = true;

      var box = el('div.dialogue-box', { style: { marginBottom: '14px' } }, [
        node.speaker ? el('div.speaker.' + speakerTone(node.speaker), node.speaker) : null,
        el('div.text' + (UI.speakerClass(node.speaker) === 'narration' ? '.narration' : ''),
          UI.renderText(node.content || '你要怎么做？'))
      ]);

      var list = el('div.choice-box', (node.options || []).map(function (opt, idx) {
        var m = Number(opt.effectMale) || 0;
        var f = Number(opt.effectFemale) || 0;
        return el('button.choice-btn', {
          type: 'button',
          dataset: { optionKey: opt.optionKey },
          onclick: function () { doChoice(opt.optionKey); }
        }, [
          el('span.idx', String(idx + 1)),
          el('span', opt.optionText),
          (m || f) ? el('span.eff', [
            m ? el('span.m', '男 ' + UI.deltaText(m)) : null,
            f ? el('span.f', '女 ' + UI.deltaText(f)) : null
          ]) : null
        ]);
      }));

      UI.mount(dialogueArea, [box, list]);

      // 键盘 1-9 快速选项
      document.onkeydown = function (e) {
        if (!dialogueArea.contains(list)) return;
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= (node.options || []).length) {
          var btn = list.querySelectorAll('.choice-btn')[n - 1];
          if (btn && !btn.disabled) btn.click();
        }
      };
    }

    // ============================================================
    // 网络动作
    // ============================================================
    function playPayload() {
      return { routeCode: routeCode, slot: slot };
    }

    function doAdvance() {
      if (S.busy || !S.node) return;
      if (S.node.type !== 'dialogue') return;
      S.busy = true;
      setBusyHint(true);

      var body = Object.assign({}, playPayload(), { nodeKey: S.node.nodeKey });

      API.advance(body)
        .then(function (data) { applyResult(data, { fromChoice: false }); })
        .catch(function (err) { handlePlayError(err, 'advance'); })
        .then(function () { S.busy = false; setBusyHint(false); });
    }

    function doChoice(optionKey) {
      if (S.busy || !S.node || S.node.type !== 'choice') return;
      S.busy = true;
      disableChoices(true);

      var body = Object.assign({}, playPayload(), {
        nodeKey: S.node.nodeKey,
        optionKey: optionKey
      });

      API.choice(body)
        .then(function (data) { applyResult(data, { fromChoice: true }); })
        .catch(function (err) { handlePlayError(err, 'choice'); })
        .then(function () { S.busy = false; disableChoices(false); });
    }

    function disableChoices(disabled) {
      UI.$$('.choice-btn', dialogueArea).forEach(function (b) { b.disabled = disabled; });
    }

    function setBusyHint(on) {
      var hint = UI.$('.next-hint', dialogueArea);
      if (hint) hint.textContent = on ? '推进中…' : (S.node && S.node.type === 'dialogue' ? '点击继续 ▾' : '');
    }

    function handlePlayError(err, kind) {
      // 20006 进度不一致 → 重新同步
      if (err && err.code === 20006) {
        UI.toast('进度已同步，正在恢复…', 'ok');
        loadState();
        return;
      }
      // 40001 被限流 → 玩家自己点太快了，给一个温和的提示而不是红色报错
      if (err && err.code === 40001) {
        UI.toast(err.message || '慢一点，等一下再试', 'ok');
        if (kind === 'choice') disableChoices(false);
        return;
      }
      UI.toast((err && err.message) || '操作失败', 'err');
      if (kind === 'choice') disableChoices(false);
    }

    /** 统一处理 /api/play/* 的返回 */
    function applyResult(data, opts) {
      opts = opts || {};
      var save = data.save || {};
      var deltas = data.delta || null;

      S.save = save;
      S.affection.male = save.affectionMale || 0;
      S.affection.female = save.affectionFemale || 0;
      S.node = data.node || null;

      renderTop();
      updateBars(deltas);

      // 章末 → 自动过场到下一章
      if (data.chapterComplete && data.nextChapterNo && save.chapterNo === data.nextChapterNo) {
        showChapterCard(save.chapterTitle, data.nextChapterNo, function () {
          drawNode();
        });
        return;
      }

      if (!S.node) {
        if (data.ended) { showEnding(data); return; }
        if (data.finished) { showFinished(); return; }
        drawNode();
        return;
      }

      if (data.ended) {
        renderScene(S.node);
        renderDialogueOrChoice(S.node);
        // 结局节点内容播完后弹结局卡
        var nodeRef = S.node;
        setTimeout(function () {
          if (S.node === nodeRef) showEnding(data);
        }, 900);
        return;
      }

      drawNode();
    }

    function drawNode() {
      if (!S.node) { showFinished(); return; }
      renderScene(S.node);
      renderDialogueOrChoice(S.node);
      refreshGesture();
    }

    function renderDialogueOrChoice(node) {
      if (node.type === 'choice') renderChoices(node);
      else renderDialogue(node);
    }

    // ============================================================
    // 章节过场 / 结局 / 结束
    // ============================================================
    function showChapterCard(title, no, done) {
      var seen = Store.chapterSeen(routeCode, slot);
      if (seen.indexOf(Number(no)) !== -1) { done(); return; }
      Store.markChapterSeen(routeCode, slot, no);

      var card = el('div.chapter-card', el('div.inner', [
        el('div.no', 'CHAPTER ' + String(no).padStart(2, '0')),
        el('div.rule'),
        el('div.tt', title || ''),
        el('div.tiny.faint.mt-16', '点击继续')
      ]));
      card.addEventListener('click', function () {
        card.style.transition = 'opacity .4s';
        card.style.opacity = '0';
        setTimeout(function () { card.remove(); done(); }, 380);
      });
      stage.appendChild(card);
      Store.setTypingSpeed(Store.typingSpeed());
    }

    function showEnding(data) {
      S.pendingEnd = true;
      stopTyping();
      disableChoices(true);

      var ending = data.ending;
      if (!ending) {
        var none = el('div.ending-overlay', el('div.ending-card', [
          el('div.badge', '无 匹 配 结 局'),
          el('h2', '这次没有走到任何结局'),
          el('p', '当前的好感度不满足任何结局条件。换个选择方式再走一遍吧。'),
          endingStats(data),
          el('div.row', { style: { justifyContent: 'center' } }, [
            el('button.btn.btn-primary', { onclick: function () { restart(); } }, '重新开始这条线'),
            el('button.btn', { onclick: backToRoutes }, '回到故事线'),
            el('button.btn.btn-ghost', { onclick: function () { backToStart(); } }, '🏠 回到开始界面')
          ])
        ]));
        stage.appendChild(none);
        return;
      }

      var card = el('div.ending-overlay', el('div.ending-card', [
        el('div.badge', ending.isHidden ? '隐 藏 结 局' : 'E N D I N G'),
        el('h2', ending.title),
        el('p', ending.description || ''),
        endingStats(data),
        data.newlyUnlocked ? el('div.tag.ok.mb-16', '🎉 新结局已解锁，去图鉴看看') : null,
        el('div.row', { style: { justifyContent: 'center', flexWrap: 'wrap' } }, [
          el('button.btn.btn-primary', { onclick: function () { restart(); } }, '再走一遍'),
          el('button.btn', { onclick: function () { global.App.go('gallery', { routeCode: routeCode }); } }, '结局图鉴'),
          el('button.btn.btn-ghost', { onclick: backToRoutes }, '返回'),
          // 「回到开始界面」：清空当前状态，回到故事线选择页，
          // 让玩家可以换一条线或改名字重新开始，而不用手动退出。
          el('button.btn.btn-ghost', { onclick: function () { backToStart(); } }, '🏠 回到开始界面')
        ])
      ]));
      stage.appendChild(card);

      if (data.newlyUnlocked) UI.toast('解锁新结局：' + ending.title, 'ok', 3400);
    }

    function endingStats(data) {
      var aff = (data && data.affection) || S.affection;
      return el('div.final-aff', [
        el('div', [
          el('div.v', { style: { color: 'var(--male)' } }, String(aff.male || 0)),
          el('div.k', '他 · 好感')
        ]),
        el('div', [
          el('div.v', { style: { color: 'var(--female)' } }, String(aff.female || 0)),
          el('div.k', '她 · 好感')
        ])
      ]);
    }

    function showFinished() {
      var card = el('div.ending-overlay', el('div.ending-card', [
        el('div.badge', '剧 本 结 束'),
        el('h2', '这一段故事到这里'),
        el('p', '所有章节都走完了。可以换个档位重新体验，或去另一条视角看看同一段感情。'),
        endingStats(null),
        el('div.row', { style: { justifyContent: 'center', flexWrap: 'wrap' } }, [
          el('button.btn.btn-primary', { onclick: function () { restart(); } }, '重新开始'),
          el('button.btn', { onclick: function () { global.App.go('saves'); } }, '换个档位'),
          el('button.btn.btn-ghost', { onclick: backToRoutes }, '回到故事线'),
          el('button.btn.btn-ghost', { onclick: function () { backToStart(); } }, '🏠 回到开始界面')
        ])
      ]));
      stage.appendChild(card);
    }

    function restart() {
      UI.modal({
        title: '重新开始「' + (S.routeMeta && S.routeMeta.title || routeCode) + '」？',
        body: '档位 ' + slot + ' 的好感度、剧情进度会被清空（结局解锁记录会保留）。',
        confirmText: '清空并重玩',
        danger: true,
        onConfirm: function () {
          Store.resetChapterSeen(routeCode, slot);
          return API.delSave(slot).catch(function () {}).then(function () {
            UI.toast('已重置', 'ok');
            boot(true);
          });
        }
      });
    }

    function backToRoutes() {
      document.onkeydown = null;
      global.App.go('routes');
    }

    /**
     * 「回到开始界面」—— 从结局/结束画面回到故事线选择页，
     * 并顺手把这一局的临时状态清干净。
     *
     * 和「返回」的区别：
     *   返回       —— 只跳转，保留上次选的线路和档位
     *   回到开始   —— 清掉「上次线路」，下次进游戏停在故事线页由玩家重新选，
     *                同时清掉本章过场标记，避免下次进同一档还弹「第一章」。
     *
     * 注意不清存档数据 —— 结局解锁记录和存档要保留，
     * 否则玩家会发现自己的收集被清空了。
     */
    function backToStart() {
      document.onkeydown = null;
      // 清掉章节过场标记，让下次进入第一章时正常播过场
      Store.resetChapterSeen(routeCode, slot);
      // 不清 lastRoute —— 保留玩家上次的线路选择，
      // 只是回到故事线页（那里是选择页，不是剧情页）。
      global.App.go('routes');
      UI.toast('已回到开始界面', 'ok', 1600);
    }

    // ============================================================
    // 启动
    // ============================================================
    function loadState() {
      API.state({ routeCode: routeCode, slot: slot })
        .then(function (data) {
          S.save = data.save;
          S.affection.male = data.save.affectionMale || 0;
          S.affection.female = data.save.affectionFemale || 0;
          S.node = data.node || null;
          renderTop();
          updateBars(null);
          if (S.node) {
            drawNode();
            if (data.ended) showEnding(data);
          } else {
            showFinished();
          }
        })
        .catch(function (err) {
          // 没有存档 → 直接开新档
          if (err && err.code === 30400) { boot(true); return; }
          UI.toast(err.message || '读取进度失败', 'err');
          backToRoutes();
        });
    }

    function boot(force) {
      S.pendingEnd = false;
      UI.$$('.ending-overlay, .chapter-card', stage).forEach(function (n) { n.remove(); });

      API.start(playPayload())
        .then(function (data) {
          if (data.reset) {
            Store.resetChapterSeen(routeCode, slot);
            UI.toast('该档位已切换到「' + (isMale ? '他的视角' : '她的视角') + '」，进度重置', 'ok', 3200);
          }
          S.routeMeta = { title: isMale ? '他的视角' : '她的视角' };
          S.save = data.save;
          S.affection.male = data.save.affectionMale || 0;
          S.affection.female = data.save.affectionFemale || 0;
          S.node = data.node || null;

          renderTop();
          updateBars(null);
          loadCharacters();

          if (!S.node) {
            if (data.ended) { showEnding(data); return; }
            showFinished();
            return;
          }
          if (data.ended) {
            drawNode();
            showEnding(data);
            return;
          }
          // 新档：首章过场
          if (data.created || force) {
            showChapterCard(data.save.chapterTitle, data.save.chapterNo, drawNode);
          } else {
            drawNode();
          }
        })
        .catch(function (err) {
          UI.mount(stage, el('div.page-inner', [
            el('div.card', [
              el('div.mb-16', '开始游戏失败：' + (err.message || '未知错误')),
              el('div.row', [
                el('button.btn.btn-primary', { onclick: function () { boot(true); } }, '重试'),
                el('button.btn', { onclick: backToRoutes }, '返回故事线')
              ])
            ])
          ]));
        });
    }

    function loadCharacters() {
      API.characters(routeCode)
        .then(function (data) {
          S.character = {};
          (data.list || []).forEach(function (c) { S.character[c.charKey] = c; });
        })
        .catch(function () { S.character = null; });
    }

    // 定期上报游玩时长
    var lastTick = Date.now();
    var tickTimer = setInterval(function () {
      if (S.busy || !S.save || document.hidden) return;
      var sec = Math.floor((Date.now() - lastTick) / 1000);
      if (sec < 30) return;
      lastTick = Date.now();
      API.tick({ routeCode: routeCode, slot: slot, seconds: Math.min(sec, 600) }).catch(function () {});
    }, 15000);

    // 离开页面前上报剩余时长并清理键盘监听
    var cleanup = function () {
      clearInterval(tickTimer);
      document.onkeydown = null;
    };
    if (global.App && global.App.onLeave) global.App.onLeave(cleanup);

    // 带 chapter 参数进入 → 先让服务端跳转，再渲染
    if (ctx.jumpChapter || ctx.chapter) {
      API.enterChapter(Object.assign(playPayload(), { chapterNo: Number(ctx.jumpChapter || ctx.chapter) }))
        .then(function (data) {
          S.pendingEnd = false;
          UI.$$('.ending-overlay, .chapter-card', stage).forEach(function (n) { n.remove(); });
          S.save = data.save;
          S.affection.male = data.save.affectionMale || 0;
          S.affection.female = data.save.affectionFemale || 0;
          S.node = data.node || null;
          renderTop();
          updateBars(null);
          loadCharacters();
          drawNode();
          showChapterCard(data.save.chapterTitle, data.save.chapterNo, function () {});
          // 去掉地址栏上的 chapter，避免刷新重复跳转
          history.replaceState(null, '', '#/play/' + routeCode + '/' + slot);
        })
        .catch(function (err) {
          UI.toast((err && err.message) || '跳转章节失败', 'err');
          boot(true);
        });
      return;
    }

    boot();
  }

  global.PagePlay = { render: render };
})(window);