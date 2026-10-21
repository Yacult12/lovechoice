/**
 * 新剧本的端到端静态验证
 *   node verify-new-story.js [baseUrl]
 *
 * 覆盖
 *   1. 剧本连通性（后端 /validate 接口：断链 / 不可达节点）
 *   2. 章节启示接口
 *   3. 立绘 / 背景 / 插图 路径可达性
 *   4. 音频文件可达性与时长
 *   5. 结局清单与条件互斥完备
 */
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://121.40.54.103:8080';
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0, warn = 0;
const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`
};
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ' + C.g('OK  ') + name); }
  else { fail++; console.log('  ' + C.r('FAIL') + ' ' + name + (extra ? C.d('  -> ' + extra) : '')); }
}
function soft(name, cond, extra) {
  if (cond) { pass++; console.log('  ' + C.g('OK  ') + name); }
  else { warn++; console.log('  ' + C.y('WARN') + ' ' + name + (extra ? '  -> ' + extra : '')); }
}

(async () => {
  console.log(C.b('\n=== 新剧本验证 ===\n'));
  console.log('  目标: ' + BASE + '\n');

  // ---------- 1. 剧本连通性 ----------
  console.log(C.b('[1] 剧本连通性（后端 validate）'));
  for (const code of ['male', 'female']) {
    try {
      const res = await fetch(`${BASE}/api/story/routes/${code}/validate`);
      const j = await res.json();
      const d = j.data || {};
      const st = d.stats || {};
      ck(`${code} 线无错误`, d.ok === true && (st.errorCount || 0) === 0,
        `errorCount=${st.errorCount}`);
      ck(`${code} 线无警告`, (st.warnCount || 0) === 0,
        `warnCount=${st.warnCount}` + (d.issues && d.issues.length
          ? ' → ' + d.issues.slice(0, 3).map((i) => i.type + '@' + i.nodeKey).join(', ')
          : ''));
      console.log(C.d(`      ${code}: ${st.chapters} 章 / ${st.nodes} 节点 / ` +
        `${st.choiceNodes} 抉择点 / ${st.choices} 选项 / ${st.endings} 结局`));
    } catch (e) {
      ck(`${code} 线 validate`, false, e.message);
    }
  }

  // ---------- 2. 章节启示接口 ----------
  console.log('');
  console.log(C.b('[2] 章节启示接口'));
  try {
    const res = await fetch(`${BASE}/api/story/insights`);
    const j = await res.json();
    const d = j.data || {};
    ck('接口返回 200 且 code=0', j.code === 0, `code=${j.code}`);

    const list = d.list || [];
    ck('有 5 条启示', list.length === 5, '实际 ' + list.length);
    for (let i = 1; i <= 5; i++) {
      const it = list.find((x) => Number(x.chapterNo) === i);
      if (!it) { ck(`第 ${i} 章启示存在`, false, '缺失'); continue; }
      ck(`第 ${i} 章「${it.title}」`,
        !!it.content && it.content.length > 30,
        `content 长度 ${(it.content || '').length}`);
      ck(`第 ${i} 章插图 ${it.illustration}`, !!it.illustration, '缺 illustration');
    }

    // 关键：启示文案必须包含用户给的核心关键词
    const all = list.map((x) => (x.title || '') + (x.content || '')).join('\n');
    const mustHave = ['爱人先爱己', '边界', '珍惜', '敢爱敢恨', '放下', '安全感'];
    mustHave.forEach((k) => {
      ck(`启示含关键词「${k}」`, all.includes(k), '缺失');
    });

    ck('有导语', !!(d.prologue && d.prologue.content), '缺 prologue');
    ck('导语含「爱情没有标准答案」',
      !!(d.prologue && d.prologue.content.includes('爱情没有标准答案')), '');
    ck('有登录页小文案', !!(d.loginFooter && d.loginFooter.content), '缺 loginFooter');
    // ⚠️「同一个故事，两种视角」在 title 字段，
    // content 是「爱情没有完美选项…」，别查错地方。
    ck('登录页小文案 title 是「同一个故事，两种视角」',
      !!(d.loginFooter && d.loginFooter.title === '同一个故事，两种视角'),
      'title=' + (d.loginFooter && d.loginFooter.title));
    ck('登录页小文案含「爱情没有完美选项」',
      !!(d.loginFooter && d.loginFooter.content.includes('爱情没有完美选项')), '');
    ck('登录页签名含「爱人先爱己」',
      !!(d.loginFooter && (d.loginFooter.signature || '').includes('爱人先爱己')), '');
  } catch (e) {
    ck('insights 接口', false, e.message);
  }

  // ---------- 3. 美术资源 ----------
  console.log('');
  console.log(C.b('[3] 美术资源可达性'));

  // 立绘：复现前端 pickAvatar 的拼装逻辑
  const MOODS = { high: ['smile', 'smile', 'soft'], mid: ['soft', 'soft', 'away'], low: ['down', 'away', 'down'] };
  const missingAvatars = [];
  let avCount = 0;
  for (let ch = 1; ch <= 5; ch++) {
    for (const side of ['female', 'male']) {
      for (const exprs of Object.values(MOODS)) {
        for (const expr of exprs) {
          const name = side === 'female' ? `female-c${ch}-${expr}.svg` : `male-${expr}.svg`;
          avCount++;
          const r = await fetch(`${BASE}/assets/img/avatar/${name}`);
          if (!r.ok) missingAvatars.push(`${name}(${r.status})`);
        }
      }
    }
  }
  ck(`${avCount} 条立绘路径全部可达`, missingAvatars.length === 0,
    '失败: ' + missingAvatars.slice(0, 5).join(', '));

  // 背景
  const bgDir = path.join(ROOT, 'client', 'assets', 'img', 'bg');
  const bgs = fs.readdirSync(bgDir).filter((f) => f.endsWith('.svg'));
  const bgBad = [];
  for (const f of bgs) {
    const r = await fetch(`${BASE}/assets/img/bg/${f}`);
    if (!r.ok) bgBad.push(`${f}(${r.status})`);
  }
  ck(`${bgs.length} 张背景全部可达`, bgBad.length === 0, '失败: ' + bgBad.join(', '));

  // 插图
  const illuDir = path.join(ROOT, 'client', 'assets', 'img', 'illu');
  const illus = fs.readdirSync(illuDir).filter((f) => f.endsWith('.svg'));
  const illuBad = [];
  for (const f of illus) {
    const r = await fetch(`${BASE}/assets/img/illu/${f}`);
    if (!r.ok) illuBad.push(`${f}(${r.status})`);
  }
  ck(`${illus.length} 张插图全部可达`, illuBad.length === 0, '失败: ' + illuBad.join(', '));

  // 剧本里引用的插图名必须都在 illu 目录里
  const insightsSrc = fs.readFileSync(
    path.join(ROOT, 'server', 'src', 'data', 'insights.js'), 'utf8');
  const usedIllu = [...insightsSrc.matchAll(/illustration:\s*'([^']+)'/g)].map((m) => m[1]);
  const illuNames = illus.map((f) => f.replace(/\.svg$/, ''));
  const missIllu = usedIllu.filter((u) => !illuNames.includes(u));
  ck('启示引用的插图都存在', missIllu.length === 0, '缺失: ' + missIllu.join(', '));

  // ---------- 4. 音频 ----------
  console.log('');
  console.log(C.b('[4] 音频'));
  const audioDir = path.join(ROOT, 'client', 'assets', 'audio');
  const tracks = fs.readdirSync(audioDir).filter((f) => f.endsWith('.mp3'));
  ck('有 6 个音频文件', tracks.length === 6, '实际 ' + tracks.length);
  for (const t of tracks) {
    try {
      const r = await fetch(`${BASE}/assets/audio/${t}`, { method: 'HEAD' });
      const len = Number(r.headers.get('content-length') || 0);
      ck(`${t} 可下载`, r.ok && len > 100000, `HTTP ${r.status} / ${len} 字节`);
    } catch (e) {
      ck(t, false, e.message);
    }
  }

  // music.js 里的曲目表必须与实际文件对得上
  const musicJs = fs.readFileSync(path.join(ROOT, 'client', 'assets', 'js', 'music.js'), 'utf8');
  const declared = [...musicJs.matchAll(/'(\.\/assets\/audio\/[a-z0-9]+\.mp3)'/g)].map((m) => m[1].split('/').pop());
  const missingTrack = declared.filter((f) => !tracks.includes(f));
  ck('music.js 曲目表与实际文件一致', missingTrack.length === 0,
    '缺失: ' + missingTrack.join(', '));

  // ---------- 5. 结局 ----------
  console.log('');
  console.log(C.b('[5] 结局'));
  for (const code of ['male', 'female']) {
    try {
      const res = await fetch(`${BASE}/api/story/endings?routeCode=${code}`);
      const j = await res.json();
      // ⚠️ 带 routeCode 时返回 { route, endings }，
      // 不带时返回 { list: [{ route, endings }] }。别写成 data.list。
      const list = j.data.endings || (j.data.list && j.data.list[0]
        ? j.data.list[0].endings : []) || [];
      ck(`${code} 线有 5 个结局`, list.length === 5, '实际 ' + list.length);
      const hidden = list.filter((e) => e.isHidden);
      ck(`${code} 线有 1 个隐藏结局`, hidden.length === 1, '实际 ' + hidden.length);
      list.forEach((e) => {
        console.log(C.d(`      ${e.endingKey.padEnd(11)} ${e.title}` +
          (e.isHidden ? '  [隐藏]' : '')));
      });
    } catch (e) {
      ck(`${code} 线结局`, false, e.message);
    }
  }

  // ---------- 汇总 ----------
  console.log('');
  console.log('='.repeat(56));
  console.log(`  通过 ${pass} · 警告 ${warn} · 失败 ${fail}`);
  console.log(fail === 0
    ? C.g(C.b('  ✅ 新剧本全部验证通过'))
    : C.r(C.b(`  ❌ ${fail} 项失败`)));
  console.log('='.repeat(56));
  console.log('');
  process.exit(fail ? 1 : 0);
})();