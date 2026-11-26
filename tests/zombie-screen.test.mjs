
// E22：铁门僵尸的规则。
// 它不改变血量，改变的是「你得换一套火力」——所以这些断言钉的是规则而不是数值。
import test from 'node:test';
import assert from 'node:assert';
import { createWorld, beginPlay } from '../src/core/world.js';
import { spawnZombie, damageZombie } from '../src/core/entities.js';

function mk(){
  const w = createWorld({ seed: 7 });
  w.level = 0; w.slots = [];
  w.ports = { sound(){}, saveProgress(){}, saveUnlockAll(){} };
  beginPlay(w, 50);
  w.events = []; w.evIdx = 0;
  return w;
}

test('E23：铁门把弹道削到 25%——豌豆不是无效，而是变慢', () => {
  const w = mk();
  spawnZombie(w, 'screen');
  const z = w.zombies[0];
  assert.strictEqual(z.screen, true, '铁门僵尸应带 screen 标记');
  const acc = z.acc;
  damageZombie(w, z, 20);                                 // 一发豌豆
  assert.strictEqual(z.acc, acc - 5, '20 伤害的弹道应只削 5 点铁门（25%）');
  assert.strictEqual(z.hp, 200, '铁门没破前不该伤到本体');

  // 堆够火力仍然能打穿：900 盾 ÷ (20×0.25) = 180 发
  for(let i=0;i<200;i++) damageZombie(w, z, 20);
  assert.ok(z.acc <= 0, '持续豌豆火力最终应磨穿铁门');
});

test('E23：穿透伤害无视铁门的削减', () => {
  const w = mk();
  spawnZombie(w, 'screen');
  const z = w.zombies[0];
  const acc = z.acc;
  damageZombie(w, z, 300, true);                          // 樱桃/导弹/光线这一路
  assert.strictEqual(z.acc, acc - 300, '穿透伤害不打折');
  damageZombie(w, z, 9999, true);                         // 小推车
  assert.strictEqual(z.state, 'dying', '推车应能碾过铁门僵尸');
});

test('E22：非弹道伤害无视铁门——爆炸、光线、小推车都算', () => {
  const w = mk();
  spawnZombie(w, 'screen');
  const z = w.zombies[0];
  const acc = z.acc;
  damageZombie(w, z, 300, true);                          // 樱桃/导弹/光线这一路
  assert.strictEqual(z.acc, acc - 300, '穿透伤害应先破门');
  damageZombie(w, z, 9999, true);                         // 小推车
  assert.strictEqual(z.state, 'dying', '推车应能碾过铁门僵尸');
});

test('E22：铁门被打中会留下 screenHitT 供渲染层画火花', () => {
  const w = mk();
  spawnZombie(w, 'screen');
  const z = w.zombies[0];
  z.screenHitT = 0;
  damageZombie(w, z, 20);
  assert.ok(z.screenHitT > 0, '被弹道打中后应有火花反馈计时');
});

test('E22：普通僵尸不受 pierce 参数影响', () => {
  const w = mk();
  spawnZombie(w, 'normal');
  const z = w.zombies[0];
  const hp = z.hp;
  damageZombie(w, z, 20);                                 // 不传 pierce
  assert.strictEqual(z.hp, hp - 20, '普通僵尸照常吃弹道伤害');
});
test('E28：首见提示与规则一致——说弹道只剩 1/4，且不推荐被同样削弱的火豌豆', async () => {
  const { updatePlay } = await import('../src/core/sim.js');
  const { SCREEN_BALLISTIC_MULT } = await import('../src/core/entities.js');
  const w = mk();
  w.events = [{ t: 0.5, type: 'screen' }]; w.evIdx = 0; w.t = 0.4;
  updatePlay(w, 0.2);
  assert.ok(w.visual.waveText, '铁门僵尸首次登场应弹出提示');
  const text = w.visual.waveText.text;
  assert.strictEqual(SCREEN_BALLISTIC_MULT, 0.25, '倍率变了：提示里的「1/4」要跟着改');
  assert.ok(text.includes('1/4'), '提示应说明弹道伤害只剩 1/4：' + text);
  assert.ok(!text.includes('火豌豆'), '火豌豆直击同样被削弱，不该被推荐为破门手段：' + text);
  // 火豌豆直击确实被削：40 点只扣 10 点铁门
  spawnZombie(w, 'screen');
  const z = w.zombies[w.zombies.length - 1];
  const acc = z.acc;
  damageZombie(w, z, 40);
  assert.strictEqual(acc - z.acc, 10);
});
