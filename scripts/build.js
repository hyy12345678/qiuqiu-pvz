// 构建：src 模块图 → esbuild 单文件 bundle → 注入 shell.html → dist/*.html
// 产物必须完全离线自包含：无外部请求、无运行时依赖。
// 用法：node scripts/build.js [--minify] [--version x.y.z]
// 标准发布产物是 pretty 那一份；--minify 只写 <name>.min.html 供等价验证，不覆盖发布产物。
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { esbuildOpts } = require('./esbuild-opts');
const { inlineBundle, writeDist, ENTRY, MIN_NAME, OUT_NAME, ROOT } = require('./inline');
// 构建戳里的源码摘要与 check-fingerprint 共用同一套清单与哈希，避免两份实现漂移。
const { srcDigest } = require('./check-fingerprint');

function argOf(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i < 0 ? dflt : (process.argv[i + 1] || dflt);
}

async function build() {
  const minify = process.argv.includes('--minify');
  const version = argOf('--version', String(require(path.join(ROOT, 'package.json')).version));

  const result = await esbuild.build({
    ...esbuildOpts([ENTRY], { minify }),
    write: false,
    outbase: path.join(ROOT, 'src'),
  });
  if (result.errors.length) {
    for (const e of result.errors) console.error(e.text);
    process.exit(1);
  }

  // 戳里带源码摘要（E1 D3）：dist 先构建后提交，git SHA 在提交后会指向父提交，因此不用 SHA。
  // 摘要回答的是「这份产物是否由当前 src/** 构建」，提交前后一致，min 与 pretty 共享同一个摘要。
  const stamp = '/* build: v' + version + (minify ? ' minified' : ' pretty')
    + ' · src ' + srcDigest(path.join(ROOT, 'src')) + ' */';
  const out = writeDist(inlineBundle(result.outputFiles[0].text, stamp), minify ? MIN_NAME : OUT_NAME);
  console.log('built ' + path.relative(ROOT, out) + '  (' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB, ' + (minify ? 'minified，仅验证用' : 'pretty，标准发布产物') + ')');
  return out;
}

if (require.main === module) {
  build().catch(e => { console.error(e.message || e); process.exit(1); });
} else {
  module.exports = { build, OUT_NAME, MIN_NAME };
}
