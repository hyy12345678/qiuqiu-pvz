// R6：历史基线单文件不再常年放在工作区，改为按需从冻结的 tag 取出到临时目录。
// tag pre-refactor-baseline 不可变，所以取出的副本可以放心缓存。
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY_TAG = 'pre-refactor-baseline';
const LEGACY_FILE = '植物大战僵尸-网页版.html';

function legacySource() {
  const cache = path.join(os.tmpdir(), 'qiuqiu-pvz-legacy');
  const out = path.join(cache, LEGACY_TAG + '-' + LEGACY_FILE);
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;
  let blob;
  try {
    blob = execFileSync('git', ['show', LEGACY_TAG + ':' + LEGACY_FILE],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    throw new Error('取不到历史基线 ' + LEGACY_TAG + ':' + LEGACY_FILE +
      '（需要带该 tag 的 git 检出，浅克隆会失败）：' + String(e.message || e).split('\n')[0]);
  }
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(out, blob);
  return out;
}

module.exports = { legacySource, LEGACY_TAG, LEGACY_FILE };
