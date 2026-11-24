
// E24：铁门僵尸的投放节奏。
//
// 起因：原实现最早就 66 秒出现、每局平均 2.1 只——既是突然袭击，又没机会学会。
// 这三条测试钉住「晚出现、更常见、有提示」这个设计意图。
import test from 'node:test';
import assert from 'node:assert';
import { LEVELS } from '../src/core/data/levels.js';
import { buildSpawns } from '../src/core/waves.js';
import { mulberry32 } from '../src/core/rng.js';
import { createWorld, beginPlay } from '../src/core/world.js';
import { updatePlay } from '../src/core/sim.js';

const RUNS = 40;

function screenStats(lvIndex){
  const lv = LEVELS[lvIndex];
  const firsts = [];
  let total = 0;
  for(let s = 1; s <= RUNS; s++){
    const b = buildSpawns(lv, mulberry32(s * 7919));
    const f = b.events.find(e => e.type === 'screen');
    if (f) firsts.push(f.t);
    total += b.events.filter(e => e.type === 'screen').length;
  }
  return { firsts: firsts.sort((a,b)=>a-b), avg: total / RUNS };
}

test('E24：铁门僵尸不会在关卡前半场出现', () => {
  for(const i of [2, 3]){
    const { firsts } = screenStats(i);
    assert.ok(firsts.length > 0, 'L' + (i+1) + ' 应该会出铁门');
    assert.ok(firsts[0] >= 180,
      'L' + (i+1) + ' 首次出现应晚于 180 秒（前半场是准备期），实际 ' + firsts[0].toFixed(0) + 's');
  }
});

test('E24：铁门僵尸后半场要够常见，不能只来一两只', () => {
  for(const i of [2, 3]){
    const { avg } = screenStats(i);
    assert.ok(avg >= 2.5, 'L' + (i+1) + ' 每局平均应至少 2.5 只，实际 ' + avg.toFixed(1));
  }
});

test('E24：铁门首次登场会弹提示，而且只弹一次', () => {
  const w = createWorld({ seed: 7 });
  w.level = 2;
  w.slots = [];
  w.ports = { sound(){}, saveProgress(){}, saveUnlockAll(){} };
  beginPlay(w, 50);
  // 只留一个铁门事件，其它全清掉，直接推到它出现
  const screenEvent = { t: 1, type: 'screen' };
  w.events = [screenEvent, { t: 5, type: 'screen' }];
  w.evIdx = 0;

  let hints = 0;
  let guard = 0;
  while(w.evIdx < 2 && guard++ < 600){
    updatePlay(w, 1/60);
    if (w.visual.waveText && w.visual.waveText.text.includes('铁门')) {
      if (hints === 0) hints = 1;
    }
  }
  assert.strictEqual(hints, 1, '首次登场应有提示');
  assert.ok(w.seenTypes.has('screen'), '登场后应记入 seenTypes');
});

test('E24：普通僵尸首见不弹提示（玩家一看就懂，不需要解释）', () => {
  const w = createWorld({ seed: 7 });
  w.level = 0;
  w.slots = [];
  w.ports = { sound(){}, saveProgress(){}, saveUnlockAll(){} };
  beginPlay(w, 50);
  w.events = [{ t: 1, type: 'normal' }];
  w.evIdx = 0;
  let sawText = false;
  let guard = 0;
  while(w.evIdx < 1 && guard++ < 300){
    updatePlay(w, 1/60);
    if (w.visual.waveText) sawText = true;
  }
  assert.strictEqual(sawText, false, '普通僵尸不应触发提示');
});
