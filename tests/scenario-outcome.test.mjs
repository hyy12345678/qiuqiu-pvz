import test from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './helpers/scenario.mjs';
import { beginPlay, startLevel } from '../src/core/world.js';
import { placePlant } from '../src/core/entities.js';
import { PLANTS } from '../src/core/data/plants.js';
import { ROWS } from '../src/core/constants.js';

// headless_test.js 的 seed 来自 randomSeed()（Math.random），跑九种 seed 都能复现
// 「A 判负、B 通关且 killed===total」，故沿用同批 R5a 测试的 seed 7 固定下来。
const SEED = 7;

const NO_DEFENSE_TEAM = ['sunflower', 'peashooter', 'snowpea', 'wallnut', 'potato', 'cherry'];
const STRONG_TEAM = ['sunflower', 'peashooter', 'repeater', 'snowpea', 'wallnut', 'torch'];

function openLevelZero(seed){
  const h = scenario({ seed });
  h.pump(0.5);
  startLevel(h.world, 0);
  return h;
}

function withTeam(h, types){
  for (const type of types) h.world.slots.push({ type, cool: 0 });
  beginPlay(h.world);
  return h;
}

function pumpUntilOver(h, guard = 400){
  let seconds = 0;
  let mowerUsed = false;
  while (h.world.state === 'play' && seconds < guard) {
    h.pump(1);
    seconds++;
    if (h.world.mowers.some(m => m.state !== 'idle')) mowerUsed = true;
  }
  return { seconds, mowerUsed };
}

function describe(h, extra){
  return `${extra}；state=${h.world.state} killed=${h.world.killed}/${h.world.total} `
    + `跑了${h.world.t.toFixed(1)}秒 小推车=${h.world.mowers.map(m => m.state).join(',')}`;
}

test('场景A0–A2 无人防守：菜单开局、选关 0、铺满 6 张卡片后进入战斗', () => {
  const h = openLevelZero(SEED);
  assert.equal(h.world.state, 'select', `A0/A1: 选关后应为 select，实际 ${h.world.state}`);
  withTeam(h, NO_DEFENSE_TEAM);
  assert.equal(h.world.state, 'play', `A2: beginPlay 后应为 play，实际 ${describe(h, '开局失败')}`);
  assert.deepEqual(h.world.slots.map(s => s.type), NO_DEFENSE_TEAM, 'A2: 卡片阵容不符');
  h.pump(1);
  assert.equal(h.world.state, 'play', `A2: 开局 1 秒不应已分出胜负，${describe(h, '')}`);
});

test('场景A3–A5 无人防守：小推车被触发、僵尸被碾死、最终判负并渲染结算面板', () => {
  const h = openLevelZero(SEED);
  withTeam(h, NO_DEFENSE_TEAM);
  const { seconds, mowerUsed } = pumpUntilOver(h);
  assert.equal(h.world.state, 'lost', `A3: expect lost, got ${describe(h, `跑了${seconds}秒`)}`);
  assert.ok(mowerUsed, `A4: mower never triggered（跑了${seconds}秒，小推=${h.world.mowers.map(m => m.state).join(',')}）`);
  assert.ok(h.world.killed > 0, `A5: no zombie killed by mower（killed=${h.world.killed}/${h.world.total}，跑了${seconds}秒）`);
  assert.doesNotThrow(() => h.pump(1), 'A5 后：失败结算面板渲染抛错');
  assert.equal(h.world.state, 'lost', `结算面板不应改变胜负，${describe(h, '')}`);
});

test('场景B0 强防守布阵：五排坚果/火炬/双发落位且按价扣阳光', () => {
  const h = openLevelZero(SEED);
  withTeam(h, STRONG_TEAM);
  h.world.sun = 9999;
  for (let r = 0; r < ROWS; r++) {
    placePlant(h.world, 'wallnut', r, 0);
    placePlant(h.world, 'torch', r, 1);
    placePlant(h.world, 'repeater', r, 2);
    placePlant(h.world, 'repeater', r, 3);
  }
  const rowCost = PLANTS.wallnut.cost + PLANTS.torch.cost + PLANTS.repeater.cost * 2;
  assert.equal(h.world.sun, 9999 - rowCost * ROWS, `B0: 阳光扣费不符，实得 ${h.world.sun}`);
  assert.equal(h.world.plants.length, ROWS * 4, `B0: 植物数量应为 ${ROWS * 4}，实得 ${h.world.plants.length}`);
  for (let r = 0; r < ROWS; r++) {
    assert.deepEqual([h.world.grid[r][0].type, h.world.grid[r][1].type,
      h.world.grid[r][2].type, h.world.grid[r][3].type],
    ['wallnut', 'torch', 'repeater', 'repeater'], `B0: 第 ${r} 行阵型不符`);
  }
});

test('场景B1–B2 强防守通关：进入终局为 won、killed 与 total 守恒并渲染胜利面板', () => {
  const h = openLevelZero(SEED);
  withTeam(h, STRONG_TEAM);
  h.world.sun = 9999;
  for (let r = 0; r < ROWS; r++) {
    placePlant(h.world, 'wallnut', r, 0);
    placePlant(h.world, 'torch', r, 1);
    placePlant(h.world, 'repeater', r, 2);
    placePlant(h.world, 'repeater', r, 3);
  }
  const { seconds } = pumpUntilOver(h);
  assert.equal(h.world.state, 'won', `B1: expect won, got ${describe(h, `跑了${seconds}秒`)}`);
  assert.equal(h.world.killed, h.world.total, `B2: ${describe(h, `跑了${seconds}秒`)}`);
  assert.doesNotThrow(() => h.pump(1), 'B2 后：胜利面板渲染抛错');
  assert.equal(h.world.state, 'won', `B2: 胜利面板不应改变终局，${describe(h, '')}`);
});
