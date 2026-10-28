// 受控绘制轨迹基线：固定时间、随机源、存储、视口与 DPR，记录 Canvas 调用顺序与参数。
//
// 验证与更新分离：
//   npm run test:browser                  # 只比较
//   npm run test:browser:update           # 审查差异后重写基线
// 音频在这里是替身（无 AudioContext），所以这条路径不构成真实音频验收。

import test, { after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, launch, openRelease, clickLogical, assertClean } from './lib.mjs';
import { initHarness } from './trace-harness.mjs';

const require = createRequire(import.meta.url);
const PLAYWRIGHT_VERSION = require('playwright/package.json').version;
let chromiumVersion = '';

const SEED = 12345;
const BASE_DIR = path.join(ROOT, 'tests/browser/baselines');
const ART_DIR = path.join(ROOT, 'tests/browser/artifacts');
const UPDATE = process.env.UPDATE_TRACE === '1';

// 逻辑坐标：菜单三张关卡卡（第 1/3/4 关）、图鉴前四张、开始按钮、答题按钮。
const LV1 = [158, 333], LV3 = [630, 333], LV4 = [866, 333];
const PICKS = [[250, 300], [370, 300], [490, 300], [250, 400]];
const START = [837, 575];
const ANSWER = [380, 409];

async function advance(page, frames) {
  await page.evaluate(n => { window.__advance(n); }, frames);
}
async function click(page, x, y) {
  await clickLogical(page, x, y);
  await advance(page, 1);
}
async function toSelect(page, card) {
  await click(page, ...card);
  await advance(page, 1);
}
async function toQuiz(page, card) {
  await toSelect(page, card);
  for (const p of PICKS) await click(page, ...p);
  await click(page, ...START);
  await advance(page, 1);
}
async function toPlay(page, card) {
  await toQuiz(page, card);
  for (let i = 0; i < 3; i++) {
    await click(page, ...ANSWER);
    await advance(page, 60);
  }
  await advance(page, 240);
}

const SCENES = [
  { name: 'menu', prepare: page => advance(page, 5) },
  { name: 'select-l3', prepare: page => toSelect(page, LV3) },
  { name: 'quiz-l3', prepare: page => toQuiz(page, LV3) },
  { name: 'play-day-l1', prepare: page => toPlay(page, LV1) },
  { name: 'play-night-l4', prepare: page => toPlay(page, LV4) },
];

function baselinePath(name) { return path.join(BASE_DIR, name + '.trace.txt'); }

function updateBaseline(name, lines) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  const file = baselinePath(name);
  if (fs.existsSync(file)) {
    const before = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    console.log('  重新盖章 ' + name + '：旧 ' + before.length + ' 行 / 新 ' + lines.length + ' 行');
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function writeArtifact(name, lines, page, label) {
  fs.mkdirSync(ART_DIR, { recursive: true });
  fs.writeFileSync(path.join(ART_DIR, name + '.actual.txt'), lines.join('\n') + '\n');
  return page.screenshot({ path: path.join(ART_DIR, name + '.png') }).then(() => label);
}

async function checkScene(page, name, lines) {
  const file = baselinePath(name);
  if (UPDATE) {
    updateBaseline(name, lines);
    return;
  }
  assert.ok(fs.existsSync(file), '缺少轨迹基线 ' + path.relative(ROOT, file) + '，先跑 npm run test:browser:update');
  const expected = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  let i = 0;
  while (i < expected.length && i < lines.length && expected[i] === lines[i]) i++;
  if (i === expected.length && i === lines.length) return;
  await writeArtifact(name, lines, page, name);
  const got = lines[i] === undefined ? '<无更多行>' : lines[i];
  const want = expected[i] === undefined ? '<无更多行>' : expected[i];
  throw new Error(
    name + ' 绘制轨迹与基线不一致（首个差异第 ' + (i + 1) + ' 行；基线 ' + expected.length
    + ' 行 / 当前 ' + lines.length + ' 行）\n'
    + '  基线: ' + want + '\n'
    + '  当前: ' + got + '\n'
    + '  差异前后参考: ' + expected.slice(Math.max(0, i - 2), i + 3).join(' | ')
  );
}

for (const scene of SCENES) {
  test('绘制基线：' + scene.name, { timeout: 120000 }, async () => {
    const browser = await launch();
    chromiumVersion = browser.version();
    try {
      const { context, page, errors } = await openRelease(
        browser,
        {},
        { fn: initHarness, arg: { seed: SEED, unlocked: 4 } },
      );
      // 热点在渲染时注册；先出两帧，后续点击才落在真实控件上。
      await advance(page, 2);
      await scene.prepare(page);
      const lines = await page.evaluate(() => {
        window.__traceStart();
        window.__advance(1);
        return window.__traceStop();
      });
      assert.ok(lines.length > 100, '轨迹行数过少（' + lines.length + '），可能没有真正渲染');
      await checkScene(page, scene.name, lines);
      assertClean(errors, scene.name);
      await context.close();
    } finally {
      await browser.close();
    }
  });
}

after(() => {
  if (!UPDATE) return;
  fs.mkdirSync(BASE_DIR, { recursive: true });
  const env = {
    note: '受控绘制基线环境；仅记录生成时的版本，不参与逐行比较',
    seed: SEED,
    viewport: '1024x640',
    deviceScaleFactor: 1,
    audio: 'stub (no AudioContext)',
    playwright: PLAYWRIGHT_VERSION,
    chromium: chromiumVersion,
    scenes: SCENES.map(s => ({ name: s.name, lines: fs.existsSync(baselinePath(s.name))
      ? fs.readFileSync(baselinePath(s.name), 'utf8').split('\n').filter(Boolean).length : 0 })),
  };
  fs.writeFileSync(path.join(BASE_DIR, 'env.json'), JSON.stringify(env, null, 2) + '\n');
  console.log('基线环境：' + JSON.stringify(env.scenes));
});
