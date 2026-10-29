// R5a：把旧无头冒烟 headless_test.js 的场景 C / E / G 等价迁移到直接 import src 模块的 node:test。
// 驱动只走夹具的 pump（1/60 秒一帧）与真实 core 行为函数，不再依赖打包后的内部名。

import test from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './helpers/scenario.mjs';
import { beginPlay, startLevel } from '../src/core/world.js';
import { cellCX, damageZombie, placePlant, spawnZombie } from '../src/core/entities.js';
import { ZTYPES } from '../src/core/data/zombies.js';

const C_SLOTS = ['wallnut', 'potato', 'cherry', 'peashooter'];

// 旧驱动的场景搭建：进关 → 上卡 → 开战 → 补阳光 → t=1 跳过开场白
function battle({ seed, level, slots }){
  const h = scenario({ seed });
  startLevel(h.world, level);
  h.world.slots = slots.map(type => ({ type, cool: 0 }));
  beginPlay(h.world);
  h.world.sun = 9999;
  h.world.t = 1;
  return h;
}

// 出怪走真实 spawnZombie，再把行列与横坐标挪到旧驱动 makeZombie 的位置
function march(h, type, row, x){
  spawnZombie(h.world, type);
  const z = h.world.zombies[h.world.zombies.length - 1];
  z.row = row;
  z.x = x;
  return z;
}

function describe(z){
  return `type=${z.type} row=${z.row} x=${z.x.toFixed(1)} hp=${z.hp.toFixed(1)} acc=${z.acc.toFixed(1)} `
    + `speed=${z.speed.toFixed(2)} state=${z.state} slowT=${z.slowT.toFixed(2)} poleLost=${z.poleLost} angry=${z.angry}`;
}

test('场景C1 撑杆僵尸跳过坚果墙后落杆', () => {
  const h = battle({ seed: 21, level: 1, slots: C_SLOTS });
  const { world } = h;
  placePlant(world, 'wallnut', 2, 6);
  const wall = world.grid[2][6];
  const vz = march(h, 'vault', 2, cellCX(8) + 30);
  let jumped = false;
  for (let i = 0; i < 600 && world.state === 'play'; i++){
    h.pump(0.1);
    if (vz.poleLost){ jumped = true; break; }
    if (!world.zombies.includes(vz)){ jumped = true; break; }
  }
  assert.ok(jumped, `场景C1: 600 次 pump(0.1) 后撑杆僵尸既未落杆也未消失 ${describe(vz)}`);
  assert.equal(vz.poleLost, true, `场景C1: 跳过坚果墙应置 poleLost ${describe(vz)} 墙 cx=${wall.cx}`);
  assert.ok(vz.x < wall.cx, `场景C1: 落点应在坚果墙左侧 z.x=${vz.x.toFixed(1)} 墙 cx=${wall.cx}`);
});

test('场景C2 土豆雷成长后踩中即炸', () => {
  const h = battle({ seed: 22, level: 1, slots: C_SLOTS });
  const { world } = h;
  placePlant(world, 'potato', 3, 5);
  h.pump(15);
  const pot = world.grid[3][5];
  assert.ok(pot, '场景C2: pump(15) 后 (3,5) 的土豆雷不应消失');
  assert.equal(pot.armed, true, `场景C2: 土豆雷 15 秒后仍未武装 armT=${pot.armT.toFixed(2)}`);
  march(h, 'normal', 3, cellCX(5) + 120);
  const killedBefore = world.killed;
  h.pump(8);
  assert.ok(world.killed > killedBefore,
    `场景C2: 踩雷后 killed 没增加 ${killedBefore} -> ${world.killed}（雷 cx=${pot.cx} 场上僵尸 ${world.zombies.map(describe).join(' | ')}）`);
  assert.equal(world.grid[3][5], null, '场景C2: 引爆后土豆雷应被移除');
});

test('场景C3 樱桃炸弹一次炸死两只（路障 + 普通）', () => {
  const h = battle({ seed: 23, level: 1, slots: C_SLOTS });
  const { world } = h;
  const cone = march(h, 'cone', 1, cellCX(4) + 40);
  const normal = march(h, 'normal', 0, cellCX(4) + 20);
  const k3 = world.killed;
  placePlant(world, 'cherry', 1, 4);
  const cherry = world.grid[1][4];
  h.pump(3);
  assert.ok(world.killed >= k3 + 2,
    `场景C3: 樱桃炸弹炸死 ${world.killed - k3} 只，期望 >=2（雷 cx=${cherry.cx} ${describe(cone)} | ${describe(normal)}）`);
  assert.equal(cone.state, 'dying', `场景C3: 路障僵尸应被炸死 ${describe(cone)}`);
  assert.equal(normal.state, 'dying', `场景C3: 普通僵尸应被炸死 ${describe(normal)}`);
});

test('场景C4 僵尸啃食植物至格子变空', () => {
  const h = battle({ seed: 24, level: 1, slots: C_SLOTS });
  const { world } = h;
  placePlant(world, 'sunflower', 4, 7);
  const z = march(h, 'normal', 4, cellCX(8));
  let eaten = false;
  let frames = 0;
  let leftHp = 0;
  for (let i = 0; i < 600 && world.state === 'play'; i++){
    h.pump(0.1);
    frames++;
    const p = world.grid[4][7];
    if (!p){ eaten = true; break; }
    leftHp = p.hp;
  }
  assert.ok(eaten, `场景C4: pump ${(frames / 60).toFixed(2)} 秒后 (4,7) 的向日葵仍在 hp=${leftHp.toFixed(1)} ${describe(z)}`);
  assert.equal(z.hp, ZTYPES.normal.hp, `场景C4: 啃食不应伤到僵尸本体 hp=${z.hp} ${describe(z)}`);
  assert.equal(world.killed, 0, `场景C4: 这一场景不应有僵尸死亡 killed=${world.killed}`);
});

test('场景C5 寒冰豌豆命中后减速僵尸', () => {
  const h = battle({ seed: 25, level: 1, slots: C_SLOTS });
  const { world } = h;
  placePlant(world, 'snowpea', 0, 0);
  const z = march(h, 'normal', 0, cellCX(3));
  const snowpea = world.grid[0][0];
  h.pump(3);
  assert.ok(z.state === 'dying' || z.slowT > 0,
    `场景C5: 3 秒内寒冰豌豆既未减速也未杀僵尸 ${describe(z)} 射手 cx=${snowpea.cx} 场上弹丸=${world.peas.map(p => p.type).join(',') || '无'}`);
  assert.ok(z.hp < ZTYPES.normal.hp, `场景C5: 命中应造成伤害 hp=${z.hp}/${ZTYPES.normal.hp} ${describe(z)}`);
});

test('场景E 球球加特林：2 秒内造成伤害、期间出现弹丸、8 秒内打死僵尸', () => {
  const h = battle({ seed: 26, level: 0, slots: ['qiuqiu'] });
  const { world } = h;
  placePlant(world, 'qiuqiu', 2, 1);
  const z = march(h, 'normal', 2, cellCX(5));
  const hpBefore = z.hp;
  h.pump(2);
  assert.ok(z.hp < hpBefore,
    `场景E1: 球球 2 秒内没造成伤害 hp=${z.hp}/${hpBefore} ${describe(z)} 场上弹丸=${world.peas.map(p => p.type).join(',') || '无'}`);
  let sawShot = false;
  let shotType = '无';
  let peaFrames = 0;
  for (let i = 0; i < 300 && world.state === 'play'; i++){
    h.pump(0.05);
    peaFrames++;
    const pea = world.peas.find(p => p.type === 'bullet' || p.type === 'missile');
    if (pea){ sawShot = true; shotType = `${pea.type}(dmg=${pea.dmg})`; break; }
  }
  assert.ok(sawShot,
    `场景E2: ${peaFrames} 次 pump(0.05) 内没出现 bullet/missile 弹丸，场上弹丸=${world.peas.map(p => p.type).join(',') || '无'} ${describe(z)}`);
  h.pump(6);
  assert.equal(z.state, 'dying',
    `场景E3: 球球火力不足，僵尸 8 秒后仍存活 hp=${z.hp} ${describe(z)} 命中弹丸=${shotType}`);
});

test('场景G 报纸僵尸：报纸吸收伤害，破报后暴怒提速直到死亡', () => {
  const h = battle({ seed: 27, level: 1, slots: ['repeater'] });
  const { world } = h;
  assert.ok(ZTYPES.newspaper.acc > 0, `场景G0: 报纸僵尸没有报纸护盾 acc=${ZTYPES.newspaper.acc}`);

  spawnZombie(world, 'newspaper');
  const spawned = world.zombies[world.zombies.length - 1];
  assert.equal(spawned.type, 'newspaper', `场景G-a: 出怪类型应为 newspaper，实际 ${spawned.type}`);
  assert.equal(spawned.paper, ZTYPES.newspaper.acc,
    `场景G-a: 出怪应自带报纸护盾 paper=${spawned.paper} 期望=${ZTYPES.newspaper.acc}`);
  assert.equal(spawned.angry, false, `场景G-a: 出怪不应是暴怒态 ${describe(spawned)}`);

  const nz = march(h, 'newspaper', 0, cellCX(4));
  const spdBefore = nz.speed;
  const hpBefore = nz.hp;

  damageZombie(world, nz, 200);
  assert.equal(nz.acc, 200, `场景G1: 报纸应吸收 200 点伤害，剩余 acc=${nz.acc}`);
  assert.equal(nz.hp, hpBefore, `场景G1: 报纸未破时本体不应掉血 hp=${nz.hp}/${hpBefore}`);
  assert.equal(nz.angry, false, `场景G2: 报纸还在不应暴怒 ${describe(nz)}`);

  damageZombie(world, nz, 250);
  assert.equal(nz.acc, 0, `场景G4: 报纸打掉后 acc 应为 0，实际 ${nz.acc}`);
  assert.equal(nz.angry, true, `场景G3: 报纸打掉后应暴怒 ${describe(nz)}`);
  assert.equal(nz.hp, 150, `场景G5: 溢出伤害应为 250-200=50 → hp=150，实际 hp=${nz.hp}`);
  assert.ok(nz.speed > spdBefore, `场景G6: 暴怒后应提速 ${spdBefore.toFixed(2)} -> ${nz.speed.toFixed(2)}`);

  h.pump(1);
  damageZombie(world, nz, 150);
  assert.equal(nz.state, 'dying', `场景G7: 暴怒僵尸吃满 150 伤害后应死亡 hp=${nz.hp} ${describe(nz)}`);
  h.pump(1);
});
