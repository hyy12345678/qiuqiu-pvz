// 小推车：动画时间显式传入。

import { CH, LY, TAU } from '../core/constants.js';
import { ctx } from './target.js';
import { rr, O } from './paint.js';

export function drawMower(t, m){
  if(m.state==='gone') return;
  ctx.save();
  ctx.translate(m.x, LY + m.row*CH + CH - 14);
  const run = m.state==='run';
  if(run) ctx.translate(0, Math.sin(t*42)*1.4);
  ctx.fillStyle = 'rgba(25,45,15,0.32)';
  ctx.beginPath(); ctx.ellipse(14,13,25,5.5,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(30,2); ctx.lineTo(47,-24);
  ctx.strokeStyle = '#3c4046'; ctx.lineWidth = 6; ctx.lineCap='round'; ctx.stroke();
  ctx.strokeStyle = '#8d949c'; ctx.lineWidth = 3.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(43,-24); ctx.lineTo(51,-24);
  ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 5; ctx.stroke();
  let g = ctx.createLinearGradient(0,-18,0,12);
  g.addColorStop(0,'#f0685a'); g.addColorStop(0.55,'#d03a2c'); g.addColorStop(1,'#952218');
  ctx.beginPath(); rr(-4,-16,38,25,8);
  O(g, '#5e1410', 2.4);
  ctx.beginPath(); rr(1,-12,15,9,3);
  O('#e8edf2', '#8d949c', 1.6);
  ctx.strokeStyle = 'rgba(94,20,16,0.6)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(20,-12); ctx.lineTo(20,5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(25,-12); ctx.lineTo(25,5); ctx.stroke();
  ctx.beginPath(); rr(-8,-14,6,8,2);
  O('#6b7076', '#3c4046', 1.4);
  if(run){
    ctx.fillStyle = 'rgba(120,120,120,'+(0.3+Math.sin(t*30)*0.15)+')';
    ctx.beginPath(); ctx.arc(-11,-16-Math.abs(Math.sin(t*18))*5,3.4,0,TAU); ctx.fill();
  }
  const wa = run ? t*24 : 0;
  const wheel = (wx, r)=>{
    ctx.beginPath(); ctx.arc(wx,10,r,0,TAU);
    O('#2e2a24', '#17140f', 2);
    ctx.strokeStyle = '#7d7468'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(wx+Math.cos(wa)*(r-2.5), 10+Math.sin(wa)*(r-2.5));
    ctx.lineTo(wx-Math.cos(wa)*(r-2.5), 10-Math.sin(wa)*(r-2.5)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx+Math.cos(wa+1.57)*(r-2.5), 10+Math.sin(wa+1.57)*(r-2.5));
    ctx.lineTo(wx-Math.cos(wa+1.57)*(r-2.5), 10-Math.sin(wa+1.57)*(r-2.5)); ctx.stroke();
    ctx.fillStyle = '#a89c8c';
    ctx.beginPath(); ctx.arc(wx,10,2.4,0,TAU); ctx.fill();
  };
  wheel(3, 8.4); wheel(27, 7);
  ctx.restore();
}

