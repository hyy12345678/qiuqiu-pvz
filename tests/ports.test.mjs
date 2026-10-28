// R2b：核心的副作用只经注入端口。测试用记录端口检查发声 / 存档的时机与次数，
// 并用静态扫描确认 core/ 不再直接依赖音频与浏览器存储。
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { createWorld, beginPlay, startLevel, startQuiz, answerQuiz, toggleUnlockAll } = await import('../src/core/world.js');
const { updatePlay } = await import('../src/core/sim.js');
const { placePlant, applyCoffee, damageZombie, explode, spawnZombie, triggerMower } = await import('../src/core/entities.js');
const { SFX } = await import('../src/audio/sfx.js');

const DT = 1 / 60;
const CORE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/core');

function recorder(){
  const calls = { sound: [], saveProgress: [], saveUnlockAll: [] };
  return {
    calls,
    ports: {
      sound: name => calls.sound.push(name),
      saveProgress: value => calls.saveProgress.push(value),
      saveUnlockAll: on => calls.saveUnlockAll.push(on),
    },
  };
}

function make(rec, extra = {}){
  return createWorld({ seed: 7, ports: rec.ports, unlocked: 1, unlockAll: false, ...extra });
}

test('端口1 关卡流程与答题按原时机发声音', () => {
  const rec = recorder();
  const w = make(rec);

  startLevel(w, 0);
  assert.deepStrictEqual(rec.calls.sound, ['click'], '进入选卡应发一次 click');

  startQuiz(w);
  assert.deepStrictEqual(rec.calls.sound, ['click', 'click'], '进入答题应再发一次 click');

  const q = w.quiz.questions[w.quiz.idx];
  answerQuiz(w, q.answer);
  assert.strictEqual(rec.calls.sound.at(-1), 'select', '答对应发 select');

  const wrongRec = recorder();
  const w2 = make(wrongRec);
  startQuiz(w2);
  const q2 = w2.quiz.questions[w2.quiz.idx];
  answerQuiz(w2, q2.options.find(o => o !== q2.answer));
  assert.strictEqual(wrongRec.calls.sound.at(-1), 'error', '答错应发 error');
});

test('端口2 种植、咖啡豆、爆炸、击杀与推车各走 sound', () => {
  const rec = recorder();
  const w = make(rec);
  beginPlay(w);
  rec.calls.sound.length = 0;

  w.sun = 999;
  placePlant(w, 'puff', 2, 3);
  assert.deepStrictEqual(rec.calls.sound, ['plant'], '种植应发 plant');

  const puff = w.grid[2][3];
  assert.strictEqual(puff.asleep, true, '白天种下的蘑菇应打盹');
  assert.strictEqual(applyCoffee(w, puff), true);
  assert.deepStrictEqual(rec.calls.sound, ['plant', 'select'], '唤醒应发 select');
  assert.strictEqual(applyCoffee(w, puff), false, '已醒的蘑菇不应再发声音');
  assert.deepStrictEqual(rec.calls.sound, ['plant', 'select']);

  explode(w, puff.cx, 2, false);
  assert.ok(rec.calls.sound.includes('boom'), '爆炸应发 boom');

  spawnZombie(w, 'normal');
  damageZombie(w, w.zombies.at(-1), 9999);  assert.strictEqual(rec.calls.sound.at(-1), 'groan', '击杀应发 groan');

  triggerMower(w, 0);
  assert.strictEqual(rec.calls.sound.at(-1), 'mower', '推车启动应发 mower');
});

test('端口3 通关只写一次进度，全关卡开关按状态写回', () => {
  const rec = recorder();
  const w = make(rec);
  beginPlay(w);
  w.level = 0;
  w.t = 1;
  w.events = []; w.evIdx = 0;
  w.zombies.length = 0;
  w.skyTimer = 1e9;

  for (let i = 0; i < 70; i++) updatePlay(w, DT);

  assert.strictEqual(w.state, 'won');
  assert.deepStrictEqual(rec.calls.saveProgress, [2], '解锁到第 2 关时应写回一次');
  assert.strictEqual(rec.calls.sound.at(-1), 'win', '判胜应发 win');

  for (let i = 0; i < 30; i++) updatePlay(w, DT);
  assert.deepStrictEqual(rec.calls.saveProgress, [2], '判胜后继续推进不应重复写回');

  toggleUnlockAll(w);
  toggleUnlockAll(w);
  assert.deepStrictEqual(rec.calls.saveUnlockAll, [true, false], '开关每次切换都应写回当前状态');

  const high = recorder();
  const w2 = make(high, { unlocked: 3 });
  beginPlay(w2);
  w2.level = 0; w2.t = 1; w2.events = []; w2.evIdx = 0; w2.zombies.length = 0; w2.skyTimer = 1e9;
  for (let i = 0; i < 70; i++) updatePlay(w2, DT);
  assert.strictEqual(w2.state, 'won');
  assert.deepStrictEqual(high.calls.saveProgress, [], '进度没有提高时不应写回');
});

test('端口4 默认端口静默，跑完整流程不依赖浏览器对象', () => {
  const w = createWorld();
  assert.strictEqual(w.unlocked, 1, '未注入进度时从第 1 关开始');
  assert.strictEqual(w.unlockAll, false, '未注入开关时默认关闭');

  startLevel(w, 0);
  startQuiz(w);
  answerQuiz(w, w.quiz.questions[0].answer);
  w.slots = [{ type: 'sunflower', cool: 0 }];
  beginPlay(w);
  w.sun = 999;
  placePlant(w, 'sunflower', 0, 0);
  w.t = 1; w.events = []; w.evIdx = 0; w.zombies.length = 0; w.skyTimer = 1e9;
  for (let i = 0; i < 70; i++) updatePlay(w, DT);
  assert.strictEqual(w.state, 'won');
});

test('端口5 两个世界的端口互不共享，写回不串台', () => {
  const a = recorder(), b = recorder();
  const wa = make(a), wb = make(b);
  beginPlay(wa); beginPlay(wb);
  a.calls.sound.length = 0; b.calls.sound.length = 0;

  wa.sun = 999;
  placePlant(wa, 'sunflower', 1, 1);
  assert.deepStrictEqual(a.calls.sound, ['plant']);
  assert.deepStrictEqual(b.calls.sound, [], 'B 不应收到 A 的声音');

  toggleUnlockAll(wa);
  assert.deepStrictEqual(a.calls.saveUnlockAll, [true]);
  assert.deepStrictEqual(b.calls.saveUnlockAll, [], 'B 不应收到 A 的存档写回');
  assert.strictEqual(wb.unlockAll, false);
});

test('端口6 core/ 不直接依赖音频实现或浏览器存储', () => {
  const files = [];
  (function walk(dir){
    for (const name of fs.readdirSync(dir)){
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.js')) files.push(full);
    }
  })(CORE_DIR);
  assert.ok(files.length > 0);

  for (const file of files){
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/audio\/sfx/.test(text), path.relative(CORE_DIR, file) + ' 不应导入 audio/sfx');
    assert.ok(!/localStorage/.test(text), path.relative(CORE_DIR, file) + ' 不应直接访问 localStorage');
    assert.ok(!/['"]\.{1,2}\/persist\.js['"]/.test(text), path.relative(CORE_DIR, file) + ' 不应导入 persist');
  }
});

test('端口7 核心发出的每个声音名都是真实音效方法', () => {
  const names = new Set();
  for (const name of fs.readdirSync(CORE_DIR)){
    if (!name.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(CORE_DIR, name), 'utf8');
    for (const m of text.matchAll(/sound\('([a-zA-Z]+)'\)/g)) names.add(m[1]);
  }
  assert.ok(names.size >= 15, '应扫描到核心的全部声音名，实际 ' + names.size);
  for (const name of names){
    assert.strictEqual(typeof SFX[name], 'function', '声音名「' + name + '」没有对应音效实现');
  }
});
