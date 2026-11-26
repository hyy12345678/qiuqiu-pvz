// 新增植物「迪迦奥特曼」的行为契约：限时登场 + 每 6.5 秒一次贯穿整行的光线，只打同行。
// 驱动仍走 R5a 夹具：真实 core、手动时钟，不碰打包产物。

import test from 'node:test';
import assert from 'node:assert';
import { PLANTS } from '../src/core/data/plants.js';
import { beginPlay, startLevel } from '../src/core/world.js';
import { cellCX, damageZombie, placePlant, spawnZombie } from '../src/core/entities.js';
import { scenario } from './helpers/scenario.mjs';

const LIFE = PLANTS.tiga.life;
const COST = PLANTS.tiga.cost;

// 进关 + 上卡 + 开战 + 充足阳光；t=1 跳过开场倒计时。
// 出怪表默认换成一条永不触发的占位事件：不清空的话「场上没僵尸」会立刻判通关，模拟就停了。
function battle({ seed, slots = ['tiga'] } = {}){
  const h = scenario({ seed });
  startLevel(h.world, 0);
  h.world.slots = slots.map(type => ({ type, cool: 0 }));
  beginPlay(h.world);
  h.world.sun = 9999;
  h.world.t = 1;
  h.world.events.length = 0;
  h.world.events.push({ t: 1e6, type: 'normal' });
  return h;
}

function march(world, type, row, x){
  spawnZombie(world, type);
  const z = world.zombies[world.zombies.length - 1];
  z.row = row;
  z.x = x;
  return z;
}

const body = z => z.hp + z.acc;

test('数值表：光之巨人是限时单位，cost/hp/life 都写在数据里', () => {
  assert.equal(PLANTS.tiga.name, '迪迦奥特曼');
  assert.equal(COST, 275);
  assert.equal(PLANTS.tiga.life, 25);
  assert.equal(PLANTS.tiga.cool, 30);
});

test('登场：扣费、计时器初值等于 life', () => {
  const h = battle({ seed: 31 });
  const { world } = h;
  const sun = world.sun;
  placePlant(world, 'tiga', 2, 3);
  assert.equal(sun - world.sun, COST, '种植应扣 tiga.cost');
  const p = world.grid[2][3];
  assert.equal(p.lifeT, LIFE);
  assert.equal(p.maxLifeT, LIFE);
});

test('彩色计时器：没有目标也会在 life 秒后自行离场', () => {
  const h = battle({ seed: 32 });
  const { world } = h;
  placePlant(world, 'tiga', 2, 3);
  h.pump(LIFE - 1);
  assert.ok(world.grid[2][3], '第 24 秒仍应在场');
  h.pump(2);
  assert.equal(world.grid[2][3], null, `第 ${LIFE} 秒后应已离场`);
  assert.ok(h.sounds.includes('hop'), `离场应有提示音，实际 ${h.sounds.join(',')}`);
  assert.equal(world.peas.filter(p => p.type === 'beam').length, 0, '空场不应放光线');
});

test('只在同行有僵尸时开火，邻行僵尸不触发', () => {
  const h = battle({ seed: 33 });
  const { world } = h;
  placePlant(world, 'tiga', 2, 3);
  const other = march(world, 'normal', 3, cellCX(7));
  h.pump(12);
  assert.equal(world.peas.filter(p => p.type === 'beam').length, 0, '别的行有僵尸不该让光线出膛');
  assert.ok(!h.sounds.includes('missile'), '没开火就不该有发射音');
  assert.ok(world.zombies.includes(other), '邻行僵尸不应被误伤');
});

test('光线贯穿同行多只：一帧命中两只，各掉 400 且弹体不消失', () => {
  const h = battle({ seed: 34 });
  const { world } = h;
  placePlant(world, 'tiga', 2, 3);
  const near = march(world, 'bucket', 2, cellCX(5) + 40);
  const far = march(world, 'bucket', 2, cellCX(7) + 40);
  const bystander = march(world, 'bucket', 3, cellCX(6));
  const beforeNear = body(near), beforeFar = body(far), beforeBy = body(bystander);
  for(let i = 0; i < 60 * 12; i++){
    h.pump(1 / 60);
    if(body(far) !== beforeFar) break;
  }
  assert.equal(beforeNear - body(near), 400, '同一发光线应贯穿近处铁桶并只结算一次');
  assert.equal(beforeFar - body(far), 400, '远处铁桶应吃到同一发的贯穿伤害');
  assert.ok(world.peas.some(p => p.type === 'beam'), '命中后光线仍应飞向屏幕右缘');
  assert.equal(body(bystander), beforeBy, '邻行僵尸不应被贯穿光线误伤');
  assert.ok(h.sounds.includes('missile'), '开火应有发射音');
});

test('蓄力节奏：相邻两发光线约隔 6.5 秒', () => {
  const h = battle({ seed: 35 });
  const { world } = h;
  placePlant(world, 'tiga', 2, 3);
  march(world, 'bucket', 2, cellCX(8));
  const firedAt = [];
  for(let i = 0; i < 60 * 16; i++){
    const before = world.peas.filter(p => p.type === 'beam').length;
    h.pump(1 / 60);
    if(world.peas.filter(p => p.type === 'beam').length > before) firedAt.push(world.t);
  }
  assert.ok(firedAt.length >= 2, `16 秒内应至少放两发光线，实际 ${firedAt.length}`);
  const gap = firedAt[1] - firedAt[0];
  assert.ok(gap > 6.3 && gap < 6.8, `两发光线间隔应约 6.5 秒，实际 ${gap.toFixed(2)}`);
});

test('3D 视图：巨人登场后光线成束，最后几秒计时器红闪', () => {
  const h = battle({ seed: 36 });
  const { world } = h;
  placePlant(world, 'tiga', 2, 3);
  march(world, 'bucket', 2, cellCX(8));
  const beams = () => { let n = 0; h.view3d.view.scene.traverse(o => { if(o.isMesh && o.geometry.type === 'CylinderGeometry' && o.material.blending === 2) n++; }); return n; };
  let sawBeam = false;
  for(let i = 0; i < 60 * 3 && !sawBeam; i++){ h.pump(1 / 60); if(world.peas.some(p => p.type === 'beam')) sawBeam = beams() > 0; }
  assert.ok(sawBeam, '光线在场时场景里应有发光光束');
  // 剩 8 秒起计时器变红：跳到最后几秒，计时器材质应与开场时不同
  const tiga = world.plants.find(p => p.type === 'tiga');
  let timer = null;
  h.view3d.view.scene.traverse(o => { if(o.name === 'timer') timer = o; });
  assert.ok(timer, '巨人应有彩色计时器节点');
  const mat = () => timer.children.find(c => c.isMesh && c.userData.key === 'e').material;
  assert.ok(mat().color.b > mat().color.r, '时间充裕时计时器是蓝色');
  tiga.lifeT = 3;
  let red = 0;
  for(let i = 0; i < 30; i++){ h.pump(1 / 60); if(mat().color.r > mat().color.b) red++; }
  assert.ok(red > 0 && red < 30, '最后几秒计时器应红蓝交替闪烁，实际红帧 ' + red + '/30');
});

test('伤害结算仍走 damageZombie：护盾先掉、本体后掉', () => {
  const h = battle({ seed: 37 });
  const z = march(h.world, 'cone', 1, cellCX(6));
  damageZombie(h.world, z, 400);
  assert.equal(z.acc, 0, '400 点应先打穿 370 护盾');
  assert.equal(z.hp, 170, '溢出部分落到本体');
});
