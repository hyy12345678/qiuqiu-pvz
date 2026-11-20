// 战斗场景：背景、实体、悬停提示与 HUD 的绘制顺序保持原样。

import { W, H, ROWS, CW, CH, LX, LY, TAU } from '../../core/constants.js';
import { clamp } from '../../core/util.js';
import { PLANTS } from '../../core/data/plants.js';
import { LEVELS } from '../../core/data/levels.js';
import { isNight } from '../../core/world.js';
import { cellCX, cellFY } from '../../core/entities.js';
import { inspectUseCard } from '../../core/actions.js';
import { ctx } from '../target.js';
import { rr, O, drawText } from '../paint.js';
import { drawBackground } from '../background.js';
import { drawPlantEntity } from '../plant.js';
import { drawZombieEntity } from '../zombie.js';
import { drawPea, drawSun } from '../projectile.js';
import { drawMower } from '../mower.js';
import { drawSeedBank, drawProgressBar, drawTopRightButtons, drawWaveText, drawIntro, drawShovelIcon } from '../hud.js';

// ---------------- 绘制：场景 ----------------
export function renderPlay(t, world, ui, musicOn){
  drawBackground(world, t);

  for(const d of world.visual.decals){
    ctx.save();
    ctx.globalAlpha = clamp(d.ttl/d.max, 0, 1) * 0.55;
    let g = ctx.createRadialGradient(d.x, d.fy, 4, d.x, d.fy, d.r);
    g.addColorStop(0,'rgba(40,28,12,0.9)'); g.addColorStop(1,'rgba(40,28,12,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(d.x, d.fy, d.r, d.r*0.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  for(const m of world.mowers) drawMower(t, m);

  // 悬停高亮 + 幽灵植物
  const hc = ui.hoverCell;
  if(hc && world.state==='play' && !world.paused){
    const x = LX + hc.col*CW, y = LY + hc.row*CH;
    if(ui.shovel){
      ctx.fillStyle = 'rgba(220,90,45,0.3)';
      ctx.fillRect(x, y, CW, CH);
      ctx.strokeStyle = 'rgba(220,90,45,0.85)'; ctx.lineWidth = 2.5;
      ctx.strokeRect(x+2, y+2, CW-4, CH-4);
    } else if(ui.sel >= 0){
      const selType = world.slots[ui.sel].type;
      // 咖啡豆反过来：只有「睡着的蘑菇」是合法目标，空格子反而不行
      const isCoffee = selType === 'coffee';
      const ok = inspectUseCard(world, ui.sel, hc.row, hc.col).ok;
      ctx.fillStyle = ok ? 'rgba(255,255,220,0.32)' : 'rgba(200,40,30,0.32)';
      ctx.fillRect(x, y, CW, CH);
      ctx.strokeStyle = ok ? 'rgba(255,250,200,0.9)' : 'rgba(230,60,40,0.9)';
      ctx.lineWidth = 2.5;
      const bl = 12, pu = Math.sin(t*6)*1.5;
      ctx.beginPath();
      ctx.moveTo(x+2, y+2+bl+pu); ctx.lineTo(x+2, y+2); ctx.lineTo(x+2+bl+pu, y+2);
      ctx.moveTo(x+CW-2-bl-pu, y+2); ctx.lineTo(x+CW-2, y+2); ctx.lineTo(x+CW-2, y+2+bl+pu);
      ctx.moveTo(x+CW-2, y+CH-2-bl-pu); ctx.lineTo(x+CW-2, y+CH-2); ctx.lineTo(x+CW-2-bl-pu, y+CH-2);
      ctx.moveTo(x+2+bl+pu, y+CH-2); ctx.lineTo(x+2, y+CH-2); ctx.lineTo(x+2, y+CH-2-bl-pu);
      ctx.stroke();
      if(ok && !isCoffee){
        ctx.save();
        ctx.globalAlpha = 0.55;
        const ghost = { type:selType, cx:cellCX(hc.col), fy:cellFY(hc.row), phase:0, armed:true, fuse:0.9, hp:1, maxHp:1, recoil:0, flash:0,
          asleep: !!PLANTS[selType].mushroom && !isNight(world) };
        drawPlantEntity(t, ghost);
        ctx.restore();
      }
    }
  }

  // E10：僵尸按行分桶一次、每行排一次，替代原来的「每行各 filter 一遍整张表再 sort」。
  // 绘制顺序与原实现完全一致（行内仍按 x 升序），只是少做了 5 次全表扫描与 5 次分配。
  const zombiesByRow = Array.from({ length: ROWS }, () => []);
  for(const z of world.zombies) zombiesByRow[z.row].push(z);
  for(const row of zombiesByRow) row.sort((a, b) => a.x - b.x);

  for(let r=0;r<ROWS;r++){
    for(const p of world.plants) if(p.row===r) drawPlantEntity(t, p);
    for(const z of zombiesByRow[r]) drawZombieEntity(t, z);
  }

  for(const p of world.peas) drawPea(p);

  for(const p of world.visual.parts){
    ctx.save();
    ctx.globalAlpha = clamp(p.life/p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    ctx.restore();
  }

  for(const s of world.suns) drawSun(t, s);

  drawSeedBank(t, world, ui);
  drawProgressBar(world);
  drawTopRightButtons(world, ui, musicOn);
  drawText(LEVELS[world.level].name, W-16, 62, 13, '#f0e2c0', '#3a2410', 3, 'right', '700');
  drawWaveText(t, world);
  drawIntro(t, world);

  // 夜战提示条
  if(world.visual.nightHint > 0 && isNight(world)){
    const a = clamp(world.visual.nightHint/1.4, 0, 1);
    const bw = 520, bh = 44, bx = W/2-bw/2, by = 150;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(15,22,48,0.42)';
    ctx.beginPath(); rr(bx+3, by+5, bw, bh, 22); ctx.fill();
    let ng = ctx.createLinearGradient(0,by,0,by+bh);
    ng.addColorStop(0,'rgba(38,52,96,0.94)'); ng.addColorStop(1,'rgba(22,30,60,0.94)');
    ctx.beginPath(); rr(bx, by, bw, bh, 22);
    O(ng, '#8fa4d8', 2.4);
    // 小月亮
    ctx.fillStyle = '#f6eec6'; ctx.strokeStyle = '#b8a860'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(bx+27, by+bh/2, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(184,168,96,0.55)';
    ctx.beginPath(); ctx.arc(bx+24, by+bh/2-2.6, 2.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(bx+30.5, by+bh/2+2.8, 1.5, 0, TAU); ctx.fill();
    drawText('夜战 · 天上不会掉太阳，快种向日葵！', bx+bw/2+14, by+bh/2+1, 17, '#eaf0ff', '#1b2440', 4, 'center', '800');
    ctx.restore();
  }

  if(ui.shovel && ui.mouse.x >= 0){
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawShovelIcon(ui.mouse.x, ui.mouse.y - 10, 1.1);
    ctx.restore();
  }

  // 爆炸白闪
  if(world.visual.flash > 0){
    ctx.fillStyle = 'rgba(255,250,230,' + clamp(world.visual.flash,0,0.35) + ')';
    ctx.fillRect(-20,-20,W+40,H+40);
  }

  if(world.paused){
    ctx.fillStyle = 'rgba(10,16,10,0.55)';
    ctx.fillRect(0,0,W,H);
    drawText('已暂停', W/2, H/2-20, 54, '#f5e6b8', '#3a2410', 9);
    drawText('点击「继续」或按 P 键继续游戏', W/2, H/2+36, 18, '#e0d2a8', '#3a2410', 4, 'center', '600');
  }
}

