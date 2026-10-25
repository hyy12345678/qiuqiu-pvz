// 关卡推进：一帧之内的全部模拟步骤。渲染字段（AT/hoverCell/mouse/hotspots）不在这里出现。

import { CH, COLS, CW, LX, LY, ROWS, W } from './constants.js';
import { clamp, easeOut, lerp, rand } from './util.js';
import { ZTYPES } from './data/zombies.js';
import { LEVELS } from './data/levels.js';
import { saveUnlocked } from './persist.js';
import { SFX } from '../audio/sfx.js';
import { G } from './world.js';
import { damageZombie, explode, explodeMissile, findEatTarget, removePlant, spawnSun, spawnZombie, triggerMower } from './entities.js';
import { addDirtPuff, addFlamePuff, addLeafBurst, addPeaSplat } from './particles.js';

export function updatePlay(dt){
  G.t += dt;
  const t = G.t;
  const lv = LEVELS[G.level];
  if(G.nightHint > 0) G.nightHint -= dt;

  if(t > 0){
    while(G.evIdx < G.events.length && G.events[G.evIdx].t <= t){
      const e = G.events[G.evIdx++];
      if(e.announce){
        G.waveText = { text:'一大波僵尸正在接近！', t:0 };
        SFX.horn();
      } else spawnZombie(e.type);
    }
    // 夜间关卡：天上不会掉太阳，只能靠向日葵
    if(!lv.night){
      G.skyTimer -= dt;
      if(G.skyTimer <= 0){
        G.skyTimer = rand(4.5, 6.5);
        spawnSun(rand(LX+30, LX+COLS*CW-30), -30, rand(LY+60, LY+ROWS*CH-40), true);
      }
    }
  }

  // 植物
  for(let i=G.plants.length-1;i>=0;i--){
    const p = G.plants[i];
    if(p.hp <= 0){ removePlant(p); addLeafBurst(p.cx, p.fy-30); continue; }
    p.recoil = Math.max(0, p.recoil - dt*(p.type==='qiuqiu' ? 4 : 1.4));
    p.flash = Math.max(0, (p.flash||0) - dt);
    switch(p.type){
      case 'sunflower':
        if(t > 0){
          p.sunT -= dt;
          if(p.sunT <= 0){
            p.sunT = rand(8, 10);
            spawnSun(p.cx + rand(-14,14), p.fy-88, p.fy-30, false);
          }
        }
        break;
      case 'peashooter': case 'snowpea': case 'repeater': case 'qiuqiu': {
        p.fireT -= dt;
        let has = false;
        for(const z of G.zombies){
          if(z.row===p.row && z.state!=='dying' && z.x > p.cx-8 && z.x < W+50){ has = true; break; }
        }
        if(has && p.fireT <= 0 && t > 0){
          if(p.type==='qiuqiu'){
            p.fireT = 0.4; p.recoil = 1; p.flash = 0.1;
            const py = p.fy - 44;
            const isMissile = Math.random() < 0.15;
            const type = isMissile ? 'missile' : 'bullet';
            const dmg = isMissile ? 90 : 25;
            const vx = isMissile ? 300 : 520;
            G.peas.push({ x:p.cx+52, y:py, row:p.row, type, dmg, vx, prevX:p.cx+52 });
            if(isMissile) SFX.missile(); else SFX.gatling();
          } else {
            p.fireT = 1.4; p.recoil = 1; p.flash = 0.09;
            const py = p.fy - 52;
            const kind = p.type==='snowpea' ? 'snow' : 'pea';
            G.peas.push({ x:p.cx+30, y:py, row:p.row, type:kind, dmg:20, vx:340, prevX:p.cx+30 });
            if(p.type==='repeater'){
              G.peas.push({ x:p.cx+12, y:py+6, row:p.row, type:kind, dmg:20, vx:340, prevX:p.cx+12 });
            }
            if(kind==='snow') SFX.snowShoot(); else SFX.shoot();
          }
        }
        break;
      }
      case 'potato':
        if(!p.armed){
          p.armT += dt;
          if(p.armT >= 14){ p.armed = true; addDirtPuff(p.cx, p.fy); }
        } else {
          for(const z of G.zombies){
            if(z.row===p.row && z.state!=='dying' && Math.abs(z.x - p.cx) < 34){
              removePlant(p);
              explode(p.cx, p.row, false);
              break;
            }
          }
        }
        break;
      case 'cherry':
        p.fuse -= dt;
        if(p.fuse <= 0){
          removePlant(p);
          explode(p.cx, p.row, true);
        }
        break;
    }
  }

  // 豌豆
  for(let i=G.peas.length-1;i>=0;i--){
    const pea = G.peas[i];
    pea.prevX = pea.x;
    pea.x += pea.vx * dt;
    if(pea.type==='fire' && Math.random()<0.6){
      G.parts.push({ x:pea.x-8, y:pea.y+rand(-3,3), vx:rand(-30,-10), vy:rand(-25,5), g:-60, life:rand(0.15,0.3), max:0.3, size:rand(2,4), color:'#ffb347' });
    }
    if(pea.type === 'pea' || pea.type === 'snow'){
      for(const p of G.plants){
        if(p.type==='torch' && p.row===pea.row && pea.prevX < p.cx && pea.x >= p.cx){
          pea.type = 'fire'; pea.dmg *= 2;
          addFlamePuff(p.cx, pea.y);
        }
      }
    }
    let hit = false;
    for(const z of G.zombies){
      if(z.row===pea.row && z.state!=='dying' && pea.x >= z.x-24 && pea.x <= z.x+16){
        if(pea.type==='missile'){
          explodeMissile(pea.x, pea.row, Math.floor((pea.x - LX)/CW));
          hit = true;
          break;
        }
        damageZombie(z, pea.dmg);
        if(pea.type==='snow'){ z.slowT = 6; }
        if(pea.type==='fire'){
          for(const z2 of G.zombies){
            if(z2!==z && z2.row===pea.row && z2.state!=='dying' && Math.abs(z2.x-z.x)<45){
              damageZombie(z2, 20);
            }
          }
        }
        addPeaSplat(pea.x, pea.y, pea.type);
        if(pea.type==='bullet') SFX.bulletHit(); else SFX.splat();
        hit = true;
        break;
      }
    }
    if(hit || pea.x > W+60) G.peas.splice(i,1);
  }

  // 僵尸
  let lost = false;
  for(let i=G.zombies.length-1;i>=0;i--){
    const z = G.zombies[i];
    if(z.state==='dying'){
      z.deathT += dt;
      if(z.deathT > 0.95) G.zombies.splice(i,1);
      continue;
    }
    if(z.slowT > 0) z.slowT -= dt;
    const slowMul = z.slowT > 0 ? 0.45 : 1;
    if(t <= 0) continue;

    if(z.state==='walk'){
      const animMul = (z.type==='vault' && !z.poleLost) ? 1.7 : (z.angry ? 2.1 : 1);
      z.animT += dt * slowMul * animMul;
      z.x -= z.speed * slowMul * dt;
      // 脚步扬尘
      z.dustT = (z.dustT||0) + dt;
      if(z.dustT > 0.5 && z.x > LX-30 && z.x < W){
        z.dustT = 0;
        G.parts.push({ x:z.x+rand(-6,10), y:LY+(z.row+1)*CH-6, vx:rand(-14,6), vy:rand(-22,-8), g:30, life:rand(0.3,0.55), max:0.55, size:rand(2,4), color:'rgba(150,140,110,0.4)' });
      }
      if(z.type==='vault' && !z.poleLost){
        let target = null;
        for(let c=COLS-1;c>=0;c--){
          const p = G.grid[z.row][c];
          if(p && !(p.type==='potato' && !p.armed) && p.cx < z.x-6 && p.cx > z.x-150){ target = p; break; }
        }
        if(target){
          z.state = 'vault'; z.vt = 0; z.fromX = z.x;
          z.toX = Math.max(target.cx - CW + 18, LX - 10);
          SFX.hop();
          continue;
        }
      }
      const food = findEatTarget(z);
      if(food){
        z.state = 'eat'; z.eatT = 0; z.eatPlant = food;
        z.x = Math.max(z.x, food.cx + 40);
      }
    } else if(z.state==='vault'){
      z.vt += dt / 0.55;
      if(z.vt >= 1){
        z.x = z.toX; z.state = 'walk'; z.poleLost = true;
        z.speed = ZTYPES.normal.speed * rand(0.92,1.08);
        z.vy = 0;
        addDirtPuff(z.x, LY+(z.row+1)*CH-6);
      } else {
        z.x = lerp(z.fromX, z.toX, easeOut(z.vt));
        z.vy = -Math.sin(Math.PI * z.vt) * 72;
      }
    } else if(z.state==='eat'){
      z.eatT += dt;
      if(Math.floor(z.eatT/0.62) !== Math.floor((z.eatT-dt)/0.62)) SFX.chomp();
      const p = z.eatPlant;
      if(!p || p.hp <= 0 || G.grid[z.row][p.col] !== p){
        z.state = 'walk'; z.eatPlant = null;
      } else {
        p.hp -= 100 * dt;
        if(p.hp <= 0){
          addLeafBurst(p.cx, p.fy-30);
          removePlant(p);
          z.state = 'walk'; z.eatPlant = null;
          SFX.chomp();
        }
      }
    }
    if(z.state!=='dying' && z.x < LX + 14){
      const m = G.mowers.find(m=>m.row===z.row && m.state==='idle');
      if(m) triggerMower(z.row);
      else if(z.x < LX - 72){ lost = true; G.loseZombie = z; }
    }
  }
  if(lost){
    G.state = 'lost';
    SFX.lose();
    return;
  }

  // 小推车
  for(const m of G.mowers){
    if(m.state==='run'){
      m.x += 330 * dt;
      if(Math.random()<0.55){
        G.parts.push({ x:m.x+rand(6,26), y:LY+m.row*CH+CH-8, vx:rand(-60,20), vy:rand(-140,-60), g:300, life:rand(0.25,0.5), max:0.5, size:rand(2,4), color:'#7cc24a' });
      }
      for(const z of G.zombies){
        if(z.row===m.row && z.state!=='dying' && z.x < m.x+52 && z.x > m.x-70){
          damageZombie(z, 9999);
        }
      }
      if(m.x > W+80) m.state = 'gone';
    }
  }

  // 阳光
  for(let i=G.suns.length-1;i>=0;i--){
    const s = G.suns[i];
    s.t += dt;
    if(s.state==='fall'){
      s.y += (s.fromSky?130:105) * dt;
      s.x = s.sx + Math.sin(s.t*2.4) * (s.fromSky?9:4);
      if(s.y >= s.ty){ s.y = s.ty; s.state='idle'; s.t=0; }
    } else if(s.state==='idle'){
      s.life -= dt;
      if(s.life <= 0){ G.suns.splice(i,1); }
    } else if(s.state==='fly'){
      s.ft += dt / 0.42;
      if(s.ft >= 1){
        G.sun = Math.min(9990, G.sun + s.value);
        G.sunFlash = 0.35;
        SFX.sun();
        G.suns.splice(i,1);
      }
    }
  }
  if(G.sunFlash > 0) G.sunFlash -= dt;

  // 粒子 / 焦痕
  for(let i=G.parts.length-1;i>=0;i--){
    const p = G.parts[i];
    p.life -= dt;
    if(p.life <= 0){ G.parts.splice(i,1); continue; }
    p.x += p.vx*dt; p.y += p.vy*dt;
    if(p.g) p.vy += p.g*dt;
  }
  for(let i=G.decals.length-1;i>=0;i--){
    G.decals[i].ttl -= dt;
    if(G.decals[i].ttl <= 0) G.decals.splice(i,1);
  }

  if(G.zombies.length > 0){
    G.groanTimer -= dt;
    if(G.groanTimer <= 0){ G.groanTimer = rand(4,9); SFX.groan(); }
  }

  if(G.waveText){
    G.waveText.t += dt;
    if(G.waveText.t > 2.6) G.waveText = null;
  }

  if(G.evIdx >= G.events.length && G.zombies.length === 0 && t > 0){
    G.winT += dt;
    if(G.winT > 1.0){
      G.state = 'won';
      if(G.level + 2 > G.unlocked){ G.unlocked = clamp(G.level+2, 1, LEVELS.length); saveUnlocked(G.unlocked); }
      SFX.win();
    }
  }

  for(const s of G.slots) if(s.cool > 0) s.cool = Math.max(0, s.cool - dt);

  if(G.shake > 0) G.shake -= dt;
  if(G.flash > 0) G.flash = Math.max(0, G.flash - dt*1.4);
}
