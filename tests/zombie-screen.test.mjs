
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

test('E22：铁门挡弹道——豌豆打不掉血也打不掉护盾', () => {
  const w = mk();
  spawnZombie(w, 'screen');
  const z = w.zombies[0];
  assert.strictEqual(z.screen, true, '铁门僵尸应带 screen 标记');
  const hp = z.hp, acc = z.acc;
  for(let i=0;i<50;i++) damageZombie(w, z, 20);          // 弹道
  assert.strictEqual(z.hp, hp, '弹道不应伤到本体');
  assert.strictEqual(z.acc, acc, '弹道不应磨损铁门');
  assert.strictEqual(z.state, 'walk', '不应被打死');
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
