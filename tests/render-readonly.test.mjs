import test from 'node:test';
import assert from 'node:assert';
import { PLANTS } from '../src/core/data/plants.js';
import { bindCanvas } from '../src/render/target.js';
import { drawPlantEntity } from '../src/render/plant.js';
import { drawZombieEntity } from '../src/render/zombie.js';
import { drawSun, drawPea } from '../src/render/projectile.js';
import { drawMower } from '../src/render/mower.js';

function makeCtx(){
  const target = {
    scale(){},
    createLinearGradient(){ return { addColorStop(){} }; },
    createRadialGradient(){ return { addColorStop(){} }; },
  };
  return new Proxy(target, {
    get(t, p){
      if(p in t) return t[p];
      if(typeof p !== 'string') return undefined;
      return () => undefined;
    },
    set(t, p, v){ t[p] = v; return true; },
  });
}
function makeCanvas(){
  const c = makeCtx();
  return { width: 0, height: 0, getContext: () => c };
}

const snapshot = obj => JSON.stringify(obj);

function fakePlant(type){
  return {
    type, cx: 200, fy: 300, phase: 1.3, recoil: 0.4, flash: 0.2,
    hp: PLANTS[type].hp, maxHp: PLANTS[type].hp,
    armed: true, fuse: 0.5, asleep: false,
  };
}

function fakeZombie(type, extra = {}){
  return Object.assign({
    type, row: 2, x: 640, vy: 0, state: 'walk', animT: 1.2, eatT: 0,
    slowT: 0, deathT: 0, paper: type === 'newspaper' ? 400 : 0, angry: false,
  }, extra);
}

test('绘制只读：所有植物与蘑菇姿态都不修改实体', () => {
  bindCanvas(makeCanvas(), 1);
  for(const type of Object.keys(PLANTS)){
    const p = fakePlant(type);
    const before = snapshot(p);
    drawPlantEntity(1.7, p);
    assert.strictEqual(snapshot(p), before, type + ' 绘制修改了实体');
    drawPlantEntity(0, p);
    assert.strictEqual(snapshot(p), before, type + ' 补间绘制修改了实体');
    if(type === 'puff' || type === 'sunshroom'){
      p.asleep = true;
      const asleepBefore = snapshot(p);
      drawPlantEntity(1.7, p);
      assert.strictEqual(snapshot(p), asleepBefore, type + ' 睡眠绘制修改了实体');
    }
  }
});

test('绘制只读：僵尸的行走 / 啃食 / 死亡 / 暴怒都不修改实体', () => {
  bindCanvas(makeCanvas(), 1);
  const cases = [
    fakeZombie('normal'),
    fakeZombie('cone'),
    fakeZombie('bucket'),
    fakeZombie('flag'),
    fakeZombie('vault'),
    fakeZombie('vault', { state: 'vault', vy: -30 }),
    fakeZombie('vault', { poleLost: true }),
    fakeZombie('newspaper'),
    fakeZombie('newspaper', { angry: true, paper: 0 }),
    fakeZombie('normal', { state: 'eat', eatT: 1.1 }),
    fakeZombie('normal', { state: 'dying', deathT: 0.4 }),
    fakeZombie('normal', { slowT: 1 }),
  ];
  for(const z of cases){
    const before = snapshot(z);
    drawZombieEntity(2.1, z);
    assert.strictEqual(snapshot(z), before, z.type + '/' + z.state + ' 绘制修改了实体');
  }
});

test('绘制只读：阳光、豌豆、小推车都不修改实体', () => {
  bindCanvas(makeCanvas(), 1);
  for(const state of ['fall', 'idle', 'fly']){
    const sun = { x: 600, y: 300, t: 1.4, ft: 0.3, life: 2, state };
    const sunBefore = snapshot(sun);
    drawSun(1.2, sun);
    assert.strictEqual(snapshot(sun), sunBefore, state + ' 绘制修改了阳光');
  }

  for(const type of ['pea', 'bullet', 'snow', 'spore', 'ball', 'missile', 'fire']){
    const pea = { x: 400, y: 320, type };
    const before = snapshot(pea);
    drawPea(pea);
    assert.strictEqual(snapshot(pea), before, type + ' 绘制修改了弹丸');
  }

  for(const state of ['idle', 'run', 'gone']){
    const m = { x: 300, row: 1, state };
    const before = snapshot(m);
    drawMower(1.1, m);
    assert.strictEqual(snapshot(m), before, state + ' 绘制修改了小推车');
  }
});
