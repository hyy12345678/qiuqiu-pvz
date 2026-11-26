// 场景 D：各界面用真实 render 各画一帧（3D 视图为无 WebGL 的真实场景树替身）；
// G-b：报纸僵尸两种姿态在 3D 模型上分叉；I12–I13：弹丸原型配色。
// 只断言「画得出、分支确实分叉」，不锁定具体像素。
import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { MeshPhysicalMaterial } from 'three';
import { LEVELS } from '../src/core/data/levels.js';
import { beginPlay, startLevel, startQuiz } from '../src/core/world.js';
import { spawnZombie } from '../src/core/entities.js';
import { ZOMBIE_MODELS } from '../src/render/scene3d/zombies.js';
import { template } from '../src/render/scene3d/world-view.js';
import { instantiate, resetPose } from '../src/render/scene3d/rig.js';
import { buildPeaProtos } from '../src/render/scene3d/props.js';
import { scenario } from './helpers/scenario.mjs';

const KEYS = ['fill', 'stroke', 'fillText', 'createLinearGradient', 'createRadialGradient', 'drawImage', 'arc', 'fillRect'];
function countsOf(paint){
  const out = {};
  for (const key of KEYS) out[key] = paint.counts.get(key) || 0;
  return out;
}
let lastTrace = [];
function blits(){
  return lastTrace.filter(e => e.op === 'drawImage' && e.args[1] === 0 && e.args[2] === 0 && e.args[3] === 1024).length;
}
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
function frameTrace(sc){
  sc.activate();
  const start = sc.trace.length;
  sc.frame();
  return sc.trace.slice(start);
}
// 夜关卡片右上角的月亮：只在第 4 关解锁后画
const MOON = '#fff4c8';
const moons = entries => entries.filter(e => e.prop === 'fillStyle' && e.value === MOON).length;
// 方块风界面大量用 fillRect 画斜面与像素图标，一并计入「画出来了」
const filled = d => d.fill + d.stroke + d.drawImage + d.fillRect;

describe('场景 D：各界面用真实 render 各画一帧', () => {
  test('D0：锁住的关卡也必须注册热点——只是不高亮，点下去由 chooseLevel 给出 locked 反馈', () => {
    const sc = scenario({ seed: 7 });
    sc.world.unlocked = 1;
    sc.world.unlockAll = false;
    oneFrame(sc);
    const levelHotspots = sc.ui.hotspots.filter(h => h.action && h.action.type === 'level');
    assert.equal(levelHotspots.length, LEVELS.length, '每一关都应注册热点，锁住的也不例外');
    const lockedIdx = LEVELS.length - 1;
    assert.ok(sc.world.unlocked < lockedIdx + 1, '本用例需要至少一个锁定关卡');
    assert.ok(levelHotspots.find(h => h.action.index === lockedIdx), '锁定关卡必须有热点');
  });

  test('D1：菜单 / 说明 / 选关 / 算术 / 战斗 / 结算都能画，热点表与 3D 模式随界面切换', () => {
    const sc = scenario({ seed: 7, trace: true });
    const menu = oneFrame(sc);
    assert.ok(filled(menu) > 40, `菜单绘制过少：${JSON.stringify(menu)}`);
    assert.equal(blits(), 1, '菜单应贴一次 3D 院子');
    assert.equal(sc.ui.hotspots.length, 7, '菜单热点数变化');

    sc.world.state = 'help';
    const help = oneFrame(sc);
    assert.ok(filled(help) > 20, '说明弹层没画出来');
    assert.ok(help.fillText >= 15, `说明弹层文字过少：${help.fillText}`);
    assert.equal(sc.ui.hotspots.length, 1, '说明弹层只剩关闭按钮');

    sc.world.state = 'menu';
    startLevel(sc.world, 0);
    const select = oneFrame(sc);
    assert.ok(filled(select) > 100, '选关界面绘制过少：' + JSON.stringify(select));
    // 没有 WebGL 肖像时，13 张图鉴卡都画占位圆章（名字首字）
    assert.ok(select.fillText >= 13 * 2, '图鉴 13 张卡都应有名字与价格，实际 ' + select.fillText);
    assert.ok(sc.ui.hotspots.length >= 10, `选关热点过少：${sc.ui.hotspots.length}`);

    startQuiz(sc.world);
    const quiz = oneFrame(sc);
    assert.ok(filled(quiz) > 20, '算术界面没画出来');
    assert.equal(sc.ui.hotspots.length, 4, '算术界面热点应为四个选项');
    assert.deepEqual([...new Set(sc.view3d.draws)], ['menu'], '战斗前的界面都压在 3D 院子上');

    beginPlay(sc.world, 50);
    const play = oneFrame(sc);
    assert.equal(blits(), 1, '战斗帧应恰好贴一次 3D 战场');
    assert.equal(sc.view3d.draws.at(-1), 'battle');
    assert.ok(filled(play) > 20, '战斗界面没画出来');
    const playHotspots = sc.ui.hotspots.length;
    for (const state of ['won', 'lost']){
      sc.world.state = state;
      const end = oneFrame(sc);
      assert.equal(blits(), 1, state + '：结算仍压在 3D 战场上');
      assert.equal(sc.view3d.draws.at(-1), 'battle', state + '：结算时 3D 视图仍是战场');
      assert.ok(end.fillText > play.fillText, `${state}：结算面板应补上文字`);
      assert.ok(sc.ui.hotspots.length > playHotspots, `${state}：结算面板应新增按钮热点`);
    }
  });

  test('D2：解锁进度改变菜单分支 —— 夜关月亮与关卡卡面只在解锁后绘制', () => {
    const sc = scenario({ seed: 7, trace: true });
    assert.equal(sc.world.unlocked, 1, '起始只解锁第 1 关');
    const locked = { delta: oneFrame(sc), moon: moons(frameTrace(sc)) };
    sc.world.unlocked = LEVELS.length;
    const unlocked = { delta: oneFrame(sc), moon: moons(frameTrace(sc)) };
    sc.world.unlockAll = true;
    const unlockAll = { delta: oneFrame(sc), moon: moons(frameTrace(sc)) };
    sc.world.unlockAll = false;
    sc.world.unlocked = 1;
    const backToLocked = { delta: oneFrame(sc), moon: moons(frameTrace(sc)) };
    assert.ok(unlocked.delta.arc !== locked.delta.arc || unlocked.delta.fill !== locked.delta.fill, '解锁后菜单卡面应不同');
    assert.equal(locked.moon, 0, '未解锁的夜关不该有月亮');
    assert.equal(unlocked.moon, 1, `解锁第 4 关后应有且只有一个月亮，实得 ${unlocked.moon}`);
    assert.equal(unlockAll.moon, 1, 'unlockAll 也应命中夜关月亮分支');
    assert.deepEqual(backToLocked.delta.fillText, locked.delta.fillText, '回到锁定态后文字应还原');
    assert.equal(backToLocked.moon, 0);
  });

  test('D3：夜关选关与白天选关分叉', () => {
    const sc = scenario({ seed: 7, trace: true });
    startLevel(sc.world, 0);
    const day = frameTrace(sc).filter(e => e.op === 'addColorStop').map(e => e.args[1]);
    sc.world.unlocked = LEVELS.length;
    startLevel(sc.world, LEVELS.length - 1);
    const night = frameTrace(sc).filter(e => e.op === 'addColorStop').map(e => e.args[1]);
    assert.ok(LEVELS[LEVELS.length - 1].night, '最后一关应是夜战');
    assert.notDeepEqual(night, day, '夜关选关界面的配色应与白关不同');
  });
});

describe('场景 G-b：报纸僵尸两种姿态', () => {
  function pose(z){
    const inst = instantiate(template('zombie', z.type));
    resetPose(inst);
    const env = { dt: 0 };
    ZOMBIE_MODELS[z.type].animate(inst, z, 0.5, env);
    return { inst, env };
  }
  const base = { type: 'newspaper', row: 0, x: 0, state: 'walk', animT: 0.3, eatT: 0, slowT: 0, deathT: 0, hp: 200, acc: 400, angry: false };
  test('看报 / 暴怒 / 普通三种姿态互不相同且都不抛错', () => {
    const reading = pose({ ...base });
    const angry = pose({ ...base, angry: true, acc: 0 });
    assert.equal(reading.inst.pv.acc.visible, true, '看报时报纸应在手上');
    assert.equal(angry.inst.pv.acc.visible, false, '暴怒时报纸已撕碎');
    assert.equal(angry.inst.pv.rage.visible, true, '暴怒时眼睛发红光');
    assert.equal(reading.inst.pv.rage.visible, false);
    assert.ok(angry.env.tint, '暴怒应带红色染色');
    assert.notEqual(reading.inst.pv.armF.rotation.z, angry.inst.pv.armF.rotation.z, '暴怒时手臂姿势不同');
    const plain = pose({ ...base, type: 'normal', acc: 0 });
    assert.equal(plain.inst.pv.acc, undefined, '普通僵尸没有护具节点');
  });
  test('护具按耐久分档，打穿后从模型上消失', () => {
    for (const type of ['cone', 'bucket', 'screen']){
      const w = { zombies: [], lastRows: [], rng: Math.random, fxRng: Math.random };
      spawnZombie(w, type);
      const z = w.zombies[0];
      const full = pose({ ...z }), worn = pose({ ...z, acc: z.acc * 0.2 }), gone = pose({ ...z, acc: 0 });
      assert.equal(full.inst.pv.acc.visible, true, type + ' 满耐久应戴着护具');
      assert.equal(gone.inst.pv.acc.visible, false, type + ' 打穿后护具应消失');
      const s = o => [o.inst.pv.acc.rotation.x, o.inst.pv.acc.rotation.z, o.inst.pv.acc.scale.y].join();
      assert.notEqual(s(full), s(worn), type + ' 残破档的护具形态应变化');
    }
  });
});

describe('场景 I12–I13：弹丸配色', () => {
  const protos = buildPeaProtos((hex, rough) => new MeshPhysicalMaterial({ color: hex, roughness: rough }));
  const colorOf = type => protos[type].children[0].material.color;
  test('I12：孢子是紫色（蓝、红分量都明显高于绿）', () => {
    const c = colorOf('spore');
    assert.ok(c.b > c.g && c.r > c.g, '孢子不是紫色：' + c.getHexString());
  });
  test('I13：非孢子弹丸不借用孢子配色', () => {
    const spore = colorOf('spore').getHex();
    for (const type of ['pea', 'snow', 'fire', 'bullet', 'missile', 'ball']){
      assert.ok(protos[type], type + ' 缺少弹丸原型');
      assert.notEqual(colorOf(type).getHex(), spore, `${type} 混入了孢子配色`);
    }
  });
});
