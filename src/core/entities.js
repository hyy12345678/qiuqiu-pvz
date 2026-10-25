// 实体行为：种植、出怪、伤害、小推车。全部只读写 G 与传入参数，不碰 canvas。

import { CH, COLS, CW, LX, LY, ROWS, TAU, W } from './constants.js';
import { rand, randi } from './util.js';
import { PLANTS } from './data/plants.js';
import { ZTYPES } from './data/zombies.js';
import { SFX } from '../audio/sfx.js';
import { G } from './world.js';
import { addDirtPuff, addPaperShreds } from './particles.js';

export function cellCX(c){ return LX + c*CW + CW/2; }
export function cellFY(r){ return LY + (r+1)*CH - 6; }

export function placePlant(type, row, col){
  const def = PLANTS[type];
  G.sun -= def.cost;
  const p = {
    type, row, col, hp:def.hp, maxHp:def.hp,
    phase: Math.random()*TAU,
    cx: cellCX(col), fy: cellFY(row),
    fireT: rand(0.5,1.3), sunT: rand(6,9), recoil:0, flash:0,
    armed:false, armT:0, fuse: type==='cherry' ? 1.05 : 0,
  };
  G.grid[row][col] = p;
  G.plants.push(p);
  SFX.plant();
  addDirtPuff(p.cx, p.fy);
}

export function removePlant(p){
  G.grid[p.row][p.col] = null;
  const i = G.plants.indexOf(p);
  if(i>=0) G.plants.splice(i,1);
}

export function spawnSun(x,y,ty,fromSky){
  G.suns.push({ x, y, ty, value:50, life:10, state:'fall', t:0, fromSky, sx:x, ft:0 });
}

export function explode(x, row, big){
  G.shake = Math.max(G.shake, big?0.55:0.4);
  G.flash = big ? 0.3 : 0.2;
  SFX.boom();
  G.decals.push({ x, fy: LY + row*CH + CH/2, ttl:6, max:6, r: big?95:55 });
  for(let i=0;i<46;i++){
    const a = rand(0,TAU), sp = rand(40, big?340:210);
    G.parts.push({ x, y: LY+row*CH+CH/2, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-70, g:230,
      life:rand(0.3,0.85), max:0.85, size:rand(3,10),
      color: ['#fff3b0','#ffdf6e','#ff9a2e','#ff5a2e','#9a9a92'][randi(0,4)] });
  }
  for(let k=0;k<6;k++){
    G.parts.push({ x:x+rand(-20,20), y:LY+row*CH+CH/2, vx:rand(-15,15), vy:rand(-70,-35), g:-30,
      life:rand(0.7,1.2), max:1.2, size:rand(9,16), color:'rgba(90,85,80,0.5)' });
  }
  for(const z of G.zombies){
    if(z.state==='dying') continue;
    if(Math.abs(z.row-row) <= (big?1:0) && Math.abs(z.x-x) < (big?132:58)){
      damageZombie(z, 1800);
    }
  }
}

// 加特林导弹：3x3 格子（九格）范围爆炸
export function explodeMissile(x, row, col){
  G.shake = Math.max(G.shake, 0.3);
  G.flash = Math.max(G.flash, 0.15);
  SFX.boom();
  G.decals.push({ x, fy: LY + row*CH + CH/2, ttl:4, max:4, r:72 });
  for(let i=0;i<30;i++){
    const a = rand(0,TAU), sp = rand(30,240);
    G.parts.push({ x, y:LY+row*CH+CH/2, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-50, g:240,
      life:rand(0.25,0.6), max:0.6, size:rand(2,6),
      color:['#ffdf6e','#ff9a2e','#ff5a2e','#9a9a92'][randi(0,3)] });
  }
  const c = (col !== undefined) ? col : Math.floor((x - LX)/CW);
  for(const z of G.zombies){
    if(z.state==='dying') continue;
    const zc = Math.floor((z.x - LX)/CW);
    if(Math.abs(z.row - row) <= 1 && Math.abs(zc - c) <= 1){
      damageZombie(z, 90);
    }
  }
}

export function damageZombie(z, d){
  if(z.acc > 0){
    z.acc -= d;
    if(z.acc < 0){ z.hp += z.acc; z.acc = 0; }
  } else {
    z.hp -= d;
  }
  // 报纸僵尸：报纸（护盾）被打掉后狂暴
  if(z.type==='newspaper' && !z.angry && z.acc <= 0 && z.state !== 'dying'){
    z.angry = true;
    z.speed = 34 * rand(0.94,1.08);
    z.slowT = 0;
    addPaperShreds(z.x, LY + (z.row+1)*CH - 76);
    SFX.paperTear();
    SFX.angry();
  }
  if(z.hp <= 0 && z.state !== 'dying'){
    z.state = 'dying'; z.deathT = 0;
    G.killed++;
    SFX.groan();
  }
}

export function spawnZombie(type){
  const def = ZTYPES[type];
  let row = randi(0, ROWS-1);
  if(G.lastRows.length>=2 && G.lastRows[0]===row && G.lastRows[1]===row){
    row = (row + randi(1, ROWS-1)) % ROWS;
  }
  G.lastRows.unshift(row);
  if(G.lastRows.length>3) G.lastRows.length = 3;
  G.zombies.push({
    type, row,
    x: W + 40 + rand(0,40),
    speed: def.speed * rand(0.92,1.08),
    hp: def.hp, acc: def.acc, maxHp: def.hp + def.acc,
    state:'walk', animT: rand(0,TAU), eatT:0, slowT:0,
    poleLost:false, vt:0, fromX:0, toX:0, vy:0, deathT:0, eatPlant:null, dustT:0,
    paper: type==='newspaper' ? ZTYPES.newspaper.acc : 0, angry:false,
  });
}

export function findEatTarget(z){
  let best = null;
  for(let c=0;c<COLS;c++){
    const p = G.grid[z.row][c];
    if(!p) continue;
    if(p.type==='potato') continue; // 土豆雷不会被啃，踩中即炸
    if(p.cx >= z.x - 26) continue;
    if(p.cx < z.x - 92) continue;
    if(!best || p.cx > best.cx) best = p;
  }
  return best;
}

export function triggerMower(row){
  const m = G.mowers.find(m=>m.row===row && m.state==='idle');
  if(m){ m.state = 'run'; SFX.mower(); return true; }
  return false;
}

