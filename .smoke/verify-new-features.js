/**
 * 验证新增的三个功能：名字替换 / 背景音乐 / 结局返回按钮
 *   node verify-new-features.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 从本文件位置上溯两级到仓库根 —— 不能硬编码绝对路径，
// GitHub Actions 跑在 Linux 上，写死 C:\Users\… 会直接找不到文件。
const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

const dom = new JSDOM(
  '<!DOCTYPE html><html><body><div id="app"></div></body></html>',
  {
    url: 'http://localhost:5500/',
    pretendToBeVisual: true,
    // outside-only：允许用 win.eval() 注入脚本，
    // 同时保证 window 是脚本可见的全局。
    // 不加这个选项时 win.eval 里的 window 未定义。
    runScripts: 'outside-only'
  }
);
const win = dom.window;

// 脚本里习惯直接写 window.xxx，这里确保它可用
win.window = win;

console.log('\n=== 新功能验证 ===\n');

console.log('[1] 名字替换 UI.renderText');
win.eval(read('client/assets/js/store.js'));
win.eval(read('client/assets/js/ui.js'));

check('Store 已挂载', !!win.Store);
check('UI 已挂载', !!win.UI);
check('UI.renderText 存在', typeof win.UI.renderText === 'function');

const rt = win.UI.renderText;

check('未设置名字时原样返回', rt('他没有说话') === '他没有说话', rt('他没有说话'));
check('未设置名字时空串也安全', rt('') === '');

win.Store.setPartnerName('小满');
check('「他」被替换', rt('他没有说话') === '小满没有说话', rt('他没有说话'));
check('「她」被替换', rt('她笑了') === '小满笑了', rt('她笑了'));
check('「他们」变成「小满们」', rt('他们走了') === '小满们走了', rt('他们走了'));
check('旁白里的「他」也被替换',
  rt('九月，图书馆。他推开了门。') === '九月，图书馆。小满推开了门。',
  rt('九月，图书馆。他推开了门。'));
check('多处代词全部替换',
  rt('他等她，她等他') === '小满等小满，小满等小满', rt('他等她，她等他'));
check('已含名字的文本不二次替换',
  rt('小满没有说话') === '小满没有说话', rt('小满没有说话'));
check('英文不受影响', rt('Hello world') === 'Hello world');
check('数字不受影响', rt('12345') === '12345');

win.Store.setPartnerName('a'.repeat(30));
check('名字超 12 字被截断', win.Store.partnerName().length === 12,
  '实际 ' + win.Store.partnerName().length);

win.Store.setPartnerName('');
check('清空后回到「他/她」', rt('他没有说话') === '他没有说话');

console.log('\n[2] 背景音乐 Music');
const played = [];
let pausedCount = 0;
win.Audio = function () {
  return {
    src: '', loop: false, preload: '', volume: 1, paused: true,
    play: function () { this.paused = false; played.push(this.src); return Promise.resolve(); },
    pause: function () { this.paused = true; pausedCount++; }
  };
};
win.eval(read('client/assets/js/music.js'));

check('Music 已挂载', !!win.Music);
// 配乐已改成分幕曲目（default + act1~5），不再有单一 bgm.mp3
check('音频路径正确', win.Music.TRACKS.default === './assets/audio/default.mp3',
  win.Music.TRACKS.default);

win.Store.setMusicOn(true);
win.Music.init();
check('init 后调用了 play()', played.length > 0, 'played=' + played.length);
check('play 用了正确路径',
  played.length > 0 && played[0] === './assets/audio/default.mp3',
  played.length ? played[0] : '(未播放)');

win.Music.pause();
check('pause 真的暂停', pausedCount > 0);

const musicSrc = read('client/assets/js/music.js');
check('设置了循环播放 audio.loop = true', /audio\.loop\s*=\s*true/.test(musicSrc),
  '不循环的话音乐播完就停，不满足「不因剧情改变」');

win.Store.setMusicOn(false);
check('开关状态写入 localStorage',
  win.localStorage.getItem('lovechoice_musicOn') === 'false',
  win.localStorage.getItem('lovechoice_musicOn'));
win.Store.setMusicOn(true);
check('能读回', win.Store.musicOn() === true);

check('音量设得较低（不盖过阅读）',
  /VOLUME\s*=\s*0\.[0-5]/.test(musicSrc),
  '音量太大会在读剧情时干扰');
check('有自动播放被拒的兜底（pointerdown/keydown）',
  /pointerdown/.test(musicSrc) && /keydown/.test(musicSrc),
  '缺这个首次进入登录页时音乐放不出来');
check('play() 的 reject 被静默捕获', /\.catch\s*\(/.test(musicSrc));

console.log('\n[3] 结局后的「回到开始界面」');
const playSrc = read('client/assets/js/pages/play.js');
check('定义了 backToStart', /function backToStart\s*\(/.test(playSrc));

// 只数真正挂在按钮上的，别把注释里的说明文字也算进来
const btnCount = (playSrc.match(/'🏠 回到开始界面'/g) || []).length;
check('三个结局画面都有该按钮', btnCount === 3,
  '实际 ' + btnCount + ' 处（正常结局 / 无匹配结局 / 剧本结束）');

check('跳转回 routes',
  /function backToStart[\s\S]{0,900}App\.go\('routes'\)/.test(playSrc));
check('会清章节过场标记',
  /function backToStart[\s\S]{0,400}resetChapterSeen/.test(playSrc));

const bts = playSrc.slice(playSrc.indexOf('function backToStart'),
                         playSrc.indexOf('function backToStart') + 700);
check('不删除存档数据', !/delSave/.test(bts), '误删存档会让玩家发现收集被清空');
check('不清除已解锁结局', !/user_endings|clearEndings/.test(bts));

console.log('\n[4] 名字设置入口');
const routesSrc = read('client/assets/js/pages/routes.js');
check('故事线页有名字设置卡片', /function nameCard\s*\(/.test(routesSrc));
check('故事线页调用了 nameCard()',
  /UI\.mount\(wrap, \[[\s\S]{0,400}nameCard\(\)/.test(routesSrc));
check('导出 openNameModal', /openNameModal:\s*openNameModal/.test(routesSrc));
check('剧情页有名字修改按钮', /✎/.test(playSrc));
check('改名字后重画当前对白',
  /onConfirm[\s\S]{0,700}renderDialogueOrChoice\(S\.node\)/.test(playSrc));
check('没有绕过 renderText 直接渲染 content',
  !/el\('div\.text[^']*',\s*\n?\s*node\.content/.test(playSrc),
  '有一处直接用 node.content，名字替换不生效');

const rtCount = (playSrc.match(/UI\.renderText\(/g) || []).length;
check('renderText 被调用至少 3 处', rtCount >= 3, '实际 ' + rtCount + ' 处');

console.log('\n[5] 音频资源与服务器配置');
const bgmPath = path.join(ROOT, 'client', 'assets', 'audio', 'bgm.mp3');
const hasBgm = fs.existsSync(bgmPath);
console.log('    bgm.mp3 ' + (hasBgm ? '已就位' : '尚未提供（等你上传）'));
check('audio 目录已建', fs.existsSync(path.dirname(bgmPath)));
if (hasBgm) {
  const size = fs.statSync(bgmPath).size;
  check('音频文件非空', size > 10000, size + ' 字节');
  console.log('    大小: ' + (size / 1024 / 1024).toFixed(2) + ' MB');
}

const html = read('client/index.html');
const iMusic = html.indexOf('music.js');
const iApp = html.indexOf('js/app.js');
const iStore = html.indexOf('js/store.js');
check('index.html 引入了 music.js', iMusic > -1);
check('music.js 在 store.js 之后', iMusic > iStore);
check('music.js 在 app.js 之前', iMusic > -1 && iMusic < iApp);

const nginx = read('client/docker/nginx.conf');
check('nginx 有音频专用 location', /location \^~ \/assets\/audio\//.test(nginx));
check('声明了 audio/mpeg MIME', /audio\/mpeg/.test(nginx));
check('开启 Accept-Ranges', /Accept-Ranges bytes/.test(nginx));

console.log('\n' + '='.repeat(50));
console.log(fail === 0 ? `  全部通过 ${pass} 项` : `  通过 ${pass} / 失败 ${fail}`);
console.log('='.repeat(50));
process.exit(fail ? 1 : 0);