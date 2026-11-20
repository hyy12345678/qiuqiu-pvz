// E1 护栏收口的自测：把「不带 --yes 不许盖章」和「构建戳摘要」两条新契约钉住。
//
// 这两个 dry-run 测试是安全的：它们断言的全部内容就是「什么都没写」。
// 一旦有人把加闸逻辑改回「直接写」，这里会立刻红，而不是靠 review 记住。

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { srcDigest } = require('../scripts/check-fingerprint.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = path.join(ROOT, 'scripts', 'parity-baseline.txt');
const FINGERPRINT = path.join(ROOT, 'scripts', 'source-fingerprint.txt');

function runScript(name, args) {
  return spawnSync(process.execPath, [path.join(ROOT, 'scripts', name), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('E1 D4：check-parity --rebase 不带 --yes 只做 dry-run，不写快照', () => {
  const before = fs.readFileSync(SNAPSHOT);
  const r = runScript('check-parity.js', ['--rebase']);
  assert.strictEqual(r.status, 1, '未确认时必须拒绝盖章（退出码 1）');
  assert.match(r.stdout, /未写入/);
  assert.match(r.stdout, /npm run parity:rebase/, 'dry-run 必须给出确认入口');
  assert.ok(fs.readFileSync(SNAPSHOT).equals(before), 'dry-run 不得修改快照');
});

test('E1 D4：check-fingerprint --update 不带 --yes 只做 dry-run，不写指纹', () => {
  const before = fs.readFileSync(FINGERPRINT);
  const r = runScript('check-fingerprint.js', ['--update']);
  assert.strictEqual(r.status, 1, '未确认时必须拒绝盖章（退出码 1）');
  assert.match(r.stdout, /未写入/);
  assert.ok(fs.readFileSync(FINGERPRINT).equals(before), 'dry-run 不得修改指纹基线');
});

test('E1 D3：源码摘要为 8 位十六进制、可重复，且随内容变化', () => {
  const a = srcDigest(path.join(ROOT, 'src'));
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.strictEqual(srcDigest(path.join(ROOT, 'src')), a, '同一份源码必须得到同一摘要');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pvz-digest-'));
  try {
    fs.writeFileSync(path.join(tmp, 'a.js'), 'const x = 1;');
    const before = srcDigest(tmp);
    fs.writeFileSync(path.join(tmp, 'a.js'), 'const x = 2;');
    const after = srcDigest(tmp);
    assert.notStrictEqual(before, after, '一个字节的变化必须改变摘要');

    fs.writeFileSync(path.join(tmp, 'b.js'), 'const y = 3;');
    assert.notStrictEqual(srcDigest(tmp), after, '新增文件必须改变摘要');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
