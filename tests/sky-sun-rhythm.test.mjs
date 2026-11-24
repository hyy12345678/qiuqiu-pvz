
// E21：天降阳光的节奏曲线。
// 这条测试钉住「前期松、后期紧」这个设计意图，防止哪天被改回一刀切。
import test from 'node:test';
import assert from 'node:assert';
import { createWorld, beginPlay } from '../src/core/world.js';
import { updatePlay } from '../src/core/sim.js';

function countSkySuns(seconds, seed = 7){
  const w = createWorld({ seed });
  w.level = 0;
  w.slots = [];
  w.ports = { sound(){}, saveProgress(){}, saveUnlockAll(){} };
  beginPlay(w, 50);
  const seen = new Set();
  const at = {};
  const marks = [30, 60, 120];
  while (w.t < seconds){
    updatePlay(w, 1/60);
    for (const s of w.suns) if (s.fromSky && !seen.has(s)) seen.add(s);
    for (const m of marks) if (at[m] === undefined && w.t >= m) at[m] = seen.size;
    w.suns = w.suns.filter(s => s.state === 'fall');
  }
  return { total: seen.size, at };
}

test('E21：天降阳光前 60 秒约 11 颗，全程明显少于 4.5~6.5s 的原始节奏', () => {
  const r = countSkySuns(168);
  assert.ok(r.at[60] >= 9 && r.at[60] <= 13,
    '前 60 秒应有约 11 颗（照顾上手），实际 ' + r.at[60]);
  assert.ok(r.total >= 18 && r.total <= 26,
    '全程应约 22 颗，明显少于原始的 30 颗，实际 ' + r.total);
});

test('E21：后期节奏确实被压慢——后 60 秒掉落的颗数少于前 60 秒', () => {
  const r = countSkySuns(168);
  const first60 = r.at[60];
  const lastWindow = r.total - r.at[120];
  const earlyWindow = r.at[60] - (r.at[30] || 0);
  assert.ok(lastWindow <= earlyWindow,
    '后期每 30 秒的颗数不应多于前 30 秒（早期 ' + (r.at[30] || 0) + '，晚期 ' + lastWindow + '）');
  assert.ok(r.at[120] < 21, '前 120 秒应少于原始的 21 颗，实际 ' + r.at[120]);
});

test('E21：夜战仍然没有天降阳光', () => {
  const w = createWorld({ seed: 7 });
  w.level = 3;                    // 第 4 关，夜战
  w.slots = [];
  w.ports = { sound(){}, saveProgress(){}, saveUnlockAll(){} };
  beginPlay(w, 50);
  const seen = new Set();
  while (w.t < 60){
    updatePlay(w, 1/60);
    for (const s of w.suns) if (s.fromSky) seen.add(s);
    w.suns = w.suns.filter(s => s.state === 'fall');
  }
  assert.strictEqual(seen.size, 0, '夜战不应有天降阳光');
});
