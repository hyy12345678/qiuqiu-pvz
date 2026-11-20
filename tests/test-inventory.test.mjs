// E9：测试清单下限的守卫。
//
// tests/ 不进 fingerprint（改测试是常态），代价是「删测试换绿」原本无人察觉。
// 这个下限记录在 scripts/test-inventory.json 里——它是护栏工具指纹的一部分，
// 所以想调低下限，必须先过 fingerprint 那一关。

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildInventory, compareInventory, countTests } = require('../scripts/check-test-inventory.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts', 'test-inventory.json');

test('E9：测试声明总数不得低于登记下限', () => {
  const expected = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const actual = buildInventory();
  const d = compareInventory(expected, actual);
  assert.deepStrictEqual(d.removed, [], '有测试文件被删掉了');
  assert.deepStrictEqual(d.shrunk, [], '有测试文件的用例数减少了');
  assert.ok(actual.total >= expected.total,
    '测试总数 ' + actual.total + ' 低于下限 ' + expected.total);
});

test('E9：下限只拦减少，不拦新增', () => {
  const expected = { files: [{ path: 'tests/a.test.mjs', count: 3 }], total: 3 };
  const added = { files: [{ path: 'tests/a.test.mjs', count: 5 }, { path: 'tests/b.test.mjs', count: 2 }], total: 7 };
  const d = compareInventory(expected, added);
  assert.strictEqual(d.ok, true, '加了测试不该红');
  assert.deepStrictEqual(d.added, ['tests/b.test.mjs']);
});

test('E9：删文件与减用例都会被抓到', () => {
  const expected = {
    files: [{ path: 'tests/gone.test.mjs', count: 4 }, { path: 'tests/shrink.test.mjs', count: 6 }],
    total: 10,
  };
  const actual = { files: [{ path: 'tests/shrink.test.mjs', count: 2 }], total: 2 };
  const d = compareInventory(expected, actual);
  assert.strictEqual(d.ok, false);
  assert.deepStrictEqual(d.removed, [{ path: 'tests/gone.test.mjs', count: 4 }]);
  assert.deepStrictEqual(d.shrunk, [{ path: 'tests/shrink.test.mjs', expected: 6, actual: 2 }]);
});

test('E9：计数只认 test( 声明，不误数其它文本', () => {
  const dir = fs.mkdtempSync(path.join(ROOT, 'tests', '.inventory-probe-'));
  try {
    const file = path.join(dir, 'probe.test.mjs');
    fs.writeFileSync(file, [
      "// test( 出现在注释里不算",
      "test('a', () => {});",
      "  test('b', () => {});",
      "const note = 'test(';",
      "describe('suite', () => {",
      "  test('c', () => {});",
      "});",
    ].join('\n'));
    assert.strictEqual(countTests(file), 3, '应只数行首（含缩进）的 test( 声明');
    // 已知口径：同一行里写在 describe(...) 之后的 test( 不计数。代码库中不存在这种写法，
    // 若要支持它就得解析注释与字符串，得不偿失。这条断言把这个口径钉住。
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
