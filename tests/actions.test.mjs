// R3：动作入口与界面状态分离。证明失败不部分扣费 / 不推进冷却 / 不改变目标，
// 成功时扣费、冷却、取消选择各发生一次，且界面状态能按实例隔离。
import test from 'node:test';
import assert from 'node:assert';

const { createWorld, beginPlay, startQuiz, answerQuiz } = await import('../src/core/world.js');
const { spawnSun, placePlant } = await import('../src/core/entities.js');
const { createUI } = await import('../src/ui/state.js');
const { addHotspot, hitHotspot, clearHotspots } = await import('../src/ui/hotspots.js');
const {
  inspectUseCard, useCard, pickSlot, toggleShovel, pressCell,
  collectSun, chooseLevel, togglePause, removeSlot, pickTeamPlant,
} = await import('../src/core/actions.js');

function makeWorld(opts = {}){
  const sounds = [];
  const w = createWorld({
    seed: opts.seed === undefined ? 7 : opts.seed,
    ports: { sound: name => sounds.push(name) },
    unlocked: opts.unlocked === undefined ? 4 : opts.unlocked,
    unlockAll: opts.unlockAll === undefined ? false : opts.unlockAll,
  });
  w.level = opts.level === undefined ? 0 : opts.level;
  w.slots = (opts.slots || []).map(type => ({ type, cool:0 }));
  beginPlay(w, opts.sun === undefined ? 5000 : opts.sun);
  w.sun = opts.sun === undefined ? 5000 : opts.sun;
  w.t = 1;
  w.zombies.length = 0;
  w.events.length = 0;
  w.evIdx = 0;
  w.skyTimer = 1e9;
  sounds.length = 0;   // beginPlay 的 click 不算动作反馈
  return { w, ui: createUI(), sounds };
}

function combatState(w, ui){
  return {
    sun: w.sun,
    paused: w.paused,
    grid: w.grid.map(row => row.map(p => p ? p.type : null)),
    plants: w.plants.map(p => p.type + '@' + p.row + ',' + p.col),
    slots: w.slots.map(s => s.type + ':' + s.cool),
    sel: ui.sel,
    shovel: ui.shovel,
    parts: w.visual.parts.length,
  };
}

test('动作0 world 不再持有界面字段', () => {
  const w = createWorld({ seed: 1 });
  for (const key of ['mouse', 'hoverCell', 'sel', 'shovel', 'hotspots']){
    assert.ok(!(key in w), 'world 不应再有 ' + key);
  }
});

test('动作1 阳光不足：不种植、不扣费、不冷却、保持选卡', () => {
  const { w, ui, sounds } = makeWorld({ slots:['sunflower'], sun:40 });
  ui.sel = 0;
  const before = combatState(w, ui);
  const r = pressCell(w, ui, 2, 3);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'not-enough-sun');
  assert.deepStrictEqual(combatState(w, ui), before);
  assert.deepStrictEqual(sounds, ['error']);
  assert.strictEqual(w.sunFlash, 0.5, '余额不足仍应点亮阳光盒，与现状一致');
});

test('动作2 冷却未结束 / 占用格：不种植、不扣费、不覆盖目标', () => {
  {
    const { w, ui, sounds } = makeWorld({ slots:['sunflower'] });
    w.slots[0].cool = 3;
    ui.sel = 0;
    const before = combatState(w, ui);
    const r = pressCell(w, ui, 2, 3);
    assert.strictEqual(r.reason, 'cooling');
    assert.deepStrictEqual(combatState(w, ui), before);
    assert.deepStrictEqual(sounds, ['error']);
  }
  {
    const { w, ui, sounds } = makeWorld({ slots:['sunflower'] });
    placePlant(w, 'wallnut', 1, 1);
    sounds.length = 0;
    ui.sel = 0;
    const target = w.grid[1][1];
    const before = combatState(w, ui);
    const r = pressCell(w, ui, 1, 1);
    assert.strictEqual(r.reason, 'occupied');
    assert.deepStrictEqual(combatState(w, ui), before);
    assert.strictEqual(w.grid[1][1], target, '目标植物必须原样保留');
    assert.deepStrictEqual(sounds, ['error']);
  }
});

test('动作3 咖啡豆点空格 / 清醒植物 / 越界格：不扣费、不冷却、不取消选卡', () => {
  const { w, ui, sounds } = makeWorld({ slots:['coffee'], sun:100 });
  ui.sel = 0;
  const before = combatState(w, ui);
  assert.strictEqual(pressCell(w, ui, 0, 0).reason, 'invalid-target');
  assert.deepStrictEqual(combatState(w, ui), before);

  placePlant(w, 'sunflower', 1, 1);   // 清醒植物
  w.sun = 100;
  sounds.length = 0;
  ui.sel = 0;
  const beforeAwake = combatState(w, ui);
  assert.strictEqual(pressCell(w, ui, 1, 1).reason, 'invalid-target');
  assert.deepStrictEqual(combatState(w, ui), beforeAwake);
  assert.deepStrictEqual(sounds, ['error']);

  assert.strictEqual(useCard(w, 0, -1, 0).reason, 'out-of-bounds');
  assert.strictEqual(w.sun, 100);
  assert.strictEqual(w.slots[0].cool, 0);
  assert.strictEqual(ui.sel, 0, '失败的咖啡豆必须保持选中');
});

test('动作4 咖啡豆点睡眠蘑菇：唤醒、扣费、冷却、取消选卡各一次', () => {
  const { w, ui, sounds } = makeWorld({ slots:['puff', 'coffee'], sun:100 });
  placePlant(w, 'puff', 2, 4);
  const mushroom = w.grid[2][4];
  assert.strictEqual(mushroom.asleep, true, '白天种下的蘑菇应先打盹');
  w.sun = 100;
  sounds.length = 0;
  ui.sel = 1;

  const r = pressCell(w, ui, 2, 4);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(mushroom.asleep, false);
  assert.strictEqual(w.sun, 75, '咖啡豆只应扣一次 25');
  assert.strictEqual(w.slots[1].cool, 20, '成功后应进入冷却');
  assert.strictEqual(ui.sel, -1, '成功后应取消选卡');
  assert.deepStrictEqual(sounds, ['select'], '唤醒反馈只发一次');
});

test('动作5 inspectUseCard 是只读判断：各类输入前后状态一致', () => {
  const { w, ui } = makeWorld({ slots:['sunflower', 'coffee'], sun:60 });
  placePlant(w, 'puff', 3, 3);
  const before = combatState(w, ui);
  const cases = [
    [0, 0, 0], [0, 3, 3], [1, 3, 3], [1, 0, 0], [1, -1, 0], [9, 0, 0],
  ];
  for (const [slot, row, col] of cases) inspectUseCard(w, slot, row, col);
  assert.deepStrictEqual(combatState(w, ui), before);
  assert.strictEqual(w.sunFlash, 0, '只读判断不应触发阳光盒闪烁');
});

test('动作6 铲子：空格不清除铲子；有植物时移除、出粒子、清铲子、发 dig', () => {
  {
    const { w, ui, sounds } = makeWorld({ slots:[] });
    ui.shovel = true;
    const before = combatState(w, ui);
    assert.strictEqual(pressCell(w, ui, 2, 2).reason, 'empty');
    assert.deepStrictEqual(combatState(w, ui), before);
    assert.strictEqual(ui.shovel, true, '点空格不应取消铲子');
    assert.deepStrictEqual(sounds, []);
  }
  {
    const { w, ui, sounds } = makeWorld({ slots:[] });
    placePlant(w, 'sunflower', 2, 2);
    w.visual.parts.length = 0;
    sounds.length = 0;
    ui.shovel = true;
    const plant = w.grid[2][2];
    const r = pressCell(w, ui, 2, 2);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(w.grid[2][2], null);
    assert.ok(!w.plants.includes(plant));
    assert.ok(w.visual.parts.length > 0, '铲除应留下叶子粒子');
    assert.strictEqual(ui.shovel, false);
    assert.deepStrictEqual(sounds, ['dig']);
  }
});

test('动作7 收阳光：倒序优先、跳过飞行中、暂停时拒绝', () => {
  const { w } = makeWorld({ slots:[] });
  spawnSun(w, 200, 200, 200, false, 50);
  spawnSun(w, 205, 200, 200, false, 25);
  assert.strictEqual(collectSun(w, 202, 200).ok, true);
  assert.strictEqual(w.suns[0].state, 'fall', '先落下的阳光不应被抢走');
  assert.strictEqual(w.suns[1].state, 'fly', '后注册的阳光应优先命中');

  w.suns[1].state = 'fly';
  w.suns[0].state = 'fall';
  assert.strictEqual(collectSun(w, 202, 200).ok, true);
  assert.strictEqual(w.suns[0].state, 'fly', '飞行中的阳光应被跳过');

  assert.strictEqual(collectSun(w, 600, 500).reason, 'no-sun');
  w.paused = true;
  assert.strictEqual(collectSun(w, 202, 200).reason, 'paused');
});

test('动作8 暂停与非战斗状态：战斗动作失效，导航与暂停仍工作', () => {
  const { w, ui } = makeWorld({ slots:['sunflower'], sun:500 });
  w.paused = true;
  const before = combatState(w, ui);
  assert.strictEqual(pickSlot(w, ui, 0).reason, 'paused');
  assert.strictEqual(toggleShovel(w, ui).reason, 'paused');
  assert.strictEqual(useCard(w, 0, 1, 1).reason, 'paused');
  assert.strictEqual(pressCell(w, ui, 1, 1).reason, 'paused');
  assert.deepStrictEqual(combatState(w, ui), before);

  assert.strictEqual(togglePause(w).ok, true);
  assert.strictEqual(w.paused, false);
  assert.strictEqual(togglePause(w).paused, true);

  const menu = createWorld({ unlocked:1 });
  const menuUI = createUI();
  assert.strictEqual(pickSlot(menu, menuUI, 0).reason, 'wrong-state');
  assert.strictEqual(togglePause(menu).reason, 'wrong-state');
  assert.strictEqual(chooseLevel(menu, menuUI, 0).ok, true, '菜单选关不受暂停影响');
  assert.strictEqual(menu.state, 'select');
});

test('动作9 选关：锁定关卡拒绝且不改状态；合法关卡清除选择', () => {
  const w = createWorld({ unlocked:1, unlockAll:false });
  const ui = createUI();
  ui.sel = 3; ui.shovel = true;
  assert.strictEqual(chooseLevel(w, ui, 1).reason, 'locked');
  assert.strictEqual(w.state, 'menu');
  assert.strictEqual(ui.sel, 3);

  assert.strictEqual(chooseLevel(w, ui, 0).ok, true);
  assert.strictEqual(w.state, 'select');
  assert.strictEqual(w.level, 0);
  assert.strictEqual(ui.sel, -1);
  assert.strictEqual(ui.shovel, false);

  assert.strictEqual(chooseLevel(w, createUI(), 9).reason, 'bad-level');
});

test('动作10 选卡界面：卡槽增删与队伍上限', () => {
  const { w, ui } = makeWorld({ slots:['sunflower', 'peashooter', 'wallnut'] });
  ui.sel = 2;
  assert.strictEqual(removeSlot(w, ui, 0).ok, true);
  assert.strictEqual(ui.sel, 1, '移除前面的卡槽后选卡下标应左移');
  assert.strictEqual(removeSlot(w, ui, 1).ok, true);
  assert.strictEqual(ui.sel, -1, '移除当前选中的卡槽应清空选择');
  assert.strictEqual(removeSlot(w, ui, 5).reason, 'no-slot');

  const team = makeWorld({ level:0, slots:['sunflower', 'peashooter', 'snowpea', 'repeater', 'wallnut', 'potato'] });
  assert.strictEqual(pickTeamPlant(team.w, team.ui, 'cherry').reason, 'team-full');
  assert.deepStrictEqual(team.sounds, ['error']);
  assert.strictEqual(pickTeamPlant(team.w, team.ui, 'sunflower').ok, true);
  assert.strictEqual(team.w.slots.some(s => s.type === 'sunflower'), false);
  assert.strictEqual(pickTeamPlant(team.w, team.ui, 'cherry').added, true);
});

test('动作11 同一逻辑格：重复提交得到同一结果', () => {
  function plantAt(row, col){
    const { w, ui } = makeWorld({ slots:['sunflower'], sun:60 });
    ui.sel = 0;
    const first = pressCell(w, ui, row, col);
    const state = combatState(w, ui);
    const second = pressCell(w, ui, row, col);
    return { first, second, state, after: combatState(w, ui) };
  }
  const a = plantAt(2, 2), b = plantAt(2, 2);
  assert.strictEqual(a.first.ok, true);
  assert.strictEqual(a.second.reason, 'no-selection', '成功一次后选择已清除');
  assert.deepStrictEqual(a.state, b.state);
  assert.deepStrictEqual(a.after, b.after);
});

test('动作12 UI 状态与热点表按实例隔离，命中仍是后注册优先', () => {
  const a = createUI(), b = createUI();
  assert.notStrictEqual(a.mouse, b.mouse);
  assert.notStrictEqual(a.hotspots, b.hotspots);
  a.sel = 2; a.shovel = true;
  assert.strictEqual(b.sel, -1);
  assert.strictEqual(b.shovel, false);

  addHotspot(a, 0, 0, 10, 10, 'lower', { type:'lower' });
  addHotspot(a, 0, 0, 10, 10, 'upper', { type:'upper' });
  assert.strictEqual(hitHotspot(a, { x:5, y:5 }).id, 'upper');
  assert.strictEqual(hitHotspot(a, { x:50, y:50 }), null);
  clearHotspots(a);
  assert.strictEqual(a.hotspots.length, 0);
  assert.strictEqual(hitHotspot(a, { x:5, y:5 }), null);
});

test('动作13 答题返回明确结果，重复提交在反馈期内被拒', () => {
  const w = createWorld({ seed: 3 });
  startQuiz(w);
  const q = w.quiz.questions[0];
  const right = answerQuiz(w, q.answer);
  assert.deepStrictEqual(right, { ok:true, correct:true });
  assert.strictEqual(answerQuiz(w, q.answer).reason, 'busy');
  assert.strictEqual(answerQuiz(createWorld({ seed:3 }), q.answer).reason, 'wrong-state');
});
