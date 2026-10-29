import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if(e.isDirectory()) return walk(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

const rel = f => path.relative(SRC, f).split(path.sep).join('/');
const files = walk(SRC).map(f => ({ file: f, rel: rel(f), text: fs.readFileSync(f, 'utf8') }));

function importsOf(entry){
  const out = [];
  const re = /\b(?:import|export)\s+(?:([^;'"()]+?)\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while((m = re.exec(entry.text))){
    const clause = (m[1] || '').trim();
    const named = clause.match(/^\{([^}]*)\}$/);
    const names = named
      ? named[1].split(',').map(part => part.trim().split(/\s+as\s+/)[0]).filter(Boolean)
      : ['*'];
    out.push({ spec: m[2], names });
  }
  for(const m of entry.text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)){
    out.push({ spec: m[1], names: ['*'] });
  }
  return out;
}

function resolve(fromRel, spec){
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
}

const forbiddenRender = ['audio/', 'platform/', 'core/sim.js', 'ui/input.js', 'game.js', 'main.js'];
const isForbiddenRender = to => forbiddenRender.some(x => x.endsWith('/') ? to.startsWith(x) : to === x);
const targetAssignment = /(?<![\w$.])(?:ctx|DPR)\s*(?:=(?!=)|\+=|-=|\*=|\/=|\?\?=|&&=|\|\|=|\+\+|--)/;

test('边界扫描器识别目录、具名别名、命名空间、转导出与字面量动态导入', () => {
  for(const to of ['audio/sfx.js', 'platform/persist.js', 'core/sim.js', 'game.js']){
    assert.ok(isForbiddenRender(to), to);
  }
  assert.ok(!isForbiddenRender('core/util.js'));
  const imports = importsOf({ text: `
    import { inspectUseCard as inspect,\n useCard } from '../core/actions.js';
    import * as actions from '../core/actions.js';
    export { SFX } from '../audio/sfx.js';
    import '../platform/persist.js';
    const sim = import('../core/sim.js');
  ` });
  assert.deepEqual(imports, [
    { spec: '../core/actions.js', names: ['inspectUseCard', 'useCard'] },
    { spec: '../core/actions.js', names: ['*'] },
    { spec: '../audio/sfx.js', names: ['SFX'] },
    { spec: '../platform/persist.js', names: ['*'] },
    { spec: '../core/sim.js', names: ['*'] },
  ]);
});

test('边界扫描器识别声明和行内 target 赋值，但不拦截 Canvas 属性写入', () => {
  for(const text of ['let ctx = other;', 'finally { ctx = prev; }', 'DPR *= 2;', 'ctx ??= other;']){
    assert.match(text, targetAssignment);
  }
  for(const text of ['ctx.fillStyle = color;', 'ctx === other', 'object.ctx = other;']){
    assert.doesNotMatch(text, targetAssignment);
  }
});

test('画布唯一写入口：只有 render/target.js 给 ctx / DPR 赋值', () => {
  const offenders = [];
  for(const f of files){
    if(f.rel === 'render/target.js') continue;
    f.text.split('\n').forEach((line, i) => {
      if(targetAssignment.test(line)) offenders.push(f.rel + ':' + (i + 1));
    });
  }
  assert.deepEqual(offenders, [], '其他模块直接给 ctx / DPR 赋值');
});

test('依赖方向：render 不引用音频、存档、模拟推进、输入与装配', () => {
  const offenders = [];
  for(const f of files){
    if(!f.rel.startsWith('render/')) continue;
    for(const imp of importsOf(f)){
      const to = resolve(f.rel, imp.spec);
      if(isForbiddenRender(to)) offenders.push(f.rel + ' → ' + to);
    }
  }
  assert.deepEqual(offenders, []);
});

test('依赖方向：core 不引用 render / ui / 装配', () => {
  const offenders = [];
  for(const f of files){
    if(!f.rel.startsWith('core/')) continue;
    for(const imp of importsOf(f)){
      const to = resolve(f.rel, imp.spec);
      if(to.startsWith('render/') || to.startsWith('ui/') || to === 'game.js' || to === 'main.js') offenders.push(f.rel + ' → ' + to);
    }
  }
  assert.deepEqual(offenders, []);
});

test('render 对 core 的导入受只读白名单约束', () => {
  const allow = {
    'core/actions.js': ['inspectUseCard'],
    'core/world.js': ['isNight'],
    'core/entities.js': ['cellCX', 'cellFY'],
  };
  const offenders = [];
  for(const f of files){
    if(!f.rel.startsWith('render/')) continue;
    for(const imp of importsOf(f)){
      const to = resolve(f.rel, imp.spec);
      const names = allow[to];
      if(!names) continue;
      for(const n of imp.names){
        if(!names.includes(n)) offenders.push(f.rel + ' → ' + to + '#' + n);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('render 不反向引用 ui/input 且 ui 不引用 render', () => {
  const offenders = [];
  for(const f of files){
    for(const imp of importsOf(f)){
      const to = resolve(f.rel, imp.spec);
      if(f.rel.startsWith('render/') && to.startsWith('ui/') && to !== 'ui/hotspots.js' && to !== 'ui/state.js'){
        offenders.push(f.rel + ' → ' + to);
      }
      if(f.rel.startsWith('ui/') && (to.startsWith('render/') || to === 'game.js' || to === 'main.js')){
        offenders.push(f.rel + ' → ' + to);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('输入适配器只依赖坐标常量和界面状态，不调用核心规则或平台实现', () => {
  const input = files.find(f => f.rel === 'ui/input.js');
  const allow = ['core/constants.js', 'ui/state.js', 'ui/hotspots.js'];
  for(const imp of importsOf(input)){
    const to = resolve(input.rel, imp.spec);
    assert.ok(allow.includes(to), 'ui/input.js → ' + to);
  }
});

test('游戏调度通过注入使用音频与渲染，不直接导入平台适配器', () => {
  const game = files.find(f => f.rel === 'game.js');
  for(const imp of importsOf(game)){
    const to = resolve(game.rel, imp.spec);
    assert.ok(to.startsWith('core/') || to === 'ui/state.js' || to === 'ui/hotspots.js', 'game.js → ' + to);
  }
});
