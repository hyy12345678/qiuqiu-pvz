// 胜负结算遮罩：压在 3D 战场之上（失败时镜头已推近到冲进屋子的那只僵尸）。
import { W, H, TAU } from '../../core/constants.js';
import { LEVELS } from '../../core/data/levels.js';
import { ctx } from '../target.js';
import { drawText } from '../paint.js';
import { panel, dimmer, heroTitle, sunIcon, sparkle } from '../skin.js';
import { drawButton } from './common.js';

const CONFETTI = ['#ffd23e', '#8fe055', '#ff8ab0', '#7cc4ec', '#ffffff', '#ff9a2e'];

export function renderEndOverlay(t, world, ui){
  const won = world.state === 'won';
  dimmer(W, H, won ? 0.42 : 0.5);
  if(won){
    // 背后的放射光
    ctx.save();
    ctx.translate(W / 2, H / 2 - 40);
    ctx.rotate(t * 0.25);
    for(let i = 0; i < 14; i++){
      ctx.rotate(TAU / 14);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -520); ctx.lineTo(60, -520); ctx.closePath();
      ctx.fillStyle = 'rgba(255,236,150,0.10)'; ctx.fill();
    }
    ctx.restore();
  } else {
    const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, 'rgba(120,0,0,0.45)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const pw = 580, ph = 300, px = W / 2 - pw / 2, py = H / 2 - ph / 2 + 10;
  panel(px, py, pw, ph, { tone: won ? 'jade' : 'wine' });
  if(won){
    heroTitle('关卡完成！', W / 2, py - 6, 54, t);
    sunIcon(W / 2 - 150, py + 92, 0.8, t);
    drawText('消灭僵尸 ' + world.killed + ' 只', W / 2 - 120, py + 92, 20, '#fff8e0', null, 0, 'left', '800');
    drawText('剩余阳光 ' + world.sun, W / 2 + 40, py + 92, 20, '#ffe58a', null, 0, 'left', '800');
    const lastLv = world.level >= LEVELS.length - 1;
    drawText(lastLv ? '你通关了全部 ' + LEVELS.length + ' 个关卡，草坪安全了！' : '新的关卡已解锁！', W / 2, py + 140, 18, '#c8ff8a', 'rgba(0,0,0,0.5)', 3, 'center', '900');
    drawButton(ui, W / 2 - 215, py + ph - 84, 200, 54, lastLv ? '再玩一次' : '下一关', 'next', { type: 'level', index: lastLv ? world.level : world.level + 1 }, { color: 'orange' });
    drawButton(ui, W / 2 + 15, py + ph - 84, 200, 54, '主菜单', 'menu', { type: 'nav', state: 'menu' }, { color: 'blue' });
    for(let k = 0; k < 60; k++){
      const cx = (k * 97.3 + t * (40 + (k % 7) * 9)) % W;
      const cy = (k * 53.1 + t * (90 + (k % 5) * 25)) % H;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * (2 + k % 3) + k);
      ctx.fillStyle = CONFETTI[k % CONFETTI.length];
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    for(let i = 0; i < 5; i++){
      const k = (t * 0.8 + i * 0.29) % 1;
      sparkle(px + 40 + i * 120, py + 20 + (i % 2) * 30, 10 * Math.sin(k * Math.PI), Math.sin(k * Math.PI));
    }
  } else {
    const shake = Math.sin(t * 30) * 2;
    heroTitle('僵尸吃掉了你的脑子！', W / 2 + shake, py - 6, 44, t * 0.3,
      { face: ['#ffe0d8', '#ff8a6a', '#e0281c', '#8a0a06'], side: '#6a0806', edge: '#2a0202', rim: '#fff0e8' });
    drawText('消灭僵尸 ' + world.killed + ' / ' + world.total, W / 2, py + 96, 21, '#ffd8d0', null, 0, 'center', '800');
    drawText('换个阵型再试一次吧！', W / 2, py + 136, 16, '#ffb0a0', null, 0, 'center', '700');
    drawButton(ui, W / 2 - 215, py + ph - 84, 200, 54, '重新挑战', 'retry', { type: 'level', index: world.level }, { color: 'red' });
    drawButton(ui, W / 2 + 15, py + ph - 84, 200, 54, '主菜单', 'menu', { type: 'nav', state: 'menu' }, { color: 'blue' });
  }
}
