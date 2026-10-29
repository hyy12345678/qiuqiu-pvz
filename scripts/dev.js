// 开发模式：esbuild watch + 本地静态服务，改代码后浏览器刷新即最新产物。
// 用法：npm run dev   （Ctrl-C 停止）
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const esbuild = require('esbuild');
const { esbuildOpts } = require('./esbuild-opts');
const { inlineBundle, writeDist, ENTRY, OUT_DIR, OUT_NAME } = require('./inline');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);

async function serve() {
  const ctx = await esbuild.context({
    ...esbuildOpts([ENTRY]),
    write: false,
    plugins: [{
      name: 'inline-offline',
      setup(build) {
        build.onEnd(result => {
          if (result.errors.length) {
            for (const e of result.errors) console.error('[esbuild]', e.text);
            return;
          }
          try {
            const out = writeDist(inlineBundle(result.outputFiles[0].text, '/* dev build */'));
            console.log('[' + new Date().toLocaleTimeString() + '] rebuilt → ' + path.relative(ROOT, out));
          } catch (e) {
            console.error('[inline] ' + e.message);
          }
        });
      },
    }],
  });
  await ctx.watch();

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/index.html') p = '/' + OUT_NAME;
    const file = path.join(OUT_DIR, p);
    if (!file.startsWith(OUT_DIR) || !fs.existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(file));
  });
  server.listen(PORT, () => {
    console.log('dev server: http://localhost:' + PORT + '/');
    console.log('或双击打开: ' + path.join(OUT_DIR, OUT_NAME));
    console.log('改 src/ 下的文件后刷新浏览器即可；Ctrl-C 停止。');
    console.log('注意：dev 会把 /* dev build */ 写进发布文件，验收或提交前必须跑 npm run build 重新生成标准产物。');
  });
}

serve().catch(e => { console.error(e); process.exit(1); });
