// 重构护栏：对比重构基线（legacy）与当前源码/产物，证明某一阶段只做了代码移动。
//
// 两种模式：
//   默认（src 模式）   逐行规范化后比较 —— 严格，适用于 source-to-source 搬迁
//   --dist（字节模式）  产物内联脚本必须等于「当前 src 重新打一遍包」的结果，逐字节比较。
//                      不与 legacy 直接比：esbuild 会 const→var、十六进制→十进制、同名符号消歧重命名
//                      （g→g2），拿未打包的 legacy 比打包后的 dist 全是假阳性。
//                      链条：legacy ≡ src（行级） 且 bundle(src) ≡ 产物（字节级） ⇒ 产物 ≡ legacy
//
// 用法：
//   node scripts/check-parity.js              # legacy vs src/**
//   node scripts/check-parity.js --dist       # esbuild(legacy) vs dist 产物内联脚本
//   node scripts/check-parity.js --verbose    # 打印全部差异
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { esbuildOpts } = require('./esbuild-opts');
const { escapeForInline, ENTRY } = require('./inline');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(ROOT, 'legacy', '植物大战僵尸-网页版.html');
const DIST = path.join(ROOT, 'dist', '植物大战僵尸-网页版.html');
const SRC_DIR = path.join(ROOT, 'src');
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'legacy', 'scripts', 'tests', 'docs']);

function extractScript(html) {
  const parts = html.split('<script>');
  if (parts.length < 2) throw new Error('未找到 <script> 块');
  return parts.slice(1).map(p => p.split('</script>')[0]).join('\n');
}

// 手写扫描器：只有当前引号字符才结束字符串，因此 'a "b' 这类混用是安全的。
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let q = null;               // 当前字符串定界符
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += d === undefined ? '' : d; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += '\n'; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; out += '\n'; continue; }
    out += c; i++;
  }
  return out;
}

// 只有「纯模块化样板」可以整行忽略：import 语句、以及 re-export 形式。
// `export const/function …` 必须剥掉关键字后照常参与比较，否则整行逃逸检查，
// 单行函数（如 loadUnlocked）里的改动就看不见了。
const IMPORT_LINE = /^(import\b|export\s+(default\s+)?[({*])/;

// esbuild 的 iife 包装必然引入的这些 token 不参与比较
const WRAPPER_TOKENS = new Set(['use strict', 'function', 'void', 'arguments']);

// P2 授权差异：方案 §6-P2 约定的唯一一处「行为等价但签名变化」——
// 波次与题目的随机源从 Math.random 改为可注入的 rng（默认值仍是 Math.random）。
// 逐行精确列举：任何其它差异一律 FAIL，新增可注入点也必须先来这里挂号。
const AUTHORIZED_LEGACY_ONLY = [
  'function makeQuiz(){',
  'if(Math.random() < 0.5){',
  'function shuffle(arr){',
  'const j = randi(0, i);',
  'shuffle(opts);',
  'function pickType(lv, prog){',
  'function buildSpawns(lv){',
  'let sum = pool.reduce((a,p)=>a+p[1],0), r = Math.random()*sum;',
  'if(progress > 0.15) size += (Math.random() < 0.26 + 0.3*progress ? 1 : 0);',
  'if(progress > 0.55) size += (Math.random() < 0.35 ? 1 : 0);',
  "const type = spawned < 3 ? 'normal' : pickType(lv, Math.max(0, progress-0.2));",
  "ev.push({ t: finalT + k*0.4, type: k===0 ? 'flag' : pickType(lv, 1) });",
];
const AUTHORIZED_SRC_ONLY = [
  'function makeQuiz(rng = Math.random){',
  'const randi = (a, b) => Math.floor(a + rng() * (b - a + 1));',
  'if(rng() < 0.5){',
  'function shuffle(arr, rng = Math.random){',
  'const j = Math.floor(rng() * (i + 1));',
  'shuffle(opts, rng);',
  'function pickType(lv, prog, rng){',
  'let sum = pool.reduce((a,p)=>a+p[1],0), r = rng()*sum;',
  'function buildSpawns(lv, rng = Math.random){',
  'const rand = (a, b) => a + rng() * (b - a);',
  'if(progress > 0.15) size += (rng() < 0.26 + 0.3*progress ? 1 : 0);',
  'if(progress > 0.55) size += (rng() < 0.35 ? 1 : 0);',
  "const type = spawned < 3 ? 'normal' : pickType(lv, Math.max(0, progress-0.2), rng);",
  "ev.push({ t: finalT + k*0.4, type: k===0 ? 'flag' : pickType(lv, 1, rng) });",
];

function normalize(src) {
  return stripComments(src)
    .split('\n')
    .map(l => l.trim().replace(/\s+/g, ' '))
    .filter(l => l.length > 0)
    .filter(l => !IMPORT_LINE.test(l))
    .map(l => l.replace(/^export\s+default\s+/, '').replace(/^export\s+/, ''))
    .filter(l => l.length > 0)
    .sort();
}

// token 模式：丢掉标点与换行，只保留标识符 / 数字 / 字符串内容，排序后比多集合。
// 打包器对字面量与声明关键字的无害改写，比较前统一归一化：
//   1000 ↔ 1e3、0.30 ↔ 0.3、1.0 ↔ 1、.5 ↔ 0.5           → 按数值比较
//   顶层 const/let → var（esbuild iife 的已知行为；本文件所有顶层声明都是先赋值后使用，
//                        TDZ 差异无实际影响，故视作等价并在此注明）
const DECL_KEYWORDS = new Set(['const', 'let', 'var']);

// esbuild 会给同名符号加后缀消歧（paintBattleBG 里的 `const g` → `g2`），
// 因此标识符去掉尾部数字后再比：两侧同样处理，y0/y1 合并成 y 是无害的对称弱化。
function canonIdent(s) { return DECL_KEYWORDS.has(s) ? 'var' : s.replace(/\d+$/, ''); }

function normalizeTokens(src) {
  const clean = stripComments(src);
  const out = [];
  const re = /([A-Za-z_$][\w$]*)|((?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(`(?:[^`\\]|\\.)*`)/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    if (m[1] !== undefined) out.push(canonIdent(m[1]));
    else if (m[2] !== undefined) out.push(String(Number(m[2])));
    else out.push(m[0].slice(1, -1));        // 字符串只比内容，忽略引号风格
  }
  return out.filter(t => !WRAPPER_TOKENS.has(t)).sort();
}

function walkJs(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(name)) walkJs(p, acc);
    } else if (name.endsWith('.js')) {
      acc.push(p);
    }
  }
  return acc;
}

function multisetDiff(a, b) {
  const cnt = new Map();
  for (const l of a) cnt.set(l, (cnt.get(l) || 0) + 1);
  for (const l of b) cnt.set(l, (cnt.get(l) || 0) - 1);
  const onlyA = [], onlyB = [];
  for (const [l, c] of cnt) {
    for (let k = 0; k < Math.abs(c); k++) (c > 0 ? onlyA : onlyB).push(l);
  }
  return { onlyA: onlyA.sort(), onlyB: onlyB.sort() };
}

// 与 scripts/build.js 完全相同的配置重新打一遍包 —— 配置一旦漂移，这个检查就失去意义，
// 所以 esbuildOpts 与 ENTRY 都必须从构建侧共享的模块里取。
async function bundleEntry() {
  const r = await esbuild.build({ ...esbuildOpts([ENTRY]), write: false, outbase: path.join(ROOT, 'src') });
  return { outputText: r.outputFiles[0].text };
}

// 消耗掉「已授权」的差异行；剩余任何一项都仍然是 FAIL。
function consumeAuthorized(list, authorized) {
  const allow = new Map();
  for (const l of authorized) allow.set(l, (allow.get(l) || 0) + 1);
  const rest = [];
  for (const l of list) {
    const n = allow.get(l) || 0;
    if (n > 0) { allow.set(l, n - 1); continue; }
    rest.push(l);
  }
  return { rest, used: list.length - rest.length };
}

// dist 模式：产物内联脚本必须与「当前 src 的 bundle」逐字节一致（只允许可可证伪的构建戳差异）。
// 这一侧不再扯上 legacy —— 源码是否忠实由 line 模式单独负责，两者串起来就是完整链条：
//   legacy ≡ src（行级）  且  bundle(src) ≡ 产物（字节级）  ⇒  产物 ≡ legacy
async function checkDist() {
  const expected = escapeForInline((await bundleEntry()).outputText);
  const raw = extractScript(fs.readFileSync(DIST, 'utf8')).replace(/^\s*\/\* build:[\s\S]*?\*\/\n/, '');
  const actual = raw.trim();
  console.log('parity[byte]: esbuild(src/main.js) vs dist/植物大战僵尸-网页版.html 内联脚本');
  if (actual === expected.trim()) {
    console.log('PASS —— 产物与当前源码的 bundle 逐字节一致（' + (expected.length / 1024).toFixed(1) + ' KB）');
    return true;
  }
  let i = 0;
  while (i < Math.min(actual.length, expected.length) && actual[i] === expected[i]) i++;
  const cut = s => JSON.stringify(s.slice(Math.max(0, i - 60), i + 60));
  console.log('FAIL —— 首个差异在第 ' + i + ' 字符');
  console.log('  期望: ' + cut(expected));
  console.log('  实际: ' + cut(actual));
  const { onlyA, onlyB } = multisetDiff(normalizeTokens(expected), normalizeTokens(actual));
  if (onlyA.length || onlyB.length) {
    console.log('  token 层面：bundle 独有 ' + onlyA.length + '，产物独有 ' + onlyB.length);
    onlyA.slice(0, 10).forEach(t => console.log('    - ' + t));
    onlyB.slice(0, 10).forEach(t => console.log('    + ' + t));
  }
  return false;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const verbose = args.has('--verbose');
  if (args.has('--dist')) {
    process.exitCode = (await checkDist()) ? 0 : 1;
    return;
  }

  const unit = '行';
  const base = normalize(extractScript(fs.readFileSync(BASELINE, 'utf8')));
  const curLabel = 'src/** 源码';
  const files = walkJs(SRC_DIR, []);
  const cur = normalize(files.map(f => fs.readFileSync(f, 'utf8')).join('\n'));

  const { onlyA: a0, onlyB: b0 } = multisetDiff(base, cur);
  const a = consumeAuthorized(a0, AUTHORIZED_LEGACY_ONLY);
  const b = consumeAuthorized(b0, AUTHORIZED_SRC_ONLY);
  const onlyA = a.rest, onlyB = b.rest;
  const authorizedUsed = a.used + b.used;
  const limit = verbose ? onlyA.length + onlyB.length : 20;

  console.log('parity[line]: legacy(' + base.length + ' ' + unit
    + ') vs ' + curLabel + '(' + cur.length + ' ' + unit + ')');
  if (onlyA.length === 0 && onlyB.length === 0) {
    console.log('PASS —— 无逻辑差异，本阶段仅为代码移动'
      + (authorizedUsed ? '（已授权 ' + authorizedUsed + ' 行 rng 注入签名变化）' : ''));
    return;
  }
  console.log('FAIL —— 基线独有 ' + onlyA.length + ' ' + unit + '，当前独有 ' + onlyB.length + ' ' + unit);
  onlyA.slice(0, limit).forEach(l => console.log('  - 丢失: ' + l));
  onlyB.slice(0, limit).forEach(l => console.log('  + 新增: ' + l));
  if (!verbose && (onlyA.length > limit || onlyB.length > limit)) {
    console.log('  （加 --verbose 查看全部 ' + (onlyA.length + onlyB.length) + ' 项差异）');
  }
  process.exitCode = 1;
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
