/**
 * 解密网易云音乐下载的加密音频（新版魔数 CTENFDAM）
 *   node decrypt-ncm.mjs "<源目录>" "<输出目录>"
 *
 * 为什么自己写而不用 ncm-decrypt 包
 *   那个包是 ESM-only 且内部用 Worker 派发解密任务，
 *   CLI 环境下 Worker 的相对路径解析会炸。
 *   解密本身是纯 CPU 计算，不需要真并发，
 *   这里按它的算法实现一份，Worker 那层去掉。
 *
 * ⚠️ 踩过的坑：RC4 异或盒的三个下标全是「值」不是「下标」。
 *   照抄成下标会解出乱码，而且文件大小完全正常，
 *   ffprobe 才会报 "Header missing" —— 静默失败，最难查。
 *
 * 用法：
 *   node decrypt-ncm.mjs "<源目录>" "<输出目录>"
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const NEW_MAGIC = Buffer.from([0x43, 0x54, 0x45, 0x4e, 0x46, 0x44, 0x41, 0x4d]); // CTENFDAM

// 网易云的固定密钥
const CORE_KEY = Buffer.from('687a4852416d736f356b496e62617857', 'hex');
const META_KEY = Buffer.from('2331346C6A6B5F215C5D2630553C2728', 'hex');

function aesEcbDecrypt(buf, key) {
  const d = crypto.createDecipheriv('aes-128-ecb', key, null);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(buf), d.final()]);
}

/** 去 PKCS7 padding */
function stripPad(buf) {
  if (!buf.length) return buf;
  const pad = buf[buf.length - 1];
  if (pad < 1 || pad > 16 || pad > buf.length) return buf;
  return buf.subarray(0, buf.length - pad);
}

/**
 * 生成 RC4 异或盒。
 *
 * 注意这里的三个量（si / sj / 结果）全都是「值」，
 * 不是「下标」—— 混了会解出乱码。
 */
function makeKeyBox(keyData) {
  const box = new Uint8Array(256);
  for (let i = 0; i < 256; i++) box[i] = i;

  // KSA
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (box[i] + j + keyData[i % keyData.length]) & 255;
    const t = box[i]; box[i] = box[j]; box[j] = t;
  }

  // 重排：si / sj 取的是 box 里的「值」
  const keyBox = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const i1 = (i + 1) & 255;
    const si = box[i1];
    const sj = box[(i1 + si) & 255];
    keyBox[i] = box[(si + sj) & 255];
  }
  return keyBox;
}

function decryptNew(buf) {
  let offset = 10;

  // ---- key 区 ----
  const keyLen = buf.readUInt32LE(offset); offset += 4;
  const keyCipher = Buffer.from(buf.subarray(offset, offset + keyLen));
  offset += keyLen;
  for (let i = 0; i < keyCipher.length; i++) keyCipher[i] ^= 100;
  const keyPlain = stripPad(aesEcbDecrypt(keyCipher, CORE_KEY));
  const keyData = keyPlain.subarray(17);

  const keyBox = makeKeyBox(keyData);

  // ---- meta 区 ----
  let meta = null;
  const metaLen = buf.readUInt32LE(offset); offset += 4;
  if (metaLen > 0) {
    const metaCipher = Buffer.from(buf.subarray(offset, offset + metaLen));
    offset += metaLen;
    for (let i = 0; i < metaCipher.length; i++) metaCipher[i] ^= 99;
    try {
      const b64 = metaCipher.subarray(22).toString('utf8');
      const raw = Buffer.from(b64, 'base64');
      const plain = stripPad(aesEcbDecrypt(raw, META_KEY)).toString('utf8');
      const idx = plain.indexOf(':');
      const parsed = JSON.parse(plain.slice(idx + 1));
      meta = parsed.mainMusic || parsed;
    } catch (e) { meta = null; }
  }

  // ---- 音频数据 ----
  offset += buf.readUInt32LE(offset + 5) + 13;
  const audio = Buffer.from(buf.subarray(offset));
  for (let i = 0; i < audio.length; i++) audio[i] ^= keyBox[i & 255];

  return { audio, meta };
}

const srcDir = process.argv[2] || 'C:/Users/何树吉/Desktop/音乐';
const outDir = process.argv[3] || path.resolve(process.cwd(), 'audio-src');

await fs.mkdir(outDir, { recursive: true });

const files = (await fs.readdir(srcDir)).filter((f) =>
  /\.(ncm|qmc0|qmc3|qmcflac|qmcogg)$/i.test(f));

if (!files.length) {
  console.log('没有找到可解密的音频文件');
  process.exit(0);
}

console.log(`\n=== 解密（${files.length} 个）===\n`);

for (const f of files) {
  const buf = await fs.readFile(path.join(srcDir, f));
  try {
    if (!buf.subarray(0, 8).equals(NEW_MAGIC)) throw new Error('无法识别的文件头（仅支持新版 CTENFDAM）');

    const { audio, meta } = decryptNew(buf);
    const title = (meta && (meta.musicName || meta.name)) || path.basename(f).replace(/\.[^.]+$/, '');
    const artist = (meta && (meta.artist || meta.singer)) || '';

    // 判断实际容器格式
    let ext = '.mp3';
    if (audio.subarray(0, 4).toString('latin1') === 'fLaC') ext = '.flac';
    else if (audio[0] === 0x4f && audio[1] === 0x67 && audio[2] === 0x67) ext = '.ogg';

    // 歌手名里带 ",数字" 的（解密库加的），去掉
    const cleanArtist = String(artist).split(',')[0].trim();
    const safeTitle = String(title).replace(/[\\/:*?"<>|]/g, '').replace(/[（(][^）)]*[)）]\s*$/, '').trim();

    const outName = `${cleanArtist ? cleanArtist + ' - ' : ''}${safeTitle}${ext}`;
    await fs.writeFile(path.join(outDir, outName), audio);

    console.log(`  ✓ ${outName}`);
    console.log(`    ${(audio.length / 1024 / 1024).toFixed(1)} MB`);
    if (meta && meta.album) console.log(`    专辑: ${meta.album}`);
  } catch (err) {
    console.log(`  ✗ ${f}  ${err.message}`);
  }
}

console.log(`\n输出目录: ${outDir}\n`);
