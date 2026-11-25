// 显式动作入口：界面只负责定位目标，规则、扣费与冷却在这里统一提交。
// 全部动作返回 { ok, reason }；失败不得部分扣费、推进冷却或改变目标。

import { COLS, ROWS } from './constants.js';
import { LEVELS } from './data/levels.js';
import { PLANTS } from './data/plants.js';
import { addLeafBurst } from './particles.js';
import { applyCoffee, placePlant, removePlant } from './entities.js';
import { startLevel } from './world.js';

function inBounds(row, col){
  return row>=0 && row<ROWS && col>=0 && col<COLS;
}

// 只读判断：悬停提示与提交动作共用。
//
// 冷却与阳光对所有卡一视同仁，挡在分支之前：咖啡豆同样要花阳光，没有任何玩法理由让它豁免。
// 曾经的写法是「咖啡豆分支不校验阳光」并注释为「当前不可达」——不可达只是这一版的巧合
// （pickSlot 已经先挡过一次），代价却是一个在悬停层看起来合法、在提交层却会扣成负数的缺口。
// 悬停高亮与提交共用本函数，豁免在这里就等于同时放行了「看起来能种」和「真的扣费」。
export function inspectUseCard(world, slotIndex, row, col){
  if(!inBounds(row, col)) return { ok:false, reason:'out-of-bounds' };
  const s = world.slots[slotIndex];
  if(!s) return { ok:false, reason:'no-slot' };
  const def = PLANTS[s.type];
  if(s.cool > 0) return { ok:false, reason:'cooling', def };
  if(world.sun < def.cost) return { ok:false, reason:'not-enough-sun', def };
  const target = world.grid[row][col];
  if(s.type === 'coffee'){
    if(!(target && target.asleep)) return { ok:false, reason:'invalid-target', def };
    return { ok:true, kind:'coffee', def };
  }
  if(target) return { ok:false, reason:'occupied', def };
  return { ok:true, kind:'plant', def };
}

export function useCard(world, slotIndex, row, col){
  if(world.state !== 'play') return { ok:false, reason:'wrong-state' };
  if(world.paused) return { ok:false, reason:'paused' };
  const check = inspectUseCard(world, slotIndex, row, col);
  if(!check.ok){
    if(check.reason === 'not-enough-sun'){
      world.ports.sound('error');
      world.sunFlash = 0.5;
    } else if(check.reason === 'cooling' || check.reason === 'occupied' || check.reason === 'invalid-target'){
      world.ports.sound('error');
    }
    return check;
  }
  const s = world.slots[slotIndex];
  const def = check.def;
  if(check.kind === 'coffee'){
    if(!applyCoffee(world, world.grid[row][col])) return { ok:false, reason:'invalid-target', def };
    world.sun -= def.cost;
    s.cool = def.cool;
    return { ok:true };
  }
  placePlant(world, s.type, row, col);
  s.cool = def.cool;
  return { ok:true };
}

export function pickSlot(world, ui, slotIndex){
  if(world.state !== 'play') return { ok:false, reason:'wrong-state' };
  if(world.paused) return { ok:false, reason:'paused' };
  const s = world.slots[slotIndex];
  if(!s) return { ok:false, reason:'no-slot' };
  const def = PLANTS[s.type];
  if(ui.sel === slotIndex){
    ui.sel = -1;
    world.ports.sound('click');
    return { ok:true, deselected:true };
  }
  if(s.cool > 0){
    world.ports.sound('error');
    return { ok:false, reason:'cooling' };
  }
  if(world.sun < def.cost){
    world.ports.sound('error');
    world.sunFlash = 0.5;
    return { ok:false, reason:'not-enough-sun' };
  }
  ui.sel = slotIndex; ui.shovel = false;
  world.ports.sound('select');
  return { ok:true };
}

export function toggleShovel(world, ui){
  if(world.state !== 'play') return { ok:false, reason:'wrong-state' };
  if(world.paused) return { ok:false, reason:'paused' };
  ui.shovel = !ui.shovel; ui.sel = -1;
  world.ports.sound('click');
  return { ok:true, active:ui.shovel };
}

export function pressCell(world, ui, row, col){
  if(world.state !== 'play') return { ok:false, reason:'wrong-state' };
  if(world.paused) return { ok:false, reason:'paused' };
  if(!inBounds(row, col)) return { ok:false, reason:'out-of-bounds' };
  if(ui.shovel){
    const p = world.grid[row][col];
    if(!p) return { ok:false, reason:'empty' };
    addLeafBurst(world, p.cx, p.fy-30);
    removePlant(world, p);
    world.ports.sound('dig');
    ui.shovel = false;
    return { ok:true };
  }
  if(ui.sel >= 0){
    const r = useCard(world, ui.sel, row, col);
    if(r.ok) ui.sel = -1;
    return r;
  }
  return { ok:false, reason:'no-selection' };
}

// 阳光飞到资源栏才到账由 sim.js 负责；这里只把最近的一颗标记为飞行。
export function collectSun(world, x, y){
  if(world.state !== 'play') return { ok:false, reason:'wrong-state' };
  if(world.paused) return { ok:false, reason:'paused' };
  for(let i=world.suns.length-1;i>=0;i--){
    const s = world.suns[i];
    if(s.state === 'fly') continue;
    const dx = x - s.x, dy = y - s.y;
    if(dx*dx + dy*dy < 36*36){
      s.state = 'fly'; s.ft = 0;
      return { ok:true };
    }
  }
  return { ok:false, reason:'no-sun' };
}

export function chooseLevel(world, ui, li){
  if(!Number.isInteger(li) || li < 0 || li >= LEVELS.length) return { ok:false, reason:'bad-level' };
  if(!world.unlockAll && li+1 > world.unlocked) return { ok:false, reason:'locked' };
  startLevel(world, li);
  ui.sel = -1; ui.shovel = false;
  return { ok:true };
}

export function togglePause(world){
  if(world.state !== 'play') return { ok:false, reason:'wrong-state' };
  world.paused = !world.paused;
  world.ports.sound('click');
  return { ok:true, paused:world.paused };
}

export function removeSlot(world, ui, slotIndex){
  if(!world.slots[slotIndex]) return { ok:false, reason:'no-slot' };
  world.slots.splice(slotIndex, 1);
  if(ui.sel === slotIndex) ui.sel = -1;
  else if(ui.sel > slotIndex) ui.sel--;
  world.ports.sound('click');
  return { ok:true };
}

export function pickTeamPlant(world, ui, type){
  const lv = LEVELS[world.level];
  const idx = world.slots.findIndex(s=>s.type === type);
  if(idx >= 0){
    world.slots.splice(idx, 1);
    world.ports.sound('click');
    return { ok:true, added:false };
  }
  if(world.slots.length >= lv.slots){
    world.ports.sound('error');
    return { ok:false, reason:'team-full' };
  }
  world.slots.push({ type, cool:0 });
  world.ports.sound('select');
  return { ok:true, added:true };
}
