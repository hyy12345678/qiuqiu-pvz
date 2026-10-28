// 重构护栏：证明「搬家阶段」只动了代码位置，没动行为。
//
// 三种模式：
//   默认（快照模式）   当前 src 的规范化行 必须等于 scripts/parity-baseline.txt —— 零容忍。
//                      基线在 P3c 落定（原 legacy 单文件已完成搬家 + 两处已审改动的行为变化），
//                      此后每次改动都会立刻显形；确认过要改行为时用 --rebase 重新盖章。
//   --legacy（溯源模式）与 legacy/ 手写单文件逐行比较。legacy 由 tag pre-refactor-baseline
//                      固定，是「这个重构最初从哪儿搬来」的证据；改动它没有意义，所以差异
//                      靠下面的授权清单逐行豁免，清单之外一律 FAIL。
//                      此模式冻结在 P3c：它证明的是「搬家没改行为」，功能开发开始后就失效了
//                      （新增植物会带来上百行无法逐条列举的合法新增），所以不在 verify 链里。
//   --dist（字节模式）  产物内联脚本必须等于「当前 src 重新打一遍包」的结果，逐字节比较。
//                      不与 legacy 直接比：esbuild 会 const→var、十六进制→十进制、同名符号消歧重命名
//                      （g→g2），拿未打包的 legacy 比打包后的 dist 全是假阳性。
//
// 链条：bundle(src) ≡ 产物（字节） 且 src ≡ 快照（行） ⇒ 产物 ≡ 上次盖章的 src
//
// 用法：
//   node scripts/check-parity.js              # src vs 快照
//   node scripts/check-parity.js --rebase     # 用当前 src 重写快照（确认过行为变化后才用）
//   node scripts/check-parity.js --legacy     # legacy vs src（授权清单模式）
//   node scripts/check-parity.js --dist       # esbuild(src) vs dist 产物内联脚本
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
const SNAPSHOT = path.join(__dirname, 'parity-baseline.txt');
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

// P3c 授权差异：主页「全部关卡」开关 + 修复严格模式下未声明的 `g`（两处都是有意为之的行为变化）。
// 注意 '}' 与 'SFX.click();' 这类通用行按多集合计数豁免，理论上会吞掉一行同名代码；
// 真正兜住行为漂移的是默认的快照模式（零容忍、不做签名归一化）。
const P3C_LEGACY_ONLY = [
  'const locked = i+1 > G.unlocked;',
  'g = ctx.createRadialGradient(mx, my, 1, mx, my, 12);',
  "drawButton(W/2-190, 462, 180, 52, '操作说明', 'help', ()=>{ G.state='help'; SFX.click(); }, {});",
  "drawButton(W/2+10, 462, 180, 52, SFX.musicOn ? '音乐：开' : '音乐：关', 'music', ()=>{ SFX.ensure(); SFX.musicOn = !SFX.musicOn; SFX.click(); }, {});",
];
const P3C_SRC_ONLY = [
  "function loadUnlockAll(){ try{ return localStorage.getItem('pvzweb_unlockall') === '1'; }catch(e){ return false; } }",
  "function saveUnlockAll(on){ try{ if(on) localStorage.setItem('pvzweb_unlockall', '1'); else localStorage.removeItem('pvzweb_unlockall'); }catch(e){} }",
  'unlockAll:loadUnlockAll(),',
  'function toggleUnlockAll(){',
  'G.unlockAll = !G.unlockAll;',
  'saveUnlockAll(G.unlockAll);',
  'SFX.click();',
  '}',
  'const locked = !G.unlockAll && i+1 > G.unlocked;',
  'const g = ctx.createRadialGradient(mx, my, 1, mx, my, 12);',
  "drawButton(W/2-290, 462, 180, 52, '操作说明', 'help', ()=>{ G.state='help'; SFX.click(); }, {});",
  "drawButton(W/2-90, 462, 180, 52, SFX.musicOn ? '音乐：开' : '音乐：关', 'music', ()=>{ SFX.ensure(); SFX.musicOn = !SFX.musicOn; SFX.click(); }, {});",
  "drawButton(W/2+110, 462, 180, 52, G.unlockAll ? '全部关卡：开' : '全部关卡：关', 'unlockall', ()=>toggleUnlockAll(), { size: 18 });",
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

  const files = walkJs(SRC_DIR, []);
  const cur = normalize(files.map(f => fs.readFileSync(f, 'utf8')).join('\n'));

  if (args.has('--legacy')) {
    const base = normalize(extractScript(fs.readFileSync(BASELINE, 'utf8')));
    const { onlyA: a0, onlyB: b0 } = multisetDiff(base, cur);
    const a = consumeAuthorized(a0, AUTHORIZED_LEGACY_ONLY.concat(P3C_LEGACY_ONLY));
    const b = consumeAuthorized(b0, AUTHORIZED_SRC_ONLY.concat(P3C_SRC_ONLY));
    report('parity[legacy]: legacy/植物大战僵尸-网页版.html vs src/**', base.length, cur.length, a, b, verbose);
    return;
  }

  // 默认：当前 src 必须与盖章快照逐行相等。快照本身就是 src 的规范化行，所以没有签名归一化，
  // import/re-export 行也照常参与比较 —— 搬家阶段的任何越界都会显形。
  const snap = fs.existsSync(SNAPSHOT)
    ? fs.readFileSync(SNAPSHOT, 'utf8').split('\n').filter(l => l.length > 0)
    : [];
  if (args.has('--rebase')) {
    const { onlyA, onlyB } = multisetDiff(snap, cur);
    fs.writeFileSync(SNAPSHOT, cur.join('\n') + '\n');
    console.log('已重新盖章 ' + path.relative(ROOT, SNAPSHOT) + '：' + cur.length + ' 行'
      + '（本次吸收差异 移除 ' + onlyA.length + ' / 新增 ' + onlyB.length + '）');
    return;
  }
  if (!fs.existsSync(SNAPSHOT)) {
    console.error('缺少快照 ' + path.relative(ROOT, SNAPSHOT) + '，先跑 node scripts/check-parity.js --rebase');
    process.exit(1);
  }
  const { onlyA, onlyB } = multisetDiff(snap, cur);
  report('parity[snapshot]: scripts/parity-baseline.txt vs src/**', snap.length, cur.length,
    { rest: onlyA, used: 0 }, { rest: onlyB, used: 0 }, verbose,
    '确认过这是想要的改动后：node scripts/check-parity.js --rebase');
}

function report(title, nBase, nCur, a, b, verbose, hint) {
  const onlyA = a.rest, onlyB = b.rest;
  const authorizedUsed = a.used + b.used;
  const limit = verbose ? onlyA.length + onlyB.length : 20;
  console.log(title + '（基线 ' + nBase + ' 行 / 当前 ' + nCur + ' 行）');
  if (onlyA.length === 0 && onlyB.length === 0) {
    console.log('PASS —— 与基线逐行一致，无未登记的改动'
      + (authorizedUsed ? '（已授权 ' + authorizedUsed + ' 行签名/功能变化）' : ''));
    return;
  }
  console.log('FAIL —— 基线独有 ' + onlyA.length + ' 行，当前独有 ' + onlyB.length + ' 行');
  onlyA.slice(0, limit).forEach(l => console.log('  - 丢失: ' + l));
  onlyB.slice(0, limit).forEach(l => console.log('  + 新增: ' + l));
  if (!verbose && (onlyA.length > limit || onlyB.length > limit)) {
    console.log('  （加 --verbose 查看全部 ' + (onlyA.length + onlyB.length) + ' 项差异）');
  }
  if (hint) console.log('  ' + hint);
  process.exitCode = 1;
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
