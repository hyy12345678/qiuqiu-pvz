// 构建：src 模块图 → esbuild 单文件 bundle → 注入 shell.html → dist/植物大战僵尸-网页版.html
// 产物必须完全离线自包含：无外部请求、无运行时依赖。
// 用法：node scripts/build.js [--minify] [--version x.y.z]
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { esbuildOpts } = require('./esbuild-opts');
const { inlineBundle, writeDist, ENTRY, ROOT } = require('./inline');

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

  const stamp = '/* build: v' + version + (minify ? ' minified' : ' pretty') + ' */';
  const out = writeDist(inlineBundle(result.outputFiles[0].text, stamp));
  console.log('built ' + path.relative(ROOT, out) + '  (' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB, ' + (minify ? 'minified' : 'pretty') + ')');
  return out;
}

if (require.main === module) {
  build().catch(e => { console.error(e.message || e); process.exit(1); });
} else {
  module.exports = { build, OUT_NAME };
}
