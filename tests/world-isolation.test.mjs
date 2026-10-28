// R1b：世界实例隔离。证明 createWorld() 产出的两个世界在内存上互不影响，
// 而不是只证明“函数签名里多了一个参数”。
import test from 'node:test';
import assert from 'node:assert';

const { createWorld, beginPlay, startLevel, startQuiz, answerQuiz } = await import('../src/core/world.js');
const { updatePlay } = await import('../src/core/sim.js');
const { placePlant, damageZombie, spawnZombie } = await import('../src/core/entities.js');

const DT = 1 / 60;

/** 进入「关卡已开始、无出怪、无天降阳光」的可控状态 */
function fresh(unlocked = 1){
  const w = createWorld({ unlocked, unlockAll: false });
  beginPlay(w);
  w.t = 1;
  w.zombies.length = 0;
  w.events.length = 0;
  w.evIdx = 0;
  w.skyTimer = 1e9;
  return w;
}

test('隔离0 工厂返回的初始容器互不共享（不依赖 beginPlay 重建）', () => {
  const a = createWorld({ unlocked: 1, unlockAll: false });
  const b = createWorld({ unlocked: 1, unlockAll: false });
  for (const key of ['plants','zombies','peas','suns','mowers','parts','decals','events','slots','lastRows']){
    assert.notStrictEqual(a[key], b[key], `初始 ${key} 不应共享同一个数组`);
  }
  assert.notStrictEqual(a.mouse, b.mouse, '初始鼠标状态不应共享');
  assert.strictEqual(a.quiz, null);
  assert.strictEqual(b.quiz, null);
});

test('隔离1 两个世界不共享任何容器或行数组', () => {
  const a = fresh();
  const b = fresh();
  for (const key of ['plants','zombies','peas','suns','mowers','parts','decals','events','slots','lastRows']){
    assert.notStrictEqual(a[key], b[key], key + ' 不应共享同一个数组');
  }
  assert.notStrictEqual(a.grid, b.grid, 'grid 顶层不应共享');
  for (let r = 0; r < a.grid.length; r++){
    assert.notStrictEqual(a.grid[r], b.grid[r], `grid 第 ${r} 行不应共享`);
  }
  assert.notStrictEqual(a.mouse, b.mouse, '鼠标状态不应共享');
  assert.strictEqual(a.quiz, null);
  assert.strictEqual(b.quiz, null);
});

test('隔离2 在 A 种植只扣 A 的阳光、只写 A 的格子与粒子', () => {
  const a = fresh();
  const b = fresh();
  a.sun = 500; b.sun = 500;

  placePlant(a, 'sunflower', 2, 3);   // cost 50

  assert.ok(a.grid[2][3], 'A 的格子应种上植物');
  assert.strictEqual(b.grid[2][3], null, 'B 的同一格必须仍为空');
  assert.strictEqual(a.plants.length, 1);
  assert.strictEqual(b.plants.length, 0);
  assert.strictEqual(a.sun, 450, '只扣 A 的阳光');
  assert.strictEqual(b.sun, 500, 'B 的阳光不受影响');
  assert.ok(a.parts.length > 0, '种植土尘应进入 A 的粒子数组');
  assert.strictEqual(b.parts.length, 0, 'B 不应收到 A 的粒子');
});

test('隔离3 在 A 击杀僵尸只改 A 的击杀数', () => {
  const a = fresh();
  const b = fresh();
  spawnZombie(a, 'normal');
  spawnZombie(b, 'normal');
  const za = a.zombies[0], zb = b.zombies[0];

  damageZombie(a, za, 9999);

  assert.strictEqual(za.state, 'dying', 'A 的僵尸应死亡');
  assert.strictEqual(a.killed, 1);
  assert.strictEqual(zb.state, 'walk', 'B 的僵尸不受影响');
  assert.strictEqual(zb.hp, zb.maxHp, 'B 的僵尸血量不变');
  assert.strictEqual(b.killed, 0, 'B 的击杀数不变');
  assert.strictEqual(b.zombies[0], zb, 'B 的僵尸仍是同一个对象');
});

test('隔离4 A、B 交错推进：各按自己的速度移动，粒子和状态不串写', () => {
  const a = fresh();
  const b = fresh();
  spawnZombie(a, 'normal');
  spawnZombie(b, 'cone');
  const za = a.zombies[0], zb = b.zombies[0];
  za.row = 0; za.x = 800; za.speed = 30;
  zb.row = 4; zb.x = 600; zb.speed = 10;
  const ax0 = za.x, bx0 = zb.x;
  const aSeen = new Set(), bSeen = new Set();

  for (let i = 0; i < 60; i++){
    updatePlay(a, DT); updatePlay(b, DT);
    for (const p of a.parts) aSeen.add(p);
    for (const p of b.parts) bSeen.add(p);
  }

  assert.ok(Math.abs((ax0 - za.x) - 30) < 1e-6, `A 的僵尸应按自己的速度走 30px，实际 ${ax0 - za.x}`);
  assert.ok(Math.abs((bx0 - zb.x) - 10) < 1e-6, `B 的僵尸应按自己的速度走 10px，实际 ${bx0 - zb.x}`);
  assert.strictEqual(a.zombies[0], za);
  assert.strictEqual(b.zombies[0], zb);
  assert.strictEqual(za.row, 0);
  assert.strictEqual(zb.row, 4);
  assert.ok(aSeen.size > 0 && bSeen.size > 0, '两边各自都应产生过扬尘');
  for (const p of aSeen) assert.ok(!bSeen.has(p), 'A 的粒子不应出现在 B 里');
  assert.strictEqual(a.killed, 0);
  assert.strictEqual(b.killed, 0);
});

test('隔离5 重开关卡换新容器，旧局实体不被保留，B 完全不受影响', () => {
  const a = fresh();
  const b = fresh();
  a.sun = 999;
  placePlant(a, 'wallnut', 1, 1);
  const oldPlant = a.grid[1][1];
  const oldPlants = a.plants, oldGrid = a.grid, oldMowers = a.mowers, oldParts = a.parts, oldSlots = a.slots;
  b.sun = 321;
  const bPlants = b.plants, bGrid = b.grid, bSun = b.sun;

  beginPlay(a);

  assert.notStrictEqual(a.plants, oldPlants, '重开应换新的 plants 数组');
  assert.notStrictEqual(a.grid, oldGrid, '重开应换新的 grid');
  assert.notStrictEqual(a.mowers, oldMowers, '重开应换新的小推车数组');
  assert.notStrictEqual(a.parts, oldParts, '重开应换新的粒子数组');
  assert.notStrictEqual(a.slots, oldSlots, '重开应换新的卡槽数组');
  assert.strictEqual(a.plants.length, 0);
  assert.strictEqual(a.grid[1][1], null);
  assert.ok(!a.plants.includes(oldPlant), '旧植物不应残留在新世界里');
  assert.strictEqual(a.state, 'play');

  assert.strictEqual(b.sun, bSun, 'B 的阳光不变');
  assert.strictEqual(b.plants, bPlants, 'B 的 plants 数组不应被换掉');
  assert.strictEqual(b.grid, bGrid, 'B 的 grid 不应被换掉');
});

test('隔离6 卡槽、题目与关卡状态各自独立', () => {
  const a = fresh();
  const b = fresh();
  const slotBefore = { type:'sunflower', cool:0 };
  a.slots = [slotBefore];

  beginPlay(a);
  assert.deepStrictEqual(a.slots, [{ type:'sunflower', cool:0 }], 'A 的卡槽应被重置冷却而非清空');
  assert.notStrictEqual(a.slots[0], slotBefore, '卡槽对象应是新实例');
  assert.strictEqual(b.slots.length, 0, 'B 的卡槽不受影响');

  startLevel(a, 0);
  assert.strictEqual(a.state, 'select');
  assert.strictEqual(b.state, 'play', 'B 的状态不受 A 的影响');

  startQuiz(a);
  assert.ok(a.quiz, 'A 应进入答题状态');
  assert.strictEqual(b.quiz, null, 'B 不应出现题目');
  const q = a.quiz.questions[a.quiz.idx];
  const wrong = q.options.find(o => o !== q.answer);
  answerQuiz(a, wrong);
  assert.strictEqual(a.quiz.correct, false);
  assert.strictEqual(a.quiz.energy, 50, '答错不翻倍');
  assert.strictEqual(b.quiz, null);
});

test('隔离7 通关解锁只改自己的进度，初始进度可由装配层注入', () => {
  const a = fresh(1);
  const b = fresh(1);
  a.level = 0;
  b.level = 0;

  for (let i = 0; i < 70; i++) updatePlay(a, DT);   // 空场满 1 秒判胜

  assert.strictEqual(a.state, 'won');
  assert.strictEqual(a.unlocked, 2, 'A 应解锁到第 2 关');
  assert.strictEqual(b.state, 'play', 'B 仍在对局中');
  assert.strictEqual(b.unlocked, 1, 'B 的进度不应被 A 改写');

  const injected = createWorld({ unlocked: 3, unlockAll: true });
  assert.strictEqual(injected.unlocked, 3, '装配层可注入初始进度');
  assert.strictEqual(injected.unlockAll, true, '装配层可注入全部关卡开关');
});
