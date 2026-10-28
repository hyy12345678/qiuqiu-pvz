// 严格指纹的自测：证明它确实能发现单字节变化、文件增删与改名。

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { hashContent, buildManifest, formatManifest, parseManifest, diffManifests } =
  require('../scripts/check-fingerprint.js');

function tempTree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvz-fp-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

test('单字节变化会改变哈希', () => {
  assert.notStrictEqual(hashContent(Buffer.from('a')), hashContent(Buffer.from('b')));
  assert.strictEqual(hashContent(Buffer.from('同样的内容', 'utf8')), hashContent(Buffer.from('同样的内容', 'utf8')));
});

test('清单按路径排序、使用相对路径，并覆盖子目录与非 JS 文件', () => {
  const dir = tempTree({
    'b.js': 'b',
    'a/shell.html': '<html></html>',
    'a/c.js': 'c',
  });
  const m = buildManifest(dir);
  assert.deepStrictEqual(m.map(e => e.path), ['a/c.js', 'a/shell.html', 'b.js']);
  const text = formatManifest(m);
  assert.deepStrictEqual(parseManifest(text), m);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('差异分为新增 / 缺失 / 内容变化三类', () => {
  const before = [
    { path: 'keep.js', hash: 'a'.repeat(64) },
    { path: 'gone.js', hash: 'b'.repeat(64) },
    { path: 'edit.js', hash: 'c'.repeat(64) },
  ];
  const after = [
    { path: 'keep.js', hash: 'a'.repeat(64) },
    { path: 'edit.js', hash: 'd'.repeat(64) },
    { path: 'new.js', hash: 'e'.repeat(64) },
  ];
  assert.deepStrictEqual(diffManifests(before, after), {
    added: ['new.js'],
    missing: ['gone.js'],
    changed: ['edit.js'],
  });
});

test('基线格式非法时明确报错，不静默跳过', () => {
  assert.throws(() => parseManifest('not-a-hash  some/file.js'), /格式非法/);
});
