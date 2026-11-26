// 受控绘制轨迹基线：固定时间、随机源、存储、视口与 DPR，记录 Canvas 调用顺序与参数。
//
// 3D 版：轨迹记录的是 2D 主画布上的全部调用——界面层（卡片、按钮、文字、HUD）逐行锁定，
// 3D 战场在轨迹里只是一次整幅 drawImage。战场本身由下面的画面统计兜底：
// 不锁像素（软件光栅与真 GPU 的像素本来就不同），只断言「画出来了、昼夜确实分叉」。
//
// 验证与更新分离：
//   npm run test:browser:baselines        # 只比较（verify 链用的就是这一条）
//   npm run test:browser:update           # 审查差异后重写基线
// 音频在这里是替身（无 AudioContext），所以这条路径不构成真实音频验收。
//
// E25 减负：从 5 个场景收敛到 3 个。删掉的是 select-l3 与 quiz-l3——
// 这两个界面没有随时间变化的绘制，逐帧轨迹里绝大部分是同一段静态面板的重复；
// 它们的分支仍由 tests/scenario-scenes.test.mjs 与 render-boundary 断言覆盖。
// 留下的三条各守一个不同的东西：menu=持续动画与热点排版，play-day-l1=白天战斗全场，
// play-night-l4=夜间分支与贴图路径。改绘制时少盖两扇门，回归面几乎不变。

import test, { after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, launch, openRelease, clickLogical, assertClean, regionStats } from './lib.mjs';
import { initHarness } from './trace-harness.mjs';

const require = createRequire(import.meta.url);
const PLAYWRIGHT_VERSION = require('playwright/package.json').version;
let chromiumVersion = '';

const SEED = 12345;
const BASE_DIR = path.join(ROOT, 'tests/browser/baselines');
const ART_DIR = path.join(ROOT, 'tests/browser/artifacts');
const UPDATE = process.env.UPDATE_TRACE === '1';

// 逻辑坐标：菜单关卡卡（第 1 / 4 关）、图鉴前四张、开始按钮、答题按钮。
const LV1 = [158, 333], LV4 = [866, 333];
const PICKS = [[250, 300], [370, 300], [490, 300], [250, 400]];
const START = [837, 575];
const ANSWER = [380, 409];

async function advance(page, frames) {
  await page.evaluate(n => { window.__advance(n); }, frames);
}
// 粗帧推进：每帧 50ms（游戏单帧 dt 的上限），同样的游戏时长只需三分之一的帧数。
// 3D 版每帧都要真渲染一次，CI 的软件光栅比本机慢约 3 倍，逐 16.7ms 推进会超时（E28 首次 CI 实跑）。
// 只用于「到达」被测画面的路上；被记录的那一帧仍是标准 16.7ms。
async function coarse(page, seconds) {
  await page.evaluate(n => { for (let i = 0; i < n; i++) window.__step(50); }, Math.round(seconds / 0.05));
}
async function click(page, x, y) {
  await clickLogical(page, x, y);
  await advance(page, 1);
}
// 菜单 → 卡（选关）→ 图鉴 → 开始 → 答题 → 战斗。中间两步不再单独出场景，
// 但仍是到达战斗的必经之路，因此留在到达函数里而不是各自成例。
async function toPlay(page, card) {
  await click(page, ...card);
  await advance(page, 1);
  for (const p of PICKS) await click(page, ...p);
  await click(page, ...START);
  await advance(page, 1);
  for (let i = 0; i < 3; i++) {
    await click(page, ...ANSWER);
    await coarse(page, 1);
  }
  await coarse(page, 4);
}

// lawn：战场中央的画面统计断言（白天草坪明亮偏绿，夜里整体压暗）
const LAWN = { x: 380, y: 260, w: 260, h: 160 };
const SCENES = [
  { name: 'menu', prepare: page => advance(page, 5),
    check: st => assert.ok(st.b > st.r, '菜单应是 3D 院子的蓝天') , rect: { x: 0, y: 0, w: 1024, h: 60 } },
  { name: 'play-day-l1', prepare: page => toPlay(page, LV1),
    check: st => { assert.ok(st.g > st.r && st.g > st.b, '白天草坪应偏绿'); assert.ok(st.mean > 90, '白天草坪应明亮，实际 ' + st.mean.toFixed(0)); }, rect: LAWN },
  { name: 'play-night-l4', prepare: page => toPlay(page, LV4),
    check: st => assert.ok(st.mean < 90, '夜战应明显压暗，实际 ' + st.mean.toFixed(0)), rect: LAWN },
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
  test('绘制基线：' + scene.name, { timeout: 360000 }, async () => {
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
      assert.ok(lines.some(l => /drawImage\(\[object HTMLCanvasElement\],0,0,1024,640\)/.test(l)), '应整幅贴出 3D 画面');
      scene.check(await regionStats(page, scene.rect));
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
