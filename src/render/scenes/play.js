// 战斗场景的界面层：战场本身由 3D 视图画，这里只画 HUD、提示条、暂停幕与铲子光标。
import { W, H, TAU } from '../../core/constants.js';
import { clamp } from '../../core/util.js';
import { LEVELS } from '../../core/data/levels.js';
import { isNight } from '../../core/world.js';
import { ctx } from '../target.js';
import { rr, drawText } from '../paint.js';
import { shovelIcon } from '../skin.js';
import { drawSeedBank, drawProgressBar, drawTopRightButtons, drawWaveText, drawIntro } from '../hud.js';

export function renderPlay(t, world, ui, musicOn){
  // 爆炸白闪：只压一层，3D 里已有真实的光
  if(world.visual.flash > 0){
    ctx.fillStyle = 'rgba(255,246,220,' + clamp(world.visual.flash * 0.8, 0, 0.28) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  drawSeedBank(t, world, ui);
  drawProgressBar(world);
  drawTopRightButtons(world, ui, musicOn);
  drawText(LEVELS[world.level].name, W - 16, 60, 14, '#fff8e0', 'rgba(0,0,0,0.75)', 4, 'right', '900');
  drawWaveText(t, world);
  drawIntro(t, world);
  if(world.visual.nightHint > 0 && isNight(world)){
    const a = clamp(world.visual.nightHint / 1.4, 0, 1);
    const bw = 540, bh = 46, bx = W / 2 - bw / 2, by = 150;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(120,140,255,0.6)'; ctx.shadowBlur = 20;
    rr(bx, by, bw, bh, 23);
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, 'rgba(50,60,130,0.95)'); g.addColorStop(1, 'rgba(18,22,60,0.95)');
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8c8ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff4c8';
    ctx.beginPath(); ctx.arc(bx + 28, by + bh / 2, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(40,50,110,1)';
    ctx.beginPath(); ctx.arc(bx + 33, by + bh / 2 - 4, 10, 0, TAU); ctx.fill();
    drawText('夜战 · 天上不会掉太阳，快种向日葵！', bx + bw / 2 + 14, by + bh / 2 + 1, 18, '#f0f4ff', '#141a40', 4, 'center', '900');
    ctx.restore();
  }
  if(ui.shovel && ui.mouse.x >= 0){
    ctx.save();
    ctx.globalAlpha = 0.95;
    shovelIcon(ui.mouse.x + 6, ui.mouse.y - 14, 1.15);
    ctx.restore();
  }
  if(world.paused){
    ctx.fillStyle = 'rgba(6,12,16,0.6)';
    ctx.fillRect(0, 0, W, H);
    for(let d = 6; d > 0; d--) drawText('已暂停', W / 2, H / 2 - 20 + d, 60, '#0a1a14', '#0a1a14', 10);
    drawText('已暂停', W / 2, H / 2 - 20, 60, '#fff4d0', '#1a3a2a', 10);
    drawText('点击「继续」或按 P 键继续游戏', W / 2, H / 2 + 38, 18, '#e0f0e4', 'rgba(0,0,0,0.6)', 4, 'center', '800');
  }
}
