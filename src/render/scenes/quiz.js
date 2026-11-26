// 战前答题弹层：压在 3D 菜单场景之上。
import { W, H, TAU } from '../../core/constants.js';
import { addHotspot } from '../../ui/hotspots.js';
import { pointInRect } from './common.js';
import { ctx } from '../target.js';
import { drawText } from '../paint.js';
import { panel, dimmer, ribbon, candyButton, sunIcon, sparkle } from '../skin.js';
import { getUITime } from './common.js';

const ANSWER_COLORS = ['green', 'blue', 'orange', 'purple'];

export function renderQuiz(t, world, ui){
  dimmer(W, H, 0.6);
  const q = world.quiz;
  const cur = q.questions[q.idx];
  const pw = 640, ph = 420, px = W / 2 - pw / 2, py = H / 2 - ph / 2 + 6;
  panel(px, py, pw, ph, {});
  ribbon(W / 2, py + 4, 250, 42, '战 前 热 身', { color: 'orange', size: 22 });
  drawText('答对一题，初始阳光 ×2', W / 2, py + 50, 15, '#d8f0c8', null, 0, 'center', '800');
  // 能量计：太阳 + 数字 + 三颗进度珠
  sunIcon(px + 92, py + 98, 0.95, t);
  drawText(String(q.energy), px + 150, py + 99, 34, '#ffe58a', '#5a3a08', 6, 'left', '900');
  drawText('初始阳光', px + 152, py + 128, 12, '#d8f0c8', null, 0, 'left', '700');
  for(let i = 0; i < 3; i++){
    const cx = px + pw - 140 + i * 40, cy = py + 104;
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU);
    const done = i < q.idx || (i === q.idx && q.feedback > 0 && q.correct);
    const g = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, 13);
    if(done){ g.addColorStop(0, '#f8ffd0'); g.addColorStop(1, '#4cc22a'); }
    else if(i === q.idx){ g.addColorStop(0, '#fff8d8'); g.addColorStop(1, '#ffb020'); }
    else { g.addColorStop(0, '#6a7a74'); g.addColorStop(1, '#2a3632'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    drawText(String(i + 1), cx, cy + 1, 13, '#ffffff', 'rgba(0,0,0,0.5)', 3, 'center', '900');
  }
  // 题面：一块发光的「黑板」
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(W / 2, py + 196, 230, 44, 0, 0, TAU); ctx.fill();
  ctx.restore();
  const pop = q.feedback > 0 ? 1 + Math.sin(Math.min(1, (0.9 - q.feedback) / 0.25) * Math.PI) * 0.12 : 1;
  ctx.save();
  ctx.translate(W / 2, py + 196); ctx.scale(pop, pop);
  drawText(cur.text, 0, 0, 54, '#ffffff', '#0f3a2a', 9, 'center', '900');
  ctx.restore();
  // 答案按钮 2×2
  const bw = 240, bh = 58, bx0 = W / 2 - bw - 12, bx1 = W / 2 + 12, by0 = py + 262, by1 = py + 336;
  for(let i = 0; i < 4; i++){
    const bx = (i % 2 === 0) ? bx0 : bx1;
    const by = (i < 2) ? by0 : by1;
    const hover = pointInRect(ui, bx, by, bw, bh);
    addHotspot(ui, bx, by, bw, bh, 'ans' + i, { type: 'answer', value: cur.options[i] });
    candyButton(bx, by, bw, bh, String(cur.options[i]), { hover, color: ANSWER_COLORS[i], size: 28, r: 16, t: getUITime() });
  }
  if(q.feedback > 0){
    const k = Math.min(1, (0.9 - q.feedback) / 0.2);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = q.correct ? 'rgba(80,200,60,0.22)' : 'rgba(220,40,30,0.25)';
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, py + 196); ctx.scale(0.6 + k * 0.4, 0.6 + k * 0.4); ctx.rotate(-0.06);
    if(q.correct){
      drawText('答对了！阳光 ×2', 0, 0, 46, '#c8ff6a', '#0f3a06', 9, 'center', '900');
      for(let i = 0; i < 8; i++) sparkle(Math.cos(i * 0.8) * 220, Math.sin(i * 1.3) * 50, 10, 1 - k * 0.3);
    } else {
      drawText('答错了，开战！', 0, 0, 46, '#ffb0a0', '#4a0604', 9, 'center', '900');
    }
    ctx.restore();
  }
}
