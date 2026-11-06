// 阳光与豌豆：绘制动画只读目标与实体字段。

import { TAU } from '../core/constants.js';
import { clamp, lerp, easeOut } from '../core/util.js';
import { ctx } from './target.js';
import { rr, O } from './paint.js';
import { drawBallIcon } from './plant.js';

// ---------------- 绘制：其它实体 ----------------
export function drawSun(t, s){
  let alpha = 1, scale = 1;
  if(s.state==='idle' && s.life < 2.5) alpha = clamp(s.life/2.5, 0, 1);
  let x = s.x, y = s.y;
  if(s.state==='fly'){
    const k = easeOut(s.ft);
    x = lerp(s.x, 78, k); y = lerp(s.y, 50, k);
    scale = 1 - s.ft*0.4;
  }
  if(s.state==='fall') scale = 0.85 + clamp(s.t*0.5,0,0.15);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const pulse = 1 + Math.sin(t*4 + s.t)*0.05;
  ctx.scale(pulse, pulse);
  let g = ctx.createRadialGradient(0,0,4, 0,0,40);
  g.addColorStop(0,'rgba(255,244,160,0.95)');
  g.addColorStop(0.45,'rgba(255,214,90,0.4)');
  g.addColorStop(1,'rgba(255,190,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0,0,40,0,TAU); ctx.fill();
  ctx.save();
  ctx.rotate(t*0.7);
  for(let k=0;k<14;k++){
    ctx.rotate(TAU/14);
    const long = k%2===0;
    ctx.beginPath();
    ctx.moveTo(0,-14); ctx.lineTo(long?4.6:3.4, long?-27:-22); ctx.lineTo(long?-4.6:-3.4, long?-27:-22);
    ctx.closePath();
    ctx.fillStyle = long ? '#ffd83d' : '#ffc32e';
    ctx.fill();
  }
  ctx.restore();
  g = ctx.createRadialGradient(-4,-4,2, 0,0,16);
  g.addColorStop(0,'#fff6c8'); g.addColorStop(0.7,'#ffd042'); g.addColorStop(1,'#ffaa22');
  ctx.beginPath(); ctx.arc(0,0,15.5,0,TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(230,150,20,0.6)'; ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

export function drawPea(p){
  ctx.save();
  ctx.translate(p.x, p.y);
  if(p.type==='ball'){
    // 残影
    ctx.globalAlpha = 0.25;
    drawBallIcon(-11, 0, 6, p.x*0.11 - 0.5);
    ctx.globalAlpha = 0.12;
    drawBallIcon(-19, 0, 5, p.x*0.11 - 1);
    ctx.globalAlpha = 1;
    drawBallIcon(0, 0, 7.5, p.x*0.11);
    ctx.restore();
    return;
  }
  if(p.type==='bullet'){
    // 加特林子弹：曳光
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(-13, 0, 3.6, 0, TAU); ctx.fillStyle = '#d8dee4'; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); rr(-7,-2.4, 16, 4.8, 2);
    O('#e8edf2', '#5a6066', 1.4);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(6, -1, 1.2, 0, TAU); ctx.fill();
    ctx.restore();
    return;
  }
  if(p.type==='beam'){
    // 哉佩利敖光线：长拖尾外焰 + 白色光芯 + 端头冷白光晕
    let g = ctx.createLinearGradient(-150, 0, 10, 0);
    g.addColorStop(0, 'rgba(143,216,255,0)');
    g.addColorStop(0.6, 'rgba(143,216,255,0.4)');
    g.addColorStop(1, 'rgba(223,246,255,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-150,-1.2); ctx.lineTo(6,-7.5); ctx.lineTo(13,0); ctx.lineTo(6,7.5); ctx.lineTo(-150,1.2);
    ctx.closePath(); ctx.fill();
    g = ctx.createLinearGradient(-72, 0, 10, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-72,-0.8); ctx.lineTo(8,-3); ctx.lineTo(12,0); ctx.lineTo(8,3); ctx.lineTo(-72,0.8);
    ctx.closePath(); ctx.fill();
    g = ctx.createRadialGradient(10, 0, 1, 10, 0, 20);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(180,232,255,0.55)');
    g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(10, 0, 20, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(223,246,255,0.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-46,-6.5); ctx.lineTo(-26,-2.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-60,5.5); ctx.lineTo(-36,2); ctx.stroke();
    ctx.restore();
    return;
  }
  if(p.type==='missile'){
    // 导弹：火焰尾 + 弹体 + 尾翼
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(-13, 0, 5, 0, TAU); ctx.fillStyle = '#ff9a2e'; ctx.fill();
    ctx.beginPath(); ctx.arc(-20, 0, 3.5, 0, TAU); ctx.fillStyle = '#ffd23e'; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); rr(-10,-4, 20, 8, 3);
    O('#c8cdd2', '#5a6066', 1.6);
    ctx.beginPath(); ctx.moveTo(10,-4); ctx.lineTo(16,0); ctx.lineTo(10,4); ctx.closePath();
    O('#e04a3a', '#8a1c12', 1.4);
    ctx.beginPath(); ctx.moveTo(-10,-4); ctx.lineTo(-14,-8); ctx.lineTo(-8,-4); ctx.closePath();
    O('#4a93c9', '#2c5a7a', 1);
    ctx.beginPath(); ctx.moveTo(-10,4); ctx.lineTo(-14,8); ctx.lineTo(-8,4); ctx.closePath();
    O('#4a93c9', '#2c5a7a', 1);
    ctx.restore();
    return;
  }
  if(p.type==='fire'){
    let g = ctx.createRadialGradient(0,0,1, 0,0,14);
    g.addColorStop(0,'#fff3b0'); g.addColorStop(0.45,'#ff9a2e'); g.addColorStop(1,'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,14,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0,0,7.5,0,TAU);
    O('#ff7a1e', '#c04810', 1.8);
    ctx.fillStyle = 'rgba(255,150,40,0.45)';
    ctx.beginPath(); ctx.arc(-13,0,5.5,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-20,1,3.4,0,TAU); ctx.fill();
  } else {
    const col = p.type==='snow' ? ['#e8f8ff','#8fd0f2','#4a93c9']
      : p.type==='spore' ? ['#f0dcff','#b478e0','#6b3f96']
      : ['#c8f0a0','#7cc84e','#3f8a2e'];
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(-10,0,6,0,TAU); ctx.fillStyle = col[1]; ctx.fill();
    ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.arc(-18,0,5,0,TAU); ctx.fill();
    ctx.globalAlpha = 1;
    let g = ctx.createRadialGradient(-2,-2,1, 0,0,8.5);
    g.addColorStop(0,col[0]); g.addColorStop(1,col[1]);
    ctx.beginPath(); ctx.arc(0,0,7.8,0,TAU);
    O(g, col[2], 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.ellipse(-2.4,-2.8,2.4,1.5,-0.6,0,TAU); ctx.fill();
    if(p.type==='snow'){
      ctx.fillStyle = 'rgba(210,240,255,0.55)';
      ctx.beginPath(); ctx.arc(-12,1.4,3.6,0,TAU); ctx.fill();
    }
  }
  ctx.restore();
}

