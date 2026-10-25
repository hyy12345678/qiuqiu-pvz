// 重构护栏：对比重构基线（legacy）与当前源码/产物，证明某一阶段只做了代码移动。
//
// 两种模式：
//   默认（src 模式）   逐行规范化后比较 —— 严格，适用于 source-to-source 搬迁
//   --dist（token 模式）
//                      先把 legacy 脚本体过**同一个 esbuild 配置**得到基线 bundle，再和 dist 内联脚本比
//                      token。直接拿「未打包的 legacy」比「打包后的 dist」是不对的：esbuild 会做
//                      const→var、0x..→十进制、同名符号消歧重命名（g→g2），全是假阳性。
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
const { escapeForInline } = require('./inline');

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

const MODULE_LINE = /^\s*(import|export\s+(default\s+)?[({*]|export\s+(const|let|var|function|class|async)\b)/;

// esbuild 的 iife 包装必然引入的这些 token 不参与比较
const WRAPPER_TOKENS = new Set(['use strict', 'function', 'void', 'arguments']);

function normalize(src) {
  return stripComments(src)
    .split('\n')
    .map(l => l.trim().replace(/\s+/g, ' '))
    .filter(l => l.length > 0)
    // 模块化必然新增的行：import 语句、export 关键字、装配入口的 require
    .filter(l => !MODULE_LINE.test(l))
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

// 用与构建完全相同的 esbuild 配置打包一段源码文本，作为 dist 模式的基线侧。
async function bundleStdin(code) {
  const r = await esbuild.build({
    ...esbuildOpts([]),
    stdin: { contents: code, loader: 'js', resolveDir: ROOT },
    write: false,
  });
  return r.outputFiles[0].text;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const verbose = args.has('--verbose');
  const useDist = args.has('--dist');
  const unit = useDist ? 'token' : '行';

  const legacyBody = extractScript(fs.readFileSync(BASELINE, 'utf8'));
  let base, cur, curLabel;
  if (useDist) {
    // 两侧都做同样的「内联转义」，否则字符串里的 </script 只在 dist 侧被改写，会报假差异
    base = normalizeTokens(escapeForInline(await bundleStdin(legacyBody)));
    curLabel = 'dist/植物大战僵尸-网页版.html 内联脚本';
    cur = normalizeTokens(extractScript(fs.readFileSync(DIST, 'utf8')));
  } else {
    base = normalize(legacyBody);
    curLabel = 'src/** 源码';
    const files = walkJs(SRC_DIR, []);
    cur = normalize(files.map(f => fs.readFileSync(f, 'utf8')).join('\n'));
  }

  const { onlyA, onlyB } = multisetDiff(base, cur);
  const limit = verbose ? onlyA.length + onlyB.length : 20;

  console.log('parity[' + (useDist ? 'token' : 'line') + ']: legacy(' + base.length + ' ' + unit
    + ') vs ' + curLabel + '(' + cur.length + ' ' + unit + ')');
  if (onlyA.length === 0 && onlyB.length === 0) {
    console.log('PASS —— 无逻辑差异，本阶段仅为代码移动');
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
