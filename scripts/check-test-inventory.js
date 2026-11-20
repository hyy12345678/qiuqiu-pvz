// 测试清单下限：记录每个测试文件里 test( 声明的条数，只允许增、不允许减。
//
// 为什么需要：tests/ 故意不进 fingerprint（改测试是常态，全量哈希会让每次改测试都要盖章，
// 而重盖越频繁人越会无脑盖章）。但「删掉测试让 CI 变绿」是最廉价的作弊方式，
// 在这之前没有任何检查能发现。
//
// 两个设计选择：
//   1. 清单是 scripts/test-inventory.json，不是 .txt —— 因为 E6 的工具指纹排除了 *.txt，
//      只有放在 .json 里才能被护栏工具指纹一起保护：想调低下限，先过 fingerprint 那一关。
//   2. 下限语义而非精确匹配 —— 加测试永远不用重盖；只有「减少」才会红。
//
// 用法：
//   node scripts/check-test-inventory.js                  # 验证
//   node scripts/check-test-inventory.js --update         # dry-run：只打印将吸收的差异
//   node scripts/check-test-inventory.js --update --yes   # 确认后重写下限
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');
const BASELINE = path.join(__dirname, 'test-inventory.json');

// 只数「测试声明」，不数运行时用例数：后者会被循环放大（例如绘制基线一条声明生成五条用例），
// 作为下限指标不稳定。声明数对「有没有人删测试」这个问题的分辨率已经足够。
const CASE_RE = /^\s*test\s*\(/gm;

function listTestFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) listTestFiles(full, acc);
    else if (name.endsWith('.test.mjs')) acc.push(full);
  }
  return acc;
}

function countTests(file) {
  const found = fs.readFileSync(file, 'utf8').match(CASE_RE);
  return found ? found.length : 0;
}

function buildInventory() {
  const files = listTestFiles(TESTS_DIR).map(full => ({
    path: path.relative(ROOT, full).split(path.sep).join('/'),
    count: countTests(full),
  }));
  return { files, total: files.reduce((a, f) => a + f.count, 0) };
}

function compareInventory(expected, actual) {
  const exp = new Map(expected.files.map(f => [f.path, f.count]));
  const act = new Map(actual.files.map(f => [f.path, f.count]));
  const removed = [], shrunk = [], added = [];
  for (const [p, n] of exp) {
    if (!act.has(p)) removed.push({ path: p, count: n });
    else if (act.get(p) < n) shrunk.push({ path: p, expected: n, actual: act.get(p) });
  }
  for (const p of act.keys()) if (!exp.has(p)) added.push(p);
  return {
    removed, shrunk, added,
    totalExpected: expected.total,
    totalActual: actual.total,
    ok: removed.length === 0 && shrunk.length === 0 && actual.total >= expected.total,
  };
}

function report(d) {
  for (const r of d.removed) console.log('  - 测试文件消失: ' + r.path + '（下限 ' + r.count + ' 条）');
  for (const s of d.shrunk) console.log('  ~ 用例数减少: ' + s.path + '（下限 ' + s.expected + ' → 实际 ' + s.actual + '）');
  for (const a of d.added) console.log('  + 新增测试文件（未登记，不影响下限）: ' + a);
  console.log('  合计：下限 ' + d.totalExpected + ' 条 / 当前 ' + d.totalActual + ' 条');
}

function main() {
  const update = process.argv.includes('--update');
  const confirm = process.argv.includes('--yes');
  const actual = buildInventory();

  if (update) {
    const expected = fs.existsSync(BASELINE)
      ? JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
      : { files: [], total: 0 };
    const d = compareInventory(expected, actual);
    if (!confirm) {
      console.log('test-inventory[update]: 将重写 ' + path.relative(ROOT, BASELINE)
        + '（下限 ' + expected.total + ' 条 → 当前 ' + actual.total + ' 条）');
      report(d);
      console.log('\n未写入。确认后：npm run test:inventory:update');
      return 1;
    }
    fs.writeFileSync(BASELINE, JSON.stringify(actual, null, 2) + '\n');
    console.log('已重写 ' + path.relative(ROOT, BASELINE) + '：' + actual.files.length + ' 个文件 / ' + actual.total + ' 条');
    return 0;
  }

  if (!fs.existsSync(BASELINE)) {
    console.error('缺少测试清单 ' + path.relative(ROOT, BASELINE) + '，先跑 npm run test:inventory:update');
    return 1;
  }
  const expected = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const d = compareInventory(expected, actual);
  console.log('test-inventory: 测试声明条数 vs ' + path.relative(ROOT, BASELINE)
    + '（下限 ' + d.totalExpected + ' 条 / 当前 ' + d.totalActual + ' 条，共 ' + actual.files.length + ' 个文件）');
  if (d.ok) {
    console.log('PASS —— 没有测试被删除或减少');
    return 0;
  }
  console.log('FAIL —— 测试清单比下限少');
  report(d);
  console.log('  确认这是有意的删除后：npm run test:inventory:update');
  return 1;
}

module.exports = { CASE_RE, listTestFiles, countTests, buildInventory, compareInventory };

if (require.main === module) {
  process.exitCode = main();
}
