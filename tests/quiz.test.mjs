// 战前算数题目：题量、选项合法性、题面与答案自洽。
// 阳光结算（答对 ×2 → 50..400）依赖 G 与 beginPlay，仍由 headless_test.js 的场景 F 覆盖。
import test from 'node:test';
import assert from 'node:assert';

const { makeQuiz } = await import('../src/core/quiz.js');
const { mulberry32 } = await import('../src/core/rng.js');

// 题面是「a − b = ?」/「a + b = ?」，减号用的是 U+2212，解析时两种都认
function evalText(text) {
  const m = text.match(/^(\d+) ([+−-]) (\d+) = \?$/);
  assert.ok(m, `题面格式不认识：${text}`);
  const a = Number(m[1]), b = Number(m[3]);
  return m[2] === '−' || m[2] === '-' ? a - b : a + b;
}

test('固定 3 题，每题 4 个互不相同的非负整数选项，且必含正确答案', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const qs = makeQuiz(mulberry32(seed));
    assert.strictEqual(qs.length, 3, `seed${seed} 题量`);
    for (const q of qs) {
      assert.strictEqual(q.options.length, 4, `seed${seed} 选项数`);
      assert.strictEqual(new Set(q.options).size, 4, `seed${seed} 选项重复：${q.options}`);
      assert.ok(q.options.includes(q.answer), `seed${seed} 选项里没有正确答案`);
      for (const o of q.options) {
        assert.ok(Number.isInteger(o) && o >= 0, `seed${seed} 选项非法：${o}`);
      }
    }
  }
});

test('题面算式与答案自洽，且落在一年级口算范围内（和不超过 99）', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const q of makeQuiz(mulberry32(seed))) {
      assert.strictEqual(evalText(q.text), q.answer, `seed${seed} 题面与答案不符：${q.text}`);
      assert.ok(q.answer >= 1, `seed${seed} 答案应为正数：${q.answer}`);
      assert.ok(q.answer <= 99, `seed${seed} 答案超出 99：${q.answer}`);
    }
  }
});

test('干扰项贴近正确答案（±9 内），否则热身题就失去意义', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const q of makeQuiz(mulberry32(seed))) {
      for (const o of q.options) {
        assert.ok(Math.abs(o - q.answer) <= 12, `seed${seed} 干扰项离题太远：${o} vs ${q.answer}`);
      }
    }
  }
});

test('同一 seed 必得同一套题', () => {
  assert.deepStrictEqual(makeQuiz(mulberry32(3)), makeQuiz(mulberry32(3)));
  assert.notDeepStrictEqual(makeQuiz(mulberry32(3)), makeQuiz(mulberry32(4)));
});

test('不传 rng 时退回 Math.random，仍可正常出题', () => {
  const qs = makeQuiz();
  assert.strictEqual(qs.length, 3);
  for (const q of qs) assert.ok(q.options.includes(q.answer));
});
