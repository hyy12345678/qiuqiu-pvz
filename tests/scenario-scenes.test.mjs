// R5a 场景迁移：旧 headless_test.js 的场景 D（各界面渲染）、G-b（报纸僵尸两姿态）、
// I12–I13（弹道配色）。旧驱动靠打包后的内部名与顶层 ctx 赋值，这里改走真实 render
// 与 withTarget(记录 ctx)，只断言「画得出、分支确实分叉」，不锁定具体像素。

import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import { LEVELS } from '../src/core/data/levels.js';
import { beginPlay, startLevel, startQuiz } from '../src/core/world.js';
import { drawPea } from '../src/render/projectile.js';
import { drawZombieEntity, drawZombieHeadIcon } from '../src/render/zombie.js';
import { bgCache } from '../src/render/background.js';
import { makeContext, scenario, withTarget } from './helpers/scenario.mjs';

const SPORE_COLOR = '#b478e0';
const KEYS = ['fill', 'stroke', 'fillText', 'createLinearGradient', 'createRadialGradient', 'drawImage', 'arc'];

function countsOf(paint){
  const out = {};
  for (const key of KEYS) out[key] = paint.counts.get(key) || 0;
  return out;
}

// E19：HUD 的木板与太阳图标也改成了贴精灵，drawImage 总数不再是「背景贴了几次」。
// 用 trace 精确数「整屏级」贴图（drawImage(画布, 0, 0, 1024, 640)），其余断言不受影响。
let lastTrace = [];
function bgBlits(){
  return lastTrace.filter(e => e.op === 'drawImage'
    && e.args[1] === 0 && e.args[2] === 0 && e.args[3] === 1024).length;
}

// 单独驱动一帧，返回这一帧的绘制增量。
function oneFrame(sc){
  sc.activate();
  const before = countsOf(sc.paint);
  const start = sc.trace ? sc.trace.length : 0;
  sc.frame();
  lastTrace = sc.trace ? sc.trace.slice(start) : [];
  const after = countsOf(sc.paint);
  const delta = {};
  for (const key of KEYS) delta[key] = after[key] - before[key];
  return delta;
}

// 取「下一帧新增的绘制指令」，用来断言具体分支而不是总量。
function frameTrace(sc){
  sc.activate();
  const start = sc.trace.length;
  sc.frame();
  return sc.trace.slice(start);
}

const MOON_GLOW = 'rgba(255,246,200,0.6)';
const moonGradients = entries => entries.filter(e =>
  e.op === 'createRadialGradient' && e.stops.some(([, color]) => color === MOON_GLOW));

// E18：图标改成贴精灵（drawImage），选关页的绘制量因此大幅转移到 drawImage。
// "画出来了"的语义本来就是"有足够的绘制动作"，所以把 drawImage 一并计入。
function filled(delta){
  return delta.fill + delta.stroke + delta.drawImage;
}

describe('场景 D：各界面用真实 render 各画一帧', () => {
  test('D1：菜单 / 说明 / 选关 / 算术 / 战斗 / 结算都能画，热点表随界面切换', () => {
    const sc = scenario({ seed: 7, trace: true });
    const themeBeforeMenu = bgCache.theme;
    const menu = oneFrame(sc);
    assert.ok(filled(menu) > 300, `菜单绘制过少：${JSON.stringify(menu)}`);
    // E18 起图标走 drawImage，不能用 drawImage 计数判断背景缓存；
    // 改成直接看缓存主题有没有被菜单帧写脏——这才是这条断言的本意。
    assert.equal(bgCache.theme, themeBeforeMenu, '菜单自绘天空，不该触发生成背景缓存');
    assert.equal(sc.ui.hotspots.length, 7, '菜单热点数变化');

    sc.world.state = 'help';
    const help = oneFrame(sc);
    assert.ok(filled(help) > 300, '说明弹层没画出来');
    assert.ok(help.fillText >= 15, `说明弹层文字过少：${help.fillText}`);
    assert.equal(sc.ui.hotspots.length, 1, '说明弹层只剩关闭按钮');
    sc.world.state = 'menu';

    startLevel(sc.world, 0);
    assert.equal(sc.world.state, 'select');
    const select = oneFrame(sc);
    // E18：13 张图鉴卡的图标从「每张近 250 次填充/描边」变成「每张 1 次 drawImage」，
    // 总绘制量掉了一个数量级。阈值下调，同时把「13 张卡都贴出图标」直接断言出来——
    // 这比原来的总数阈值更能说明问题。
    assert.ok(filled(select) > 100, '选关界面绘制过少：' + JSON.stringify(select));
    assert.ok(select.drawImage >= 13, '图鉴 13 张卡都应贴出图标，实际 ' + select.drawImage);
    assert.ok(sc.ui.hotspots.length >= 10, `选关热点过少：${sc.ui.hotspots.length}`);

    startQuiz(sc.world);
    const quiz = oneFrame(sc);
    assert.ok(filled(quiz) > 300, '算术界面没画出来');
    assert.equal(sc.ui.hotspots.length, 4, '算术界面热点应为三个选项加其它一个');

    beginPlay(sc.world, 50);
    const play = oneFrame(sc);
    assert.equal(bgBlits(), 1, '战斗帧应恰好贴一次背景缓存');
    assert.ok(filled(play) > 100, '战斗界面没画出来');
    const playHotspots = sc.ui.hotspots.length;

    for (const state of ['won', 'lost']){
      sc.world.state = state;
      const end = oneFrame(sc);
      assert.equal(bgBlits(), 1, state + '：结算仍走战斗背景');
      assert.ok(end.fillText > play.fillText, `${state}：结算面板应补上文字`);
      assert.ok(sc.ui.hotspots.length > playHotspots, `${state}：结算面板应新增按钮热点`);
    }
  });

  test('D2：解锁进度改变菜单分支 —— 夜间小月亮与关卡卡片只在解锁后绘制', () => {
    const sc = scenario({ seed: 7, trace: true });
    assert.equal(sc.world.unlocked, 1, '起始只解锁第 1 关');
    const locked = { delta: oneFrame(sc), moon: moonGradients(frameTrace(sc)) };
    sc.world.unlocked = LEVELS.length;
    const unlocked = { delta: oneFrame(sc), moon: moonGradients(frameTrace(sc)) };
    sc.world.unlockAll = true;
    const unlockAll = { delta: oneFrame(sc), moon: moonGradients(frameTrace(sc)) };
    sc.world.unlockAll = false;
    sc.world.unlocked = 1;
    const backToLocked = { delta: oneFrame(sc), moon: moonGradients(frameTrace(sc)) };

    assert.ok(unlocked.delta.fill > locked.delta.fill,
      `解锁后菜单应多画关卡卡片：${locked.delta.fill} → ${unlocked.delta.fill}`);
    assert.equal(locked.moon.length, 0, '未解锁的夜关不该有小月亮');
    assert.equal(unlocked.moon.length, 1, `解锁第 4 关后应有且只有一个月亮，实得 ${unlocked.moon.length}`);
    assert.deepEqual(unlocked.delta, unlockAll.delta, 'unlockAll 与全解锁的菜单绘制量应一致');
    assert.equal(unlockAll.moon.length, 1, 'unlockAll 也应命中夜关小月亮分支');
    assert.deepEqual(backToLocked, locked, '回到锁定态后绘制应还原，差异确实来自解锁分支');
  });

  test('D3：夜关选关与白天选关分叉', () => {
    const sc = scenario({ seed: 7 });
    startLevel(sc.world, 0);
    const day = oneFrame(sc);
    sc.world.unlocked = LEVELS.length;
    startLevel(sc.world, LEVELS.length - 1);
    const night = oneFrame(sc);
    assert.ok(LEVELS[LEVELS.length - 1].night, '最后一关应是夜战');
    assert.notDeepEqual(night, day, '夜关选关界面应与白关不同');
  });
});

describe('场景 G-b：报纸僵尸两种姿态', () => {
  const base = { type: 'newspaper', row: 0, x: 0, vy: 0, state: 'walk',
    animT: 0, eatT: 0, slowT: 0, deathT: 0, dustT: 0, paper: 200, angry: false };

  function draw(zombie){
    const paint = makeContext({ label: '僵尸' });
    withTarget(paint.ctx, () => drawZombieEntity(0, zombie));
    return countsOf(paint);
  }

  test('看报 / 暴怒 / 普通三种画法互不相同且都不抛错', () => {
    const reading = draw({ ...base });
    const angry = draw({ ...base, angry: true, paper: 0, acc: 0 });
    const plain = draw({ ...base, type: 'normal', paper: undefined, angry: undefined });
    assert.ok(filled(reading) > 50, '看报姿态没画出来');
    assert.ok(filled(angry) > 50, '暴怒姿态没画出来');
    assert.notDeepEqual(angry, reading, '暴怒姿态应与看报姿态不同');
    assert.notDeepEqual(reading, plain, '看报姿态应区别于普通僵尸');
  });

  test('图鉴头像按护盾类型分叉', () => {
    const paint = makeContext({ label: '头像' });
    const per = acc => {
      const before = countsOf(paint);
      withTarget(paint.ctx, () => drawZombieHeadIcon(100, 100, 1, acc));
      const after = countsOf(paint);
      return after.fill - before.fill;
    };
    const bare = per(undefined);
    const newspaper = per('newspaper');
    assert.ok(newspaper > bare, '报纸头像没画在裸头之上');
    assert.ok(bare > 0, '裸头至少要有脸');
  });
});

describe('场景 I12–I13：弹道配色', () => {
  function fillStylesFor(type){
    const writes = [];
    const paint = makeContext({ label: `弹道 ${type}`, writes });
    withTarget(paint.ctx, () => {
      drawPea({ x: 300, y: 300, row: 2, type, dmg: 20, vx: 300, prevX: 300 });
    });
    return writes.filter(w => w.prop === 'fillStyle').map(w => w.value);
  }

  test('I12：孢子用自身紫色', () => {
    assert.ok(fillStylesFor('spore').includes(SPORE_COLOR), '孢子没有按孢子配色渲染');
  });

  test('I13：非孢子弹道不该借用孢子配色', () => {
    for (const type of ['pea', 'snow', 'fire', 'bullet', 'missile', 'ball']){
      const fills = fillStylesFor(type);
      assert.ok(fills.length > 0, `${type} 没有产生任何填充色`);
      assert.ok(!fills.includes(SPORE_COLOR), `${type} 混入了孢子配色`);
    }
  });
});
