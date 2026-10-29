import test from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './helpers/scenario.mjs';
import { beginPlay, startLevel } from '../src/core/world.js';
import { cellCX, cellFY } from '../src/core/entities.js';
import { PLANTS } from '../src/core/data/plants.js';

function dayTeam(seed){
  const h = scenario({ seed });
  startLevel(h.world, 0);
  h.world.slots = [
    { type: 'puff', cool: 0 },
    { type: 'sunshroom', cool: 0 },
    { type: 'coffee', cool: 0 },
  ];
  beginPlay(h.world);
  h.world.sun = 9999;
  h.world.t = 1;
  return h;
}

const cellOf = (row, col) => ({ x: cellCX(col), y: cellFY(row) - 40 });

test('场景I1–I2b 白天经真实按下种下小喷菇即打盹，且小喷菇免费', () => {
  const h = dayTeam(7);
  const sunBefore = h.world.sun;
  h.ui.sel = 0;
  const point = cellOf(2, 4);
  h.press(point.x, point.y);
  const puff = h.world.grid[2][4];
  assert.ok(puff && puff.type === 'puff', 'I1: 白天没能种下小喷菇');
  assert.equal(puff.asleep, true, 'I2: 白天种下的蘑菇应当打盹');
  assert.equal(PLANTS.puff.cost, 0, 'I2b: 小喷菇应当免费');
  assert.equal(h.world.sun, sunBefore, '免费植物不应扣阳光');
  assert.equal(h.ui.sel, -1, '种下后应取消选卡');
  assert.ok(h.sounds.includes('plant'), '种植应有 plant 音效');
});

test('场景I3–I4 咖啡豆点空格外不生效：不进冷却、不取消选卡、只发 error', () => {
  const h = dayTeam(11);
  h.ui.sel = 0;
  h.press(cellOf(2, 4).x, cellOf(2, 4).y);
  const coffee = h.world.slots[2];
  assert.equal(coffee.cool, 0);
  const sounds = h.sounds.length;
  h.ui.sel = 2;
  const miss = cellOf(1, 1);
  h.press(miss.x, miss.y);
  assert.equal(coffee.cool, 0, 'I3: 点错目标的咖啡豆不该进入冷却');
  assert.equal(h.ui.sel, 2, 'I4: 用错的咖啡豆不该取消选卡');
  assert.deepEqual(h.sounds.slice(sounds), ['error'], '用错对象只应发一次 error 音效');
  assert.equal(h.world.grid[1][1], null, '空格不应被写成植物');
});

test('场景I5–I7 咖啡豆点对打盹蘑菇：唤醒、进冷却、取消选卡各一次', () => {
  const h = dayTeam(13);
  h.ui.sel = 0;
  const point = cellOf(2, 4);
  h.press(point.x, point.y);
  const puff = h.world.grid[2][4];
  const coffee = h.world.slots[2];
  const sounds = h.sounds.length;
  h.ui.sel = 2;
  h.press(point.x, point.y);
  assert.equal(puff.asleep, false, 'I5: 咖啡豆没能唤醒蘑菇');
  assert.ok(coffee.cool > 0, 'I6: 成功使用后应进入冷却');
  assert.equal(coffee.cool, PLANTS.coffee.cool, 'I6b: 冷却应等于咖啡卡片冷却');
  assert.equal(h.ui.sel, -1, 'I7: 用过的咖啡豆应取消选卡');
  assert.deepEqual(h.sounds.slice(sounds), ['select'], '唤醒只应发一次 select 音效');
});

test('场景I8–I10 阳光菇经咖啡豆唤醒后只产 25 阳光，场上不混入其它产量', () => {
  const h = dayTeam(17);
  h.ui.sel = 1;
  const point = cellOf(3, 6);
  h.press(point.x, point.y);
  const shroom = h.world.grid[3][6];
  assert.ok(shroom && shroom.type === 'sunshroom', 'I8: 没能种下阳光菇');
  assert.equal(shroom.asleep, true, '白天阳光菇应先打盹');
  h.ui.sel = 2;
  h.press(point.x, point.y);
  assert.equal(shroom.asleep, false, '阳光菇应被咖啡豆唤醒');
  h.world.suns.length = 0;
  h.pump(11);
  const plantSuns = h.world.suns.filter(sun => !sun.fromSky);
  assert.ok(plantSuns.some(sun => sun.value === 25), 'I9: 阳光菇应产 25 阳光');
  assert.equal(plantSuns.some(sun => sun.value !== 25), false,
    `I10: 场上不该出现其它产量的植物阳光，实得 ${plantSuns.map(sun => sun.value).join(',')}`);
});

test('场景I11 夜战种下的蘑菇落地即开工，无需咖啡豆', () => {
  const h = scenario({ seed: 23 });
  startLevel(h.world, 3);
  h.world.slots = [{ type: 'puff', cool: 0 }];
  beginPlay(h.world);
  h.world.sun = 9999;
  h.world.t = 1;
  h.ui.sel = 0;
  const point = cellOf(2, 4);
  h.press(point.x, point.y);
  assert.equal(h.world.grid[2][4].asleep, false, 'I11: 夜里种下的蘑菇不该打盹');
});
