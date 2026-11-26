// 3D 拾取：透视下草坪在屏幕上不再是规整网格，点击要按镜头反投影回格子与阳光。
// 这里验证的是玩家视角的承诺——点在格子正中就种在这一格，点在植物身上就选中这株植物，
// 点在阳光上就收这颗阳光——而不是某个具体的屏幕坐标。
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS } from '../src/core/constants.js';
import { createWorld, beginPlay } from '../src/core/world.js';
import { placePlant, spawnSun, cellCX } from '../src/core/entities.js';
import { createUI } from '../src/ui/state.js';
import { createWorldView } from '../src/render/scene3d/world-view.js';
import { createPicker } from '../src/render/scene3d/picking.js';
import { rowZ } from '../src/render/scene3d/coords.js';
import { scenario } from './helpers/scenario.mjs';

function setup(){
  const w = createWorld({ seed: 2 }); w.level = 0; w.slots = []; beginPlay(w, 999); w.t = 1;
  const ui = createUI(), view = createWorldView(), picker = createPicker(view);
  view.update('battle', w, ui, 0, 400);
  return { w, ui, view, picker };
}

test('点在每一格地面的正中，都拾取到这一格（45 格全覆盖）', () => {
  const { picker } = setup();
  for(let r = 0; r < ROWS; r++) for(let c = 0; c < COLS; c++){
    const s = picker.screenOf(c + 0.5, 0, rowZ(r));
    assert.ok(s.x > 0 && s.x < 1024 && s.y > 96 && s.y < 640, `格子 ${r},${c} 应落在 HUD 之下的画面里：${s.x.toFixed(0)},${s.y.toFixed(0)}`);
    assert.deepEqual(picker.cellAt(s), { row: r, col: c }, `点格子 ${r},${c} 的中心应拾取到它`);
  }
});

test('点在植物头上也算点中它的格子（植物有高度，头部投影会落到后一行的地面上）', () => {
  const { w, ui, view, picker } = setup();
  placePlant(w, 'sunflower', 3, 4);
  view.update('battle', w, ui, 0.02, 400);
  const head = picker.screenOf(4.5, 0.62, rowZ(3));
  assert.deepEqual(picker.cellAt(head), { row: 3, col: 4 });
});

test('草坪之外与菜单模式下不拾取格子', () => {
  const { w, ui, view, picker } = setup();
  assert.equal(picker.cellAt(picker.screenOf(-1.5, 0, rowZ(2))), null, '门廊上不是格子');
  assert.equal(picker.cellAt(picker.screenOf(10.5, 0, rowZ(2))), null, '人行道上不是格子');
  view.update('menu', w, ui, 0.1, 400);
  assert.equal(picker.cellAt({ x: 512, y: 400 }), null);
});

test('点在阳光上返回这颗阳光的逻辑坐标；飞向资源栏的阳光不再可点', () => {
  const { w, ui, view, picker } = setup();
  spawnSun(w, cellCX(6), 300, 400, false);
  w.suns[0].y = 400; w.suns[0].state = 'idle';
  view.update('battle', w, ui, 0.02, 400);
  const a = view.sunAnchors()[0];
  const s = picker.screenOf(a.pos.x, a.pos.y, a.pos.z);
  assert.deepEqual(picker.sunAt(s), { x: w.suns[0].x, y: w.suns[0].y });
  assert.equal(picker.sunAt({ x: s.x + 80, y: s.y }), null, '离阳光太远不算点中');
  w.suns[0].state = 'fly';
  assert.equal(picker.sunAt(s), null);
});

test('游戏按注入的拾取器结算点击：收阳光优先，其次种植', () => {
  const h = scenario({ seed: 5 });
  const calls = [];
  const picker = {
    sunAt: p => { calls.push('sun'); return null; },
    cellAt: p => { calls.push('cell'); return { row: 1, col: 2 }; },
  };
  // 换一个带拾取器的游戏实例，共用同一个世界
  h.game.handlePress.call(null, { x: -50, y: -50 });
  assert.deepEqual(calls, [], '默认拾取器不应调用注入的那一份');
  return import('../src/game.js').then(({ createGame }) => {
    const g = createGame({ world: h.world, ui: h.ui, frameState: h.frameState, audio: h.audio, render(){}, now: () => 0, requestFrame(){}, picker });
    h.world.state = 'play'; h.world.paused = false;
    h.world.slots = [{ type: 'sunflower', cool: 0 }]; h.world.sun = 100;
    h.world.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    h.ui.sel = 0;
    g.handlePress({ x: 600, y: 300 });
    assert.deepEqual(calls, ['sun', 'cell']);
    assert.equal(h.world.grid[1][2] && h.world.grid[1][2].type, 'sunflower', '应种在拾取器给出的格子上');
  });
});
