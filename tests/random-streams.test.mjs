// R2a 的验收矩阵：同一 seed、动作与 dt 序列下，绘制 / 粒子 / 音频的执行方式
// 不能改变战斗投影。另测 15% 导弹边界与多 seed 的出场节奏。
//
// 说明：绘制在 Node 里无法真跑（渲染在 main.js，依赖 DOM）。这里按“绘制对世界唯一的
// 随机接触面”建模——额外消耗表现流、禁用表现抽样、替换全局 Math.random（音频局部源）。
// 真实绘制路径由浏览器轨迹基线与 A–I 冒烟兜底。
import test from 'node:test';
import assert from 'node:assert';
import { projectBattle, seq } from './battle-projection.mjs';

const { createWorld, beginPlay, startQuiz } = await import('../src/core/world.js');
const { updatePlay } = await import('../src/core/sim.js');
const { placePlant, spawnZombie } = await import('../src/core/entities.js');
const { mulberry32 } = await import('../src/core/rng.js');

const DT = 1 / 60;

function pinnedZombie(w, row, x){
  w.zombies.push({
    type: 'normal', row, x, speed: 0, hp: 1e6, acc: 0, maxHp: 1e6,
    state: 'walk', animT: 0, eatT: 0, slowT: 0, poleLost: false, vt: 0,
    fromX: 0, toX: 0, vy: 0, deathT: 0, eatPlant: null, dustT: 0, paper: 0, angry: false,
  });
}

function setup(seed){
  const w = createWorld({ seed });
  w.level = 0; w.slots = [];
  beginPlay(w);
  for(let i = 0; i < 200; i++) updatePlay(w, DT);   // 跑完开场倒计时
  w.sun = 5000;
  placePlant(w, 'sunflower', 0, 0);
  placePlant(w, 'peashooter', 2, 1);
  placePlant(w, 'qiuqiu', 2, 2);
  placePlant(w, 'snowpea', 4, 1);
  placePlant(w, 'wallnut', 4, 5);
  // 钉一只打不死的僵尸在球球射程内：保证导弹/子弹的判定每 0.4 秒发生一次
  pinnedZombie(w, 2, w.grid[2][2].cx + 260);
  return w;
}

// 1800 帧 ≈ 30 秒：覆盖天降阳光、射击、导弹、出怪事件、啃食、粒子与呻吟
function runScenario(seed, mode){
  const w = setup(seed);
  const other = mode === 'interleave' ? setup(991) : null;
  const savedRandom = Math.random;
  if(mode === 'audio') Math.random = mulberry32(4242);
  try {
    for(let f = 0; f < 1800; f++){
      if(f % 150 === 0) spawnZombie(w, f % 600 === 0 ? 'cone' : 'normal');
      updatePlay(w, DT);
      if(other){
        if(f % 180 === 0) spawnZombie(other, 'normal');
        updatePlay(other, DT);
      }
      if(mode === 'extra-fx'){
        for(let k = 0; k < 9; k++) w.fxRng();      // 模拟“多画几帧 / 多抽几次表现随机”
      } else if(mode === 'no-fx'){
        w.fxRng = () => 0.5;                       // 表现抽样退化成常量
        w.visual.parts.length = 0; w.visual.decals.length = 0;   // 并禁用表现产出
      } else if(mode === 'audio'){
        for(let k = 0; k < 3; k++) Math.random();  // 音频局部源的消耗
      }
    }
  } finally {
    Math.random = savedRandom;
  }
  return projectBattle(w);
}

test('矩阵1 多画 / 禁用表现 / 音频随机都不改变战斗投影', () => {
  const baseline = runScenario(2026, 'plain');
  assert.deepStrictEqual(runScenario(2026, 'extra-fx'), baseline, '额外消耗表现流不应改变战斗');
  assert.deepStrictEqual(runScenario(2026, 'no-fx'), baseline, '禁用表现产出不应改变战斗');
  assert.deepStrictEqual(runScenario(2026, 'audio'), baseline, '音频随机源不应改变战斗');
});

test('矩阵2 A/B 交错推进时，A 的战斗投影与单独运行完全一致', () => {
  const solo = runScenario(2026, 'plain');
  assert.deepStrictEqual(runScenario(2026, 'interleave'), solo, 'B 的随机与推进不应串到 A');
});

test('矩阵3 同一 seed 可复现，不同 seed 战斗轨迹不同', () => {
  assert.deepStrictEqual(runScenario(77, 'plain'), runScenario(77, 'plain'));
  assert.notDeepStrictEqual(runScenario(77, 'plain'), runScenario(78, 'plain'));
});

// ---- 15% 导弹边界 ----

function combatWorld(){
  const w = createWorld({ seed: 5 });
  w.level = 0; w.slots = [];
  beginPlay(w);
  w.t = 1; w.events = []; w.evIdx = 0; w.skyTimer = 1e9;
  w.sun = 5000;
  placePlant(w, 'qiuqiu', 2, 2);
  w.zombies.length = 0; w.peas.length = 0;
  const p = w.grid[2][2];
  p.fireT = 0;
  pinnedZombie(w, 2, p.cx + 200);
  return w;
}

// E20：球球导弹概率 15% → 8%、子弹伤害 25 → 18（球球 DPS 87 → 49）。
// 测试改成从源码读阈值会绕开「两端夹逼」，所以这里直接写新值，并保留边界语义。
test('概率边界：world.rng 返回 0.079 出导弹，0.081 出子弹；阈值仍是 0.08', () => {
  const missile = combatWorld();
  missile.rng = seq([0.079]);
  updatePlay(missile, DT);
  assert.strictEqual(missile.peas.length, 1);
  assert.strictEqual(missile.peas[0].type, 'missile');
  assert.strictEqual(missile.peas[0].dmg, 90);

  const bullet = combatWorld();
  bullet.rng = seq([0.081]);
  updatePlay(bullet, DT);
  assert.strictEqual(bullet.peas.length, 1);
  assert.strictEqual(bullet.peas[0].type, 'bullet');
  assert.strictEqual(bullet.peas[0].dmg, 15);
});

test('分布抽查：固定 seed 下 600 发球球的导弹比例落在 5%~12%', () => {
  const w = combatWorld();
  const p = w.grid[2][2];
  w.fxRng = () => 0.5;
  let shots = 0, missiles = 0;
  for(let i = 0; i < 600; i++){
    p.fireT = 0;
    w.visual.parts.length = 0; w.visual.decals.length = 0;
    updatePlay(w, DT);
    if(p.fireT === 0.4 && w.peas.length > 0){
      shots++;
      if(w.peas[w.peas.length - 1].type === 'missile') missiles++;
    }
    w.peas.length = 0;
  }
  assert.strictEqual(shots, 600, '每帧都应开火');
  const ratio = missiles / shots;
  assert.ok(ratio > 0.05 && ratio < 0.12, '导弹比例应接近 8%，实际 ' + (ratio * 100).toFixed(1) + '%');
});

// ---- 波次与题目跟着世界的战斗流 ----

test('波次表：同一 seed 逐事件相同，不同 seed 不同；beginPlay 使用 world.rng', () => {
  const events = seed => {
    const w = createWorld({ seed });
    w.level = 1; w.slots = [];
    beginPlay(w);
    return w.events;
  };
  assert.deepStrictEqual(events(7), events(7));
  assert.notDeepStrictEqual(events(7), events(8));
});

test('题目：startQuiz 使用 world.rng，同一 seed 同一套题，不同 seed 不同', () => {
  const questions = seed => {
    const w = createWorld({ seed });
    startQuiz(w);
    return w.quiz.questions;
  };
  assert.deepStrictEqual(questions(31), questions(31));
  assert.notDeepStrictEqual(questions(31), questions(32));
});

test('两条流互不消耗：多抽 fxRng 不改变后续 rng 序列，两条流本身不同', () => {
  const a = createWorld({ seed: 123 });
  const b = createWorld({ seed: 123 });
  for(let i = 0; i < 50; i++) b.fxRng();
  for(let i = 0; i < 20; i++) assert.strictEqual(a.rng(), b.rng());

  const c = createWorld({ seed: 123 });
  const battle = Array.from({ length: 20 }, () => c.rng());
  const visual = Array.from({ length: 20 }, () => c.fxRng());
  assert.notDeepStrictEqual(battle, visual, '战斗流与表现流不应是同一条序列');
});