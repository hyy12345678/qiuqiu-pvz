// 测试清单下限：记录每个测试文件里 test( 声明的条数，只允许增、不允许减。
//
// 为什么需要：tests/ 故意不进 fingerprint（改测试是常态，全量哈希会让每次改测试都要盖章，
// 而重盖越频繁人越会无脑盖章）。但「删掉测试让 CI 变绿」是最廉价的作弊方式，
// 在这之前没有任何检查能发现。
//
// 三个设计选择：
//   1. 清单是 scripts/test-inventory.json，不是 .txt —— 因为 E6 的工具指纹排除了 *.txt，
//      只有放在 .json 里才能被护栏工具指纹一起保护：想调低下限，先过 fingerprint 那一关。
//   2. 下限语义而非精确匹配 —— 加测试永远不用重盖；只有「减少」才会红。
//   3. 清单里同时记「每个文件的条数」和「被数过哪些文件」——第二份用来发现单测套件
//      根本没跑到某个目录。E25 前 npm test 用 tests/*.test.mjs（只匹配顶层），
//      tests/browser/ 下 2 个测试文件、34 条 trace 基线都不在任何单测链条里，
//      而按路径记的清单对「压根没访问」和「一致」给出同样的沉默。
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
const BROWSER_DIR = path.join(TESTS_DIR, 'browser');
const BASELINE = path.join(__dirname, 'test-inventory.json');

// 只数「测试声明」，不数运行时用例数：后者会被循环放大（例如绘制基线一条声明生成五条用例），
// 作为下限指标不稳定。声明数对「有没有人删测试」这个问题的分辨率已经足够。
// 单位词边界很重要：`retest(` 不能被算成一条测试。
const CASE_RE = /^\s*test\s*\(/gm;

// 单测套件实际吃到的文件集合，直接读 package.json 的脚本，而不是在任何地方再写一遍 glob：
// 各包管理器（npm / pnpm）把参数原样交给 sh，所以这里用 sh 展开即可，与真实命令逐字一致。
// npm 自身会往命令里塞环境变量前缀，因此不能用 node -e，独立成脚本由 bash 调用最可靠。
const UNIT_SCRIPT = 'test';
const BROWSER_SCRIPT = 'test:browser';

function expandGlob(pattern) {
  const { execFileSync } = require('child_process');
  const out = execFileSync('sh', ['-c', 'printf "%s\\n" ' + pattern], { cwd: ROOT })
    .toString('utf8').split('\n').filter(Boolean);
  return out.map(p => path.resolve(ROOT, p)).filter(f => fs.existsSync(f));
}

function scriptsConsumedFiles() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const pick = name => {
    const cmd = pkg.scripts && pkg.scripts[name];
    if (!cmd) return [];
    const m = /node --test\s+(\S+(?:\s+\S+)*)/.exec(cmd);
    if (!m) return [];
    const files = [];
    for (const tok of m[1].split(/\s+/)) {
      if (tok.includes('*')) files.push(...expandGlob(tok));
      else if (tok.endsWith('.mjs')) files.push(path.resolve(ROOT, tok));
    }
    return [...new Set(files)];
  };
  return { unit: pick(UNIT_SCRIPT), browser: pick(BROWSER_SCRIPT) };
}

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

// 全部测试文件（含浏览器目录）→ 用于「有没有文件被悄悄少算」的比对。
function buildInventory() {
  const files = listTestFiles(TESTS_DIR).map(full => ({
    path: path.relative(ROOT, full).split(path.sep).join('/'),
    count: countTests(full),
  }));
  // covered：单测套件（npm test）真的会执行到的测试文件。浏览器基线另有一份自己的入口，
  // 两者分开记——把浏览器基线塞进 npm test 只会让「单测全绿」变慢并且不再等于「规则全绿」。
  const consumed = scriptsConsumedFiles();
  const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
  const covered = consumed.unit.map(rel).sort();
  const browser = consumed.browser.map(rel).sort();
  return {
    files,
    total: files.reduce((a, f) => a + f.count, 0),
    covered,
    browser,
    browserBaselines: fs.existsSync(BROWSER_DIR)
      ? fs.readdirSync(path.join(BROWSER_DIR, 'baselines')).filter(n => n.endsWith('.trace.txt')).sort()
      : [],
  };
}

// 覆盖差异：基线里「被单测套件覆盖」的文件少了，说明某个测试文件整体脱离了执行链
// （例如有人把 tests/*.test.mjs 改成更窄的 glob）。这比「某文件少了一条 test(」更隐蔽：
// 用例数没变，但因为整个文件不再运行，一条都没跑。
function compareCoverage(expected, actual) {
  const exp = new Set(expected.covered || []);
  const act = new Set(actual.covered || []);
  const dropped = [...exp].filter(p => !act.has(p));
  const gained = [...act].filter(p => !exp.has(p));
  const expBrowser = new Set(expected.browser || []);
  const actBrowser = new Set(actual.browser || []);
  const browserDropped = [...expBrowser].filter(p => !actBrowser.has(p));
  const expBaselines = new Set(expected.browserBaselines || []);
  const actBaselines = new Set(actual.browserBaselines || []);
  const baselinesDropped = [...expBaselines].filter(p => !actBaselines.has(p));
  const baselinesAdded = [...actBaselines].filter(p => !expBaselines.has(p));
  return { dropped, gained, browserDropped, baselinesDropped, baselinesAdded };
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
  const coverage = compareCoverage(expected, actual);
  return {
    removed, shrunk, added, coverage,
    totalExpected: expected.total,
    totalActual: actual.total,
    ok: removed.length === 0 && shrunk.length === 0 && actual.total >= expected.total
      && coverage.dropped.length === 0 && coverage.browserDropped.length === 0
      && coverage.baselinesDropped.length === 0,
  };
}

function report(d) {
  for (const r of d.removed) console.log('  - 测试文件消失: ' + r.path + '（下限 ' + r.count + ' 条）');
  for (const s of d.shrunk) console.log('  ~ 用例数减少: ' + s.path + '（下限 ' + s.expected + ' → 实际 ' + s.actual + '）');
  for (const a of d.added) console.log('  + 新增测试文件（未登记，不影响下限）: ' + a);
  for (const p of d.coverage.dropped) console.log('  ! 脱离单测执行链: ' + p + '（用例数没变，但 npm test 不再跑它）');
  for (const p of d.coverage.browserDropped) console.log('  ! 脱离浏览器执行链: ' + p);
  for (const p of d.coverage.baselinesDropped) console.log('  ! 绘制轨迹基线消失: ' + p);
  for (const p of d.coverage.baselinesAdded) console.log('  + 新增绘制轨迹基线: ' + p);
  console.log('  合计：下限 ' + d.totalExpected + ' 条 / 当前 ' + d.totalActual + ' 条；'
    + '单测覆盖 ' + (d.coverage.dropped.length ? '有文件脱离' : '完整') + '，浏览器基线 '
    + (d.coverage.baselinesDropped.length ? '有缺失' : '完整'));
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

module.exports = {
  CASE_RE, listTestFiles, countTests, buildInventory, compareInventory, compareCoverage,
  scriptsConsumedFiles, expandGlob,
};

if (require.main === module) {
  process.exitCode = main();
}
