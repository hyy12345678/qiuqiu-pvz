// P4 技术方案的前置验证：esbuild bundle 后，ESM 的 `export let` 在源模块内重绑，
// 引用方仍能看到新值（live binding）。若不成立，P4 必须改为「每个 draw 函数显式传 g 参数」，
// 意味着 1119 处 ctx 引用与 28 个函数签名全量重写，工期需要重估。
// 这是 §5 方案 B 的唯一硬依赖，所以放在 P1 就验证。
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const esbuild = require('esbuild');

const ENTRY = path.join(__dirname, 'fixtures', 'lb-main.mjs');

test('esbuild bundle 保留 ESM live binding 语义', async () => {
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    target: 'es2019',
    platform: 'neutral',
    write: false,
  });
  const js = result.outputFiles[0].text;
  delete globalThis.__lb;
  new Function(js)();
  assert.deepStrictEqual(globalThis.__lb, ['none', 'main', 'off', 'main', 'main']);
});
