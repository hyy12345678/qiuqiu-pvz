// 胜负结算遮罩。

import { W, H } from '../../core/constants.js';
import { LEVELS } from '../../core/data/levels.js';
import { ctx } from '../target.js';
import { rr, O, drawText } from '../paint.js';
import { drawButton } from './common.js';

export function renderEndOverlay(t, world, ui){
  ctx.fillStyle = 'rgba(10,16,10,0.62)';
  ctx.fillRect(0,0,W,H);
  const won = world.state==='won';
  const pw = 560, ph = 330, px = W/2-pw/2, py = H/2-ph/2-20;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); rr(px+5, py+8, pw, ph, 14); ctx.fill();
  let g = ctx.createLinearGradient(0,py,0,py+ph);
  if(won){ g.addColorStop(0,'#f0e2bc'); g.addColorStop(1,'#d8c090'); }
  else { g.addColorStop(0,'#4a3040'); g.addColorStop(1,'#2c1c26'); }
  ctx.beginPath(); rr(px, py, pw, ph, 14);
  O(g, won ? '#6b4c20' : '#1c1016', 4);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(px+6, py+4, pw-12, 7);
  if(won){
    // 彩带
    ctx.save();
    for(let k=0;k<26;k++){
      const cx = px + ((k*97 + t*70) % pw);
      const cy = py + ((k*53 + t*(40+k*3)) % ph);
      ctx.fillStyle = ['#ffd23e','#8fd44a','#ff8ab0','#7cc4ec'][k%4];
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t*3+k);
      ctx.fillRect(-3, -1.6, 6, 3.2);
      ctx.restore();
    }
    ctx.restore();
    drawText('关 卡 完 成 ！', W/2, py+62, 44, '#3c7a18', '#1e3c0a', 8, 'center', '900');
    drawText('消灭僵尸：' + world.killed + ' 只　　剩余阳光：' + world.sun, W/2, py+122, 19, '#4a3414', null, 0, 'center', '700');
    const lastLv = world.level >= LEVELS.length-1;
    if(!lastLv) drawText('新的关卡已解锁！', W/2, py+158, 17, '#a05c10', null, 0, 'center', '700');
    else drawText('你通关了全部 ' + LEVELS.length + ' 个关卡，草坪安全了！', W/2, py+158, 17, '#a05c10', null, 0, 'center', '700');
    const leftLabel = lastLv ? '再玩一次' : '下一关';
    const leftAction = { type:'level', index: lastLv ? world.level : world.level+1 };
    drawButton(ui, W/2-215, py+ph-76, 200, 48, leftLabel, 'next', leftAction, {});
    drawButton(ui, W/2+15, py+ph-76, 200, 48, '主菜单', 'menu', { type:'nav', state:'menu' }, {});
  } else {
    drawText('僵尸吃掉了你的脑子！', W/2, py+66, 37, '#e8554a', '#3a0a04', 8, 'center', '900');
    drawText('消灭僵尸：' + world.killed + ' / ' + world.total, W/2, py+130, 19, '#d8b8c0', null, 0, 'center', '700');
    drawButton(ui, W/2-215, py+ph-76, 200, 48, '重新挑战', 'retry', { type:'level', index:world.level }, { red:true });
    drawButton(ui, W/2+15, py+ph-76, 200, 48, '主菜单', 'menu', { type:'nav', state:'menu' }, {});
  }
}
