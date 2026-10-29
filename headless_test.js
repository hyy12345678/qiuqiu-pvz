// 无头冒烟测试：用桩对象模拟 DOM/Canvas，驱动游戏逻辑跑完整关卡
//
// 只能测「脚本形态」的代码：驱动脚本与被测代码跑在同一个 vm 上下文里，靠的是顶层
// var/const 变成全局。esbuild 的 iife 产物把所有符号关在闭包中，驱动看不到 G，
// 所以发布产物由 npm run build（内含离线自包含与语法校验）与 parity:dist 逐字节把关，
// 行为覆盖测 src/main.js；等 P6 拆成模块后再给产物加一个测试入口。
//
// 用法：
//   node headless_test.js                       # 默认测历史基线（从 tag pre-refactor-baseline 现取）
//   node headless_test.js src/main.js           # 测模块源码头（拼接后）—— npm run test:smoke 用的就是这条
//
// 注意：legacy 目标已不是绿灯入口（R6 起 package.json 里没有对应脚本，verify 只跑 src 目标）。
// 它跑不通是预期结果：基线自带缺陷（renderMenu 的夜间小月亮分支给未声明的 g 赋值，严格模式抛错
// 打断 rAF 链，P3c 才在 src 里修掉），且场景 I 依赖的蘑菇 / 咖啡豆在基线里还不存在。
// legacy 是冻结的溯源件，不回头改；这里的价值只剩「同一份驱动能对照历史行为到哪一步」。
const fs = require('fs'), vm = require('vm'), path = require('path');
const esbuild = require('esbuild');
const { esbuildOpts } = require('./scripts/esbuild-opts');
const { legacySource } = require('./scripts/legacy-source');

const target = process.argv[2] || legacySource();
let js, label = target;
if (target.endsWith('.js')) {
  js = fs.readFileSync(target, 'utf8');
  if (/^\s*import\b/m.test(js)) {
    // src 已模块化，先用与构建同一套 esbuild 配置打成单文件。
    // 用 esm 而非 iife：iife 的闭包会把 G/ZTYPES 藏起来，驱动就读不到游戏状态了。
    js = esbuild.buildSync({ ...esbuildOpts([target]), write: false, format: 'esm' }).outputFiles[0].text;
    label = target + '（esbuild esm 打包后）';
  }
} else {
  const html = fs.readFileSync(require('path').isAbsolute(target) ? target : require('path').join(__dirname, target), 'utf8');
  js = html.split('<script>')[1].split('</script>')[0];
}
if (/^\s*(?:\/\*[\s\S]*?\*\/\s*)*\(\s*(?:\(\)\s*=>|\(\s*\)\s*=>|function)/.test(js)) {
  console.error('拒绝执行：' + target + ' 是 iife 打包产物，内部符号（G/ZTYPES/…）不在全局，\n'
    + '本驱动无法注入。请改用 npm run test:smoke（测 src/main.js）。');
  process.exit(2);
}
console.log('smoke source: ' + label);

// ---- 桩环境 ----
globalThis.__tNow = 0;
globalThis.__raf = null;
// Canvas 桩用白名单而不是「未知属性一律返回空函数」：后者会把拼错的方法名、
// 新增但未登记的绘制 API 全部吞掉，渲染场景只剩「不抛错」这一条信息。
const CTX_METHODS = new Set([
  'beginPath', 'fill', 'stroke', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse',
  'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'rect', 'fillRect', 'strokeRect',
  'save', 'restore', 'translate', 'rotate', 'scale', 'clip', 'fillText', 'strokeText',
  'drawImage', 'setTransform', 'createLinearGradient', 'createRadialGradient',
]);
const CTX_PROPS = new Set([
  'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'font',
  'textAlign', 'textBaseline', 'globalAlpha', 'globalCompositeOperation',
]);
function makeGradient() { return { addColorStop() {} }; }
function makeCtx(label) {
  const t = {};
  return new Proxy(t, {
    get(target, p) {
      if (typeof p !== 'string') return undefined;
      if (p in target) return target[p];
      if (CTX_PROPS.has(p)) return undefined;      // 允许读取尚未写入的样式属性
      if (CTX_METHODS.has(p)) {
        const fn = (...args) => (p.startsWith('create') ? makeGradient() : undefined);
        target[p] = fn;
        return fn;
      }
      throw new Error('Canvas 桩缺少 API「' + p + '」（' + label + '）：新增绘制调用必须显式登记');
    },
    set(target, p, v) {
      if (typeof p === 'string' && CTX_PROPS.has(p)) { target[p] = v; return true; }
      throw new Error('Canvas 桩不支持写入属性「' + String(p) + '」（' + label + '）');
    }
  });
}
const ctxProxy = makeCtx('主画布');
globalThis.__canvasHandlers = new Map();
const fakeCanvas = {
  width: 0, height: 0, style: {},
  getContext: () => ctxProxy,
  addEventListener(type, handler) { globalThis.__canvasHandlers.set(type, handler); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1024, height: 640 }),
};
globalThis.document = {
  getElementById: () => fakeCanvas,
  createElement: () => ({ width:0, height:0, getContext: () => makeCtx('离屏画布'), style:{} }),
  addEventListener: () => {},
};
globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
Object.defineProperty(globalThis, 'performance', { value: { now: () => globalThis.__tNow }, configurable: true });
globalThis.requestAnimationFrame = cb => { globalThis.__raf = cb; };

// 桩自检：未知 Canvas API 必须抛错，否则渲染场景会退化成「什么都没执行也没报错」。
let stubCaught = false;
try { makeCtx('自检').definitelyNotARealCanvasApi(); } catch (e) { stubCaught = /Canvas 桩缺少 API/.test(e.message); }
if (!stubCaught) throw new Error('Canvas 桩自检失败：未知 API 没有抛错');

vm.runInThisContext(js, { filename: 'game.js' });

// ---- 驱动脚本（同一上下文，可访问 G / 内部函数） ----
vm.runInThisContext(`
function pump(seconds){
  const frames = Math.ceil(seconds * 60);
  for(let f = 0; f < frames; f++){
    globalThis.__tNow += 1000/60;
    const cb = globalThis.__raf;
    globalThis.__raf = null;
    if(typeof cb !== 'function') throw new Error('rAF 链中断：第 ' + f + ' 帧没有待执行的回调');
    cb(globalThis.__tNow);
    if(typeof globalThis.__raf !== 'function') throw new Error('rAF 链在第 ' + f + ' 帧后中断：frame() 没有重新排下一帧');
  }
}
// 帧链自检：没有待执行回调时必须报错，否则「画面冻住」会被 pump 静默跳过。
{
  const saved = globalThis.__raf;
  globalThis.__raf = null;
  let caught = false;
  try { pump(0.1); } catch(e){ caught = /rAF 链/.test(e.message); }
  globalThis.__raf = saved;
  if(!caught) throw new Error('S0: 帧链中断没有被检测到');
}
function makeZombie(type, row, x){
  const def = ZTYPES[type];
  return { type, row, x, speed: def.speed, hp: def.hp, acc: def.acc,
    maxHp: def.hp + def.acc, state:'walk', animT:0, eatT:0, slowT:0,
    poleLost:false, vt:0, fromX:0, toX:0, vy:0, deathT:0, eatPlant:null,
    paper: type==='newspaper' ? def.acc : 0, angry:false };
}

// ===== 场景 A：无人防守，应当触发小推车并最终失败 =====
pump(0.5);
if(G.state !== 'menu') throw new Error('A0: expect menu, got ' + G.state);
startLevel(G, 0);
if(G.state !== 'select') throw new Error('A1: expect select, got ' + G.state);
for(const t of ['sunflower','peashooter','snowpea','wallnut','potato','cherry']) G.slots.push({type:t,cool:0});
beginPlay(G);
if(G.state !== 'play') throw new Error('A2: expect play, got ' + G.state);
let guard = 0, mowerUsed = false;
while(G.state === 'play' && guard++ < 400){
  pump(1);
  if(G.mowers.some(m => m.state !== 'idle')) mowerUsed = true;
}
if(G.state !== 'lost') throw new Error('A3: expect lost, got ' + G.state);
if(!mowerUsed) throw new Error('A4: mower never triggered');
if(G.killed <= 0) throw new Error('A5: no zombie killed by mower');
pump(1); // 渲染失败结算面板

// ===== 场景 B：强力防守，应当通关 =====
startLevel(G, 0);
G.slots = [];
for(const t of ['sunflower','peashooter','repeater','snowpea','wallnut','torch']) G.slots.push({type:t,cool:0});
beginPlay(G);
G.sun = 9999;
for(let r = 0; r < 5; r++){
  placePlant(G, 'wallnut', r, 0);
  placePlant(G, 'torch', r, 1);
  placePlant(G, 'repeater', r, 2);
  placePlant(G, 'repeater', r, 3);
}
guard = 0;
while(G.state === 'play' && guard++ < 400){ pump(1); }
if(G.state !== 'won') throw new Error('B1: expect won, got ' + G.state + ' killed=' + G.killed + '/' + G.total);
if(G.killed !== G.total) throw new Error('B2: killed ' + G.killed + ' != total ' + G.total);
pump(1); // 渲染胜利面板

// ===== 场景 C：机制测试（撑杆跳 / 土豆雷 / 樱桃炸弹 / 啃食） =====
startLevel(G, 1);
G.slots = [];
for(const t of ['wallnut','potato','cherry','peashooter']) G.slots.push({type:t,cool:0});
beginPlay(G);
G.sun = 9999;
G.t = 1; // 跳过开场白
// C1: 撑杆僵尸跳过坚果墙
placePlant(G, 'wallnut', 2, 6);
G.zombies.push(makeZombie('vault', 2, cellCX(8) + 30));
let jumped = false;
for(let i = 0; i < 600 && G.state === 'play'; i++){
  pump(0.1);
  const vz = G.zombies.find(z => z.type === 'vault');
  if(vz && vz.poleLost){ jumped = true; break; }
  if(!vz){ jumped = true; break; } // 被意外消灭也算跑完了
}
if(!jumped) throw new Error('C1: vault zombie never finished jump');
// C2: 土豆雷成长后炸死僵尸
placePlant(G, 'potato', 3, 5);
pump(15); // 等待成长
const pot = G.grid[3][5];
if(!pot || !pot.armed) throw new Error('C2: potato not armed after 15s');
G.zombies.push(makeZombie('normal', 3, cellCX(5) + 120));
const killedBefore = G.killed;
pump(8);
if(G.killed <= killedBefore) throw new Error('C2: potato mine did not kill zombie');
// C3: 樱桃炸弹
G.zombies.push(makeZombie('cone', 1, cellCX(4) + 40));
G.zombies.push(makeZombie('normal', 0, cellCX(4) + 20));
const k3 = G.killed;
placePlant(G, 'cherry', 1, 4);
pump(3);
if(G.killed < k3 + 2) throw new Error('C3: cherry bomb killed ' + (G.killed - k3) + ', expect >=2');
// C4: 僵尸啃食植物
placePlant(G, 'sunflower', 4, 7);
G.zombies.push(makeZombie('normal', 4, cellCX(8)));
let eaten = false;
for(let i = 0; i < 600 && G.state === 'play'; i++){
  pump(0.1);
  if(!G.grid[4][7]){ eaten = true; break; }
}
if(!eaten) throw new Error('C4: zombie did not eat plant');
// C5: 寒冰减速
placePlant(G, 'snowpea', 0, 0);
const szRef = makeZombie('normal', 0, cellCX(3));
G.zombies.push(szRef);
pump(3);
if(szRef.state !== 'dying' && szRef.slowT <= 0) throw new Error('C5: snow pea did not slow zombie');

// ===== 场景 D：各界面渲染 =====
G.state = 'help'; pump(0.2);
G.state = 'menu'; pump(0.2);
// D2: 解锁到最后一关的菜单 —— 夜间关的小月亮分支只有这里才会跑到
const unlockedSave = G.unlocked;
G.unlocked = LEVELS.length; pump(0.2);
G.unlockAll = true; pump(0.2);
G.unlockAll = false; G.unlocked = unlockedSave;
startLevel(G, 2); pump(0.2);

// ===== 场景 E：球球（扔小皮球的核心角色） =====
startLevel(G, 0);
G.slots = [];
G.slots.push({type:'qiuqiu',cool:0});
beginPlay(G);
G.sun = 9999;
G.t = 1;
placePlant(G, 'qiuqiu', 2, 1);
const zE = makeZombie('normal', 2, cellCX(5));
G.zombies.push(zE);
const hpBefore = zE.hp;
pump(2);
if(zE.hp >= hpBefore) throw new Error('E1: qiuqiu did not damage zombie');
let sawShot = false;
for(let i=0;i<300 && G.state==='play';i++){ pump(0.05); if(G.peas.some(pp=>pp.type==='bullet'||pp.type==='missile')){ sawShot=true; break; } }
if(!sawShot) throw new Error('E2: no gatling projectile spawned');
pump(6);
if(zE.state !== 'dying') throw new Error('E3: qiuqiu too weak, zombie alive after 8s');

// ===== 场景 F：战前算数热身 =====
startQuiz(G);
if(G.state !== 'quiz') throw new Error('F1: not quiz state');
if(G.quiz.questions.length !== 3) throw new Error('F2: not 3 questions');
const c = G.quiz.questions[0];
if(!c.options.includes(c.answer)) throw new Error('F3: answer missing from options');
for(let k=0;k<3;k++){ answerQuiz(G, G.quiz.questions[G.quiz.idx].answer); pump(1); }
if(G.state !== 'play') throw new Error('F4: 3 correct answers did not start battle');
if(G.sun !== 400) throw new Error('F5: energy should be 400, got ' + G.sun);
// 答错直接开战
startQuiz(G);
answerQuiz(G, G.quiz.questions[0].answer + 999);
pump(1);
if(G.state !== 'play') throw new Error('F6: wrong answer did not start battle');
if(G.sun !== 50) throw new Error('F7: wrong answer energy should be 50, got ' + G.sun);

// ===== 场景 G：报纸僵尸（报纸=护盾，被打掉后暴怒加速） =====
startLevel(G, 1);
G.slots = [];
G.slots.push({type:'repeater',cool:0});
beginPlay(G);
G.sun = 9999; G.t = 1;
if(ZTYPES.newspaper.acc <= 0) throw new Error('G0: newspaper zombie has no paper shield');
// G-a: 出怪时自带报纸护盾
spawnZombie(G, 'newspaper');
const spawned = G.zombies[G.zombies.length-1];
if(spawned.type !== 'newspaper' || spawned.paper !== ZTYPES.newspaper.acc || spawned.angry)
  throw new Error('G-a: spawnZombie did not equip paper shield');
const nz = makeZombie('newspaper', 0, cellCX(4));
const spdBefore = nz.speed;
damageZombie(G, nz, 200);
if(nz.acc !== 200 || nz.hp !== ZTYPES.newspaper.hp) throw new Error('G1: paper should absorb damage (acc=' + nz.acc + ' hp=' + nz.hp + ')');
if(nz.angry) throw new Error('G2: went angry while paper still alive');
damageZombie(G, nz, 250);          // 打爆报纸，溢出 50 点伤害
if(!nz.angry) throw new Error('G3: paper destroyed but zombie not enraged');
if(nz.acc !== 0) throw new Error('G4: acc should be 0 after paper lost, got ' + nz.acc);
if(nz.hp !== 150) throw new Error('G5: spillover damage wrong, hp=' + nz.hp);
if(!(nz.speed > spdBefore)) throw new Error('G6: angry zombie not faster (' + spdBefore + ' -> ' + nz.speed + ')');
pump(1);                        // 渲染暴怒状态
damageZombie(G, nz, 150);
if(nz.state !== 'dying') throw new Error('G7: enraged zombie did not die');
pump(1);
// G-b: 两种姿态绘制不报错
const nzDraw = makeZombie('newspaper', 2, cellCX(3));
drawZombieEntity(0, nzDraw);                       // 看报
nzDraw.angry = true; nzDraw.acc = 0; nzDraw.speed = 34;
drawZombieEntity(0, nzDraw);                       // 暴怒
drawZombieHeadIcon(100, 100, 1, 'newspaper');   // 图鉴头像

// ===== 场景 H：夜间关卡（无天降太阳、开局补偿阳光） =====
if(LEVELS.length !== 4) throw new Error('H0: expected 4 levels, got ' + LEVELS.length);
if(!LEVELS[3].night) throw new Error('H1: level 4 is not a night level');
startLevel(G, 3); pump(0.2);            // 渲染夜战选卡界面
beginPlay(G, 50);
if(G.sun !== 150) throw new Error('H2: night start sun should be 50+100, got ' + G.sun);
if(G.visual.nightHint <= 0) throw new Error('H4: night hint banner not armed');
G.t = 1;
pump(28);
if(G.suns.some(s => s.fromSky)) throw new Error('H3: night level spawned sky sun');
if(bgCache.theme !== 'night') throw new Error('H5: night background not rendered');
// 白天关卡应正常天降太阳
startLevel(G, 0); G.slots = []; G.slots.push({type:'sunflower',cool:0}); beginPlay(G, 50);
if(G.sun !== 50) throw new Error('H6: day level should not get the night bonus, got ' + G.sun);
G.t = 1; pump(20);
if(!G.suns.some(s => s.fromSky)) throw new Error('H7: day level produced no sky sun');
if(bgCache.theme !== 'day') throw new Error('H8: day background not restored');

// ===== 场景 I：蘑菇与咖啡豆（白天打盹 → 咖啡豆唤醒；夜里落地即开工） =====
function press(lx, ly){ globalThis.__canvasHandlers.get('mousedown')({ clientX:lx, clientY:ly, button:0 }); }
startLevel(G, 0);
G.slots = [{type:'puff',cool:0},{type:'sunshroom',cool:0},{type:'coffee',cool:0}];
beginPlay(G);
G.sun = 9999; G.t = 1;
UI.sel = 0; press(cellCX(4), cellFY(2) - 40);
const puffDay = G.grid[2][4];
if(!puffDay || puffDay.type !== 'puff') throw new Error('I1: 白天没能种下小喷菇');
if(!puffDay.asleep) throw new Error('I2: 白天种下的蘑菇应当打盹');
if(PLANTS.puff.cost !== 0) throw new Error('I2b: 小喷菇应当免费');
// 点空格子：不生效、不消耗、不取消选卡
const cf = G.slots[2];
UI.sel = 2; press(cellCX(1), cellFY(1) - 40);
if(cf.cool > 0) throw new Error('I3: 点错目标的咖啡豆不该进入冷却');
if(UI.sel !== 2) throw new Error('I4: 用错的咖啡豆不该取消选卡');
// 点对打盹的蘑菇：唤醒 + 进冷却 + 取消选卡
UI.sel = 2; press(cellCX(4), cellFY(2) - 40);
if(puffDay.asleep) throw new Error('I5: 咖啡豆没能唤醒蘑菇');
if(cf.cool <= 0) throw new Error('I6: 成功使用后应进入冷却');
if(UI.sel !== -1) throw new Error('I7: 用过的咖啡豆应取消选卡');
// 阳光菇产量减半
G.sun = 9999; UI.sel = 1; press(cellCX(6), cellFY(3) - 40);
const shroom = G.grid[3][6];
if(!shroom || shroom.type !== 'sunshroom') throw new Error('I8: 没能种下阳光菇');
applyCoffee(G, shroom);
G.suns.length = 0;
pump(11);
if(!G.suns.some(s => !s.fromSky && s.value === 25)) throw new Error('I9: 阳光菇应产 25 阳光');
if(G.suns.some(s => !s.fromSky && s.value !== 25)) throw new Error('I10: 场上不该出现其它产量的植物阳光');
// 渲染三种新植物与两种蘑菇姿态、孢子弹道，确认不抛错
drawPlantEntity(0, shroom);
shroom.asleep = true; drawPlantEntity(0, shroom); shroom.asleep = false;
drawPlantIcon(0, 'puff', 80, 80, 1);
drawPlantIcon(0, 'sunshroom', 80, 80, 1);
drawPlantIcon(0, 'coffee', 80, 80, 1);
// 拦截 ctx.fillStyle，确认孢子用的是自己的紫色弹道而不是回落到普通豌豆绿
function peaFills(type){
  const fills = [];
  const real = ctx;
  ctx = new Proxy({}, { get:(t,p)=>real[p],
    set:(t,p,v)=>{ if(p==='fillStyle' && typeof v==='string') fills.push(v); real[p]=v; return true; } });
  try { drawPea({ x:300, y:300, row:2, type, dmg:20, vx:300, prevX:300 }); }
  finally { ctx = real; }
  return fills;
}
if(!peaFills('spore').includes('#b478e0')) throw new Error('I12: 孢子没有按孢子配色渲染');
if(peaFills('ball').includes('#b478e0')) throw new Error('I13: 非孢子弹道不该用孢子配色');
pump(0.2);
// 夜战：落地即开工，无需咖啡豆
startLevel(G, 3);
G.slots = [{type:'puff',cool:0}];
beginPlay(G);
G.sun = 9999; G.t = 1; UI.sel = 0;
press(cellCX(4), cellFY(2) - 40);
if(G.grid[2][4].asleep) throw new Error('I11: 夜里种下的蘑菇不该打盹');

globalThis.__result = 'ALL TESTS PASSED';
`, { filename: 'driver.js' });

console.log(globalThis.__result);
