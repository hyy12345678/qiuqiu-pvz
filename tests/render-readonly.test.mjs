// 世界视图只读：把 world 同步成场景树时，不得改写 world 或任何实体的字段。
// 需要跨帧记忆的东西（上一帧血量、光线起点、粒子归属）只能放在视图自己的表里。
import test from 'node:test';
import assert from 'node:assert';
import { PLANTS } from '../src/core/data/plants.js';
import { ZTYPES } from '../src/core/data/zombies.js';
import { createWorld, beginPlay } from '../src/core/world.js';
import { placePlant, spawnZombie, spawnSun, explode } from '../src/core/entities.js';
import { createUI } from '../src/ui/state.js';
import { createWorldView } from '../src/render/scene3d/world-view.js';

function richWorld(level = 0){
  const w = createWorld({ seed: 9 });
  w.level = level; w.slots = [{ type: 'peashooter', cool: 0 }];
  beginPlay(w, 9999);
  w.t = 2;
  const types = Object.keys(PLANTS);
  types.forEach((type, i) => placePlant(w, type, i % 5, Math.floor(i / 5)));
  w.grid[0][2].asleep = true;
  for(const type of Object.keys(ZTYPES)) spawnZombie(w, type);
  const zs = w.zombies;
  zs[0].state = 'eat'; zs[0].eatT = 1.1; zs[0].eatPlant = w.plants[0];
  zs[1].state = 'dying'; zs[1].deathT = 0.4;
  zs[2].slowT = 2;
  zs[4].state = 'vault'; zs[4].vt = 0.4; zs[4].vy = -30;
  zs[5].angry = true; zs[5].acc = 0;
  for(const [i, type] of ['pea', 'snow', 'fire', 'spore', 'bullet', 'missile', 'ball', 'beam'].entries()){
    w.peas.push({ x: 400 + i * 20, y: 300, row: i % 5, type, dmg: 20, vx: 300, prevX: 390 + i * 20 });
  }
  spawnSun(w, 500, 100, 300, true);
  spawnSun(w, 600, 300, 300, false, 25);
  w.suns[1].state = 'idle';
  spawnSun(w, 700, 300, 300, true); w.suns[2].state = 'fly'; w.suns[2].ft = 0.4;
  w.mowers[1].state = 'run'; w.mowers[2].state = 'gone';
  explode(w, 500, 2, true);
  return w;
}
const ENTITY_KEYS = ['plants', 'zombies', 'peas', 'suns', 'mowers', 'slots', 'grid'];
const snap = w => JSON.stringify(ENTITY_KEYS.map(k => w[k])) + JSON.stringify({ ...w.visual, parts: w.visual.parts.length }) + w.sun + w.t + w.state;

test('世界视图只读：植物 / 僵尸 / 弹丸 / 阳光 / 推车 / 爆炸在战斗模式下同步多帧都不改实体', () => {
  for(const level of [0, 3]){
    const w = richWorld(level), ui = createUI();
    ui.hoverCell = { row: 2, col: 8 }; ui.sel = 0;
    const view = createWorldView();
    const before = snap(w);
    for(let i = 0; i < 30; i++) view.update('battle', w, ui, i / 60, 400);
    assert.strictEqual(snap(w), before, '第 ' + (level + 1) + ' 关：视图同步改写了世界');
  }
});

test('世界视图只读：菜单模式、暂停与结算状态都不改实体', () => {
  const w = richWorld(), ui = createUI();
  const view = createWorldView();
  const before = snap(w);
  view.update('menu', w, ui, 0, 400);
  w.paused = true; view.update('battle', w, ui, 0.1, 400); w.paused = false;
  w.state = 'lost'; w.loseZombie = w.zombies[3];
  for(let i = 0; i < 10; i++) view.update('battle', w, ui, 0.2 + i / 60, 400);
  w.state = 'play'; w.loseZombie = null;
  assert.strictEqual(snap(w), before);
});

test('世界视图跟着实体增删：种下 / 移除、出怪 / 死亡都在场景树里同步出现与消失', () => {
  const w = createWorld({ seed: 3 }); w.level = 0; w.slots = []; beginPlay(w, 999); w.t = 1;
  const ui = createUI();
  const view = createWorldView();
  const count = () => { let n = 0; view.scene.traverse(o => { if(o.isMesh) n++; }); return n; };
  view.update('battle', w, ui, 0, 400);
  const empty = count();
  placePlant(w, 'peashooter', 1, 1);
  spawnZombie(w, 'bucket');
  view.update('battle', w, ui, 0.1, 400);
  const busy = count();
  assert.ok(busy > empty, '种植与出怪后场景里应多出网格');
  w.plants.length = 0; w.grid[1][1] = null; w.zombies.length = 0;
  view.update('battle', w, ui, 0.2, 400);
  assert.ok(count() < busy, '实体移除后视图应回收对应网格');
});
