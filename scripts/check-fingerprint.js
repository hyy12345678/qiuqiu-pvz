// 严格指纹：按「文件路径 + 原始字节哈希」记录两份清单。
//
//   1. src/**（含 shell.html）        → scripts/source-fingerprint.txt
//   2. scripts/**（排除 *.txt 基线）  → scripts/tool-fingerprint.txt
//
// 它回答的问题只有一个：有没有未登记的内容变化。
// 它不回答「变化是否正确」，也不替代行为测试 —— 有意搬文件同样会触发，这是接受的代价。
//
// E6 为什么加上第二份：护栏自己原本没有护栏。改 scripts/check-parity.js 让它恒真、
// 或改 check-fingerprint.js 少扫一个目录，原来都不会被任何检查发现。现在会。
// 排除 *.txt 是必须的：三份基线就住在 scripts/ 里，把它们哈希进自己的基线会形成自指。
//
// 与 check-parity.js 的分工：
//   parity   = 规范化行的多集合，适合搬家阶段核对行内容增删，不保序、不过滤之外的 import 关系
//   fingerprint = 原始内容哈希，任何字节变化（含换行符、空白、import、文件边界）都会显形
//
// 用法：
//   node scripts/check-fingerprint.js                  # 验证，不写文件
//   node scripts/check-fingerprint.js --update         # dry-run：只打印「将吸收哪些差异」，不写文件，退出码 1
//   node scripts/check-fingerprint.js --update --yes   # 确认后重写基线
// 不带 --yes 不允许写基线（E1 D4）：盖章是吸收差异，不等于验证通过。
// npm run fingerprint:update 已封装为「先 npm test 全绿，再 --update --yes」。
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const TOOL_DIR = path.join(__dirname);
const BASELINE = path.join(__dirname, 'source-fingerprint.txt');
const TOOL_BASELINE = path.join(__dirname, 'tool-fingerprint.txt');

// 基线文件本身不能进清单，否则每次重盖都会改变被哈希的内容，永远对不上。
const isBaselineFile = name => name.endsWith('.txt');

function hashContent(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function walk(dir, base, acc, filter) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, base, acc);
    else if (st.isFile()) {
      if (filter && !filter(name, full)) continue;
      const rel = path.relative(base, full).split(path.sep).join('/');
      acc.push({ path: rel, hash: hashContent(fs.readFileSync(full)) });
    }
  }
  return acc;
}

// filter 可选：只影响「哪些文件进清单」，不影响路径口径。src 侧不传，scripts 侧排除 *.txt。
function buildManifest(baseDir, filter) {
  return walk(baseDir, baseDir, [], filter).sort((a, b) => a.path.localeCompare(b.path));
}

function formatManifest(entries) {
  return entries.map(e => e.hash + '  ' + e.path).join('\n') + '\n';
}

function parseManifest(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const m = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
    if (!m) throw new Error('指纹基线格式非法：' + line);
    out.push({ hash: m[1], path: m[2] });
  }
  return out;
}

function diffManifests(expected, actual) {
  const exp = new Map(expected.map(e => [e.path, e.hash]));
  const act = new Map(actual.map(e => [e.path, e.hash]));
  const added = [], missing = [], changed = [];
  for (const [p, h] of act) {
    if (!exp.has(p)) added.push(p);
    else if (exp.get(p) !== h) changed.push(p);
  }
  for (const p of exp.keys()) if (!act.has(p)) missing.push(p);
  return { added, missing, changed };
}

// 源码摘要：把清单（路径 + 逐文件 sha256）再哈希一次并截断，得到一个「这份源码是谁」的稳定短标识。
// 构建戳用它回答「产物是不是当前源码构建的」——它不随 HEAD 漂移，因此提交前后一致，见 E1 文档 D3。
function srcDigest(baseDir, len = 8) {
  const manifest = buildManifest(baseDir);
  const joined = manifest.map(e => e.path + '\0' + e.hash).join('\n');
  return hashContent(Buffer.from(joined, 'utf8')).slice(0, len);
}

// 两份清单：(源码, src/**, 不过滤) 与 (护栏工具, scripts/**, 排除 *.txt)。
function guardSets() {
  return [
    { label: '源码', dir: SRC_DIR, baseline: BASELINE, filter: undefined },
    { label: '护栏工具', dir: TOOL_DIR, baseline: TOOL_BASELINE, filter: name => !isBaselineFile(name) },
  ];
}

function readBaseline(file) {
  return fs.existsSync(file) ? parseManifest(fs.readFileSync(file, 'utf8')) : [];
}

function main() {
  const update = process.argv.includes('--update');
  const confirm = process.argv.includes('--yes');
  const sets = guardSets().map(s => {
    const before = readBaseline(s.baseline);
    const current = buildManifest(s.dir, s.filter);
    return { ...s, before, current, diff: diffManifests(before, current) };
  });

  if (update) {
    let total = 0;
    for (const s of sets) total += s.diff.added.length + s.diff.missing.length + s.diff.changed.length;

    // E1 D4：盖章是「吸收差异」，不是「验证通过」。没有显式 --yes 时只做 dry-run。
    if (!confirm) {
      for (const s of sets) {
        console.log('fingerprint[update]: 将重写 ' + path.relative(ROOT, s.baseline) + '（' + s.label
          + '，基线 ' + s.before.length + ' 个文件 → 当前 ' + s.current.length + ' 个）');
        console.log('  本次会吸收：新增 ' + s.diff.added.length + ' / 缺失 ' + s.diff.missing.length
          + ' / 变化 ' + s.diff.changed.length);
        for (const p of s.diff.added) console.log('  + ' + p);
        for (const p of s.diff.missing) console.log('  - ' + p);
        for (const p of s.diff.changed) console.log('  ~ ' + p);
      }
      console.log('\n未写入（共 ' + total + ' 处差异）。确认这些变化都属于本次审查范围后：npm run fingerprint:update');
      return 1;
    }

    for (const s of sets) {
      fs.writeFileSync(s.baseline, formatManifest(s.current));
      console.log('已重写 ' + path.relative(ROOT, s.baseline) + '：' + s.current.length + ' 个文件'
        + '（本次吸收 新增 ' + s.diff.added.length + ' / 缺失 ' + s.diff.missing.length + ' / 变化 ' + s.diff.changed.length + '）');
    }
    return 0;
  }

  let failed = false;
  for (const s of sets) {
    if (!fs.existsSync(s.baseline)) {
      console.error('缺少指纹基线 ' + path.relative(ROOT, s.baseline) + '，先跑 npm run fingerprint:update');
      return 1;
    }
    console.log('fingerprint: ' + s.label + '（' + path.relative(ROOT, s.dir) + '/**）原始内容哈希 vs '
      + path.relative(ROOT, s.baseline) + '（基线 ' + s.before.length + ' 个文件 / 当前 ' + s.current.length + ' 个）');
    const d = s.diff;
    if (!d.added.length && !d.missing.length && !d.changed.length) {
      console.log('  PASS —— 没有未登记的' + s.label + '变化');
      continue;
    }
    failed = true;
    console.log('  FAIL —— 发现未登记的' + s.label + '变化');
    for (const p of d.added) console.log('    + 新增文件: ' + p);
    for (const p of d.missing) console.log('    - 缺失文件: ' + p);
    for (const p of d.changed) console.log('    ~ 内容变化: ' + p);
  }
  if (failed) {
    console.log('  确认这些变化属于本次审查范围后：npm run fingerprint:update');
    return 1;
  }
  return 0;
}

module.exports = { hashContent, buildManifest, formatManifest, parseManifest, diffManifests, srcDigest };

if (require.main === module) {
  process.exitCode = main();
}
