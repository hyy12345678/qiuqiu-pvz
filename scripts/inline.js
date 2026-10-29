// 把 esbuild 的 bundle 文本内联进 shell.html，产出完全自包含的单文件 HTML。
// build.js 与 dev.js 共用此函数：转义规则只要在两处各写一遍，就一定会漂移。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHELL = path.join(ROOT, 'src', 'shell.html');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_NAME = '植物大战僵尸-网页版.html';   // 发布产物名含中文，集中在此声明，勿在别处硬编码
const MIN_NAME = '植物大战僵尸-网页版.min.html';   // minified 只做等价验证，不是标准发布产物，见 .gitignore
const TOKEN = '__BUNDLE__';

// 内联进 <script> 前必须处理的三类源码破坏字符：
// 1) </script 会提前闭合标签   2) U+2028/U+2029 是合法 JS 行终止符，会把字符串字面量截断
function escapeForInline(js) {
  const out = js.replace(/<\/script/gi, '<' + '\\' + '/script');
  return out.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// 转义之后必须仍能编译：上面三行替换正是最容易把产物写坏的地方。
// new Function 只编译不执行，所以这里的 SyntaxError 与运行时无关。
function assertCompiles(js) {
  try {
    new Function(js);
  } catch (e) {
    throw new Error('bundle 语法校验失败，产物未写出：' + e.message);
  }
}

function inlineBundle(js, stamp) {
  const escaped = escapeForInline(js);
  assertCompiles(escaped);
  const shell = fs.readFileSync(SHELL, 'utf8');
  const count = shell.split(TOKEN).length - 1;
  if (count !== 1) throw new Error('shell.html 中 ' + TOKEN + ' 应出现 1 次，实际 ' + count + ' 次');
  const html = shell.replace(TOKEN, () => '\n' + stamp + '\n' + escaped + '\n');   // 函数式替换，避免 $& 特殊序列
  if (!html.includes('canvas id')) throw new Error('产物缺少 canvas，shell 注入异常');
  if (html.includes(TOKEN)) throw new Error('产物仍残留 ' + TOKEN);
  assertOffline(html);
  return html;
}

// 离线自包含是这次重构的唯一硬承诺：产物里不能出现任何外部引用或联网调用。
function assertOffline(html) {
  const external = html.match(/(?:src|href)\s*=\s*["'](?!#)[^"']+/gi) || [];
  if (external.length) throw new Error('产物含外部引用，离线不可用：' + external.join(' | '));
  const net = html.match(/\b(fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(/g);
  if (net) throw new Error('产物含联网调用：' + net.join(' | '));
}

function writeDist(html, name = OUT_NAME) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, name);
  fs.writeFileSync(out, html);
  return out;
}

module.exports = { inlineBundle, escapeForInline, assertCompiles, assertOffline, writeDist, OUT_DIR, OUT_NAME, MIN_NAME, SHELL, ENTRY: path.join(ROOT, 'src', 'main.js'), ROOT };
