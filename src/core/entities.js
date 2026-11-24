// 实体行为：种植、出怪、伤害、小推车。全部只读写传入的 world 与参数，不碰 canvas。

import { CH, COLS, CW, LX, LY, ROWS, TAU, W } from './constants.js';
import { rand, randi } from './util.js';
import { PLANTS } from './data/plants.js';
import { ZTYPES } from './data/zombies.js';
import { isNight } from './world.js';
import { addDirtPuff, addPaperShreds } from './particles.js';

export function cellCX(c){ return LX + c*CW + CW/2; }
export function cellFY(r){ return LY + (r+1)*CH - 6; }

export function placePlant(world, type, row, col){
  const def = PLANTS[type];
  world.sun -= def.cost;
  const p = {
    type, row, col, hp:def.hp, maxHp:def.hp,
    phase: rand(world.fxRng,0,TAU),
    cx: cellCX(col), fy: cellFY(row),
    fireT: rand(world.rng,0.5,1.3), sunT: rand(world.rng,6,9), recoil:0, flash:0,
    armed:false, armT:0, fuse: type==='cherry' ? 1.05 : 0,
    lifeT: def.life || 0, maxLifeT: def.life || 0,   // 限时登场的角色靠它倒计时；其余植物为 0，不参与
    asleep: !!def.mushroom && !isNight(world),   // 蘑菇白天种下先打盹，等咖啡豆唤醒
  };
  world.grid[row][col] = p;
  world.plants.push(p);
  world.ports.sound('plant');
  addDirtPuff(world, p.cx, p.fy);
}

// 咖啡豆：不是种下去的植物，而是把一株正在打盹的蘑菇叫醒。返回 false 表示用错了对象（卡片不消耗）。
export function applyCoffee(world, p){
  if(!p || !p.asleep) return false;
  p.asleep = false;
  world.ports.sound('select');
  return true;
}

export function removePlant(world, p){
  world.grid[p.row][p.col] = null;
  const i = world.plants.indexOf(p);
  if(i>=0) world.plants.splice(i,1);
}

export function spawnSun(world, x,y,ty,fromSky,value){
  world.suns.push({ x, y, ty, value: value || 50, life:10, state:'fall', t:0, fromSky, sx:x, ft:0 });
}

export function explode(world, x, row, big){
  world.visual.shake = Math.max(world.visual.shake, big?0.55:0.4);
  world.visual.flash = big ? 0.3 : 0.2;
  world.ports.sound('boom');
  world.visual.decals.push({ x, fy: LY + row*CH + CH/2, ttl:6, max:6, r: big?95:55 });
  for(let i=0;i<46;i++){
    const a = rand(world.fxRng,0,TAU), sp = rand(world.fxRng,40, big?340:210);
    world.visual.parts.push({ x, y: LY+row*CH+CH/2, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-70, g:230,
      life:rand(world.fxRng,0.3,0.85), max:0.85, size:rand(world.fxRng,3,10),
      color: ['#fff3b0','#ffdf6e','#ff9a2e','#ff5a2e','#9a9a92'][randi(world.fxRng,0,4)] });
  }
  for(let k=0;k<6;k++){
    world.visual.parts.push({ x:x+rand(world.fxRng,-20,20), y:LY+row*CH+CH/2, vx:rand(world.fxRng,-15,15), vy:rand(world.fxRng,-70,-35), g:-30,
      life:rand(world.fxRng,0.7,1.2), max:1.2, size:rand(world.fxRng,9,16), color:'rgba(90,85,80,0.5)' });
  }
  for(const z of world.zombies){
    if(z.state==='dying') continue;
    if(Math.abs(z.row-row) <= (big?1:0) && Math.abs(z.x-x) < (big?132:58)){
      damageZombie(world, z, 1800, true);   // 樱桃：爆炸无视铁门
    }
  }
}

// 加特林导弹：3x3 格子（九格）范围爆炸
export function explodeMissile(world, x, row, col){
  world.visual.shake = Math.max(world.visual.shake, 0.3);
  world.visual.flash = Math.max(world.visual.flash, 0.15);
  world.ports.sound('boom');
  world.visual.decals.push({ x, fy: LY + row*CH + CH/2, ttl:4, max:4, r:72 });
  for(let i=0;i<30;i++){
    const a = rand(world.fxRng,0,TAU), sp = rand(world.fxRng,30,240);
    world.visual.parts.push({ x, y:LY+row*CH+CH/2, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-50, g:240,
      life:rand(world.fxRng,0.25,0.6), max:0.6, size:rand(world.fxRng,2,6),
      color:['#ffdf6e','#ff9a2e','#ff5a2e','#9a9a92'][randi(world.fxRng,0,3)] });
  }
  const c = (col !== undefined) ? col : Math.floor((x - LX)/CW);
  for(const z of world.zombies){
    if(z.state==='dying') continue;
    const zc = Math.floor((z.x - LX)/CW);
    if(Math.abs(z.row - row) <= 1 && Math.abs(zc - c) <= 1){
      damageZombie(world, z, 90, true);     // 球球导弹：爆炸无视铁门
    }
  }
}

// pierce：本次伤害能否穿透「铁门」这类只挡弹道的护盾。
// 豌豆/孢子/冰/球球子弹走默认 false（削到 25%），爆炸、光线、小推车显式传 true。
//
// E23：原来是「弹道完全无效」，实测过于劝退——13 种植物里能破门的只有樱桃/土豆雷/迪迦，
// 三个全是"一次性 + 长冷却"，没有常驻解法。铁门应该是"换个打法"，不是"必须押宝那张卡"。
// 改成弹道只造成 25%：豌豆不是废了，而是效率降到 1/4，堆够多仍然能过，只是慢。
export const SCREEN_BALLISTIC_MULT = 0.25;

export function damageZombie(world, z, d, pierce){
  if(z.screen && !pierce && z.acc > 0){
    // 铁门吃四分之一弹道伤害，并给火花反馈（渲染层根据 screenHitT 画）
    z.screenHitT = 0.12;
    d = d * SCREEN_BALLISTIC_MULT;
    if(d < 1) return false;          // 太薄了，忽略，免得零头无限累积
  }
  if(z.acc > 0){
    z.acc -= d;
    if(z.acc < 0){ z.hp += z.acc; z.acc = 0; }
  } else {
    z.hp -= d;
  }
  // 报纸僵尸：报纸（护盾）被打掉后狂暴
  if(z.type==='newspaper' && !z.angry && z.acc <= 0 && z.state !== 'dying'){
    z.angry = true;
    z.speed = 34 * rand(world.rng,0.94,1.08);
    z.slowT = 0;
    addPaperShreds(world, z.x, LY + (z.row+1)*CH - 76);
    world.ports.sound('paperTear');
    world.ports.sound('angry');
  }
  if(z.hp <= 0 && z.state !== 'dying'){
    z.state = 'dying'; z.deathT = 0;
    world.killed++;
    world.ports.sound('groan');
  }
  return true;
}

export function spawnZombie(world, type){
  const def = ZTYPES[type];
  let row = randi(world.rng,0,ROWS-1);
  if(world.lastRows.length>=2 && world.lastRows[0]===row && world.lastRows[1]===row){
    row = (row + randi(world.rng,1,ROWS-1)) % ROWS;
  }
  world.lastRows.unshift(row);
  if(world.lastRows.length>3) world.lastRows.length = 3;
  world.zombies.push({
    type, row,
    x: W + 40 + rand(world.rng,0,40),
    speed: def.speed * rand(world.rng,0.92,1.08),
    hp: def.hp, acc: def.acc, maxHp: def.hp + def.acc,
    state:'walk', animT: rand(world.fxRng,0,TAU), eatT:0, slowT:0,
    poleLost:false, vt:0, fromX:0, toX:0, vy:0, deathT:0, eatPlant:null, dustT:0,
    paper: type==='newspaper' ? ZTYPES.newspaper.acc : 0, angry:false,
    screen: !!def.screen, screenHitT: 0,
  });
}

export function findEatTarget(world, z){
  let best = null;
  for(let c=0;c<COLS;c++){
    const p = world.grid[z.row][c];
    if(!p) continue;
    if(p.type==='potato') continue; // 土豆雷不会被啃，踩中即炸
    if(p.cx >= z.x - 26) continue;
    if(p.cx < z.x - 92) continue;
    if(!best || p.cx > best.cx) best = p;
  }
  return best;
}

export function triggerMower(world, row){
  const m = world.mowers.find(m=>m.row===row && m.state==='idle');
  if(m){ m.state = 'run'; world.ports.sound('mower'); return true; }
  return false;
}

