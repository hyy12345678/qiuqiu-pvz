// 发布页冒烟：加载未经测试改写的真实 dist HTML，只用鼠标 / 触屏 / 键盘走流程。
//
// 这条路径不暴露 G、不替换 Canvas、不注入调试后门；它回答的是
// 「交付文件能不能启动、交互、持续运行，且不产生页面错误或外部请求」。
// 画面细节与轨迹由 render-baseline.test.mjs 单独负责。

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { DIST, launch, openRelease, clickLogical, tapLogical, digest, assertClean } from './lib.mjs';

// 逻辑坐标（1024×640）：这些是界面热点中心，不是业务常量。
const MENU_LEVEL1 = [158, 333];
const PICK = [[250, 300], [370, 300], [490, 300], [250, 400]];   // 向日葵 / 豌豆 / 寒冰 / 坚果
const START = [837, 575];
const ANSWER = [380, 409];
const CARD0 = [178, 52];
const CELL_R2C2 = [465, 352];
const PAUSE_BTN = [967, 27];

function cellRect(x, y) {
  return { x: x - 40, y: y - 48, w: 80, h: 96 };
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pickPlantsAndStart(page, act) {
  await act(...MENU_LEVEL1);
  await wait(400);
  for (const p of PICK) { await act(...p); await wait(120); }
  await act(...START);
  await wait(400);
  // 答对会进入下一题，答错立即开战；点三次并按反馈时长等待，两条路径都能落到战斗。
  for (let i = 0; i < 3; i++) { await act(...ANSWER); await wait(1300); }
  await wait(3800);   // 开场倒计时 -3.2s
}

test('发布冒烟：真实 dist HTML 可启动、交互并持续运行', { timeout: 180000 }, async () => {
  assert.ok(fs.existsSync(DIST), '缺少发布产物，请先 npm run build');
  const browser = await launch();
  try {
    const { context, page, errors } = await openRelease(browser);
    await wait(800);

    // 首帧：背景铺满，不是空白画布
    const first = await digest(page);
    assert.ok(first.ratio > 0.9, '首帧应有完整背景，实际非透明比例 ' + first.ratio.toFixed(2));

    // 持续运行：菜单动画（云、标题漂浮）在两帧之间应有变化
    const menuA = await digest(page);
    await wait(700);
    const menuB = await digest(page);
    assert.notStrictEqual(menuA.hash, menuB.hash, '菜单画面应持续变化');

    await pickPlantsAndStart(page, (x, y) => clickLogical(page, x, y));

    // 战斗画面持续变化
    const playA = await digest(page);
    await wait(700);
    const playB = await digest(page);
    assert.notStrictEqual(playA.hash, playB.hash, '战斗画面应持续变化');

    // 种植：阳光盒与目标格子都应发生变化
    const sunBefore = await digest(page, { x: 14, y: 8, w: 120, h: 88 });
    const cellBefore = await digest(page, cellRect(...CELL_R2C2));
    await clickLogical(page, ...CARD0);
    await wait(150);
    await clickLogical(page, ...CELL_R2C2);
    await wait(500);
    const sunAfter = await digest(page, { x: 14, y: 8, w: 120, h: 88 });
    const cellAfter = await digest(page, cellRect(...CELL_R2C2));
    assert.notStrictEqual(sunAfter.hash, sunBefore.hash, '种下向日葵后阳光数应变化');
    assert.notStrictEqual(cellAfter.hash, cellBefore.hash, '目标格应出现植物');

    // 键盘选卡与取消
    const bankBefore = await digest(page, { x: 148, y: 4, w: 264, h: 96 });
    await page.keyboard.press('2');
    await wait(200);
    const bankAfter = await digest(page, { x: 148, y: 4, w: 264, h: 96 });
    assert.notStrictEqual(bankAfter.hash, bankBefore.hash, '数字键应选中对应卡片');
    await page.keyboard.press('Escape');
    await wait(100);

    // 暂停按钮：遮罩应让整体亮度下降，再点一次恢复
    const bright = await digest(page);
    await clickLogical(page, ...PAUSE_BTN);
    await wait(400);
    const paused = await digest(page);
    assert.ok(paused.avg < bright.avg - 20,
      `暂停遮罩应压暗画面（${bright.avg.toFixed(1)} → ${paused.avg.toFixed(1)}）`);
    await clickLogical(page, ...PAUSE_BTN);
    await wait(300);

    await page.keyboard.press('m');
    await page.keyboard.press('m');

    assertClean(errors, '桌面发布冒烟');
    await context.close();
  } finally {
    await browser.close();
  }
});

test('发布冒烟：触屏入口可完成选卡、开局与种植', { timeout: 180000 }, async () => {
  assert.ok(fs.existsSync(DIST), '缺少发布产物，请先 npm run build');
  const browser = await launch();
  try {
    const { context, page, errors } = await openRelease(browser, { hasTouch: true });
    await wait(800);

    await pickPlantsAndStart(page, (x, y) => tapLogical(page, x, y));

    const cellBefore = await digest(page, cellRect(...CELL_R2C2));
    await tapLogical(page, ...CARD0);
    await wait(150);
    await tapLogical(page, ...CELL_R2C2);
    await wait(500);
    const cellAfter = await digest(page, cellRect(...CELL_R2C2));
    assert.notStrictEqual(cellAfter.hash, cellBefore.hash, '触屏点击应能种下植物');

    const bright = await digest(page);
    await tapLogical(page, ...PAUSE_BTN);
    await wait(400);
    const paused = await digest(page);
    assert.ok(paused.avg < bright.avg - 20, '触屏点击暂停按钮应生效');
    await tapLogical(page, ...PAUSE_BTN);
    await wait(300);

    assertClean(errors, '触屏发布冒烟');
    await context.close();
  } finally {
    await browser.close();
  }
});
