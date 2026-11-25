import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { createWorld, beginPlay, startQuiz, answerQuiz } from '../src/core/world.js';
import { spawnSun, placePlant } from '../src/core/entities.js';
import { COLS, ROWS, CW, CH, LX, LY } from '../src/core/constants.js';
import { LEVELS } from '../src/core/data/levels.js';
import { PLANTS } from '../src/core/data/plants.js';
import { mulberry32 } from '../src/core/rng.js';
import { createUI } from '../src/ui/state.js';
import { addHotspot, clearHotspots } from '../src/ui/hotspots.js';

function close(actual, expected){
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
}

function worldState(world){
  const { rng, fxRng, ports, ...state } = world;
  return structuredClone(state);
}

function harness({ clock = 1000, frameTime = 0, seed = 7 } = {}){
  const calls = [], observed = [], queue = [], frames = [];
  const ui = createUI();
  const frameState = { t:frameTime, rng:mulberry32(seed), musicOn:false };
  let world, musicOn = false;
  function record(event){
    calls.push(event);
    observed.push({
      event, mouse:ui.mouse, state:world.state, worldT:world.t,
      frameT:frameState.t, musicOn:frameState.musicOn,
    });
  }
  const audio = {
    get musicOn(){ return musicOn; },
    set musicOn(on){ musicOn = on; record(`audio.musicOn:${on}`); },
    ensure(){ record('audio.ensure'); },
    resume(){ record('audio.resume'); },
    click(){ record('audio.click'); },
    error(){ record('audio.error'); },
  };
  world = createWorld({ seed, ports:{
    sound:name => record(`port.sound:${name}`),
    saveProgress:value => record(`port.saveProgress:${value}`),
    saveUnlockAll:on => record(`port.saveUnlockAll:${on}`),
  } });
  const game = createGame({ world, ui, frameState, audio,
    now(){ record('now'); return clock; },
    requestFrame(callback){ record('requestFrame'); queue.push(callback); },
    render(w, u, f){
      assert.strictEqual(w, world);
      assert.strictEqual(u, ui);
      assert.strictEqual(f, frameState);
      assert.equal(queue.length, 0, 'render 必须先于下一次排帧');
      record('render');
      frames.push({ state:w.state, worldT:w.t, frameT:f.t,
        feedback:w.quiz?.feedback, musicOn:f.musicOn });
    },
  });
  return { world, ui, frameState, audio, game, calls, observed, queue, frames,
    clear(){ calls.length = 0; observed.length = 0; },
    step(timestamp){
      assert.equal(queue.length, 1);
      const callback = queue.shift();
      callback(timestamp);
      assert.equal(queue.length, 1, '每帧继续且只排一个回调');
      assert.deepEqual(calls.slice(-2), ['render', 'requestFrame']);
      return frames.at(-1);
    },
  };
}

function playing(h, types = ['sunflower']){
  h.world.slots = types.map(type => ({ type, cool:0 }));
  beginPlay(h.world, 500);
  h.clear();
  return h;
}

function dispatch(h, action, calls){
  h.clear();
  assert.equal(h.game.dispatch(action), undefined, action.type);
  assert.deepEqual(h.calls, calls, action.type);
}

function cell(row = 2, col = 3){
  return { x:LX + (col + 0.5) * CW, y:LY + (row + 0.5) * CH };
}

test('createGame 不自动启动；start 先取 now，再排帧，首次帧使用该时间', () => {
  const h = harness({ frameTime:7 });
  assert.deepEqual(h.calls, []);
  assert.equal(h.queue.length, 0);
  assert.equal(h.frames.length, 0);
  for(const method of ['dispatch', 'handlePress', 'handleKey', 'start']){
    assert.equal(typeof h.game[method], 'function');
  }
  h.game.start();
  assert.deepEqual(h.calls, ['now', 'requestFrame']);
  assert.equal(h.frames.length, 0);
  const frame = h.step(1020);
  close(frame.frameT, 7.02);
  assert.equal(frame.worldT, 0);
  assert.equal(frame.state, 'menu');
  assert.deepEqual(h.calls, ['now', 'requestFrame', 'render', 'requestFrame']);
});

test('beforeFrame 每帧先于模拟与绘制执行，且模拟抛错时仍然执行', () => {
  // E26：换屏后重建背板必须独立于「这一帧游戏逻辑有没有出错」，
  // 否则一次 updatePlay 异常会让画面永远停在旧 DPR 上。
  const h = harness();
  const seen = [];
  let throwOnce = false;
  h.game = createGame({
    world: h.world, ui: h.ui, frameState: h.frameState, audio: h.audio,
    now: () => 1000,
    requestFrame(cb){ h.queue.push(cb); },
    beforeFrame(){ seen.push('beforeFrame'); },
    render(){ seen.push('render'); },
  });
  h.game.start();
  const run = ts => { const cb = h.queue.shift(); cb(ts); };

  run(1010);
  assert.deepStrictEqual(seen, ['beforeFrame', 'render'], '先重建背板，再绘制');

  // 让模拟抛错：钩子仍须执行，且 rAF 链不能断
  seen.length = 0;
  h.world.state = 'play';
  h.world.slots = [{ type:'sunflower', cool:0 }];
  beginPlay(h.world, 500);
  h.world.grid = null;              // stepPlants 读 world.plants 不炸，stepProgress 读 events 也不炸
  h.world.events = null;            // 这里制造一次真实异常
  try { run(1020); } catch(e) { throwOnce = true; }
  assert.ok(throwOnce, '本用例需要一个抛错帧');
  assert.ok(seen.includes('beforeFrame'), '模拟抛错时 beforeFrame 仍应已执行');
  assert.equal(h.queue.length, 1, '抛错后仍须排下一帧');
});

test('play 使用真实模拟，last 每帧更新，长帧截断且渲染看到更新后的状态', () => {
  const h = playing(harness());
  h.world.t = 1;
  h.world.slots[0].cool = 2;
  h.world.events = [{ t:1.001, announce:true }];
  h.world.evIdx = 0;
  h.world.quiz = { feedback:0.9 };
  h.audio.musicOn = true;
  h.clear();
  h.game.start();
  let elapsed = 0;
  for(const [timestamp, dt] of [[1010, 0.01], [1030, 0.02], [1030, 0], [6030, 0.05], [6040, 0.01]]){
    elapsed += dt;
    const frame = h.step(timestamp);
    close(h.world.t, 1 + elapsed);
    close(h.world.slots[0].cool, 2 - elapsed);
    close(h.frameState.t, elapsed);
    close(frame.worldT, h.world.t);
    close(frame.frameT, elapsed);
    assert.equal(frame.musicOn, true);
    assert.equal(h.world.quiz.feedback, 0.9, 'play 不执行 updateQuiz');
  }
  const horn = h.observed.find(entry => entry.event === 'port.sound:horn');
  close(horn.worldT, 1.01);
  close(horn.frameT, 0.01);
  assert.equal(horn.musicOn, true, '时钟和音乐状态先同步，再调用模拟');
  assert.equal(h.calls.filter(call => call === 'now').length, 1);
  h.audio.musicOn = false;
  assert.equal(h.step(6050).musicOn, false);
});

test('菜单、帮助、选卡、胜败和暂停都继续画与排帧，但不推进世界', () => {
  const h = playing(harness());
  h.world.slots[0].cool = 2;
  h.world.quiz = { feedback:0.8 };
  h.game.start();
  let timestamp = 1000, elapsed = 0;
  for(const state of ['menu', 'help', 'select', 'won', 'lost', 'play']){
    h.world.state = state;
    h.world.paused = state === 'play';
    const before = worldState(h.world);
    const frame = h.step(timestamp += 20);
    elapsed += 0.02;
    assert.deepEqual(worldState(h.world), before, state);
    assert.equal(frame.state, state);
    close(frame.frameT, elapsed);
  }
  h.world.paused = false;
  const beforeT = h.world.t;
  const frame = h.step(timestamp + 10);
  close(frame.worldT, beforeT + 0.01);
  close(frame.frameT, elapsed + 0.01);
});

test('quiz 反馈按帧更新；切入 play 的那一帧不额外推进战斗', () => {
  const h = harness();
  startQuiz(h.world);
  answerQuiz(h.world, h.world.quiz.questions[0].answer);
  h.world.t = 12;
  h.world.paused = true;
  h.game.start();
  let frame = h.step(1020);
  close(frame.feedback, 0.88);
  assert.equal(frame.worldT, 12);
  frame = h.step(6020);
  close(frame.feedback, 0.83);
  frame = h.step(6030);
  close(frame.feedback, 0.82);
  h.world.quiz.feedback = 0.005;
  frame = h.step(6040);
  assert.equal(h.world.quiz.idx, 1);
  assert.equal(frame.feedback, 0);
  assert.equal(frame.state, 'quiz');
  assert.equal(frame.worldT, 12);
  h.step(6050);
  assert.equal(h.world.quiz.idx, 1, '未答题时不自行前进');

  for(const [index, correct, energy] of [[0, false, 50], [2, true, 100]]){
    const end = harness();
    end.world.slots = [{ type:'sunflower', cool:4 }];
    startQuiz(end.world);
    end.world.quiz.idx = index;
    const answer = end.world.quiz.questions[index].answer;
    answerQuiz(end.world, correct ? answer : answer + 1);
    end.world.quiz.feedback = 0.01;
    end.world.t = 12;
    end.clear();
    end.game.start();
    const entered = end.step(1020);
    assert.equal(entered.state, 'play');
    assert.equal(entered.worldT, -3.2);
    assert.equal(end.world.sun, energy);
    assert.equal(end.world.skyTimer, 2);
    assert.equal(end.world.slots[0].cool, 0);
    assert.deepEqual(end.calls, ['now', 'requestFrame', 'port.sound:click', 'render', 'requestFrame']);
    close(end.step(1030).worldT, -3.19);
  }
});

test('dispatch 导航、选关和解锁保留声音、存档顺序及拒绝路径', () => {
  const h = harness();
  dispatch(h, { type:'nav', state:'help' }, ['audio.click']);
  assert.equal(h.world.state, 'help');
  assert.equal(h.observed[0].state, 'help');
  h.ui.sel = 3; h.ui.shovel = true;
  const before = worldState(h.world);
  for(const index of [-1, 0.5, LEVELS.length, 1]){
    dispatch(h, { type:'level', index }, []);
    assert.deepEqual(worldState(h.world), before);
    assert.equal(h.ui.sel, 3);
    assert.equal(h.ui.shovel, true);
  }
  dispatch(h, { type:'level', index:0 }, ['port.sound:click']);
  assert.equal(h.world.state, 'select');
  assert.equal(h.world.level, 0);
  assert.equal(h.ui.sel, -1);
  assert.equal(h.ui.shovel, false);
  dispatch(h, { type:'unlockAll' }, ['port.saveUnlockAll:true', 'port.sound:click']);
  assert.equal(h.world.unlockAll, true);
  assert.equal(h.world.unlocked, 1);
  dispatch(h, { type:'level', index:LEVELS.length - 1 }, ['port.sound:click']);
  assert.equal(h.world.level, LEVELS.length - 1);
  dispatch(h, { type:'unlockAll' }, ['port.saveUnlockAll:false', 'port.sound:click']);
  assert.equal(h.world.unlockAll, false);
  assert.equal(h.world.unlocked, 1);
  const unchanged = worldState(h.world);
  dispatch(h, { type:'unknown' }, []);
  assert.deepEqual(worldState(h.world), unchanged);
});

test('dispatch plantPick 和 slot 增删队伍，满队与无效卡槽不改变状态', () => {
  const h = harness();
  dispatch(h, { type:'level', index:0 }, ['port.sound:click']);
  const types = Object.keys(PLANTS).slice(0, LEVELS[0].slots + 1);
  for(const plant of types.slice(0, -1)){
    dispatch(h, { type:'plantPick', plant }, ['port.sound:select']);
  }
  assert.deepEqual(h.world.slots, types.slice(0, -1).map(type => ({ type, cool:0 })));
  const full = worldState(h.world);
  dispatch(h, { type:'plantPick', plant:types.at(-1) }, ['port.sound:error']);
  assert.deepEqual(worldState(h.world), full);
  dispatch(h, { type:'plantPick', plant:types[0] }, ['port.sound:click']);
  assert.equal(h.world.slots.some(slot => slot.type === types[0]), false);
  dispatch(h, { type:'plantPick', plant:types.at(-1) }, ['port.sound:select']);
  h.ui.sel = 2;
  dispatch(h, { type:'slot', index:0 }, ['port.sound:click']);
  assert.equal(h.ui.sel, 1);
  assert.equal(h.world.slots[0].type, types[2]);
  dispatch(h, { type:'slot', index:1 }, ['port.sound:click']);
  assert.equal(h.ui.sel, -1);
  const before = worldState(h.world);
  dispatch(h, { type:'slot', index:99 }, []);
  assert.deepEqual(worldState(h.world), before);
});

test('dispatch 选卡、铲子、暂停走 core，拒绝时不泄漏 core 返回值', () => {
  const h = playing(harness());
  dispatch(h, { type:'pickSlot', index:0 }, ['port.sound:select']);
  assert.equal(h.ui.sel, 0);
  dispatch(h, { type:'pickSlot', index:0 }, ['port.sound:click']);
  assert.equal(h.ui.sel, -1);
  h.ui.sel = 0;
  dispatch(h, { type:'shovel' }, ['port.sound:click']);
  assert.equal(h.ui.sel, -1);
  assert.equal(h.ui.shovel, true);
  dispatch(h, { type:'shovel' }, ['port.sound:click']);
  assert.equal(h.ui.shovel, false);
  dispatch(h, { type:'pause' }, ['port.sound:click']);
  assert.equal(h.world.paused, true);
  for(const action of [{ type:'pickSlot', index:0 }, { type:'shovel' }]){
    dispatch(h, action, []);
    assert.equal(h.ui.sel, -1);
    assert.equal(h.ui.shovel, false);
  }
  dispatch(h, { type:'pause' }, ['port.sound:click']);
  assert.equal(h.world.paused, false);
  dispatch(h, { type:'pickSlot', index:99 }, []);
  h.world.slots[0].cool = 1;
  dispatch(h, { type:'pickSlot', index:0 }, ['port.sound:error']);
  assert.equal(h.ui.sel, -1);
  h.world.slots[0].cool = 0;
  h.world.sun = 0;
  dispatch(h, { type:'pickSlot', index:0 }, ['port.sound:error']);
  assert.equal(h.ui.sel, -1);
  assert.equal(h.world.sunFlash, 0.5);
  h.world.state = 'menu';
  for(const action of [{ type:'pickSlot', index:0 }, { type:'shovel' }, { type:'pause' }]){
    const before = worldState(h.world);
    dispatch(h, action, []);
    assert.deepEqual(worldState(h.world), before);
  }
});

test('dispatch 答题与音乐保留各自音频路径，ensure 仅由按钮参数开启', () => {
  const h = harness();
  const empty = worldState(h.world);
  dispatch(h, { type:'startQuiz' }, ['audio.error']);
  assert.deepEqual(worldState(h.world), empty);
  dispatch(h, { type:'answer', value:0 }, []);
  assert.deepEqual(worldState(h.world), empty);
  h.world.slots = [{ type:'sunflower', cool:0 }];
  for(const correct of [true, false]){
    dispatch(h, { type:'startQuiz' }, ['port.sound:click']);
    assert.equal(h.world.state, 'quiz');
    assert.equal(h.world.quiz.idx, 0);
    const answer = h.world.quiz.questions[0].answer;
    dispatch(h, { type:'answer', value:correct ? answer : answer + 1 },
      [correct ? 'port.sound:select' : 'port.sound:error']);
    assert.equal(h.world.quiz.correct, correct);
    assert.equal(h.world.quiz.energy, correct ? 100 : 50);
    assert.equal(h.world.quiz.feedback, 0.9);
    const answered = worldState(h.world);
    dispatch(h, { type:'answer', value:answer }, []);
    assert.deepEqual(worldState(h.world), answered);
  }
  for(const [action, on, calls] of [
    [{ type:'music' }, true, ['audio.musicOn:true', 'audio.click']],
    [{ type:'music', ensure:false }, false, ['audio.musicOn:false', 'audio.click']],
    [{ type:'music', ensure:true }, true, ['audio.ensure', 'audio.musicOn:true', 'audio.click']],
  ]){
    const before = worldState(h.world);
    dispatch(h, action, calls);
    assert.equal(h.audio.musicOn, on);
    assert.deepEqual(worldState(h.world), before);
  }
});

test('handlePress 先 ensure/resume 和更新 mouse，后注册热点压过阳光、格子及状态检查', () => {
  for(const [state, paused] of [['play', false], ['play', true], ['menu', false]]){
    const h = playing(harness());
    h.world.state = state; h.world.paused = paused;
    h.ui.sel = 0;
    const p = cell(), oldMouse = h.ui.mouse;
    const hover = h.ui.hoverCell = { row:0, col:0 };
    spawnSun(h.world, p.x, p.y, p.y, false);
    addHotspot(h.ui, p.x - 10, p.y - 10, 20, 20, 'lower', { type:'nav', state:'lost' });
    addHotspot(h.ui, p.x - 10, p.y - 10, 20, 20, 'upper', { type:'nav', state:'help' });
    h.game.handlePress(p);
    assert.deepEqual(h.calls, ['audio.ensure', 'audio.resume', 'audio.click']);
    assert.strictEqual(h.observed[0].mouse, oldMouse);
    assert.strictEqual(h.observed[1].mouse, oldMouse);
    assert.strictEqual(h.observed[2].mouse, p);
    assert.strictEqual(h.ui.mouse, p);
    assert.strictEqual(h.ui.hoverCell, hover);
    assert.equal(h.world.state, 'help');
    assert.equal(h.world.suns[0].state, 'fall');
    assert.equal(h.world.plants.length, 0);
    assert.equal(h.ui.sel, 0);
  }
});

test('handlePress 后注册阳光先收且跳过飞行阳光，全部飞行后才落格', () => {
  const h = playing(harness());
  const p = cell();
  h.ui.sel = 0;
  const hover = h.ui.hoverCell = { row:0, col:0 };
  spawnSun(h.world, p.x, p.y, p.y, false, 50);
  spawnSun(h.world, p.x, p.y, p.y, false, 25);
  for(const states of [['fall', 'fly'], ['fly', 'fly']]){
    h.clear();
    h.game.handlePress(p);
    assert.deepEqual(h.world.suns.map(sun => sun.state), states);
    assert.equal(h.world.sun, 500, '飞到资源栏前不直接到账');
    assert.equal(h.world.plants.length, 0);
    assert.equal(h.world.slots[0].cool, 0);
    assert.equal(h.ui.sel, 0);
    assert.deepEqual(h.calls, ['audio.ensure', 'audio.resume']);
  }
  h.clear();
  h.game.handlePress(p);
  assert.deepEqual(h.calls, ['audio.ensure', 'audio.resume', 'port.sound:plant']);
  assert.equal(h.world.grid[2][3].type, 'sunflower');
  assert.equal(h.world.plants.length, 1);
  assert.equal(h.world.sun, 500 - PLANTS.sunflower.cost);
  assert.equal(h.world.slots[0].cool, PLANTS.sunflower.cool);
  assert.equal(h.ui.sel, -1);
  assert.strictEqual(h.ui.hoverCell, hover);
});

test('handlePress 拒绝非战斗、暂停、越界和不可用卡，但草坪边缘仍可种植', () => {
  const h = playing(harness());
  const p = cell();
  spawnSun(h.world, p.x, p.y, p.y, false);
  h.ui.sel = 0;
  for(const [state, paused] of [['menu', false], ['quiz', false], ['won', false], ['lost', false], ['play', true]]){
    h.world.state = state; h.world.paused = paused;
    const before = worldState(h.world);
    h.clear();
    h.game.handlePress(p);
    assert.deepEqual(h.calls, ['audio.ensure', 'audio.resume']);
    assert.deepEqual(worldState(h.world), before);
    assert.equal(h.ui.sel, 0);
    assert.strictEqual(h.ui.mouse, p);
    assert.equal(h.ui.hoverCell, null);
  }
  h.world.state = 'play'; h.world.paused = false;
  for(const point of [
    { x:LX - 1, y:p.y }, { x:LX + COLS * CW, y:p.y },
    { x:p.x, y:LY - 1 }, { x:p.x, y:LY + ROWS * CH },
  ]){
    const before = worldState(h.world);
    h.clear();
    h.game.handlePress(point);
    assert.deepEqual(h.calls, ['audio.ensure', 'audio.resume']);
    assert.deepEqual(worldState(h.world), before);
    assert.equal(h.ui.sel, 0);
  }
  for(const reason of ['sun', 'cooling', 'occupied']){
    const rejected = playing(harness());
    rejected.ui.sel = 0;
    if(reason === 'sun') rejected.world.sun = 0;
    if(reason === 'cooling') rejected.world.slots[0].cool = 1;
    if(reason === 'occupied') placePlant(rejected.world, 'wallnut', 2, 3);
    const before = worldState(rejected.world);
    rejected.clear();
    rejected.game.handlePress(p);
    if(reason === 'sun') before.sunFlash = 0.5;
    assert.deepEqual(worldState(rejected.world), before, reason);
    assert.equal(rejected.ui.sel, 0);
    assert.deepEqual(rejected.calls, ['audio.ensure', 'audio.resume', 'port.sound:error']);
  }
  for(const [point, row, col] of [
    [{ x:LX, y:LY }, 0, 0],
    [{ x:LX + COLS * CW - 0.01, y:LY + ROWS * CH - 0.01 }, ROWS - 1, COLS - 1],
  ]){
    const edge = playing(harness());
    edge.ui.sel = 0;
    edge.game.handlePress(point);
    assert.equal(edge.world.grid[row][col].type, 'sunflower');
    assert.equal(edge.world.plants.length, 1);
  }
});

test('handleKey 仅 play 响应，数字受暂停与卡槽限制，Esc/P/M 保留独立语义', () => {
  const h = playing(harness(), Array(8).fill('sunflower'));
  for(let i = 0; i < 8; i++){
    h.ui.sel = -1; h.ui.shovel = true;
    h.clear();
    h.game.handleKey(String(i + 1));
    assert.equal(h.ui.sel, i);
    assert.equal(h.ui.shovel, false);
    assert.deepEqual(h.calls, ['port.sound:select']);
  }
  h.world.slots.length = 1;
  for(const [key, paused] of [['1', true], ['2', false], ['8', false], ['0', false], ['9', false], ['x', false]]){
    h.world.paused = paused;
    h.ui.sel = -1; h.ui.shovel = true;
    h.clear();
    h.game.handleKey(key);
    assert.equal(h.ui.sel, -1);
    assert.equal(h.ui.shovel, true);
    assert.deepEqual(h.calls, []);
  }
  for(const paused of [false, true]){
    h.world.paused = paused;
    h.ui.sel = 0; h.ui.shovel = true;
    h.clear();
    h.game.handleKey('Escape');
    assert.equal(h.ui.sel, -1);
    assert.equal(h.ui.shovel, false);
    assert.deepEqual(h.calls, []);
    for(const key of ['p', 'P']){
      const before = h.world.paused;
      h.clear();
      h.game.handleKey(key);
      assert.equal(h.world.paused, !before);
      assert.deepEqual(h.calls, ['port.sound:click']);
    }
    for(const key of ['m', 'M']){
      const before = h.audio.musicOn;
      h.clear();
      h.game.handleKey(key);
      assert.equal(h.audio.musicOn, !before);
      assert.deepEqual(h.calls, [`audio.musicOn:${!before}`]);
    }
  }
  for(const state of ['menu', 'help', 'select', 'quiz', 'won', 'lost']){
    h.world.state = state;
    h.ui.sel = 0; h.ui.shovel = true;
    const before = worldState(h.world), music = h.audio.musicOn;
    h.clear();
    for(const key of ['1', '8', 'Escape', 'p', 'P', 'm', 'M']) h.game.handleKey(key);
    assert.deepEqual(worldState(h.world), before);
    assert.equal(h.ui.sel, 0);
    assert.equal(h.ui.shovel, true);
    assert.equal(h.audio.musicOn, music);
    assert.deepEqual(h.calls, []);
  }
});

test('多个 game 的 world/ui/audio/frameState 和闭包 last、帧队列互相隔离', () => {
  const a = playing(harness({ clock:1000 }));
  const b = playing(harness({ clock:9000, frameTime:20 }));
  for(const key of ['world', 'ui', 'audio', 'frameState', 'game', 'queue']){
    assert.notStrictEqual(a[key], b[key]);
  }
  const bWorld = worldState(b.world), bUI = structuredClone(b.ui);
  a.game.dispatch({ type:'pickSlot', index:0 });
  a.game.handleKey('m');
  a.game.handlePress(cell());
  assert.deepEqual(worldState(b.world), bWorld);
  assert.deepEqual(b.ui, bUI);
  assert.equal(b.audio.musicOn, false);
  assert.equal(b.frameState.t, 20);
  assert.deepEqual(b.calls, []);
  const p = cell();
  addHotspot(a.ui, p.x - 1, p.y - 1, 2, 2, 'a-only', { type:'nav', state:'help' });
  b.game.handlePress(p);
  assert.equal(b.world.state, 'play');
  assert.equal(b.ui.hotspots.length, 0);
  clearHotspots(a.ui);
  a.clear(); b.clear();
  const aT = a.world.t, bT = b.world.t;
  a.game.start();
  assert.equal(b.queue.length, 0);
  b.game.start();
  assert.notStrictEqual(a.queue[0], b.queue[0]);
  close(a.step(1010).worldT, aT + 0.01);
  assert.equal(b.frames.length, 0);
  close(b.step(9040).worldT, bT + 0.04);
  close(a.step(1020).worldT, aT + 0.02);
  close(b.step(9050).worldT, bT + 0.05);
  close(a.frameState.t, 0.02);
  close(b.frameState.t, 20.05);
  assert.equal(a.frameState.musicOn, true);
  assert.equal(b.frameState.musicOn, false);
  assert.equal(a.calls.filter(call => call === 'now').length, 1);
  assert.equal(b.calls.filter(call => call === 'now').length, 1);
});
