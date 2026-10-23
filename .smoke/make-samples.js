/**
 * 为候选曲子生成试听切片
 *   node make-samples.js
 *
 * 目的：让用户先听一遍再挑，而不是靠歌名猜。
 * 每首曲子切 3 段（开头 / 中段 / 靠后），各 30 秒，
 * 输出到 .smoke/samples/，文件名带曲名和起始秒数。
 *
 * 输出格式：128kbps 单声道 mp3（跟正式切片一致，所见即所得）
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, 'audio-src');
const OUT = path.resolve(__dirname, 'samples');

const SEG = 30;
const FADE = 1.5;

/** 曲名 → 展示用的短名（去掉歌手前缀与文件扩展名） */
function shortName(file) {
  return file.replace(/\.(mp3|flac|ncm)$/i, '')
    // 去掉 "歌手,数字 - " 这种解密后带出来的前缀
    .replace(/^[^-\-]*?,\d*\s*-\s*/, '')
    .replace(/[（(].*?[)）]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function duration(file) {
  return parseFloat(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file
  ], { encoding: 'utf8' }).trim());
}

fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => /\.(mp3|flac)$/i.test(f));
if (!files.length) {
  console.log('素材目录为空：' + SRC);
  process.exit(1);
}

console.log('\n=== 生成试听切片 ===\n');

const list = [];

for (const f of files) {
  const src = path.join(SRC, f);
  const dur = duration(src);
  const name = shortName(f);

  // 三个起点：开头、1/3 处、2/3 处
  const starts = [0, Math.floor(dur / 3), Math.floor((dur * 2) / 3)];

  starts.forEach((start, i) => {
    const seg = Math.min(SEG, dur - start - 0.5);
    if (seg < 10) return;

    const outFile = path.join(OUT, `${name}__${String(start).padStart(3, '0')}s.mp3`);
    const fadeOutStart = Math.max(0, seg - FADE);

    execFileSync('ffmpeg', [
      '-v', 'error', '-y',
      '-i', src,
      '-af', `atrim=${start}:${(start + seg).toFixed(2)},asetpts=N/SR/TB,` +
             `afade=t=in:st=0:d=${FADE},` +
             `afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${FADE}`,
      '-ac', '1', '-b:a', '128k', '-vn', '-map_metadata', '-1', '-id3v2_version', '0',
      outFile
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    const size = fs.statSync(outFile).size;
    list.push({ file: path.basename(outFile), song: name, start, seconds: Math.round(seg), kb: Math.round(size / 1024) });

    console.log(`  ✓ ${path.basename(outFile)}  (${Math.round(seg)}s, ${Math.round(size / 1024)} KB)`);
  });
}

fs.writeFileSync(path.join(OUT, 'index.json'),
  JSON.stringify(list, null, 2), 'utf8');

console.log(`\n共 ${list.length} 个切片 → ${OUT}\n`);
