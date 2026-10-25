// esbuild 选项的唯一来源：build.js / dev.js / check-parity.js 必须用同一套配置，
// 否则 parity 的两侧格式化规则不一致，会产生假红或假绿。
'use strict';

const TARGET = 'es2019';

function esbuildOpts(entryPoints, { minify = false } = {}) {
  return {
    entryPoints,
    bundle: true,
    format: 'iife',
    target: TARGET,
    charset: 'utf8',      // 默认 ascii 会把中文转义成 \uXXXX，产物体积翻倍且不可读
    platform: 'browser',
    minify,
    legalComments: 'none',
    sourcemap: false,
  };
}

module.exports = { esbuildOpts, TARGET };
