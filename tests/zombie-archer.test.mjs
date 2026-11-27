// E30：射手僵尸的规则。
// 与 E22 铁门同一立意：钉的是规则而不是数值——「远程拆防」的规则一旦走样，
// 坚果挡箭 / 寒冰拖箭这两条反制就悄悄失效了。
import test from 'node:test';
import assert from 'node:assert';
import { createWorld, beginPlay } from '../src/core/world.js';
import { spawnZombie, placePlant } from '../src/core/entities.js';
import { updatePlay } from '../src/core/sim.js';
import { LEVELS } from '../src/core/data/levels.js';
import { buildSpawns } from '../src/core/waves.js';
import { mulberry32 } from '../src/core/rng.js';

const DT = 1 / 60;

function mk(){
  const w = createWorld({ seed: 7 });
  w.level = 0; w.slots = [];
  w.ports = { sound(){}, saveProgress(){}, saveUnlockAll(){} };
  beginPlay(w, 50);
  w.events = []; w.evIdx = 0; w.t = 0;
  return w;
}

function plant(w, type, row, col){
  w.sun = 9999;
  placePlant(w, type, row, col);
  return w.grid[row][col];
}

/** 站在指定植物前方 dist 像素处的射手 */
function archerAt(w, p, dist, row){
  spawnZombie(w, 'archer');
  const z = w.zombies[w.zombies.length - 1];
  z.row = row; z.x = p.cx + dist;
  return z;
}

function pump(w, frames){ for(let i = 0; i < frames; i++) updatePlay(w, DT); }

test('E30：射程内有植物就停下放箭，位置钉在射程上', () => {
  const w = mk();
  const p = plant(w, 'peashooter', 2, 4);
  const z = archerAt(w, p, 300, 2);           // 340 射程之内
  pump(w, 5);
  assert.strictEqual(z.state, 'shoot', '进射程应切到 shoot 态');
  const x0 = z.x;
  pump(w, 80);                                // 蓄力 1.0s + 一点余量
  assert.strictEqual(z.state, 'shoot');
  assert.ok(Math.abs(z.x - x0) < 0.01, '射击时位置不该再移动');
  const arrows = w.peas.filter(pea => pea.type === 'arrow');
  assert.ok(arrows.length > 0, '蓄力结束后应射出第一支箭');
  assert.strictEqual(arrows[0].dmg, 55, '一箭 55 点（豌豆射手 300 血吃 6 箭）');
  assert.ok(arrows[0].vx < 0, '箭往左飞（朝植物）');
});

test('E30：射程外不停车，照常走路', () => {
  const w = mk();
  const p = plant(w, 'peashooter', 2, 4);
  const z = archerAt(w, p, 460, 2);           // 超出 340 射程
  const x0 = z.x;
  pump(w, 30);
  assert.strictEqual(z.state, 'walk', '射程外不该停下');
  assert.ok(z.x < x0, '应该继续朝左走');
});

test('E30：箭打掉植物后回到 walk 继续前进', () => {
  const w = mk();
  const p = plant(w, 'peashooter', 2, 4);
  p.hp = 60;                                  // 2 箭即毁，免得测 15 秒
  const z = archerAt(w, p, 300, 2);
  pump(w, 120);                               // 2s：进 shoot、放第一箭、箭在飞
  assert.strictEqual(z.state, 'shoot');
  let guard = 0;
  while(z.state === 'shoot' && guard++ < 1500) updatePlay(w, DT);
  assert.strictEqual(z.state, 'walk', '目标没了应回到走路');
  assert.ok(w.plants.indexOf(p) === -1 || p.hp <= 0, '植物应已被箭拆掉');
});

test('E30：箭永远先到本行最靠前的植物——坚果墙挡箭', () => {
  const w = mk();
  const shooter = plant(w, 'peashooter', 2, 4);
  const wall = plant(w, 'wallnut', 2, 6);      // 坚果站在射手与豌豆之间
  const z = archerAt(w, wall, 300, 2);
  pump(w, 400);                               // 约 6.7s：至少 2 支箭已命中
  assert.ok(wall.hp < 4000, '坚果应替后排接箭');
  assert.strictEqual(shooter.hp, 300, '后排植物不该掉血');
  assert.strictEqual(z.state, 'shoot', '射手还盯着坚果打');
});

test('E30：土豆雷不被瞄准也不接箭（贴地）', () => {
  const w = mk();
  const p = plant(w, 'potato', 2, 6);
  const z = archerAt(w, p, 300, 2);            // 前方只有土豆雷
  const x0 = z.x;
  pump(w, 30);
  assert.strictEqual(z.state, 'walk', '土豆雷不构成射击目标');
  assert.ok(z.x < x0, '应继续走');
  // 反向：一支箭从土豆雷头上飞过也不该命中
  const arrow = { x: p.cx + 60, y: p.fy - 58, row: 2, type: 'arrow', dmg: 55, vx: -300, prevX: p.cx + 60 };
  w.peas.push(arrow);
  pump(w, 20);
  assert.strictEqual(p.hp, 300, '土豆雷不该吃箭');
  assert.ok(w.peas.indexOf(arrow) !== -1, '箭应飞过土豆雷继续往左飞');
});

test('E30：寒冰减速不只拖脚步，也拖放箭节奏', () => {
  const w = mk();
  const p = plant(w, 'peashooter', 2, 4);
  const z = archerAt(w, p, 300, 2);
  pump(w, 5);
  z.slowT = 6;
  z.fireT = 1.0;
  pump(w, 1);
  const delta = 1.0 - z.fireT;
  assert.ok(Math.abs(delta - DT * 0.45) < 1e-9,
    '减速下冷却应按 slowMul（0.45）推进，实际推进 ' + delta.toFixed(4));
});

test('E30：走进啃食距离照常啃，不吃射程特权', () => {
  const w = mk();
  const p = plant(w, 'wallnut', 2, 4);
  const z = archerAt(w, p, 50, 2);             // 26~92px：findEatTarget 的窗口
  pump(w, 5);
  assert.strictEqual(z.state, 'eat', '贴脸该啃，不该退回射程再射');
  assert.ok(p.hp < 4000, '啃食应造成掉血');
});

test('E30：首次登场弹提示，且提示说得出反制手段', () => {
  const w = mk();
  w.events = [{ t: 0.5, type: 'archer' }]; w.evIdx = 0; w.t = 0.4;
  updatePlay(w, 0.2);
  assert.ok(w.visual.waveText, '射手首次登场应弹出提示');
  const text = w.visual.waveText.text;
  assert.ok(text.includes('射手'), '提示应点出名字：' + text);
  assert.ok(text.includes('坚果'), '提示应说出挡箭手段：' + text);
  assert.ok(w.seenTypes.has('archer'), '登场后应记入 seenTypes');
});

// ---- 投放节奏（E24 的铁门先例：晚出现、要够见）----

const RUNS = 40;

function archerStats(lvIndex){
  const lv = LEVELS[lvIndex];
  const firsts = [];
  let total = 0;
  for(let s = 1; s <= RUNS; s++){
    const b = buildSpawns(lv, mulberry32(s * 7919));
    const f = b.events.find(e => e.type === 'archer');
    if(f) firsts.push(f.t);
    total += b.events.filter(e => e.type === 'archer').length;
  }
  return { firsts: firsts.sort((a,b)=>a-b), avg: total / RUNS };
}

test('E30：射手不会在关卡前半场出现，L1/L2 不投放', () => {
  for(const i of [0, 1]){
    const { firsts } = archerStats(i);
    assert.strictEqual(firsts.length, 0, 'L' + (i+1) + ' 不该出射手');
  }
  for(const i of [2, 3]){
    const { firsts } = archerStats(i);
    assert.ok(firsts.length > 0, 'L' + (i+1) + ' 应该会出射手');
    assert.ok(firsts[0] >= 150,
      'L' + (i+1) + ' 首次出现应晚于 150 秒（前半场是准备期），实际 ' + firsts[0].toFixed(0) + 's');
  }
});

test('E30：射手后半场要够常见，不能只来一两只', () => {
  for(const i of [2, 3]){
    const { avg } = archerStats(i);
    assert.ok(avg >= 2.0, 'L' + (i+1) + ' 每局平均应至少 2 只，实际 ' + avg.toFixed(1));
  }
});
