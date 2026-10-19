/**
 * 裁剪前奏片段并打包进项目
 *   node build-tracks.js
 *
 * 决策：所有曲目统一截取 0~30 秒作为循环段。
 *
 * 为什么不再逐首分析（试了 3 版都失败，记录在此免得后人重踩）：
 *   v1 analyze-intro.js —— 用 RMS 音量方差找结构转折
 *       失败：6 首里 5 首撞到 12s 下限。
 *       原因：方差对「力度起伏」敏感，钢琴的力度变化被误判成结构变化。
 *   v2 cut-intro.js —— 用频谱通量找 onset，再估 BPM 对齐小节线
 *       失败：4 首钢琴曲估不出BPM。
 *       原因：钢琴起音弱、延音长，一阶差分检测不到明显的能量跃升。
 *   v3 cut-intro2.js —— 用频谱质心（高频占比）找转折
 *       失败：3 首全判为「无转折」取 24s，2 首在 0.4s 就误判转折。
 *       原因：用「样本位置」近似频率分布，这个近似根本不成立。
 *
 * 结论：纯自动的前奏切分在无标注数据上不可靠。
 * 用户决定统一 30 秒 —— 6 首都是钢琴/氛围向，
 * 前奏基本在 20~35 秒之间进入主旋律，30 秒是个稳妥的折中。
 *
 *处理要点：
 *   - 从 0 秒开始（前奏起点）
 *   - 淡入 1.5s（避免循环接缝处音量突变）
 *   - 淡出 1.5s（让循环点平滑衔接）
 *   - 转 128kbps 单声道 —— 背景音乐而已，
 *     320k 立体声对6 首曲子只增加 ~30MB 上传量，
 *     而项目要部署到 2G 内存的云服务器上
 *
 * ⚠️ 踩过的坑：-map_metadata -1 只清标签，不清「附图流」。
 *源MP3 带封面时，ffmpeg 会把它当第二个流（codec_name=png）一起拷进
 * 输出，得到「MP3 + 封面」的双流文件。ffprobe 能识别、时长也对，
 * 但浏览器解码直接失败（实测 act3 和 default 全部dur=0）。
 * 必须加 -vn 丢弃非音频流 —— 这是整个流程里最容易漏的一步。
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, 'audio-src');
const DST = path.resolve(__dirname, '..', 'client', 'assets', 'audio');

const LOOP_SEC = 30;
const FADE_SEC = 1.5;

/** 曲目定义：文件名 → 项目内的短名 */
const TRACKS = [
  { src: 'TheFloridaMan,GOAT - Never see me again（Explicit）.mp3', name: 'default', act: 'default' },
  { src: '纪钧瀚 (Bryan Chi) - 明明就 (钢琴版) [原唱 周杰伦].mp3',       name: 'act2',      act: 2 },
  { src: '洋澜一 - 稳稳的幸福 (伴奏).mp3',                              name: 'act3',      act: 3 },
  { src: '纪钧瀚 (Bryan Chi) - 说好的幸福呢 (钢琴版) [原唱 周杰伦].mp3',   name: 'act4',      act: 4 },
  { src: '水仙LONE - 我走以后 (降调氛围版).mp3',                        name: 'act5',      act: 5 },
  { src: '屯叔UncleTune - 海边的风（Seaside wind）（钢琴曲）.mp3',          name: 'act1',      act: 1 }
];

const C = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`
};

function duration(file) {
  return parseFloat(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file
  ], { encoding: 'utf8' }).trim());
}

fs.mkdirSync(DST, { recursive: true });

console.log(C.b('\n=== 裁剪配乐 ===\n'));
console.log('  循环段: 0 ~ ' + LOOP_SEC + 's（淡入/淡出各 ' + FADE_SEC + 's）');
console.log('  目标  : client/assets/audio/\n');

const manifest = [];

for (const t of TRACKS) {
  const srcPath = path.join(SRC, t.src);
  if (!fs.existsSync(srcPath)) {
    console.log(C.r('  ✗ 源文件缺失: ' + t.src));
    continue;
  }

  const dur = duration(srcPath);
  const seg = Math.min(LOOP_SEC, dur - 0.5);
  const fadeOutStart = Math.max(0, seg - FADE_SEC);

  const outFile = path.join(DST, t.name + '.mp3');
  // 不重采样采样率（保持原样，避免额外失真），只转单声道 128k
  const filter =
    `atrim=0:${seg.toFixed(2)},asetpts=N/SR/TB,` +
    `afade=t=in:st=0:d=${FADE_SEC},` +
    `afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${FADE_SEC}`;

  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-i', srcPath,
    '-af', filter,
    '-ac', '1',
    '-b:a', '128k',
    '-vn',                    // 丢弃所有非音频流
    '-map_metadata', '-1',    // 去掉 ID3 标签
    '-id3v2_version', '0',    // 连 ID3v2 头都不写（写 '0' 才是真禁用）
    outFile
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const size = fs.statSync(outFile).size;

  // 自检：确保输出是「纯单流 MP3」。
  // ffprobe 能识别不等于浏览器能播 —— 带封面流的双流文件
  // ffprobe 照样报 mp3 + 30s，但浏览器解码会失败。
  let streams = '?';
  try {
    streams = execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0', outFile
    ], { encoding: 'utf8' }).trim().replace(/\s+/g, ',');
  } catch (e) { /* ignore */ }

  const clean = streams === 'audio';
  manifest.push({
    key: t.name,
    act: t.act,
    file: path.basename(outFile),
    seconds: seg,
    kb: Math.round(size / 1024),
    streams
  });

  console.log((clean ? C.g('  ✓ ') : C.r('  ✗ ')) + t.name.padEnd(9) +
    C.d(t.act === 'default' ? '剧情外 / 默认' : '第 ' + t.act + '幕'));
  console.log(C.d('      ' + path.basename(t.src).slice(0, 52)));
  console.log((clean ? C.d : C.r)('      ' + seg.toFixed(1) + 's  ' +
    (size / 1024).toFixed(0) + ' KB  streams=[' + streams + ']' +
    (clean ? '' : '  ← 含非音频流，浏览器会解码失败')));
}

fs.writeFileSync(path.join(DST, 'manifest.json'),
  JSON.stringify(manifest, null, 2), 'utf8');

const total = manifest.reduce((a, m) => a + m.kb, 0);
console.log('');
console.log(C.d('  共 ' + manifest.length + ' 首，合计 ' +
  (total / 1024).toFixed(1) + ' MB'));
console.log('');
