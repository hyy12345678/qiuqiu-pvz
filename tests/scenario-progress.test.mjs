import test from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './helpers/scenario.mjs';
import { beginPlay, startLevel } from '../src/core/world.js';
import { buildSpawns } from '../src/core/waves.js';
import { mulberry32 } from '../src/core/rng.js';
import { LEVELS } from '../src/core/data/levels.js';
import { COLS, LX, ROWS } from '../src/core/constants.js';

// 与旧驱动同为固定 seed；关卡 2（第 3 关 · 最终决战）对应旧场景 D 结尾的 startLevel(G, 2)。
const SEED = 7;
const LEVEL = 2;
const TEAM = ['sunflower', 'peashooter', 'snowpea', 'wallnut', 'potato', 'cherry'];

function selectLevel(seed = SEED, level = LEVEL){
  const h = scenario({ seed });
  h.pump(0.5);
  startLevel(h.world, level);
  return h;
}

function withCooldowns(h){
  h.world.slots = TEAM.map(type => ({ type, cool: 99 }));
  beginPlay(h.world);
  return h;
}

test('场景AB流程1 选关：startLevel 进入 select、清空待选卡片并经 ports.sound 发出 click', () => {
  const h = scenario({ seed: SEED });
  assert.equal(h.world.state, 'menu', '开局应停在菜单态');
  h.pump(0.5);
  assert.deepEqual(h.sounds, [], `菜单帧不应产生端口音效，实收 ${h.sounds.join(',')}`);
  startLevel(h.world, LEVEL);
  assert.equal(h.world.state, 'select', `A1: expect select, got ${h.world.state}`);
  assert.equal(h.world.level, LEVEL, `选关序号写入错误，实得 ${h.world.level}`);
  assert.deepEqual(h.world.slots, [], 'startLevel 应清空待选卡片');
  assert.deepEqual(h.sounds, ['click'], `A1: ports.sound 应收到一次 click，实收 ${h.sounds.join(',')}`);
});

test('场景AB流程2 开局：beginPlay 重建战场、卡片冷却归零、出怪表来自 waves', () => {
  const h = selectLevel();
  h.world.slots = TEAM.map(type => ({ type, cool: 99 }));
  beginPlay(h.world);
  assert.equal(h.world.state, 'play', `A2: expect play, got ${h.world.state}`);
  assert.equal(h.world.paused, false, '开局不应处于暂停');
  assert.equal(h.world.t, -3.2, `开场倒计时起点错误，实得 ${h.world.t}`);
  assert.equal(h.world.sun, 50, `白关开局阳光错误，实得 ${h.world.sun}`);
  assert.equal(h.world.grid.length, ROWS, `grid 行数错误，实得 ${h.world.grid.length}`);
  for (const [r, row] of h.world.grid.entries()) {
    assert.equal(row.length, COLS, `grid 第 ${r} 行列数错误，实得 ${row.length}`);
    assert.ok(row.every(cell => cell === null), `grid 第 ${r} 行存在残留守植`);
  }
  assert.deepEqual([h.world.plants.length, h.world.zombies.length, h.world.peas.length, h.world.suns.length],
    [0, 0, 0, 0], `战场容器未重建，实为 植物${h.world.plants.length} 僵尸${h.world.zombies.length} 弹道${h.world.peas.length} 阳光${h.world.suns.length}`);
  assert.deepEqual(h.world.mowers, Array.from({ length: ROWS }, (unused, r) => ({ row: r, x: LX - 52, state: 'idle' })),
    `小推车应为 ${ROWS} 行待命，实得 ${JSON.stringify(h.world.mowers)}`);
  assert.deepEqual(h.world.slots, TEAM.map(type => ({ type, cool: 0 })), `卡片冷却未重置，实得 ${JSON.stringify(h.world.slots)}`);
  const expected = buildSpawns(LEVELS[LEVEL], mulberry32(SEED));
  assert.equal(h.world.total, LEVELS[LEVEL].count, `total 来自关卡表 count 失败，实得 ${h.world.total}`);
  assert.deepEqual(h.world.events, expected.events, '出怪表与同 seed 的 waves 构建不一致');
  assert.equal(h.world.events.length, expected.events.length, `出怪事件数错误，实得 ${h.world.events.length}`);
  assert.equal(h.world.killed, 0, `killed 应归零，实得 ${h.world.killed}`);
  assert.equal(h.world.evIdx, 0, `出怪游标应归零，实得 ${h.world.evIdx}`);
  assert.equal(h.world.winT, 0, '通关计时未清零');
  assert.equal(h.world.loseZombie, null, '判负僵尸引用未清空');
});

test('场景AB流程3 帧循环走通：开场倒计时跑完进入 t > 0，波次未到不提前出怪', () => {
  const h = withCooldowns(selectLevel());
  const soundsAfterBegin = h.sounds.length;
  h.pump(3.3);
  assert.ok(h.world.t > 0 && h.world.t < 0.15, `倒计时后时钟应刚越过 0，实得 ${h.world.t}`);
  assert.equal(h.world.state, 'play', `倒计时结束不应分出胜负，state=${h.world.state}`);
  assert.equal(h.world.zombies.length, 0, `第 1 只僵尸最早 26 秒出场，实得 ${h.world.zombies.length}`);
  assert.equal(h.queue.length, 1, '帧链应继续且只排一个回调');
  assert.equal(h.sounds.length, soundsAfterBegin, `倒计时阶段不应有端口音效，实收 ${h.sounds.slice(soundsAfterBegin).join(',')}`);
});

test('场景D1 unlockAll 开关：dispatch 写档、放开锁定关卡且真实进度保持不变', () => {
  const h = scenario({ seed: SEED });
  assert.equal(h.world.unlockAll, false, '开关默认关闭');
  assert.equal(h.world.unlocked, 1, '真实进度默认只解锁第 1 关');
  h.game.dispatch({ type: 'unlockAll' });
  assert.deepEqual(h.saves, [{ kind: 'unlockAll', on: true }], `开关应写回档位，实得 ${JSON.stringify(h.saves)}`);
  assert.equal(h.world.unlockAll, true, 'dispatch 未翻转开关');
  assert.equal(h.world.unlocked, 1, `开关不应改写真实进度，实得 ${h.world.unlocked}`);
  assert.equal(h.sounds.at(-1), 'click', `开关应伴随一次 click 音效，实收 ${h.sounds.join(',')}`);
  h.game.dispatch({ type: 'level', index: LEVELS.length - 1 });
  assert.equal(h.world.state, 'select', '打开开关后锁定关卡应能直接进入选关');
  assert.equal(h.world.level, LEVELS.length - 1, `锁定关卡进入失败，实得 level=${h.world.level}`);
  assert.equal(h.world.unlocked, 1, `进锁定关卡不应推进真实进度，实得 ${h.world.unlocked}`);
  assert.deepEqual(h.saves, [{ kind: 'unlockAll', on: true }], `选关不应写档，实得 ${JSON.stringify(h.saves)}`);
});

test('场景D2 关掉 unlockAll 回到真实进度：锁定关卡被拒绝，状态、音效与存档均不变', () => {
  const h = scenario({ seed: SEED });
  h.game.dispatch({ type: 'unlockAll' });
  h.game.dispatch({ type: 'level', index: LEVELS.length - 1 });
  h.game.dispatch({ type: 'unlockAll' });
  assert.deepEqual(h.saves, [{ kind: 'unlockAll', on: true }, { kind: 'unlockAll', on: false }],
    `开关两次切换都应写回档位，实得 ${JSON.stringify(h.saves)}`);
  assert.equal(h.world.unlockAll, false, '关掉后开关应复位');
  assert.equal(h.world.unlocked, 1, `关掉开关后仍是真实进度，实得 ${h.world.unlocked}`);
  const sounds = h.sounds.length;
  h.game.dispatch({ type: 'level', index: 1 });
  assert.equal(h.world.state, 'select', '未解锁关卡被拒后应停在选择态');
  assert.equal(h.world.level, LEVELS.length - 1, `未解锁关卡被拒后 level 不应改变，实得 ${h.world.level}`);
  assert.deepEqual(h.sounds.slice(sounds), [], `未解锁关卡被拒不应产生音效，实收 ${h.sounds.slice(sounds).join(',')}`);
  assert.deepEqual(h.saves, [{ kind: 'unlockAll', on: true }, { kind: 'unlockAll', on: false }],
    `未解锁关卡被拒不应写档，实得 ${JSON.stringify(h.saves)}`);
});
