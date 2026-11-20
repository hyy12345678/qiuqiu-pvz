// scripts/inline.js 的单元测试。
//
// 为什么这件事要紧：inline.js 决定「产物会不会被写坏」，而它之前零测试覆盖。
// 里面有三处极易出错的转义（</script 提前闭合、U+2028/2029 截断字符串字面量），
// 一旦回退，产物在浏览器里表现为「页面能打开但游戏不启动」，而 npm run build 仍然报成功。
//
// 这一组测试是纯函数级的，不起浏览器、不写 dist/。

import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { escapeForInline, assertCompiles, assertOffline, inlineBundle } = require('../scripts/inline.js');

const STAMP = '/* build: v0.0.0 pretty · src deadbeef */';

test('inline：</script 必须转义，大小写都算', () => {
  for(const raw of ['</script>', '</SCRIPT>', '</Script >', 'x</scripty']){
    const out = escapeForInline(raw);
    assert.ok(!/<\/script/i.test(out), '输出里仍然含有未转义的 </script：' + out);
  }
  // 转义产物在 JS 里仍是同一串字符
  const roundTrip = new Function(escapeForInline("return '</script>';"))();
  assert.strictEqual(roundTrip, '</script>');
});

test('inline：U+2028 / U+2029 必须转成转义序列', () => {
  const raw = "var a = 'x y z';";
  const out = escapeForInline(raw);
  assert.ok(!out.includes(' '), 'U+2028 未被转义');
  assert.ok(!out.includes(' '), 'U+2029 未被转义');
  assert.ok(out.includes('\\u2028'), '应写成反斜杠 u2028 形式');
  assert.ok(out.includes('\\u2029'), '应写成反斜杠 u2029 形式');
  assert.doesNotThrow(() => assertCompiles(out));
});

test('inline：转义后仍可编译（这正是最容易写坏的一步）', () => {
  const tricky = [
    "var s = '</script>';",
    "var s = '</script><script>alert(1)</script>';",
    'var s = "x y";',
    'var s = "\\\\";',
  ].join('\n');
  assert.doesNotThrow(() => assertCompiles(escapeForInline(tricky)));
});

test('inline：assertCompiles 对坏语法报错，且说明产物未写出', () => {
  assert.throws(() => assertCompiles('function ('), /产物未写出/);
});

test('inline：assertOffline 拒绝外部引用，放行锚点', () => {
  assert.throws(() => assertOffline('<img src="logo.png">'), /外部引用/);
  assert.throws(() => assertOffline('<link href="https://x/y.css">'), /外部引用/);
  assert.throws(() => assertOffline("<script src='a.js'></script>"), /外部引用/);
  assert.doesNotThrow(() => assertOffline('<a href="#help">帮助</a>'));
  assert.doesNotThrow(() => assertOffline('<canvas id="game"></canvas>'));
});

test('inline：assertOffline 拒绝联网调用', () => {
  for(const call of ['fetch(', 'XMLHttpRequest(', 'WebSocket(', 'importScripts(']){
    assert.throws(() => assertOffline('void ' + call + '1)'), /联网调用/, call + ' 应被判红');
  }
  assert.doesNotThrow(() => assertOffline('var s = "fetching is just a word";'));
});

test('inline：inlineBundle 注入戳与脚本，且不残留占位符', () => {
  const html = inlineBundle('var answer = 42;', STAMP);
  assert.ok(html.includes(STAMP), '缺少构建戳');
  assert.ok(html.includes('var answer = 42;'), '脚本体未注入');
  assert.ok(!html.includes('__BUNDLE__'), '占位符残留');
  assert.ok(html.includes('canvas id="game"'), '缺少 canvas');
});

test('inline：bundle 内的 </script 不会提前闭合标签', () => {
  const html = inlineBundle("var s = '</script>';", STAMP);
  const closers = (html.match(/<\/script/gi) || []).length;
  assert.strictEqual(closers, 1, '整个产物里只应有 shell 自己那一个 </script>，实际 ' + closers);
});

test('inline：注入用的是函数式替换，$& 等序列不会被展开', () => {
  // 若 shell.replace(TOKEN, string) 退化成字符串替换，$& 会被展开成匹配到的占位符
  const body = "var s = '$& and $1 and $$';";
  const html = inlineBundle(body, STAMP);
  assert.ok(html.includes(body), '注入内容被当成替换模式展开了');
  assert.ok(!html.includes('__BUNDLE__'), '占位符残留');
});
