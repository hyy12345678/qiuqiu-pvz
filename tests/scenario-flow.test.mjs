import test from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './helpers/scenario.mjs';
import { startLevel, beginPlay } from '../src/core/world.js';
import { bgCache } from '../src/render/background.js';
import { LEVELS } from '../src/core/data/levels.js';

function battle(seed){
  const h = scenario({ seed });
  startLevel(h.world, 0);
  h.world.slots = [{ type: 'sunflower', cool: 0 }];
  beginPlay(h.world);
  return h;
}

test('场景F1–F5 三题全对经帧驱动进入战斗，能量按 50→100→200→400 累积', () => {
  const h = scenario({ seed: 7 });
  h.world.slots = [{ type: 'sunflower', cool: 0 }];
  h.game.dispatch({ type: 'startQuiz' });
  assert.equal(h.world.state, 'quiz');
  assert.equal(h.world.quiz.questions.length, 3, 'F2: 战前热身应为 3 题');
  for (let idx = 0; idx < 3; idx++) {
    const question = h.world.quiz.questions[idx];
    assert.ok(question.options.includes(question.answer), `F3: 第 ${idx + 1} 题选项缺少正确答案`);
    assert.equal(h.world.quiz.idx, idx);
    h.game.dispatch({ type: 'answer', value: question.answer });
    h.pump(1);
    assert.equal(h.world.quiz?.energy ?? h.world.sun, [100, 200, 400][idx], `第 ${idx + 1} 题后能量`);
  }
  assert.equal(h.world.state, 'play', 'F4: 三题答对应进入战斗');
  assert.equal(h.world.sun, 400, 'F5: 满能量开局阳光');
});

test('场景F6–F7 首题答错立即开战且只带基础 50 阳光', () => {
  const h = scenario({ seed: 11 });
  h.world.slots = [{ type: 'sunflower', cool: 0 }];
  h.game.dispatch({ type: 'startQuiz' });
  h.game.dispatch({ type: 'answer', value: h.world.quiz.questions[0].answer + 999 });
  h.pump(1);
  assert.equal(h.world.state, 'play', 'F6: 答错也应直接进入战斗');
  assert.equal(h.world.sun, 50, 'F7: 答错只带基础能量');
});

test('场景H0–H1 关卡表为 4 关且只有第 4 关是夜战', () => {
  assert.equal(LEVELS.length, 4, 'H0');
  assert.equal(LEVELS[3].night, true, 'H1: 第 4 关应为夜战');
  assert.ok(LEVELS.slice(0, 3).every(level => !level.night), 'H1: 前三关不应标夜战');
});

test('场景H2–H5 夜战开局补偿 100 阳光、提示生效、28 秒无天降太阳且背景切到 night', () => {
  const h = scenario({ seed: 13 });
  startLevel(h.world, 3);
  h.world.slots = [{ type: 'sunflower', cool: 0 }];
  beginPlay(h.world, 50);
  assert.equal(h.world.sun, 150, 'H2: 夜战开局阳光应为 50+100');
  assert.ok(h.world.visual.nightHint > 0, 'H4: 夜战提示未生效');
  h.world.t = 1;
  h.pump(28);
  assert.equal(h.world.suns.filter(sun => sun.fromSky).length, 0, 'H3: 夜关不应出现天降太阳');
  assert.equal(bgCache.theme, 'night', 'H5: 夜战背景主题未切换');
});

test('场景H6–H8 白关无夜战补偿、20 秒内产出天降太阳且主题回到 day', () => {
  const h = battle(17);
  assert.equal(h.world.sun, 50, 'H6: 白关不应拿到夜战补偿');
  h.world.t = 1;
  h.pump(20);
  assert.ok(h.world.suns.some(sun => sun.fromSky), 'H7: 白关应产出天降太阳');
  assert.equal(bgCache.theme, 'day', 'H8: 白关背景主题未还原');
});
