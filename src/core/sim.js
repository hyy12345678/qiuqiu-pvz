// 关卡推进：一帧之内的全部模拟步骤。渲染字段（AT/hoverCell/mouse/hotspots）不在这里出现。

import { CH, COLS, CW, LX, LY, ROWS, W } from './constants.js';
import { clamp, easeOut, lerp, rand } from './util.js';
import { ZTYPES } from './data/zombies.js';
import { LEVELS } from './data/levels.js';
import { damageZombie, explode, explodeMissile, findEatTarget, removePlant, spawnSun, spawnZombie, triggerMower } from './entities.js';
import { addDirtPuff, addFlamePuff, addLeafBurst, addPeaSplat } from './particles.js';

export function updatePlay(world, dt){
  world.t += dt;
  const t = world.t;
  const lv = LEVELS[world.level];
  const v = world.visual;
  if(v.nightHint > 0) v.nightHint -= dt;

  if(t > 0){
    while(world.evIdx < world.events.length && world.events[world.evIdx].t <= t){
      const e = world.events[world.evIdx++];
      if(e.announce){
        v.waveText = { text:'一大波僵尸正在接近！', t:0 };
        world.ports.sound('horn');
      } else spawnZombie(world, e.type);
    }
    // 夜间关卡：天上不会掉太阳，只能靠向日葵
    if(!lv.night){
      world.skyTimer -= dt;
      if(world.skyTimer <= 0){
        world.skyTimer = rand(world.rng,4.5, 6.5);
        // 落点决定落地时刻与可点击位置，属于战斗可见状态，不能交给表现流
        spawnSun(world, rand(world.rng,LX+30, LX+COLS*CW-30), -30, rand(world.rng,LY+60, LY+ROWS*CH-40), true);
      }
    }
  }

  // 植物
  for(let i=world.plants.length-1;i>=0;i--){
    const p = world.plants[i];
    if(p.hp <= 0){ removePlant(world, p); addLeafBurst(world, p.cx, p.fy-30); continue; }
    p.recoil = Math.max(0, p.recoil - dt*(p.type==='qiuqiu' ? 4 : 1.4));
    p.flash = Math.max(0, (p.flash||0) - dt);
    if(p.asleep) continue;   // 白天没被咖啡豆唤醒的蘑菇：占着格子、能被啃，但什么都不干
    switch(p.type){
      case 'sunflower': case 'sunshroom':
        if(t > 0){
          p.sunT -= dt;
          if(p.sunT <= 0){
            p.sunT = rand(world.rng,8, 10);
            // 阳光菇的代价：产量只有向日葵的一半；落点同样属于战斗可见状态
            const small = p.type === 'sunshroom';
            spawnSun(world, p.cx + rand(world.rng,-14,14), p.fy - (small ? 46 : 88), p.fy-30, false, small ? 25 : 50);
          }
        }
        break;
      case 'puff': case 'peashooter': case 'snowpea': case 'repeater': case 'qiuqiu': {
        p.fireT -= dt;
        const reach = p.type==='puff' ? p.cx + CW*2 : W + 50;   // 小喷菇免费换来的短射程
        let has = false;
        for(const z of world.zombies){
          if(z.row===p.row && z.state!=='dying' && z.x > p.cx-8 && z.x < reach){ has = true; break; }
        }
        if(has && p.fireT <= 0 && t > 0){
          if(p.type==='qiuqiu'){
            p.fireT = 0.4; p.recoil = 1; p.flash = 0.1;
            const py = p.fy - 44;
            const isMissile = world.rng() < 0.15;
            const type = isMissile ? 'missile' : 'bullet';
            const dmg = isMissile ? 90 : 25;
            const vx = isMissile ? 300 : 520;
            world.peas.push({ x:p.cx+52, y:py, row:p.row, type, dmg, vx, prevX:p.cx+52 });
            if(isMissile) world.ports.sound('missile'); else world.ports.sound('gatling');
          } else if(p.type==='puff'){
            p.fireT = 1.5; p.recoil = 1; p.flash = 0.09;
            const py = p.fy - 28;
            world.peas.push({ x:p.cx+14, y:py, row:p.row, type:'spore', dmg:20, vx:300, prevX:p.cx+14 });
            world.ports.sound('shoot');
          } else {
            p.fireT = 1.4; p.recoil = 1; p.flash = 0.09;
            const py = p.fy - 52;
            const kind = p.type==='snowpea' ? 'snow' : 'pea';
            world.peas.push({ x:p.cx+30, y:py, row:p.row, type:kind, dmg:20, vx:340, prevX:p.cx+30 });
            if(p.type==='repeater'){
              world.peas.push({ x:p.cx+12, y:py+6, row:p.row, type:kind, dmg:20, vx:340, prevX:p.cx+12 });
            }
            if(kind==='snow') world.ports.sound('snowShoot'); else world.ports.sound('shoot');
          }
        }
        break;
      }
      case 'potato':
        if(!p.armed){
          p.armT += dt;
          if(p.armT >= 14){ p.armed = true; addDirtPuff(world, p.cx, p.fy); }
        } else {
          for(const z of world.zombies){
            if(z.row===p.row && z.state!=='dying' && Math.abs(z.x - p.cx) < 34){
              removePlant(world, p);
              explode(world, p.cx, p.row, false);
              break;
            }
          }
        }
        break;
      case 'cherry':
        p.fuse -= dt;
        if(p.fuse <= 0){
          removePlant(world, p);
          explode(world, p.cx, p.row, true);
        }
        break;
    }
  }

  // 豌豆
  for(let i=world.peas.length-1;i>=0;i--){
    const pea = world.peas[i];
    pea.prevX = pea.x;
    pea.x += pea.vx * dt;
    if(pea.type==='fire' && world.fxRng()<0.6){
      v.parts.push({ x:pea.x-8, y:pea.y+rand(world.fxRng,-3,3), vx:rand(world.fxRng,-30,-10), vy:rand(world.fxRng,-25,5), g:-60, life:rand(world.fxRng,0.15,0.3), max:0.3, size:rand(world.fxRng,2,4), color:'#ffb347' });
    }
    if(pea.type === 'pea' || pea.type === 'snow'){
      for(const p of world.plants){
        if(p.type==='torch' && p.row===pea.row && pea.prevX < p.cx && pea.x >= p.cx){
          pea.type = 'fire'; pea.dmg *= 2;
          addFlamePuff(world, p.cx, pea.y);
        }
      }
    }
    let hit = false;
    for(const z of world.zombies){
      if(z.row===pea.row && z.state!=='dying' && pea.x >= z.x-24 && pea.x <= z.x+16){
        if(pea.type==='missile'){
          explodeMissile(world, pea.x, pea.row, Math.floor((pea.x - LX)/CW));
          hit = true;
          break;
        }
        damageZombie(world, z, pea.dmg);
        if(pea.type==='snow'){ z.slowT = 6; }
        if(pea.type==='fire'){
          for(const z2 of world.zombies){
            if(z2!==z && z2.row===pea.row && z2.state!=='dying' && Math.abs(z2.x-z.x)<45){
              damageZombie(world, z2, 20);
            }
          }
        }
        addPeaSplat(world, pea.x, pea.y, pea.type);
        if(pea.type==='bullet') world.ports.sound('bulletHit'); else world.ports.sound('splat');
        hit = true;
        break;
      }
    }
    if(hit || pea.x > W+60) world.peas.splice(i,1);
  }

  // 僵尸
  let lost = false;
  for(let i=world.zombies.length-1;i>=0;i--){
    const z = world.zombies[i];
    if(z.state==='dying'){
      z.deathT += dt;
      if(z.deathT > 0.95) world.zombies.splice(i,1);
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
        v.parts.push({ x:z.x+rand(world.fxRng,-6,10), y:LY+(z.row+1)*CH-6, vx:rand(world.fxRng,-14,6), vy:rand(world.fxRng,-22,-8), g:30, life:rand(world.fxRng,0.3,0.55), max:0.55, size:rand(world.fxRng,2,4), color:'rgba(150,140,110,0.4)' });
      }
      if(z.type==='vault' && !z.poleLost){
        let target = null;
        for(let c=COLS-1;c>=0;c--){
          const p = world.grid[z.row][c];
          if(p && !(p.type==='potato' && !p.armed) && p.cx < z.x-6 && p.cx > z.x-150){ target = p; break; }
        }
        if(target){
          z.state = 'vault'; z.vt = 0; z.fromX = z.x;
          z.toX = Math.max(target.cx - CW + 18, LX - 10);
          world.ports.sound('hop');
          continue;
        }
      }
      const food = findEatTarget(world, z);
      if(food){
        z.state = 'eat'; z.eatT = 0; z.eatPlant = food;
        z.x = Math.max(z.x, food.cx + 40);
      }
    } else if(z.state==='vault'){
      z.vt += dt / 0.55;
      if(z.vt >= 1){
        z.x = z.toX; z.state = 'walk'; z.poleLost = true;
        z.speed = ZTYPES.normal.speed * rand(world.rng,0.92,1.08);
        z.vy = 0;
        addDirtPuff(world, z.x, LY+(z.row+1)*CH-6);
      } else {
        z.x = lerp(z.fromX, z.toX, easeOut(z.vt));
        z.vy = -Math.sin(Math.PI * z.vt) * 72;
      }
    } else if(z.state==='eat'){
      z.eatT += dt;
      if(Math.floor(z.eatT/0.62) !== Math.floor((z.eatT-dt)/0.62)) world.ports.sound('chomp');
      const p = z.eatPlant;
      if(!p || p.hp <= 0 || world.grid[z.row][p.col] !== p){
        z.state = 'walk'; z.eatPlant = null;
      } else {
        p.hp -= 100 * dt;
        if(p.hp <= 0){
          addLeafBurst(world, p.cx, p.fy-30);
          removePlant(world, p);
          z.state = 'walk'; z.eatPlant = null;
          world.ports.sound('chomp');
        }
      }
    }
    if(z.state!=='dying' && z.x < LX + 14){
      const m = world.mowers.find(m=>m.row===z.row && m.state==='idle');
      if(m) triggerMower(world, z.row);
      else if(z.x < LX - 72){ lost = true; world.loseZombie = z; }
    }
  }
  if(lost){
    world.state = 'lost';
    world.ports.sound('lose');
    return;
  }

  // 小推车
  for(const m of world.mowers){
    if(m.state==='run'){
      m.x += 330 * dt;
      if(world.fxRng()<0.55){
        v.parts.push({ x:m.x+rand(world.fxRng,6,26), y:LY+m.row*CH+CH-8, vx:rand(world.fxRng,-60,20), vy:rand(world.fxRng,-140,-60), g:300, life:rand(world.fxRng,0.25,0.5), max:0.5, size:rand(world.fxRng,2,4), color:'#7cc24a' });
      }
      for(const z of world.zombies){
        if(z.row===m.row && z.state!=='dying' && z.x < m.x+52 && z.x > m.x-70){
          damageZombie(world, z, 9999);
        }
      }
      if(m.x > W+80) m.state = 'gone';
    }
  }

  // 阳光
  for(let i=world.suns.length-1;i>=0;i--){
    const s = world.suns[i];
    s.t += dt;
    if(s.state==='fall'){
      s.y += (s.fromSky?130:105) * dt;
      s.x = s.sx + Math.sin(s.t*2.4) * (s.fromSky?9:4);
      if(s.y >= s.ty){ s.y = s.ty; s.state='idle'; s.t=0; }
    } else if(s.state==='idle'){
      s.life -= dt;
      if(s.life <= 0){ world.suns.splice(i,1); }
    } else if(s.state==='fly'){
      s.ft += dt / 0.42;
      if(s.ft >= 1){
        world.sun = Math.min(9990, world.sun + s.value);
        world.sunFlash = 0.35;
        world.ports.sound('sun');
        world.suns.splice(i,1);
      }
    }
  }
  if(world.sunFlash > 0) world.sunFlash -= dt;

  // 粒子 / 焦痕
  for(let i=v.parts.length-1;i>=0;i--){
    const p = v.parts[i];
    p.life -= dt;
    if(p.life <= 0){ v.parts.splice(i,1); continue; }
    p.x += p.vx*dt; p.y += p.vy*dt;
    if(p.g) p.vy += p.g*dt;
  }
  for(let i=v.decals.length-1;i>=0;i--){
    v.decals[i].ttl -= dt;
    if(v.decals[i].ttl <= 0) v.decals.splice(i,1);
  }

  if(world.zombies.length > 0){
    v.groanTimer -= dt;
    if(v.groanTimer <= 0){ v.groanTimer = rand(world.fxRng,4,9); world.ports.sound('groan'); }
  }

  if(v.waveText){
    v.waveText.t += dt;
    if(v.waveText.t > 2.6) v.waveText = null;
  }

  if(world.evIdx >= world.events.length && world.zombies.length === 0 && t > 0){
    world.winT += dt;
    if(world.winT > 1.0){
      world.state = 'won';
      if(world.level + 2 > world.unlocked){ world.unlocked = clamp(world.level+2, 1, LEVELS.length); world.ports.saveProgress(world.unlocked); }
      world.ports.sound('win');
    }
  }

  for(const s of world.slots) if(s.cool > 0) s.cool = Math.max(0, s.cool - dt);

  if(v.shake > 0) v.shake -= dt;
  if(v.flash > 0) v.flash = Math.max(0, v.flash - dt*1.4);
}
