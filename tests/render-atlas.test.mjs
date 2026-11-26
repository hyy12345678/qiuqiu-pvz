// 像素图集：方块风的前提是「纹素密度处处一致」——每个面分到的图集区域，像素数正好等于它的尺寸。
// 这里不看画出来的像素（Node 里没有画布），只验证分配与 UV 换算这条承诺。
import test from 'node:test';
import assert from 'node:assert/strict';
import { region, ATLAS_SIZE, atlasStats } from '../src/render/scene3d/atlas.js';
import { boxGeometry, P } from '../src/render/scene3d/rig.js';
import { template } from '../src/render/scene3d/world-view.js';
import { PLANTS } from '../src/core/data/plants.js';
import { ZTYPES } from '../src/core/data/zombies.js';

test('同一个 key 只分配一次；不同 key 的区域互不重叠', () => {
  const a = region('test:a', 8, 8, null), a2 = region('test:a', 8, 8, null), b = region('test:b', 4, 12, null);
  assert.deepEqual(a, a2, '同 key 应复用同一块区域');
  const overlap = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
  assert.ok(!overlap(a, b), '两块区域不应重叠');
  for(const uv of [a, b]) for(const v of uv) assert.ok(v >= 0 && v <= 1, 'UV 应落在 [0,1]：' + v);
});

test('方块的每个面在图集里分到的像素数等于它的尺寸（front/back=d×h，top/bottom=w×d，near/far=w×h）', () => {
  const [w, h, d] = [6, 10, 4];
  const g = boxGeometry([w, h, d], '#123456');
  assert.ok(Math.abs(g.parameters.width - w * P) < 1e-9 && Math.abs(g.parameters.height - h * P) < 1e-9);
  const uv = g.attributes.uv;
  const want = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for(let f = 0; f < 6; f++){
    let u0 = 1, u1 = 0, v0 = 1, v1 = 0;
    for(let k = 0; k < 4; k++){ const i = f * 4 + k; u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); v0 = Math.min(v0, uv.getY(i)); v1 = Math.max(v1, uv.getY(i)); }
    assert.equal(Math.round((u1 - u0) * ATLAS_SIZE), want[f][0], '第 ' + f + ' 面宽度像素数');
    assert.equal(Math.round((v1 - v0) * ATLAS_SIZE), want[f][1], '第 ' + f + ' 面高度像素数');
  }
});

test('全部植物与僵尸建模后图集仍有余量（满了会直接抛错，这里提前看到余量）', () => {
  for(const t of Object.keys(PLANTS)) template('plant', t);
  for(const t of Object.keys(ZTYPES)) template('zombie', t);
  const s = atlasStats();
  assert.ok(s.height < ATLAS_SIZE * 0.8, '图集已用到 ' + s.height + '/' + ATLAS_SIZE + ' 行，接近上限');
});
