// 严格源码指纹：按「文件路径 + 原始字节哈希」记录 src/**（含 shell.html）。
//
// 它回答的问题只有一个：源码里有没有未登记的内容变化。
// 它不回答「变化是否正确」，也不替代行为测试 —— 有意搬文件同样会触发，这是接受的代价。
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
const BASELINE = path.join(__dirname, 'source-fingerprint.txt');

function hashContent(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function walk(dir, base, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, base, acc);
    else if (st.isFile()) {
      const rel = path.relative(base, full).split(path.sep).join('/');
      acc.push({ path: rel, hash: hashContent(fs.readFileSync(full)) });
    }
  }
  return acc;
}

function buildManifest(baseDir) {
  return walk(baseDir, baseDir, []).sort((a, b) => a.path.localeCompare(b.path));
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

function main() {
  const update = process.argv.includes('--update');
  const confirm = process.argv.includes('--yes');
  const current = buildManifest(SRC_DIR);

  if (update) {
    const before = fs.existsSync(BASELINE) ? parseManifest(fs.readFileSync(BASELINE, 'utf8')) : [];
    const d = diffManifests(before, current);
    const total = d.added.length + d.missing.length + d.changed.length;

    // E1 D4：盖章是「吸收差异」，不是「验证通过」。没有显式 --yes 时只做 dry-run。
    if (!confirm) {
      console.log('fingerprint[update]: 将重写 ' + path.relative(ROOT, BASELINE)
        + '（基线 ' + before.length + ' 个文件 → 当前 ' + current.length + ' 个）');
      console.log('  本次会吸收：新增 ' + d.added.length + ' / 缺失 ' + d.missing.length + ' / 变化 ' + d.changed.length
        + '，共 ' + total + ' 处');
      for (const p of d.added) console.log('  + ' + p);
      for (const p of d.missing) console.log('  - ' + p);
      for (const p of d.changed) console.log('  ~ ' + p);
      console.log('\n未写入。确认这些变化都属于本次审查范围后：npm run fingerprint:update');
      return 1;
    }

    fs.writeFileSync(BASELINE, formatManifest(current));
    console.log('已重写 ' + path.relative(ROOT, BASELINE) + '：' + current.length + ' 个文件'
      + '（本次吸收 新增 ' + d.added.length + ' / 缺失 ' + d.missing.length + ' / 变化 ' + d.changed.length + '）');
    return 0;
  }

  if (!fs.existsSync(BASELINE)) {
    console.error('缺少指纹基线 ' + path.relative(ROOT, BASELINE) + '，先跑 npm run fingerprint:update');
    return 1;
  }
  const expected = parseManifest(fs.readFileSync(BASELINE, 'utf8'));
  const d = diffManifests(expected, current);
  console.log('fingerprint: src/** 原始内容哈希 vs ' + path.relative(ROOT, BASELINE)
    + '（基线 ' + expected.length + ' 个文件 / 当前 ' + current.length + ' 个）');
  if (!d.added.length && !d.missing.length && !d.changed.length) {
    console.log('PASS —— 没有未登记的源码变化');
    return 0;
  }
  console.log('FAIL —— 发现未登记的源码变化');
  for (const p of d.added) console.log('  + 新增文件: ' + p);
  for (const p of d.missing) console.log('  - 缺失文件: ' + p);
  for (const p of d.changed) console.log('  ~ 内容变化: ' + p);
  console.log('  确认这些变化属于本次审查范围后：npm run fingerprint:update');
  return 1;
}

module.exports = { hashContent, buildManifest, formatManifest, parseManifest, diffManifests, srcDigest };

if (require.main === module) {
  process.exitCode = main();
}
