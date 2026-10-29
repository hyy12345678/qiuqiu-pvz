// 战前答题弹层。

import { W, H } from '../../core/constants.js';
import { addHotspot } from '../../ui/hotspots.js';
import { ctx } from '../target.js';
import { rr, O, drawText } from '../paint.js';
import { drawMenuScene } from './menu.js';
import { drawSunIcon } from '../hud.js';

export function renderQuiz(t, world, ui){
  drawMenuScene(t);
  ctx.fillStyle = 'rgba(10,16,10,0.6)';
  ctx.fillRect(0,0,W,H);
  const q = world.quiz;
  const cur = q.questions[q.idx];
  const pw=640, ph=400, px=W/2-pw/2, py=H/2-ph/2;
  ctx.fillStyle='rgba(15,25,8,0.45)';
  ctx.beginPath(); rr(px+5, py+7, pw, ph, 14); ctx.fill();
  let g = ctx.createLinearGradient(0,py,0,py+ph);
  g.addColorStop(0,'#f0e2bc'); g.addColorStop(1,'#d8c090');
  ctx.beginPath(); rr(px, py, pw, ph, 14); O(g,'#6b4c20',4);
  drawText('战 前 热 身', W/2, py+42, 30, '#42280f', null, 0, 'center', '900');
  drawText('答对一题，初始能量 ×2', W/2, py+74, 16, '#6b4c20', null, 0, 'center', '700');
  drawSunIcon(t, px+86, py+120, 0.7);
  drawText('初始能量：' + q.energy, px+150, py+120, 22, '#3a6b18', null, 0, 'left', '800');
  drawText('第 ' + (q.idx+1) + ' / 3 题', W/2, py+168, 16, '#8a6b3a', null, 0, 'center', '700');
  drawText(cur.text, W/2, py+222, 46, '#3c2a10', '#fff6dc', 6, 'center', '900');
  // 四个答案按钮（2×2）
  const bw=240, bh=54, bx0=W/2-bw-12, bx1=W/2+12, by0=py+262, by1=py+330;
  for(let i=0;i<4;i++){
    const bx = (i%2===0)?bx0:bx1;
    const by = (i<2)?by0:by1;
    const hover = ui.mouse.x>=bx && ui.mouse.x<=bx+bw && ui.mouse.y>=by && ui.mouse.y<=by+bh;
    let bg = ctx.createLinearGradient(0,by,0,by+bh);
    bg.addColorStop(0, hover ? '#96c862' : '#7aa848'); bg.addColorStop(1, hover ? '#649838' : '#4e7a2a');
    ctx.fillStyle='rgba(15,25,8,0.35)'; ctx.beginPath(); rr(bx+2, by+3, bw, bh, 10); ctx.fill();
    ctx.beginPath(); rr(bx, by, bw, bh, 10); O(bg, '#2e4a14', 3);
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(bx+5, by+3, bw-10, 6);
    drawText(String(cur.options[i]), bx+bw/2, by+bh/2+1, 24, '#fffbe8', '#2e3a10', 4, 'center', '800');
    addHotspot(ui, bx, by, bw, bh, 'ans'+i, { type:'answer', value:cur.options[i] });
  }
  // 反馈
  if(q.feedback > 0){
    if(q.correct){
      ctx.fillStyle='rgba(60,140,40,0.28)'; ctx.fillRect(0,0,W,H);
      drawText('答对了！能量 ×2', W/2, py+180, 34, '#3c7a18', '#fff', 6);
    } else {
      ctx.fillStyle='rgba(180,40,30,0.28)'; ctx.fillRect(0,0,W,H);
      drawText('答错了，开战！', W/2, py+180, 34, '#c03028', '#fff', 6);
    }
  }
}
