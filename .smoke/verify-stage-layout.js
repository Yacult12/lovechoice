/**
 * 验证剧情页布局修复
 *   node verify-stage-layout.js
 *
 * 检查项
 *   1. .page.stage-host 禁止滚动（立绘不再把对白推出视口）
 *   2. 立绘区永远占位，用 .empty 淡出而非移除
 *   3. 对白框有 max-height，保证留在视口内
 *   4. 小屏不再隐藏立绘
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'client/assets/css/main.css'), 'utf8');
const play = fs.readFileSync(path.join(ROOT, 'client/assets/js/pages/play.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('\n=== 剧情页布局验证 ===\n');

console.log('[1] 页面禁止滚动');
check('存在 .page.stage-host 规则',
  /\.page\.stage-host\s*\{[^}]*overflow:\s*hidden/.test(css),
  '没有这条的话 .page 的 overflow-y:auto 会让立绘撑高后产生滚动条');
check('play.js 给容器加了 stage-host',
  /el\('div\.page\.stage-host'/.test(play),
  'CSS 规则写了但 JS 没挂上class，等于没生效');

console.log('\n[2] 立绘不再引起布局跳动');
check('立绘区不再是 flex:1（改为 flex:1 1 auto）',
  /\.portrait\s*\{[^}]*flex:\s*1 1 auto/.test(css),
  'flex:1 会在内容消失时塌缩');
check('定义 .portrait.empty 淡出态',
  /\.portrait\.empty\s*\{[^}]*opacity:\s*0/.test(css));
check('立绘区有 opacity 过渡',
  /\.portrait\s*\{[^}]*transition:[^}]*opacity/.test(css),
  '没有过渡就是瞬间消失，仍然会显得突兀');
check('JS 用 classList 切换而非直接移除',
  /classList\.add\('empty'\)/.test(play) && /classList\.remove\('empty'\)/.test(play));
check('立绘图加了 .figure 动画类',
  /img\.figure/.test(play) || /figureIn/.test(css));

console.log('\n[3] 对白始终在视口内');
check('对白框有 max-height 限制',
  /\.dialogue-box\s*\{[^}]*max-height/.test(css),
  '长对白会把框撑高，配合立绘就把内容推出屏幕');
check('对白框内部可滚动',
  /\.dialogue-box\s*\{[^}]*overflow-y:\s*auto/.test(css));
check('max-height 用 vh 而非固定 px',
  /max-height:\s*min\(\s*\d+vh/.test(css),
  '固定 px 在不同屏幕上会不合适');

console.log('\n[4] 小屏适配');
// 先剥掉注释，否则注释里提到的 display:none 会被误判成真实规则
const cssNoComment = css.replace(/\/\*[\s\S]*?\*\//g, '');
const mobileStart = cssNoComment.lastIndexOf('@media (max-width: 720px)');
const mobileBlock = cssNoComment.slice(mobileStart);
check('小屏不再 display:none 隐藏立绘',
  !/\.portrait\s*\{[^}]*display:\s*none/.test(mobileBlock),
  '手机上彻底没立绘，和桌面端体验不一致');
check('小屏给立绘固定高度比例',
  /\.portrait\s*\{[^}]*height:\s*\d+vh/.test(mobileBlock));
check('有超矮屏适配（横放手机）',
  /@media \(max-height: \d+px\)/.test(cssNoComment));

console.log('\n[5] 未破坏原有功能');
check('#stage 仍是全屏 flex 容器',
  /#stage\s*\{[^}]*height:\s*100%/.test(css) && /#stage\s*\{[^}]*display:\s*flex/.test(css));
check('立绘淡入动画保留',
  /@keyframes riseIn/.test(css));
check('背景图逻辑未动',
  /renderScene/.test(play) && /bgImage/.test(play));

console.log('\n' + '='.repeat(52));
console.log(fail === 0 ? `  全部通过 ${pass} 项` : `  通过 ${pass} / 失败 ${fail}`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);