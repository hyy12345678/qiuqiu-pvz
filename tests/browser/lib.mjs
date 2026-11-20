// 浏览器验收的共享工具：发布页 URL、上下文创建、逻辑坐标点击、Canvas 像素摘要。
// 只读 Canvas（getImageData），不替换、不注入调试全局。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// 默认打标准发布产物；PVZ_DIST 可指向另一份构建（例如只用于验证的 min 产物），
// 这样同一套冒烟与受控轨迹能对两种交付形态跑同一条断言。
export const DIST = process.env.PVZ_DIST
  ? path.resolve(ROOT, process.env.PVZ_DIST)
  : path.join(ROOT, 'dist', '植物大战僵尸-网页版.html');
export const DIST_URL = pathToFileURL(DIST).href;

export const W = 1024, H = 640;

// E1 D3：戳里多了「· src <8 位十六进制>」的源码摘要，用来判断产物是否由当前源码构建。
// 摘要必须存在且格式完整——宁可判红，也不要让一份来历不明的产物通过验收。
const RELEASE_STAMP = /^\/\* build: v\d+\.\d+\.\d+ (?:pretty|minified) · src [0-9a-f]{8} \*\/$/;

/** 发布页必须带发布构建戳：npm run dev 会把 dev build 注释写进同一个文件，冒充发布产物时在这里判红。 */
export function assertReleaseStamp(file = DIST) {
  const line = fs.readFileSync(file, 'utf8').split('\n', 20).find(l => l.startsWith('/* build:'));
  if (!line) throw new Error(path.relative(ROOT, file) + ' 缺少发布构建戳，请先 npm run build');
  if (!RELEASE_STAMP.test(line)) {
    throw new Error(path.relative(ROOT, file) + ' 不是发布构建，戳为 ' + line + '；验收前须重新 npm run build');
  }
  return line;
}

export async function launch() {
  return chromium.launch({ headless: true });
}

/** 打开发布页，收集页面错误、控制台错误与外部请求。init 需在页面脚本之前注入。 */
export async function openRelease(browser, options = {}, init = null) {
  assertReleaseStamp();
  const context = await browser.newContext({
    viewport: { width: 1024, height: 640 },
    deviceScaleFactor: 1,
    ...options,
  });
  const page = await context.newPage();
  const errors = { page: [], console: [], external: [] };
  page.on('pageerror', e => errors.page.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.console.push(msg.text()); });
  page.on('request', req => {
    const url = req.url();
    if (!/^(file|data|blob|about):/i.test(url)) errors.external.push(url);
  });
  if (init) await page.addInitScript(init.fn, init.arg);
  await page.goto(DIST_URL, { waitUntil: 'load' });
  await page.waitForSelector('#game');
  return { context, page, errors };
}

export async function clickLogical(page, x, y) {
  const box = await page.locator('#game').boundingBox();
  await page.mouse.click(box.x + x / W * box.width, box.y + y / H * box.height);
}

export async function tapLogical(page, x, y) {
  const box = await page.locator('#game').boundingBox();
  await page.touchscreen.tap(box.x + x / W * box.width, box.y + y / H * box.height);
}

/** 对 Canvas 的逻辑坐标区域做像素摘要；hash 用于判断画面是否变化。 */
export async function digest(page, rect = { x: 0, y: 0, w: W, h: H }) {
  return page.evaluate(({ rect }) => {
    const c = document.getElementById('game');
    const g = c.getContext('2d');
    const dpr = c.width / 1024;
    const x = Math.max(0, Math.round(rect.x * dpr));
    const y = Math.max(0, Math.round(rect.y * dpr));
    const w = Math.max(1, Math.min(c.width - x, Math.round(rect.w * dpr)));
    const h = Math.max(1, Math.min(c.height - y, Math.round(rect.h * dpr)));
    const d = g.getImageData(x, y, w, h).data;
    let hash = 2166136261 >>> 0, nonzero = 0, sum = 0;
    for (let i = 0; i < d.length; i++) {
      hash ^= d[i];
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]) nonzero++;
      sum += d[i] + d[i + 1] + d[i + 2];
    }
    return { hash, nonzero, ratio: nonzero / (d.length / 4), avg: sum / (d.length / 4 * 3) };
  }, { rect });
}

export function assertClean(errors, label) {
  const { page, console, external } = errors;
  if (page.length) throw new Error(label + '：页面错误\n' + page.join('\n'));
  if (console.length) throw new Error(label + '：控制台错误\n' + console.join('\n'));
  if (external.length) throw new Error(label + '：外部请求\n' + external.join('\n'));
}
