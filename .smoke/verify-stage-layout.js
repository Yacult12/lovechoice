/**
 * 验证剧情页底部吸底布局
 *   node verify-stage-layout.js
 *
 * 结构（三层）
 *   .stage-top      顶部操作栏
 *   .stage-viewport 立绘舞台   flex:1
 *   .stage-bottom   底部对话区吸底
 *
 * 布局原则
 *   对话框永远贴视口底部，不受立绘有无影响，不需要滚动。
 *   选项排在对白框上方。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'client/assets/css/main.css'), 'utf8');
const play = fs.readFileSync(path.join(ROOT, 'client/assets/js/pages/play.js'), 'utf8');

// 剥掉注释，避免注释里的属性名被当成真实规则
const cc = css.replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('\n=== 剧情页布局验证 ===\n');

console.log('[1] 三层结构');
check('.stage-viewport 存在且 flex:1',
  /\.stage-viewport\s*\{[^}]*flex:\s*1 1 auto/.test(cc),
  '立绘区必须占据剩余空间');
check('.stage-viewport 有 min-height:0',
  /\.stage-viewport\s*\{[^}]*min-height:\s*0/.test(cc),
  '缺这个 flex 子项不会被压缩，撑破布局');
check('.stage-bottom 存在且不参与 flex 分配',
  /\.stage-bottom\s*\{[^}]*flex:\s*0 0 auto/.test(cc));
check('.stage-bottom 有 max-height 兜底',
  /\.stage-bottom\s*\{[^}]*max-height/.test(cc));
check('JS 按顺序挂载 viewport / bottom',
  /stageViewport[\s\S]{0,200}dialogueArea[\s\S]{0,120}el\('div#stage'/.test(play),
  'DOM 顺序必须是 top → viewport → bottom');
check('立绘包在 viewport 里',
  /el\('div\.stage-viewport',\s*portraitBox\)/.test(play));
check('旧的 .dialogue-area 已移除',
  !/dialogue-area/.test(cc) && !/dialogue-area/.test(play));

console.log('\n[2] 立绘不再引起布局变化');
check('.portrait 不再有 flex:1（会随内容塌缩）',
  !/\.portrait\s*\{[^}]*flex:\s*1/.test(cc),
  'flex:1 是这次布局崩掉的直接原因');
check('.portrait 用 max-height 约束',
  /\.portrait\s*\{[^}]*max-height:\s*100%/.test(cc));
check('.portrait.empty 只是淡出',
  /\.portrait\.empty\s*\{\s*opacity:\s*0/.test(cc));
check('.portrait 有 opacity 过渡',
  /\.portrait\s*\{[^}]*transition:[^}]*opacity/.test(cc));
check('JS 用 classList 切换显隐',
  /classList\.add\('empty'\)/.test(play) && /classList\.remove\('empty'\)/.test(play));

console.log('\n[3] 对话框贴底且完整可见');
check('.dialogue-box 没有 min-height',
  !/\.dialogue-box\s*\{[^}]*min-height/.test(cc),
  'min-height 会让短句也占一大块，底部留白');
check('.dialogue-box 有 max-height',
  /\.dialogue-box\s*\{[^}]*max-height/.test(cc));
check('.dialogue-box 内部可滚动',
  /\.dialogue-box\s*\{[^}]*overflow-y:\s*auto/.test(cc));
check('.stage-bottom 用 flex-end 吸底',
  /\.stage-bottom\s*\{[^}]*justify-content:\s*flex-end/.test(cc));
check('.stage-bottom 底部有渐变衬底',
  /\.stage-bottom\s*\{[^}]*linear-gradient/.test(cc));

console.log('\n[4] 选项在对话框上方');
check('UI.mount 传入 [list, box]（选项在前）',
  /UI\.mount\(dialogueArea,\s*\[list,\s*box\]\)/.test(play),
  '顺序反了的话选项又会跑到对白下面');
check('.choice-box 紧贴对白框（margin-bottom 很小）',
  /\.choice-box\s*\{[^}]*margin:\s*0 auto 1[0-9]px/.test(cc));

console.log('\n[5] 页面禁止整体滚动');
check('.page.stage-host overflow:hidden',
  /\.page\.stage-host\s*\{[^}]*overflow:\s*hidden/.test(cc));
check('JS 容器带 stage-host',
  /el\('div\.page\.stage-host'/.test(play));

console.log('\n[6] 小屏适配');
const mStart = cc.lastIndexOf('@media (max-width: 720px)');
const mBlock = cc.slice(mStart);
check('小屏不再隐藏立绘',
  !/\.portrait\s*\{[^}]*display:\s*none/.test(mBlock));
check('小屏收紧 stage-bottom',
  /\.stage-bottom\s*\{[^}]*max-height/.test(mBlock));
check('有超矮屏适配',
  /@media \(max-height: \d+px\)/.test(cc));

console.log('\n[7] 未破坏原有功能');
check('#stage 仍是全屏 flex',
  /#stage\s*\{[^}]*height:\s*100%/.test(cc) && /#stage\s*\{[^}]*display:\s*flex/.test(cc));
check('背景图逻辑保留',
  /renderScene/.test(play) && /bgImage/.test(play));
check('立绘 fallback 逻辑保留',
  /img\.addEventListener\('error'/.test(play));
check('键盘快捷选项保留',
  /document\.onkeydown/.test(play));
check('结局遮罩仍可滚动',
  /\.ending-overlay\s*\{[^}]*overflow-y:\s*auto/.test(cc));

console.log('\n' + '='.repeat(52));
console.log(fail === 0 ? `  全部通过 ${pass} 项` : `  通过 ${pass} / 失败 ${fail}`);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);