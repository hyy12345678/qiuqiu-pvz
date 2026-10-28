// 战斗模拟的行为不变量（1~8 是重构安全网，9~11 是蘑菇 / 阳光菇 / 咖啡豆这批新植物带进来的规则）。
// 这一组测试是 P3「先搬后改」的安全网：它只依赖 core/ 里的纯逻辑，
// 不需要 canvas / DOM 桩 —— SFX 在 ctx 为 null 时全部提前返回，persist 的 localStorage 访问已被 try/catch 包住。
// 断言写成「不变量」而不是「某一帧的具体数值」，所以随机数不影响可复现性。
import test from 'node:test';
import assert from 'node:assert';

const { createWorld, beginPlay } = await import('../src/core/world.js');
const { updatePlay } = await import('../src/core/sim.js');
const { placePlant, removePlant, damageZombie, findEatTarget, explodeMissile, triggerMower, cellCX, applyCoffee } = await import('../src/core/entities.js');
const { ZTYPES } = await import('../src/core/data/zombies.js');
const { PLANTS } = await import('../src/core/data/plants.js');
const { LEVELS } = await import('../src/core/data/levels.js');
const { LX, CW, CH, LY, ROWS, W } = await import('../src/core/constants.js');

const DT = 1 / 60;

const G = createWorld();

function stepFrames(n) {
  for (let i = 0; i < n; i++) updatePlay(G, DT);
}
function step(sec) {
  stepFrames(Math.ceil(sec / DT));
}

/** 复位到「第 level 关、倒计时已过、场上干净、不出怪」的可控状态 */
function reset(level = 0) {
  G.level = level;
  G.unlocked = 1;
  beginPlay(G);                       // 顺带把 grid/mowers/events 全部重建
  while (G.t < 0.05) updatePlay(G, DT); // 跑完 -3.2s 开场倒计时，进入 t > 0
  G.zombies.length = G.peas.length = G.suns.length = 0;
  G.plants.length = 0;
  for (let r = 0; r < ROWS; r++) G.grid[r].fill(null);
  G.parts.length = G.decals.length = 0;
  G.evIdx = 0;                       // 首个出怪事件在 26s 之后，短测试不会碰到
  G.state = 'play';
  G.winT = 0; G.loseZombie = null; G.skyTimer = 1e9; // 天降阳光单独在不变量 7 里测
  return G;
}

function plant(type, row, col) {
  G.sun = 9999;
  placePlant(G, type, row, col);
  return G.grid[row][col];
}

/** 固定数值的僵尸：spawnZombie 会加随机扰动，这里要的是可预测的起始条件 */
function zombie(type, x, row = 2) {
  const d = ZTYPES[type];
  const z = {
    type, row, x, speed: d.speed, hp: d.hp, acc: d.acc, maxHp: d.hp + d.acc,
    state: 'walk', animT: 0, eatT: 0, slowT: 0, poleLost: false, vt: 0,
    fromX: 0, toX: 0, vy: 0, deathT: 0, eatPlant: null, dustT: 0,
    paper: type === 'newspaper' ? d.acc : 0, angry: false,
  };
  G.zombies.push(z);
  return z;
}

function pea(type, x, row, dmg) {
  const p = { x, y: LY + row * CH + CH / 2, row, type, dmg, vx: 340, prevX: x };
  G.peas.push(p);
  return p;
}

// ---- 1. 护盾先吃伤害，溢出回灌本体 ----

test('不变量1 护盾：伤害先扣 acc，打穿后溢出量转灌 hp，本体扣完才死', () => {
  reset();
  const z = zombie('cone', 600); // hp 200 / acc 370

  damageZombie(G, z, 100);
  assert.strictEqual(z.acc, 270, '路障护盾应吸收全部 100');
  assert.strictEqual(z.hp, 200, '护盾未打穿时本体不掉血');
  assert.strictEqual(z.state, 'walk', '本体满血不应进入死亡');

  damageZombie(G, z, 300);        // 溢出 30
  assert.strictEqual(z.acc, 0, '护盾扣成负数后要归零');
  assert.strictEqual(z.hp, 170, '溢出的 30 应转灌本体');
  assert.notStrictEqual(z.state, 'dying');

  damageZombie(G, z, 170);
  assert.strictEqual(z.state, 'dying', '本体清零才判死');
  assert.strictEqual(z.deathT, 0, '死亡计时从零起算');

  const bucket = zombie('bucket', 600, 0); // hp 200 / acc 1100
  damageZombie(G, bucket, 5000);
  assert.strictEqual(bucket.acc, 0);
  assert.strictEqual(bucket.hp, 200 - (5000 - 1100), '溢出的 3900 全部转灌本体');
  assert.strictEqual(bucket.hp, -3700);
  assert.strictEqual(bucket.state, 'dying');
});

// ---- 2. 报纸僵尸：护盾清零即狂暴 ----

test('不变量2 报纸僵尸：acc 归零那一击触发狂暴，加速并清减速；护盾还在或已死则不触发', () => {
  reset();
  const z = zombie('newspaper', 600);
  z.slowT = 6; // 寒冰射手留下的减速

  damageZombie(G, z, 399);
  assert.strictEqual(z.acc, 1, '还剩 1 点报纸');
  assert.strictEqual(z.angry, false, '报纸未掉不狂暴');
  assert.strictEqual(z.slowT, 6, '未狂暴不应清掉减速');

  const paperBefore = G.parts.length;
  damageZombie(G, z, 1); // 恰好打空护盾
  assert.strictEqual(z.acc, 0);
  assert.strictEqual(z.angry, true, '报纸被打掉应狂暴');
  assert.ok(z.speed >= 34 * 0.94 && z.speed <= 34 * 1.08,
    `狂暴后速度应落在 34×[0.94,1.08]，实际 ${z.speed}`);
  assert.strictEqual(z.slowT, 0, '狂暴应立刻解除减速');
  assert.ok(G.parts.length > paperBefore, '撕报纸应喷出纸屑粒子');
  assert.strictEqual(z.hp, 200, '打掉护盾的那一击不该顺带伤本体');

  // 已濒死的僵尸不再狂暴（否则会出现「尸体冲刺」）
  const dying = zombie('newspaper', 600, 0);
  dying.state = 'dying';
  const speed = dying.speed;
  damageZombie(G, dying, 9999);
  assert.strictEqual(dying.angry, false, '濒死状态不应触发狂暴');
  assert.strictEqual(dying.speed, speed, '濒死状态不应改速度');
});

// ---- 3. 土豆雷：不可啃食，且只有武装机才算撑杆跳点 ----

test('不变量3 土豆雷：僵尸不会停下来啃它；未装填时撑杆僵尸不为它起跳，装填完成后起跳', () => {
  const row = 0;
  reset();
  const mine = plant('potato', row, 3);
  mine.armed = false; mine.armT = 0;

  // 未装填：贴在地里，既不是食物也不是跳点
  assert.strictEqual(findEatTarget(G, zombie('normal', 600, row)), null, '土豆雷不应是可啃目标');
  const patient = zombie('vault', 600, row);
  stepFrames(12);
  assert.strictEqual(patient.state, 'walk', '未装填的土豆雷贴地，撑杆僵尸不为它浪费这一跳');
  assert.strictEqual(G.plants.length, 1, '未装填的土豆雷不应被啃掉或引爆');

  // 装填完成：构成跳点。只跑一帧——跳过途中落到雷上被炸死是下一层行为，这里先锁住「起跳」本身
  mine.armed = true;
  G.zombies.length = 0;
  const vault = zombie('vault', 600, row);
  stepFrames(1);
  assert.strictEqual(vault.state, 'vault', '装填完成的土豆雷应成为跳点');
  assert.ok(vault.toX < vault.fromX, '起跳应往草坪左侧落');
  assert.strictEqual(vault.toX, mine.cx - 80 + 18, '落点应在植物左侧一格');

  // 对照：坚果墙既可啃又可跳；而雷始终不可啃
  G.zombies.length = 0;
  removePlant(G, mine);
  const wall = plant('wallnut', row, 3);
  assert.strictEqual(findEatTarget(G, zombie('normal', 600, row)), wall, '坚果墙应成为可啃目标');
  G.zombies.length = 0;
  const v2 = zombie('vault', 600, row);
  stepFrames(1);
  assert.strictEqual(v2.state, 'vault', '坚果墙应成为跳点');
});

// ---- 4. 火炬树桩转火 + 火豌豆溅射 ----

test('不变量4 火炬：豌豆穿越火炬所在列时转火且伤害翻倍；火豌豆命中同行 45px 内的僵尸溅射 20', () => {
  reset();
  const row = 2;
  const torch = plant('torch', row, 3);

  const p = pea('pea', torch.cx - 15, row, 20);
  step(0.05);
  assert.strictEqual(p.type, 'fire', '豌豆经过火炬应转为火豌豆');
  assert.strictEqual(p.dmg, 40, '火豌豆伤害翻倍');

  // 已经是火的豌豆不重复翻倍
  const already = pea('fire', torch.cx - 15, row, 40);
  step(0.05);
  assert.strictEqual(already.dmg, 40, '火豌豆不应被二次翻倍');

  // 寒冰豌豆同样转火
  const snow = pea('snow', torch.cx - 15, row, 20);
  step(0.05);
  assert.strictEqual(snow.type, 'fire', '冰豌豆经过火炬也转火');

  // 溅射：主目标吃全额，同行 45px 内吃 20，45px 外不受影响
  G.plants.length = 0;                        // 收走火炬，免得再次转火干扰
  G.peas.length = 0;                          // 上面三只豌豆还在飞，会重复命中同一行
  const near = zombie('normal', 500, row);
  const within = zombie('normal', 520, row);  // |520-500| = 20 < 45
  const far = zombie('normal', 560, row);     // |560-500| = 60 > 45
  const otherRow = zombie('normal', 510, 1);
  pea('fire', 476, row, 40);
  stepFrames(1);
  assert.strictEqual(near.hp, 160, '主目标承受火豌豆的翻倍伤害 40');
  assert.strictEqual(within.hp, 180, '同行 45px 内的僵尸应被溅射 20');
  assert.strictEqual(far.hp, 200, '45px 外的僵尸不应被溅射');
  assert.strictEqual(otherRow.hp, 200, '溅射不应跨行');
  assert.strictEqual(G.peas.length, 0, '命中后豌豆应被消耗掉');
});

// ---- 5. 导弹的 3×3 按格子而不是按像素 ----

test('不变量5 导弹：爆炸范围是按 x 换算出的 3×3 格（列 = floor((x - LX) / CW)），跨行跨列各一格', () => {
  reset();
  const row = 2, col = 3;
  const cx = cellCX(col);

  const sameCell = zombie('normal', cx, row);
  const rightCol = zombie('normal', cx + 85, row);      // 仍在 +1 列
  const rightTwo = zombie('normal', cx + 85 + CW, row); // +2 列
  const diagRow = zombie('normal', cx, row - 1);        // 斜角一格
  const farRow = zombie('normal', cx, row - 2);

  explodeMissile(G, cx, row, Math.floor((cx - LX) / CW));

  assert.strictEqual(sameCell.hp, 110, '本格应受 90 伤害');
  assert.strictEqual(rightCol.hp, 110, '相邻列即使在 85px 外也应受 90 伤害（按格判定）');
  assert.strictEqual(diagRow.hp, 110, '相邻行也应受 90 伤害');
  assert.strictEqual(rightTwo.hp, 200, '隔两列不应被命中');
  assert.strictEqual(farRow.hp, 200, '隔两行不应被命中');

  // sim 里的导弹命中路径必须用同一套列换算：把僵尸摆到 col 4 的左边界内侧
  reset();
  const inCol4 = zombie('normal', LX + 4 * CW + CW - 1, 2); // 落在第 4 列内
  pea('missile', inCol4.x - 20, 2, 90).vx = 300;
  step(0.05);
  assert.ok(inCol4.hp < 200, '导弹命中后应通过格子换算造成 3×3 伤害');
});

// ---- 6. 小推车与判负 ----

test('不变量6 小推车：僵尸越过 LX+14 才触发本行的闲置车，车起来清掉本行僵尸；本行无车且僵尸退到 LX-72 才判负', () => {
  reset();
  const row = 1;
  const z = zombie('normal', LX + 10, row);
  stepFrames(3);
  assert.strictEqual(G.mowers[row].state, 'run', '僵尸越线应触发本行小推车');
  assert.strictEqual(G.state, 'play', '有车可触发时不应判负');
  assert.strictEqual(z.state, 'dying', '推车碾过的僵尸应被秒杀');

  // 本行没有闲置车：不判负，直到越过 LX-72
  reset();
  G.mowers[0].state = 'gone';
  const z2 = zombie('normal', LX + 10, 0);
  stepFrames(3);
  assert.strictEqual(G.mowers[0].state, 'gone', '已消失的推车不应复活');
  assert.strictEqual(G.state, 'play', '僵尸还没退到判负线');
  assert.strictEqual(G.loseZombie, null);

  z2.x = LX - 70;                              // 仍在判负线右侧 2px
  stepFrames(1);
  assert.strictEqual(G.state, 'play', '越过 LX+14 但没到 LX-72，不应判负');
  z2.x = LX - 74;
  stepFrames(1);
  assert.strictEqual(G.state, 'lost', '本行无车且僵尸越过 LX-72 应判负');
  assert.strictEqual(G.loseZombie, z2, '应记录破门的那只僵尸');

  // 触发的是「越线那一行」自己的车，不能借邻行的车
  reset();
  zombie('normal', LX + 10, 3);
  stepFrames(3);
  assert.strictEqual(G.mowers[3].state, 'run', '越线的行自己的车应启动');
  assert.strictEqual(G.mowers[2].state, 'idle', '不应误触邻行的车');
  assert.strictEqual(G.mowers[4].state, 'idle', '不应误触邻行的车');
});

test('不变量6b triggerMower 只认领闲车，且返回值如实反映是否启动', () => {
  reset();
  assert.strictEqual(triggerMower(G, 2), true);
  assert.strictEqual(G.mowers[2].state, 'run');
  assert.strictEqual(triggerMower(G, 2), false, '已启动的车不应被重复触发');
  G.mowers[2].state = 'gone';
  assert.strictEqual(triggerMower(G, 2), false, '已消失的车不应被触发');
});

// ---- 7. 夜战规则 ----

test('不变量7 夜战：开局补偿 +100 阳光、8 秒提示倒计时自行结束、天上不掉太阳；白天照旧掉落', () => {
  const nightLevel = LEVELS.findIndex(lv => lv.night);
  assert.ok(nightLevel >= 0, '应存在夜间关卡（第 4 关月夜突袭）');

  // 初值直接看 beginPlay，不受开场倒计时影响
  G.level = nightLevel;
  beginPlay(G);
  assert.strictEqual(G.sun, 150, '夜战开局阳光 = 基础 50 + 补偿 100');
  assert.strictEqual(G.nightHint, 8, '夜战开场提示倒计时 8 秒');

  // 跑起来：不掉太阳、连天降计时的都不推进、提示与模拟时间同步递减
  reset(nightLevel);
  G.skyTimer = 5;
  const hint0 = G.nightHint;
  assert.ok(hint0 > 4 && hint0 < 8, `开场倒计时跑完后提示剩余应在 4~8 秒之间，实际 ${hint0}`);
  step(2);
  assert.strictEqual(G.suns.length, 0, '夜间没有向日葵就不该有任何阳光');
  assert.strictEqual(G.skyTimer, 5, '夜间不该推进天降阳光的计时器');
  assert.ok(Math.abs(G.nightHint - (hint0 - 2)) < 2 * DT,
    `提示倒计时应与模拟时间同步递减，实际 ${G.nightHint}`);
  step(6);
  assert.ok(G.nightHint <= 0, '提示应自行结束');
  assert.strictEqual(G.suns.length, 0, '夜间全程不掉天降阳光');

  // 对照：白天照常掉太阳
  assert.ok(!LEVELS[0].night, '第 1 关应为白天');
  reset(0);
  G.skyTimer = 0.5;
  step(1);
  const sky = G.suns.filter(s => s.fromSky);
  assert.strictEqual(sky.length, 1, '白天计时器到期应掉下一份阳光');
  assert.strictEqual(sky[0].value, 50, '每份阳光值 50');
  assert.ok(G.skyTimer > 4, `掉落后应重新排期 4.5~6.5 秒，实际 ${G.skyTimer}`);
});

// ---- 8. 胜利判定 ----

test('不变量8 胜利：出怪事件放完且场上无僵尸，连续 1 秒后判胜并解锁下一关；未满 1 秒或仍有僵尸则不判', () => {
  reset(0);
  G.evIdx = G.events.length;
  assert.strictEqual(G.zombies.length, 0);

  step(0.5);
  assert.strictEqual(G.state, 'play', '只累计了 0.5 秒，不应判胜');
  assert.ok(G.winT > 0.4 && G.winT < 0.7, `胜利计时应约为 0.5，实际 ${G.winT}`);

  zombie('normal', 700, 4); // 又冒出一只
  step(0.6);
  assert.strictEqual(G.state, 'play', '场上还有僵尸时胜利计时不应达成');
  G.zombies.length = 0;
  G.winT = 0;

  step(1.05);
  assert.strictEqual(G.state, 'won', '空场满 1 秒应判胜');
  assert.strictEqual(G.unlocked, 2, '通关后解锁到 level+2');

  // 事件没放完时，即便空场也不该赢
  reset(0);
  G.evIdx = 0;
  step(2);
  assert.strictEqual(G.state, 'play', '还有出怪事件未放完不应判胜');

  // 开场倒计时（t <= 0）阶段不参与胜利判定
  G.level = 0;
  beginPlay(G);
  G.evIdx = G.events.length;
  stepFrames(150);   // 2.5 秒，仍在 -3.2 秒倒计时之内
  assert.ok(G.t < 0, `此段应仍在开场倒计时内，实际 t = ${G.t.toFixed(2)}`);
  assert.strictEqual(G.winT, 0, '倒计时期间不应累计胜利计时');
  assert.strictEqual(G.state, 'play');
});

// ---- 9. 蘑菇的昼夜规则与咖啡豆 ----

test('不变量9 蘑菇：白天种下即打盹（不开火不产阳光），夜里直接开工；咖啡豆只叫醒打盹的蘑菇', () => {
  reset(0);
  assert.ok(!LEVELS[0].night, '第 1 关应为白天');
  const shroom = plant('puff', 2, 3);
  assert.strictEqual(shroom.asleep, true, '白天种下的蘑菇应处于打盹状态');

  const z = zombie('normal', cellCX(3) + 120, 2);
  z.speed = 0;                       // 钉在射程内，只测「打盹 / 醒来」的差别
  const hp0 = z.hp;
  step(3);
  assert.strictEqual(z.hp, hp0, '打盹的蘑菇不该开火');
  assert.strictEqual(G.peas.length, 0, '打盹的蘑菇不该产生弹道');

  assert.strictEqual(applyCoffee(shroom), true, '咖啡豆应叫醒打盹的蘑菇');
  assert.strictEqual(shroom.asleep, false);
  step(3);
  assert.ok(z.hp < hp0, '叫醒后应恢复开火');
  assert.strictEqual(applyCoffee(shroom), false, '已经醒着的蘑菇不该被再次叫醒');
  assert.strictEqual(applyCoffee(null), false, '点空格子不该消耗咖啡豆');

  // 打盹的阳光菇不产阳光，叫醒后恢复
  reset(0);
  const sh = plant('sunshroom', 1, 1);
  assert.strictEqual(sh.asleep, true);
  step(12);                          // 超过向日葵 8~10 秒的最大产出间隔
  assert.strictEqual(G.suns.length, 0, '打盹的阳光菇不该产阳光');
  applyCoffee(sh);
  step(12);
  assert.ok(G.suns.length > 0, '叫醒后的阳光菇应恢复产阳光');

  // 非蘑菇不受影响：坚果墙没有打盹一说
  const wall = plant('wallnut', 4, 4);
  assert.strictEqual(wall.asleep, false, '非蘑菇不该被打盹标记');
  assert.strictEqual(applyCoffee(wall), false, '咖啡豆对非蘑菇无效');

  // 夜战（第 4 关）：蘑菇落地即开工
  reset(3);
  assert.ok(LEVELS[3].night, '第 4 关应为夜战');
  assert.strictEqual(plant('puff', 2, 3).asleep, false, '夜里种下的蘑菇不该打盹');
  assert.strictEqual(plant('sunshroom', 1, 3).asleep, false);
});

// ---- 10. 小喷菇用免费换来的短射程 ----

test('不变量10 小喷菇：射程两格（p.cx + 2*CW），超出两格的僵尸打不到', () => {
  reset(3);                          // 夜里，省掉唤醒步骤
  const p = plant('puff', 2, 2);
  const reach = p.cx + CW * 2;

  const far = zombie('normal', reach + 40, 2);
  far.speed = 0;
  step(3);
  assert.strictEqual(far.hp, ZTYPES.normal.hp, '两格之外不该被小喷菇打到');

  const near = zombie('normal', reach - 40, 2);
  near.speed = 0;
  step(3);
  assert.ok(near.hp < ZTYPES.normal.hp, '两格之内的僵尸应被击中');
  assert.strictEqual(far.hp, ZTYPES.normal.hp, '弹道不该穿透近处僵尸打到更远处');
});

// ---- 11. 阳光菇便宜一半、产量也一半 ----

test('不变量11 阳光菇：单次产量 25，正好是向日葵 50 的一半', () => {
  reset(3);
  plant('sunflower', 0, 0);
  plant('sunshroom', 1, 0);
  G.suns.length = 0;
  step(11);
  const vals = G.suns.map(s => s.value);
  assert.ok(vals.includes(50), '向日葵应产 50');
  assert.ok(vals.includes(25), '阳光菇应产 25');
  assert.strictEqual(Math.min(...vals), 25, '不该出现比 25 更小的产出');
  assert.strictEqual(PLANTS.sunshroom.cost * 2, PLANTS.sunflower.cost, '阳光菇价格应是向日葵的一半');
  assert.strictEqual(PLANTS.puff.cost, 0, '小喷菇应免费');
});
