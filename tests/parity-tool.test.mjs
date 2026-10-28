// parity 工具的自测：既验证「能发现什么」，也固定「发现不了什么」。
//
// 这些反例是护栏契约的一部分：如果哪天多集合比较被换成保序/保作用域的算法，
// 这里会立刻失败，提醒维护者同步修改文档和阶段放行结论，而不是悄悄升级承诺。

import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalize, normalizeTokens, multisetDiff } = require('../scripts/check-parity.js');

function diff(a, b) {
  return multisetDiff(normalize(a), normalize(b));
}

function assertNoDiff(a, b, hint) {
  const { onlyA, onlyB } = diff(a, b);
  assert.deepStrictEqual(onlyA, [], hint + '：基线独有行应为空');
  assert.deepStrictEqual(onlyB, [], hint + '：当前独有行应为空');
}

test('盲区：同一作用域内语句换序不会被发现', () => {
  assertNoDiff(
    'if (x) { y(); }\nz();',
    'z();\nif (x) { y(); }',
    '换序',
  );
});

test('盲区：语句跨函数搬动不会被发现', () => {
  assertNoDiff(
    'function f(){\n  a();\n  b();\n}\nfunction g(){\n  c();\n}',
    'function f(){\n  a();\n}\nfunction g(){\n  b();\n  c();\n}',
    '跨函数搬动',
  );
});

test('盲区：import / re-export 行被过滤，增删不会被发现', () => {
  assertNoDiff(
    "import { x } from './x.js';\nexport { y } from './y.js';\nuse(x);",
    'use(x);',
    'import 增删',
  );
});

test('盲区：字符串内部的连续空白被折叠', () => {
  assertNoDiff(
    "const s = 'a  b';",
    "const s = 'a b';",
    '字符串内空白',
  );
});

test('盲区：注释变化被忽略', () => {
  assertNoDiff(
    '// 旧说明\nconst n = 1;',
    '/* 新说明 */\nconst n = 1;',
    '注释变化',
  );
});

test('能力：同一行的内容变化会被发现', () => {
  const { onlyA, onlyB } = diff('G.sun -= def.cost;', 'G.sun -= def.cost * 2;');
  assert.deepStrictEqual(onlyA, ['G.sun -= def.cost;']);
  assert.deepStrictEqual(onlyB, ['G.sun -= def.cost * 2;']);
});

test('能力：重复行按出现次数比较，多写一次会暴露', () => {
  const { onlyB } = diff('x();', 'x();\nx();');
  assert.deepStrictEqual(onlyB, ['x();']);
});

test('能力：export 修饰被剥离，但函数体仍然参与比较', () => {
  assertNoDiff('export function f(){ return 1; }', 'function f(){ return 1; }', 'export 修饰剥离');
  const { onlyB } = diff('export function f(){ return 1; }', 'function f(){ return 2; }');
  assert.deepStrictEqual(onlyB, ['function f(){ return 2; }']);
});

test('已知弱化：dist 模式的 token 比较会合并同名符号的尾部数字', () => {
  assert.deepStrictEqual(normalizeTokens('const g2 = 1.0;'), normalizeTokens('var g = 1;'));
});
