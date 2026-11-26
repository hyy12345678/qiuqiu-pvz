// 发布页冒烟：加载未经测试改写的真实 dist HTML，只用鼠标 / 触屏 / 键盘走流程。
//
// 这条路径不暴露 G、不替换 Canvas、不注入调试后门；它回答的是
// 「交付文件能不能启动、交互、持续运行，且不产生页面错误或外部请求」。
// 画面细节与轨迹由 render-baseline.test.mjs 单独负责。
//
// 3D 版：格子坐标由战斗镜头换算（cellScreen），点击走游戏真实的射线拾取。
// 无 GPU 的 CI 上跑的是低配档（软件光栅），帧率低，等待时间因此放宽。

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { DIST, launch, openRelease, clickLogical, tapLogical, digest, assertClean, cellScreen, regionStats } from './lib.mjs';

// 逻辑坐标（1024×640）：这些是界面热点中心，不是业务常量。
const MENU_LEVEL1 = [158, 333];
const PICK = [[250, 300], [370, 300], [490, 300], [250, 400]];   // 向日葵 / 豌豆 / 寒冰 / 坚果
const START = [837, 575];
const ANSWER = [380, 409];
const CARD0 = [178, 52];
const CELL_R2C2 = cellScreen(2, 2);
const PAUSE_BTN = [967, 27];
// 阳光盒里只有数字的那一块：太阳图标会转、草会摇，整个阳光盒的像素每帧都在变，
// 只有数字区域在阳光数不变时是静止的——它变了才说明真的扣了阳光。
const SUN_DIGITS = { x: 80, y: 22, w: 50, h: 28 };

// 格子中心向上一点：植物有高度，变化主要出现在地面以上
function cellRect(x, y) {
  return { x: x - 40, y: y - 70, w: 80, h: 90 };
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pickPlantsAndStart(page, act) {
  await act(...MENU_LEVEL1);
  await wait(400);
  for (const p of PICK) { await act(...p); await wait(120); }
  await act(...START);
  await wait(400);
  // 答对会进入下一题，答错立即开战；点三次并按反馈时长等待，两条路径都能落到战斗。
  for (let i = 0; i < 3; i++) { await act(...ANSWER); await wait(1600); }
  await wait(6000);   // 开场倒计时 -3.2s + 镜头从街道摇回草坪（软件光栅下帧率低，游戏时钟走得慢）
}

test('发布冒烟：真实 dist HTML 可启动、交互并持续运行', { timeout: 180000 }, async () => {
  assert.ok(fs.existsSync(DIST), '缺少发布产物，请先 npm run build');
  const browser = await launch();
  try {
    const { context, page, errors } = await openRelease(browser);
    await wait(800);

    // 首帧：3D 院子铺满，不是空白画布，也不是「不支持 WebGL」的提示底图
    const first = await digest(page);
    assert.ok(first.ratio > 0.9, '首帧应有完整背景，实际非透明比例 ' + first.ratio.toFixed(2));
    const sky = await regionStats(page, { x: 0, y: 0, w: 1024, h: 60 });
    assert.ok(sky.b > sky.r, '菜单上方应是蓝天（3D 渲染生效），实际 rgb ' + [sky.r, sky.g, sky.b].map(v => v.toFixed(0)).join(','));

    // 持续运行：菜单动画（云、标题漂浮）在两帧之间应有变化
    const menuA = await digest(page);
    await wait(700);
    const menuB = await digest(page);
    assert.notStrictEqual(menuA.hash, menuB.hash, '菜单画面应持续变化');

    await pickPlantsAndStart(page, (x, y) => clickLogical(page, x, y));

    // 战场是 3D 草坪：中央区域以绿色为主，且有明暗层次（草叶、格子、阴影）
    const lawn = await regionStats(page, { x: 380, y: 260, w: 260, h: 160 });
    assert.ok(lawn.g > lawn.r && lawn.g > lawn.b, '战场中央应是绿色草坪，实际 rgb ' + [lawn.r, lawn.g, lawn.b].map(v => v.toFixed(0)).join(','));
    assert.ok(lawn.std > 6, '草坪应有明暗层次，实际亮度离散 ' + lawn.std.toFixed(1));
    // 战斗画面持续变化
    const playA = await digest(page);
    await wait(700);
    const playB = await digest(page);
    assert.notStrictEqual(playA.hash, playB.hash, '战斗画面应持续变化');

    // 种植：阳光盒与目标格子都应发生变化
    const sunBefore = await digest(page, SUN_DIGITS);
    const sunSteady = await digest(page, SUN_DIGITS);
    assert.strictEqual(sunSteady.hash, sunBefore.hash, '阳光数不变时数字区域应静止（否则下面的断言没有意义）');
    const cellBefore = await regionStats(page, cellRect(...CELL_R2C2));
    await clickLogical(page, ...CARD0);
    await wait(150);
    await clickLogical(page, ...CELL_R2C2);
    await wait(900);
    const sunAfter = await digest(page, SUN_DIGITS);
    const cellAfter = await regionStats(page, cellRect(...CELL_R2C2));
    assert.notStrictEqual(sunAfter.hash, sunBefore.hash, '种下向日葵后阳光数应变化');
    // 向日葵是黄的：目标格的红色分量明显上升（绿草上长出一朵黄花）
    assert.ok(cellAfter.r - cellBefore.r > 8, '目标格应出现向日葵，红色分量 ' + cellBefore.r.toFixed(1) + ' → ' + cellAfter.r.toFixed(1));

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

// 分数 DPR 是真实存在的：Windows 150%、macOS「更多空间」缩放、Linux 分数缩放。
// 3D 画面画在离屏 WebGL 画布上再贴进主画布，两者都必须跟着新 DPR 重建，否则换屏后发糊。
test('发布冒烟：分数 DPR 启动正确，且运行期换屏（DPR 变化）后背板与变换都按新 DPR 重建', { timeout: 180000 }, async () => {
  assert.ok(fs.existsSync(DIST), '缺少发布产物，请先 npm run build');
  const browser = await launch();
  const shots = [];
  try {
    for (const dsf of [1.25, 1.5]) {
      const { context, page, errors } = await openRelease(browser, { deviceScaleFactor: dsf });
      await wait(600);

      // 1) 画布 backing 尺寸按 DPR 放大，且不超过 2 倍上限
      const backing = await page.evaluate(() => {
        const c = document.getElementById('game');
        return { w: c.width, h: c.height, dpr: devicePixelRatio };
      });
      assert.strictEqual(backing.dpr, dsf);
      assert.strictEqual(backing.w, Math.round(1024 * dsf), '背板宽度应随 DPR 放大');
      assert.strictEqual(backing.h, Math.round(640 * dsf), '背板高度应随 DPR 放大');

      // 2) 画面完整，且像素按该 DPR 真实重绘：
      //    同一个逻辑区域在不同 DPR 下渲染出的采样结果不应完全相同。
      const shot = await digest(page);
      assert.ok(shot.ratio > 0.9, '画面不应变空白，实际非透明比例 ' + shot.ratio.toFixed(2));
      shots.push(shot);

      // 3) 运行期 DPR 变化（E26）：换屏 / 浏览器缩放会改 devicePixelRatio 而不触发 resize。
      //    背板必须按新 DPR 重建，ctx 变换也要跟着重设——否则内容被浏览器放大，整幅发糊。
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1024, height: 640, deviceScaleFactor: 2, mobile: false,
      });
      await wait(900);
      const live = await page.evaluate(() => {
        const c = document.getElementById('game');
        return { dpr: devicePixelRatio, w: c.width, h: c.height, scale: c.getContext('2d').getTransform().a };
      });
      assert.strictEqual(live.dpr, 2);
      assert.strictEqual(live.w, 2048, '运行期改 DPR 后背板宽度应重建');
      assert.strictEqual(live.h, 1280, '运行期改 DPR 后背板高度应重建');
      assert.strictEqual(live.scale, 2, 'ctx 变换必须跟随新 DPR，否则坐标系统错位');
      const rebuilt = await digest(page);
      assert.ok(rebuilt.ratio > 0.9, '重建后画面不应变空白，实际非透明比例 ' + rebuilt.ratio.toFixed(2));

      assertClean(errors, '分数 DPR ' + dsf);
      await context.close();
    }
    assert.notStrictEqual(shots[0].hash, shots[1].hash,
      '1.25 与 1.5 两档 DPR 的同一区域采样不应完全相同，否则说明没有真正按 DPR 重绘');
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

    const sunBefore = await digest(page, SUN_DIGITS);
    const cellBefore = await regionStats(page, cellRect(...CELL_R2C2));
    await tapLogical(page, ...CARD0);
    await wait(150);
    await tapLogical(page, ...CELL_R2C2);
    await wait(900);
    const sunAfter = await digest(page, SUN_DIGITS);
    const cellAfter = await regionStats(page, cellRect(...CELL_R2C2));
    assert.notStrictEqual(sunAfter.hash, sunBefore.hash, '触屏种植后阳光数应变化');
    assert.ok(cellAfter.r - cellBefore.r > 8, '触屏点击应在目标格种下向日葵，红色分量 ' + cellBefore.r.toFixed(1) + ' → ' + cellAfter.r.toFixed(1));

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
