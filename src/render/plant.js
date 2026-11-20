// 植物与球球的美术：只读当前 target，坐标与样式保持原样。

import { TAU } from '../core/constants.js';
import { clamp, isBlinking } from '../core/util.js';
import { ctx } from './target.js';
import { rr, O, drawText } from './paint.js';

// ---------------- 绘制：植物 ----------------
export function drawLeafShape(x,y,dir,s,col,outline){
  ctx.beginPath();
  ctx.moveTo(x,y);
  ctx.quadraticCurveTo(x+dir*15*s, y-9*s, x+dir*27*s, y-2*s);
  ctx.quadraticCurveTo(x+dir*15*s, y+8*s, x, y);
  O(col||'#5cb444', outline||'#2c6b1c', 2);
  ctx.strokeStyle = 'rgba(35,90,20,0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x+dir*3*s, y); ctx.quadraticCurveTo(x+dir*14*s, y-3*s, x+dir*23*s, y-2*s); ctx.stroke();
}

export function drawSunflower(t, ph){
  const sway = Math.sin(t*1.9+ph)*3, bob = Math.sin(t*2.2+ph)*2.4;
  const hx = sway, hy = -60+bob;
  // 茎（描边双层）
  ctx.beginPath();
  ctx.moveTo(-1,2);
  ctx.quadraticCurveTo(7,-22, hx, hy+16);
  O(null, '#2c6b1c', 8);
  ctx.beginPath();
  ctx.moveTo(-1,2);
  ctx.quadraticCurveTo(7,-22, hx, hy+16);
  O(null, '#4ea832', 5);
  drawLeafShape(-3,-8,-1,0.95); drawLeafShape(4,-14,1,0.85);
  ctx.save(); ctx.translate(hx,hy); ctx.rotate(Math.sin(t*0.9+ph)*0.08);
  // 后层花瓣
  ctx.save(); ctx.rotate(Math.sin(t+ph)*0.05 + TAU/24);
  for(let k=0;k<12;k++){
    ctx.save(); ctx.rotate(k*TAU/12);
    ctx.beginPath(); ctx.ellipse(0,-25,6.5,14,0,0,TAU);
    O('#f0ae1e', '#c07d10', 1.6);
    ctx.restore();
  }
  ctx.restore();
  // 前层花瓣
  ctx.save(); ctx.rotate(Math.sin(t+ph)*0.05);
  for(let k=0;k<12;k++){
    ctx.save(); ctx.rotate(k*TAU/12);
    ctx.beginPath(); ctx.ellipse(0,-23,6,13,0,0,TAU);
    O('#ffd83d', '#d99a12', 1.6);
    ctx.restore();
  }
  ctx.restore();
  // 花盘
  let g = ctx.createRadialGradient(-4,-5,2, 0,0,18);
  g.addColorStop(0,'#c9903f'); g.addColorStop(1,'#8a5220');
  ctx.beginPath(); ctx.arc(0,0,16,0,TAU);
  O(g, '#5f3a12', 2.4);
  ctx.fillStyle = 'rgba(95,58,18,0.55)';
  for(let k=0;k<10;k++){
    const a = k*TAU/10 + 0.4;
    ctx.beginPath(); ctx.arc(Math.cos(a)*10, Math.sin(a)*10, 1.4, 0, TAU); ctx.fill();
  }
  // 脸
  const blink = isBlinking(t, ph);
  if(blink){
    ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-8,-3); ctx.lineTo(-3,-3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3,-3); ctx.lineTo(8,-3); ctx.stroke();
  } else {
    ctx.fillStyle = '#2e1c06';
    ctx.beginPath(); ctx.ellipse(-5.5,-3,2.2,3.4,0,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.5,-3,2.2,3.4,0,0,TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-4.8,-4,0.9,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6.2,-4,0.9,0,TAU); ctx.fill();
  }
  ctx.strokeStyle = '#2e1c06'; ctx.lineWidth = 2.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0,3.5,6.5,0.3,Math.PI-0.3); ctx.stroke();
  ctx.fillStyle = 'rgba(230,120,60,0.3)';
  ctx.beginPath(); ctx.ellipse(-10,2,3,2,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10,2,3,2,0,0,TAU); ctx.fill();
  ctx.restore();
}

export function drawShooter(t, ph, kind, recoil, flash){
  const bob = Math.sin(t*2.4+ph)*2.2;
  const rec = (recoil||0)*7;
  const pal = kind==='snow'
    ? { hi:'#cdeefc', main:'#6fb4de', dark:'#3a7ba6', line:'#1e4d6e', mouth:'#123a52' }
    : { hi:'#a8e070', main:'#57b03e', dark:'#2f7d24', line:'#1c4d12', mouth:'#17320f' };
  // 茎
  ctx.beginPath();
  ctx.moveTo(1,2);
  ctx.quadraticCurveTo(5,-16, -2-rec*0.5, -32+bob);
  O(null, '#2c6b1c', 7.5);
  ctx.beginPath();
  ctx.moveTo(1,2);
  ctx.quadraticCurveTo(5,-16, -2-rec*0.5, -32+bob);
  O(null, '#4ea832', 4.5);
  drawLeafShape(-2,-7,-1,0.9); drawLeafShape(4,-12,1,0.8);
  const hx = -2 - rec, hy = -54 + bob;
  // 双发后管
  if(kind==='repeater'){
    ctx.beginPath(); rr(hx-20, hy-16, 28, 19, 9);
    O(pal.dark, pal.line, 2.4);
    ctx.beginPath(); ctx.ellipse(hx-20, hy-6.5, 4.5, 7, 0, 0, TAU);
    O(pal.mouth, pal.line, 2);
  }
  // 头
  let g = ctx.createRadialGradient(hx-8,hy-9,4, hx,hy,26);
  g.addColorStop(0,pal.hi); g.addColorStop(0.6,pal.main); g.addColorStop(1,pal.dark);
  ctx.beginPath(); ctx.arc(hx, hy, 22, 0, TAU);
  O(g, pal.line, 2.6);
  // 头顶小叶
  ctx.save(); ctx.translate(hx-7, hy-20); ctx.rotate(-0.55+Math.sin(t*2+ph)*0.12);
  drawLeafShape(0,0,1,0.62, pal.main, pal.line);
  ctx.restore();
  // 炮管
  ctx.beginPath(); rr(hx+10, hy-10, 28, 20, 9);
  O(pal.main, pal.line, 2.6);
  ctx.beginPath(); ctx.ellipse(hx+37, hy, 6, 9.5, 0, 0, TAU);
  O(pal.dark, pal.line, 2.4);
  ctx.beginPath(); ctx.ellipse(hx+37, hy, 3.2, 6, 0, 0, TAU);
  O(pal.mouth, null);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.ellipse(hx+30, hy-6, 5, 2.5, -0.3, 0, TAU); ctx.fill();
  // 冰刺
  if(kind==='snow'){
    ctx.fillStyle = '#e8f7ff';
    ctx.strokeStyle = '#9fd0e8'; ctx.lineWidth = 1;
    for(let k=0;k<3;k++){
      ctx.beginPath();
      ctx.moveTo(hx+15+k*8, hy+10);
      ctx.lineTo(hx+18.5+k*8, hy+17);
      ctx.lineTo(hx+22+k*8, hy+10);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  // 眼睛
  const blink = isBlinking(t, ph+1);
  if(blink){
    ctx.strokeStyle = pal.line; ctx.lineWidth = 2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(hx-7,hy-7); ctx.lineTo(hx-1,hy-7); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(hx-3.5, hy-7.5, 4.6, 5.6, 0, 0, TAU);
    O('#fff', pal.line, 1.6);
    ctx.fillStyle = '#1e2a12';
    ctx.beginPath(); ctx.arc(hx-1.8, hy-7, 2.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx-1, hy-8, 0.9, 0, TAU); ctx.fill();
  }
  // 炮口闪光
  if(flash > 0){
    ctx.save();
    ctx.globalAlpha = flash/0.09;
    g = ctx.createRadialGradient(hx+42,hy,1, hx+42,hy,14);
    g.addColorStop(0, kind==='snow' ? 'rgba(220,245,255,0.95)' : 'rgba(255,250,200,0.95)');
    g.addColorStop(1,'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(hx+42, hy, 14, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

export function drawWallnut(hpFrac, t, ph){
  const bob = Math.sin(t*1.6+ph)*1.6;
  const dmg = 1 - hpFrac;
  ctx.save(); ctx.translate(0, bob*0.4);
  if(dmg > 0.4) ctx.rotate(Math.sin(t*9)*0.015);
  let g = ctx.createRadialGradient(-9,-45,6, 0,-34,38);
  g.addColorStop(0,'#e2b45e'); g.addColorStop(0.65,'#c08a38'); g.addColorStop(1,'#8f5f1e');
  ctx.beginPath(); ctx.ellipse(0,-34,27,35,0,0,TAU);
  O(g, '#5a3c10', 2.8);
  ctx.fillStyle = 'rgba(120,80,28,0.35)';
  ctx.beginPath(); ctx.arc(-12,-20,3,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(14,-44,2.5,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(6,-14,2,0,TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.35)';
  ctx.beginPath(); ctx.ellipse(-10,-50,8,5,-0.5,0,TAU); ctx.fill();
  ctx.strokeStyle = '#4a3008'; ctx.lineWidth = 2.2; ctx.lineCap='round';
  if(dmg > 0.33){
    ctx.beginPath(); ctx.moveTo(-19,-54); ctx.lineTo(-13,-43); ctx.lineTo(-18,-33); ctx.stroke();
  }
  if(dmg > 0.66){
    ctx.beginPath(); ctx.moveTo(15,-58); ctx.lineTo(9,-45); ctx.lineTo(16,-34); ctx.lineTo(10,-21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7,-14); ctx.lineTo(-1,-24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2,-66); ctx.lineTo(5,-57); ctx.stroke();
  }
  const blink = isBlinking(t, ph+2);
  const worried = dmg > 0.55;
  if(blink){
    ctx.strokeStyle = '#3a2608'; ctx.lineWidth = 2.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-12,-40); ctx.lineTo(-4,-40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,-40); ctx.lineTo(12,-40); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(-8,-40,5,6.2,0,0,TAU);
    O('#fff', '#5a3c10', 1.8);
    ctx.beginPath(); ctx.ellipse(8,-40,5,6.2,0,0,TAU);
    O('#fff', '#5a3c10', 1.8);
    ctx.fillStyle = '#2a1c08';
    const px = worried ? 0 : 1.2;
    ctx.beginPath(); ctx.arc(-7+px,-39,2.5,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(9+px,-39,2.5,0,TAU); ctx.fill();
  }
  if(worried){
    ctx.strokeStyle = '#4a3008'; ctx.lineWidth = 2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-13,-49); ctx.lineTo(-5,-46.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13,-49); ctx.lineTo(5,-46.5); ctx.stroke();
  }
  ctx.strokeStyle = '#4a3210'; ctx.lineWidth = 2.4; ctx.lineCap='round';
  if(worried){
    ctx.beginPath(); ctx.arc(0,-22,5.5,Math.PI+0.4,TAU-0.4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0,-28,7,0.3,Math.PI-0.3); ctx.stroke();
  }
  ctx.restore();
}

export function drawPotato(armed, t, ph){
  if(!armed){
    let g = ctx.createLinearGradient(0,-18,0,0);
    g.addColorStop(0,'#a5875a'); g.addColorStop(1,'#7c6038');
    ctx.beginPath(); ctx.ellipse(0,-4,24,14,0,Math.PI,0);
    O(g, '#55401f', 2.2);
    ctx.fillStyle = '#6b5230';
    ctx.beginPath(); ctx.arc(-10,-8,2.4,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(9,-11,2,0,TAU); ctx.fill();
    const blink = Math.sin(t*3+ph);
    if(blink > -0.6){
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-5,-11,2.6,0,TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(4,-11,2.6,0,TAU); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(-4.5,-11,1.2,0,TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(4.5,-11,1.2,0,TAU); ctx.fill();
    }
  } else {
    const hop = Math.abs(Math.sin(t*2+ph))*2.5;
    ctx.save(); ctx.translate(0,-hop);
    let g = ctx.createRadialGradient(-7,-32,4, 0,-24,28);
    g.addColorStop(0,'#d8a462'); g.addColorStop(0.7,'#b0763a'); g.addColorStop(1,'#8a5626');
    ctx.beginPath(); ctx.ellipse(0,-24,21,25,0,0,TAU);
    O(g, '#5f3c14', 2.6);
    ctx.fillStyle = 'rgba(95,60,22,0.5)';
    ctx.beginPath(); ctx.arc(-9,-31,2.2,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(10,-16,2.6,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-5,-11,2,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(12,-34,1.8,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6.5,-31,4,5,0,0,TAU);
    O('#fff', '#5f3c14', 1.8);
    ctx.beginPath(); ctx.ellipse(6.5,-31,4,5,0,0,TAU);
    O('#fff', '#5f3c14', 1.8);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-5.3,-30.5,2,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(7.7,-30.5,2,0,TAU); ctx.fill();
    ctx.strokeStyle = '#5f3c14'; ctx.lineWidth = 2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-11,-38); ctx.lineTo(-4,-36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11,-38); ctx.lineTo(4,-36); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-20,4.5,0.25,Math.PI-0.25); ctx.stroke();
    const on = Math.sin(t*7+ph) > 0;
    ctx.strokeStyle = '#5f3c14'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0,-48); ctx.lineTo(0,-53); ctx.stroke();
    if(on){
      g = ctx.createRadialGradient(0,-58,1, 0,-58,13);
      g.addColorStop(0,'rgba(255,120,90,0.85)'); g.addColorStop(1,'rgba(255,80,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0,-58,13,0,TAU); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0,-57,5,0,TAU);
    O(on ? '#ff4b3a' : '#8a281e', '#5a1410', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(-1.6,-58.6,1.5,0,TAU); ctx.fill();
    ctx.restore();
  }
}

export function drawCherry(fuse, t, ph){
  let s = 1;
  if(fuse < 0.4) s = 1 + Math.abs(Math.sin(fuse*38))*0.24*(0.4-fuse)/0.4 + 0.06;
  ctx.save(); ctx.scale(s,s);
  const draw = (x,y,r)=>{
    let g = ctx.createRadialGradient(x-r*0.35,y-r*0.42,r*0.12, x,y,r*1.15);
    g.addColorStop(0,'#ff9a8a'); g.addColorStop(0.5,'#ee3a2a'); g.addColorStop(1,'#a01005');
    ctx.beginPath(); ctx.arc(x,y,r,0,TAU);
    O(g, '#6e0e04', 2.6);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(x-r*0.38,y-r*0.48,r*0.28,r*0.15,-0.6,0,TAU); ctx.fill();
  };
  ctx.beginPath(); ctx.moveTo(-12,-44); ctx.quadraticCurveTo(-4,-62, 0,-66);
  O(null, '#2c5214', 4.5);
  ctx.beginPath(); ctx.moveTo(13,-52); ctx.quadraticCurveTo(6,-64, 0,-66);
  O(null, '#2c5214', 4.5);
  draw(-14,-30,17); draw(14,-38,20);
  ctx.fillStyle = '#3a0802';
  ctx.beginPath(); ctx.ellipse(-18,-33,2.2,3.2,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9,-33,2.2,3.2,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9,-41,2.6,3.6,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(19,-41,2.6,3.6,0,0,TAU); ctx.fill();
  ctx.strokeStyle = '#5a0a04'; ctx.lineWidth = 2.4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-22,-40); ctx.lineTo(-15,-36.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5,-40); ctx.lineTo(-12,-36.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,-49); ctx.lineTo(12,-45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(24,-49); ctx.lineTo(16,-45); ctx.stroke();
  ctx.beginPath(); ctx.arc(-13.5,-24,4,Math.PI+0.3,TAU-0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(14,-31,4.5,Math.PI+0.3,TAU-0.3); ctx.stroke();
  if(fuse < 0.7){
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2.2; ctx.lineCap='round';
    for(let k=0;k<5;k++){
      const a = (t*13 + k*TAU/5) % TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*4, -66+Math.sin(a)*4);
      ctx.lineTo(Math.cos(a)*(9+Math.sin(t*30+k)*2), -66+Math.sin(a)*(9+Math.sin(t*30+k)*2));
      ctx.stroke();
    }
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(0,-66,2.6+Math.sin(t*25)*1,0,TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawTorch(t, ph){
  let g = ctx.createRadialGradient(0,-52,4, 0,-52,34);
  g.addColorStop(0,'rgba(255,190,80,'+(0.3+Math.sin(t*8+ph)*0.08)+')');
  g.addColorStop(1,'rgba(255,150,50,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0,-52,34,0,TAU); ctx.fill();
  g = ctx.createLinearGradient(-19,0,19,0);
  g.addColorStop(0,'#96683c'); g.addColorStop(0.5,'#77502c'); g.addColorStop(1,'#5a3a1c');
  ctx.beginPath(); rr(-20,-47,40,48,8);
  O(g, '#3c2610', 2.6);
  ctx.strokeStyle = 'rgba(50,32,14,0.55)'; ctx.lineWidth = 2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-11,-42); ctx.quadraticCurveTo(-13,-24,-11,-6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10,-40); ctx.quadraticCurveTo(12,-24,10,-8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1,-38); ctx.quadraticCurveTo(-1,-26,1,-14); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0,-47,20,7.5,0,0,TAU);
  O('#b8895a', '#3c2610', 2.4);
  ctx.strokeStyle = 'rgba(90,58,28,0.7)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(0,-47,12,4.4,0,0,TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0,-47,5.5,2,0,0,TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-7,-25,3.4,4.6,0,0,TAU);
  O('#ffca4d', '#8a4c10', 1.6);
  ctx.beginPath(); ctx.ellipse(7,-25,3.4,4.6,0,0,TAU);
  O('#ffca4d', '#8a4c10', 1.6);
  ctx.fillStyle = '#c04818';
  ctx.beginPath(); ctx.arc(-7,-24.4,1.5,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(7,-24.4,1.5,0,TAU); ctx.fill();
  const w1 = Math.sin(t*9+ph)*3.4, w2 = Math.cos(t*11+ph)*3.2;
  const flame = (h, col, off)=>{
    ctx.beginPath();
    ctx.moveTo(-14+off, -49);
    ctx.quadraticCurveTo(-17+off+w1, -49-h*0.45, w2*0.5+off, -49-h);
    ctx.quadraticCurveTo(17+off+w1, -49-h*0.42, 14+off, -49);
    ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  };
  flame(40+Math.sin(t*7+ph)*6, '#ff7a1e', 0);
  flame(29+Math.cos(t*8+ph)*5, '#ffc23e', 0);
  flame(16+Math.sin(t*10+ph)*3.5, '#fff3b0', 0);
  ctx.fillStyle = 'rgba(255,190,80,0.85)';
  for(let k=0;k<3;k++){
    const yy = -58 - ((t*46 + k*29) % 34);
    const xx = Math.sin(t*3+k*2.4)*7;
    ctx.globalAlpha = clamp(1 - (-58-yy+34)/40, 0, 1)*0.8;
    ctx.beginPath(); ctx.arc(xx, yy, 1.7, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------- 绘制：蘑菇与咖啡豆 ----------------

// 蘑菇的脸：醒着睁眼乱瞟，打盹时闭眼撇嘴
export function drawShroomFace(ey, asleep, t, ph){
  ctx.lineCap = 'round';
  if(asleep){
    ctx.strokeStyle = '#3a2a44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-5.5, ey-1, 3.6, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(5.5, ey-1, 3.6, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, ey+9, 2.6, Math.PI+0.3, TAU-0.3); ctx.stroke();
    return;
  }
  const blink = Math.sin(t*1.7+ph) > 0.965;
  for(const ex of [-5.5, 5.5]){
    ctx.beginPath(); ctx.ellipse(ex, ey, 3.6, blink ? 0.9 : 4.4, 0, 0, TAU);
    O('#fff', '#3a2a44', 1.5);
    if(!blink){
      ctx.fillStyle = '#221822';
      ctx.beginPath(); ctx.arc(ex+1.2, ey+0.9, 1.8, 0, TAU); ctx.fill();
    }
  }
  ctx.strokeStyle = '#3a2a44'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(0, ey+8, 3.2, 0.25, Math.PI-0.25); ctx.stroke();
}

// 打盹中的蘑菇头顶飘着的 Z，提示「需要咖啡豆」
export function drawSleepZzz(t, ph){
  ctx.save();
  for(let k=0;k<3;k++){
    const cyc = (t*0.5 + k*0.34 + ph*0.07) % 1;
    const a = 1 - cyc;
    if(a <= 0.05) continue;
    ctx.globalAlpha = a * 0.95;
    drawText('z', 17 + cyc*11, -46 - cyc*30, 8 + cyc*7, '#f4f8ff', 'rgba(64,76,120,0.9)', 2.2, 'center', '900');
  }
  ctx.restore();
}

export function drawShroomBody(cap, capOut, hi, spots){
  let g = ctx.createLinearGradient(-8,0,8,-26);
  g.addColorStop(0,'#f6efdd'); g.addColorStop(1,'#d5c8ab');
  ctx.beginPath();
  ctx.moveTo(-7,-1); ctx.quadraticCurveTo(-9.5,-15,-6.5,-25);
  ctx.lineTo(6.5,-25); ctx.quadraticCurveTo(9.5,-15,7,-1);
  ctx.quadraticCurveTo(0,3,-7,-1); ctx.closePath();
  O(g, '#6a5030', 2);
  g = ctx.createRadialGradient(-6,-40,3, 0,-31,23);
  g.addColorStop(0, cap[0]); g.addColorStop(0.6, cap[1]); g.addColorStop(1, cap[2]);
  ctx.beginPath(); ctx.ellipse(0,-31,18,13.5,0,0,TAU);
  O(g, capOut, 2.4);
  ctx.fillStyle = hi;
  ctx.beginPath(); ctx.ellipse(-6,-38,7,3.4,-0.35,0,TAU); ctx.fill();
  ctx.fillStyle = spots;
  for(const s of [[8,-36,2.6],[-11.5,-30,2.1],[2.5,-24.5,1.8]]){
    ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, TAU); ctx.fill();
  }
}

export function drawPuff(t, ph, asleep){
  ctx.save();
  ctx.translate(0, Math.sin(t*2.6+ph)*0.9);
  drawShroomBody(['#c9a2ea','#9459c0','#6b3490'], '#401d5c', 'rgba(255,255,255,0.22)', 'rgba(232,208,255,0.5)');
  drawShroomFace(-13, asleep, t, ph);
  ctx.restore();
}

export function drawSunshroom(t, ph, asleep){
  const pulse = asleep ? 0 : 0.5 + Math.sin(t*3.4+ph)*0.14;
  ctx.save();
  if(!asleep){
    let g = ctx.createRadialGradient(0,-30,4, 0,-30,34);
    g.addColorStop(0,'rgba(255,220,110,'+(0.26*pulse+0.1)+')');
    g.addColorStop(1,'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,-30,34,0,TAU); ctx.fill();
  }
  ctx.translate(0, Math.sin(t*2.2+ph)*0.9);
  drawShroomBody(['#ffe9a0','#f5b63a','#c47a18'], '#7a4a10', 'rgba(255,255,255,0.3)', 'rgba(255,246,200,0.6)');
  drawShroomFace(-13, asleep, t, ph);
  ctx.restore();
}

export function drawCoffee(t, ph){
  ctx.save();
  ctx.translate(0, Math.sin(t*2.4+ph)*1.1);
  let g = ctx.createLinearGradient(-14,-40,14,-2);
  g.addColorStop(0,'#8a5a2c'); g.addColorStop(0.55,'#6b4220'); g.addColorStop(1,'#3f2410');
  ctx.beginPath(); ctx.ellipse(0,-21,15.5,20,0.14,0,TAU);
  O(g, '#241204', 2.4);
  ctx.strokeStyle = 'rgba(30,16,6,0.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-1,-39); ctx.quadraticCurveTo(6,-24,0,-3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,190,0.22)';
  ctx.beginPath(); ctx.ellipse(-8,-30,4.5,7,-0.4,0,TAU); ctx.fill();
  // 顶芽
  ctx.strokeStyle = '#4a7a28'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(1,-40); ctx.quadraticCurveTo(3,-48,2,-52); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(8,-52,7,3.6,-0.45,0,TAU);
  O('#7cc24a', '#2c5214', 1.8);
  // 脸
  const blink = Math.sin(t*1.9+ph) > 0.96;
  for(const ex of [-9, 7]){
    ctx.beginPath(); ctx.ellipse(ex, -24, 3.4, blink ? 0.9 : 4.2, 0, 0, TAU);
    O('#fff8ec', '#241204', 1.5);
    if(!blink){
      ctx.fillStyle = '#241204';
      ctx.beginPath(); ctx.arc(ex+1.1, -23.2, 1.7, 0, TAU); ctx.fill();
    }
  }
  ctx.strokeStyle = '#241204'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(-1, -14, 3.4, 0.3, Math.PI-0.3); ctx.stroke();
  ctx.restore();
}

// ---- 迪迦奥特曼：银紫红复合型人形，胸口彩色计时器随剩余时间转红闪烁 ----
// 开火的后座帧把双臂收成十字，光线从交叉点右方射出去；其余时间双臂自然下垂。
export function drawTiga(t, ph, recoil, lifeRatio, flash){
  const silver = '#d9dee6', silverHi = '#f6f9fc', silverDk = '#98a2ae', line = '#3f4652';
  const purple = '#6a5cae', purpleDk = '#42387a';
  const red = '#d6413a', redDk = '#8f201c';
  const fire = (recoil || 0) > 0.55 || (flash || 0) > 0;
  const ratio = clamp(lifeRatio == null ? 1 : lifeRatio, 0, 1);
  const low = ratio < 0.25;
  const timer = ratio > 0.5 ? '#5fd6a8' : ratio > 0.25 ? '#ffd23e' : '#ff4b3a';
  const timerGlow = ratio > 0.5 ? 'rgba(120,236,198,0.55)'
    : ratio > 0.25 ? 'rgba(255,210,90,0.6)' : 'rgba(255,92,70,0.65)';
  const timerOn = !low || Math.sin(t*9 + ph) > -0.1;
  const bob = Math.sin(t*1.7 + ph)*1.5;

  ctx.save();
  ctx.translate(0, -bob);
  ctx.lineCap = 'round';

  if(fire){
    let g = ctx.createRadialGradient(6,-58,4, 6,-58,54);
    g.addColorStop(0,'rgba(223,246,255,0.5)');
    g.addColorStop(1,'rgba(143,216,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(6,-58,54,0,TAU); ctx.fill();
  }

  // 腿 + 小腿红甲 + 靴
  const step = Math.sin(t*1.3 + ph)*1.2;
  for(const s of [[-6,-step],[6,step]]){
    const x = s[0], dy = s[1];
    ctx.beginPath(); ctx.moveTo(x,-44); ctx.quadraticCurveTo(x+dy,-26, x*0.85+dy*0.5,-8);
    ctx.strokeStyle = line; ctx.lineWidth = 13; ctx.stroke();
    ctx.strokeStyle = silver; ctx.lineWidth = 10; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x*0.92+dy*0.3,-22); ctx.lineTo(x*0.86+dy*0.5,-10);
    ctx.strokeStyle = red; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x*0.85+dy*0.5+2.5,-4,8.5,4.4,0,0,TAU);
    O(silver, line, 2);
  }

  // 躯干
  let g = ctx.createLinearGradient(-14,-72, 14,-42);
  g.addColorStop(0,silverHi); g.addColorStop(0.55,silver); g.addColorStop(1,silverDk);
  ctx.beginPath();
  ctx.moveTo(-13,-44);
  ctx.quadraticCurveTo(-16,-63,-11,-74);
  ctx.lineTo(11,-74);
  ctx.quadraticCurveTo(16,-63,13,-44);
  ctx.quadraticCurveTo(0,-38,-13,-44);
  ctx.closePath();
  O(g, line, 2.4);
  // 胸口紫色护甲
  g = ctx.createLinearGradient(0,-74, 0,-52);
  g.addColorStop(0,purple); g.addColorStop(1,purpleDk);
  ctx.beginPath();
  ctx.moveTo(-11,-73); ctx.quadraticCurveTo(0,-64, 11,-73);
  ctx.quadraticCurveTo(6,-55, 0,-53); ctx.quadraticCurveTo(-6,-55,-11,-73);
  ctx.closePath();
  O(g, purpleDk, 1.8);
  // 腰部红带
  ctx.beginPath();
  ctx.moveTo(-12,-47); ctx.quadraticCurveTo(0,-41, 12,-47);
  ctx.lineTo(12,-44); ctx.quadraticCurveTo(0,-37,-12,-44);
  ctx.closePath();
  O(red, redDk, 1.4);

  // 彩色计时器
  if(timerOn){
    g = ctx.createRadialGradient(0,-60,1, 0,-60,15);
    g.addColorStop(0,timerGlow); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,-60,15,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-60,6.2,0,TAU);
    O(timer, 'rgba(63,70,82,0.85)', 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(-1.8,-61.8,1.6,0,TAU); ctx.fill();
  }

  // 手臂
  const limb = (x1,y1,x2,y2,cx1,cy1)=>{
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx1,cy1,x2,y2);
    ctx.strokeStyle = line; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = silver; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.arc(x2,y2,5.4,0,TAU);
    O(silverHi, line, 2);
  };
  if(fire){
    // 竖臂在后，横臂压在上面，交叉点朝右出光
    limb(15,-78, 15,-40, 16,-59);
    limb(-10,-56, 29,-58, 10,-63);
  } else {
    const sw = Math.sin(t*1.5 + ph)*1.4;
    limb(-12,-70, -17+sw,-46, -17,-58);
    limb(12,-70, 17-sw,-46, 17,-58);
  }

  // 头
  ctx.save();
  ctx.translate(0,-85);
  ctx.rotate(Math.sin(t*0.9 + ph)*0.02);
  g = ctx.createLinearGradient(0,-14, 0,10);
  g.addColorStop(0,silverHi); g.addColorStop(1,silverDk);
  ctx.beginPath(); ctx.ellipse(0,0,10.5,13,0,0,TAU);
  O(g, line, 2.2);
  // 中央冠鳍
  ctx.beginPath();
  ctx.moveTo(-1.6,-12); ctx.lineTo(0,-21); ctx.lineTo(1.6,-12);
  ctx.lineTo(1.2,7); ctx.lineTo(-1.2,7);
  ctx.closePath();
  O(purple, purpleDk, 1.3);
  // 额头水晶
  ctx.beginPath();
  ctx.moveTo(0,-10); ctx.lineTo(2.4,-7); ctx.lineTo(0,-4); ctx.lineTo(-2.4,-7);
  ctx.closePath();
  O('#9fe4ff', '#4a86a8', 1.2);
  // 双眼
  for(const ex of [-5.4, 5.4]){
    ctx.save();
    ctx.translate(ex, 2);
    ctx.rotate(ex < 0 ? -0.16 : 0.16);
    const ge = ctx.createLinearGradient(0,-4, 0,4);
    ge.addColorStop(0,'#fff8d0'); ge.addColorStop(1,'#ffc93e');
    ctx.beginPath(); ctx.ellipse(0,0,4.3,3,0,0,TAU);
    O(ge, '#8a5a10', 1.3);
    ctx.restore();
  }
  ctx.restore();

  // 十字出光口
  if(flash > 0){
    ctx.save();
    ctx.globalAlpha = clamp(flash/0.4, 0, 1);
    g = ctx.createRadialGradient(24,-58,1, 24,-58,20);
    g.addColorStop(0,'rgba(255,255,255,0.95)');
    g.addColorStop(0.45,'rgba(180,232,255,0.6)');
    g.addColorStop(1,'rgba(120,200,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(24,-58,20,0,TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---- 球球：彩色小皮球 ----
export function drawBallIcon(x,y,r,spin){
  ctx.save(); ctx.translate(x,y); ctx.rotate(spin||0);
  ctx.beginPath(); ctx.arc(0,0,r,0,TAU);
  O('#e8483c', '#7a1408', 1.8);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r-0.9,-0.4,1.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a93c9';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r-0.9,2.7,4.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-r*0.32,-r*0.36,r*0.3,r*0.18,-0.6,0,TAU); ctx.fill();
  ctx.restore();
}

// ---- 球球：5 岁小男孩，加特林核心角色 ----
// ---- 加特林机枪 ----
export function drawGatling(ox, oy, spin, muzzle){
  // 枪身
  ctx.beginPath(); rr(ox-14, oy-11, 22, 22, 5);
  O('#5a5f66', '#2c2f33', 2.2);
  // 顶部弹链盒
  ctx.beginPath(); rr(ox-6, oy-17, 14, 8, 3);
  O('#6b7076', '#3c4046', 1.6);
  // 握把
  ctx.beginPath(); rr(ox-8, oy+11, 9, 9, 3);
  O('#3c4046', '#2c2f33', 1.8);
  // 六根旋转枪管
  for(let k=0;k<6;k++){
    const a = spin + k*TAU/6;
    const bx = ox+14 + Math.cos(a)*5;
    const by = oy + Math.sin(a)*5;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+19,by);
    ctx.strokeStyle='#3c4046'; ctx.lineWidth=6; ctx.lineCap='round'; ctx.stroke();
    ctx.strokeStyle='#6b7076'; ctx.lineWidth=3; ctx.stroke();
  }
  // 枪口箍
  ctx.beginPath(); ctx.ellipse(ox+33, oy, 7, 9, 0, 0, TAU);
  O('#3c4046', '#2c2f33', 2);
  ctx.beginPath(); ctx.ellipse(ox+33, oy, 3.5, 5, 0, 0, TAU);
  ctx.fillStyle='#1a1c1f'; ctx.fill();
  // 枪口火光
  if(muzzle > 0){
    ctx.save();
    ctx.globalAlpha = clamp(muzzle,0,1);
    let g = ctx.createRadialGradient(ox+36,oy,1, ox+36,oy,14);
    g.addColorStop(0,'rgba(255,250,200,0.95)');
    g.addColorStop(1,'rgba(255,180,60,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(ox+36,oy,14,0,TAU); ctx.fill();
    ctx.restore();
  }
}

export function drawQiuqiu(t, ph, throwT){
  const r = clamp(throwT||0, 0, 1);          // 1=刚出手 0=待机
  const hop = Math.abs(Math.sin(t*2.6+ph))*2.4;
  const blink = isBlinking(t, ph);
  const skin='#ffd9ae', skinD='#eeb183', line='#6e4218';
  ctx.save();
  ctx.translate(0, -hop);
  ctx.rotate(r*0.07);                        // 开火时身体轻微后座

  // 腿 + 小球鞋
  const step = Math.sin(t*2.6+ph)*1.6;
  const leg=(x,dy)=>{
    ctx.beginPath(); ctx.moveTo(x,-16); ctx.lineTo(x+dy*0.4,-4);
    ctx.strokeStyle=line; ctx.lineWidth=8; ctx.stroke();
    ctx.strokeStyle=skin; ctx.lineWidth=5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x+dy*0.4+2.5,-3,8,4.6,0,0,TAU);
    O('#f7f7f2','#5a5a52',2);
    ctx.strokeStyle='#e04438'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(x+dy*0.4-4,-3.4); ctx.lineTo(x+dy*0.4+9,-3.4); ctx.stroke();
  };
  leg(-5,-step); leg(6,step);

  // 躯干：橙色 T 恤
  let g = ctx.createLinearGradient(0,-48,0,-28);
  g.addColorStop(0,'#ffc85a'); g.addColorStop(1,'#f5a02e');
  ctx.beginPath(); rr(-13,-48,26,20,8);
  O(g,'#a05c10',2.2);
  ctx.beginPath(); ctx.ellipse(-11,-42,5,6,0.3,0,TAU); O('#f5a02e','#a05c10',2);
  ctx.beginPath(); ctx.ellipse(11,-42,5,6,-0.3,0,TAU); O('#f5a02e','#a05c10',2);

  // 蓝色背带裤
  g = ctx.createLinearGradient(0,-36,0,-12);
  g.addColorStop(0,'#4a82d4'); g.addColorStop(1,'#2f5ca8');
  ctx.beginPath(); rr(-12,-34,24,20,6);
  O(g,'#1c3a70',2.2);
  ctx.strokeStyle='#2f5ca8'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-8,-34); ctx.lineTo(-8,-44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,-34); ctx.lineTo(8,-44); ctx.stroke();
  ctx.fillStyle='#ffd23e';
  ctx.beginPath(); ctx.arc(-8,-33,2.2,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(8,-33,2.2,0,TAU); ctx.fill();
  ctx.strokeStyle='#1c3a70'; ctx.lineWidth=1.8;
  ctx.beginPath(); rr(-5,-28,10,7,3); ctx.stroke();

  // ---- 大头 ----
  ctx.save();
  ctx.translate(2,-66);
  ctx.rotate(Math.sin(t*1.8+ph)*0.03);
  // 耳朵
  ctx.beginPath(); ctx.ellipse(-21,2,3.5,4.5,0,0,TAU); O(skinD,line,1.8);
  // 脸
  g = ctx.createRadialGradient(-6,-8,4, 0,0,25);
  g.addColorStop(0,'#ffe6c4'); g.addColorStop(1,skin);
  ctx.beginPath(); ctx.arc(0,0,23,0,TAU);
  O(g,line,2.4);
  // 帽檐下的刘海
  ctx.fillStyle='#4a2c14';
  ctx.beginPath(); ctx.moveTo(-20,-10); ctx.quadraticCurveTo(-14,-4,-19,-1); ctx.quadraticCurveTo(-23,-5,-20,-10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(15,-13); ctx.quadraticCurveTo(19,-8,15,-6); ctx.quadraticCurveTo(12,-9,15,-13); ctx.fill();
  // 大眼睛（望向右方）
  if(blink){
    ctx.strokeStyle=line; ctx.lineWidth=2.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(3,-4); ctx.lineTo(9,-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13,-4); ctx.lineTo(19,-4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(6,-4,4.6,5.6,0,0,TAU); O('#fff',line,1.8);
    ctx.beginPath(); ctx.ellipse(16,-3.5,4.2,5.2,0,0,TAU); O('#fff',line,1.8);
    ctx.fillStyle='#2a1a08';
    ctx.beginPath(); ctx.arc(7.4,-3.4,2.4,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(17.2,-3,2.2,0,TAU); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(8.2,-4.4,0.9,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(18,-4,0.8,0,TAU); ctx.fill();
  }
  // 眉毛
  ctx.strokeStyle='#4a2c14'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(2,-11); ctx.lineTo(9,-12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13,-12); ctx.lineTo(19,-11); ctx.stroke();
  // 鼻子
  ctx.strokeStyle=skinD; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(12,2,2, -0.5, 1.2); ctx.stroke();
  // 开心大笑的嘴
  ctx.fillStyle='#7a2c18';
  ctx.beginPath(); ctx.ellipse(10,8,6.5,4.6,0.1,0,TAU); ctx.fill();
  ctx.fillStyle='#e86a5a';
  ctx.beginPath(); ctx.ellipse(10,9.6,3.6,2.2,0.1,0,TAU); ctx.fill();
  ctx.fillStyle='#fff';
  ctx.fillRect(6.5,4.6,3,2.2);
  // 腮红
  ctx.fillStyle='rgba(240,120,110,0.4)';
  ctx.beginPath(); ctx.ellipse(-2,6,3.6,2.4,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(20,6,3,2.2,0,0,TAU); ctx.fill();
  // ---- 红色棒球帽 ----
  g = ctx.createLinearGradient(0,-28,0,-6);
  g.addColorStop(0,'#f0685a'); g.addColorStop(1,'#c03028');
  ctx.beginPath();
  ctx.moveTo(-23,-6);
  ctx.quadraticCurveTo(-20,-27, 0,-28);
  ctx.quadraticCurveTo(20,-27, 23,-6);
  ctx.quadraticCurveTo(0,-14, -23,-6);
  ctx.closePath();
  O(g,'#6e1810',2.2);
  // 帽檐（朝右）
  ctx.beginPath(); ctx.ellipse(27,-9, 13, 4.6, -0.1, 0, TAU);
  O('#c03028','#6e1810',2);
  // 前片 + 小皮球标志
  ctx.beginPath(); ctx.arc(6,-17,6,0,TAU); O('#f7f2e4','#6e1810',1.6);
  drawBallIcon(6,-17,3.6, 0);
  // 帽顶扣
  ctx.beginPath(); ctx.arc(0,-28,2.6,0,TAU); O('#c03028','#6e1810',1.4);
  ctx.restore();

  // ---- 加特林机枪（画在大头之后，机枪在身前） ----
  const spin = t*2 + r*18;
  const muzzle = clamp(r*1.6, 0, 1);
  ctx.lineCap='round';
  // 左手托住机枪底部
  ctx.beginPath(); ctx.moveTo(-9,-40); ctx.quadraticCurveTo(-4,-34, 7,-36);
  ctx.strokeStyle=line; ctx.lineWidth=8.5; ctx.stroke();
  ctx.strokeStyle=skin; ctx.lineWidth=5.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(7,-36,4.6,0,TAU); O(skin,line,2);
  // 机枪本体
  drawGatling(16, -44, spin, muzzle);
  // 右手扣扳机
  ctx.beginPath(); ctx.moveTo(12,-38); ctx.quadraticCurveTo(16,-46, 17,-52);
  ctx.strokeStyle=line; ctx.lineWidth=8.5; ctx.stroke();
  ctx.strokeStyle=skin; ctx.lineWidth=5.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(17,-53,4.6,0,TAU); O(skin,line,2);

  ctx.restore();
}

// 实体与图鉴图标共用同一张绘制表（E4）。
// 拆分前这里是两个必须手工同步的 switch：漏掉一个 case 时实体「种下去不画」、
// 图标「图鉴/卡槽空白」，而且不会有任何报错。合成一张表之后，新增角色只改一处，
// 漏登记则由 tests/render-plant-table.test.mjs 直接判红。
// 每个抽屉都接收 (t, pose)：实体传实体本身，图标传 ICON_POSE 里的固定姿态。
export const PLANT_DRAWERS = {
  qiuqiu:     (t, p) => drawQiuqiu(t, p.phase, p.recoil),
  sunflower:  (t, p) => drawSunflower(t, p.phase),
  peashooter: (t, p) => drawShooter(t, p.phase, 'pea', p.recoil, p.flash),
  snowpea:    (t, p) => drawShooter(t, p.phase, 'snow', p.recoil, p.flash),
  repeater:   (t, p) => drawShooter(t, p.phase, 'repeater', p.recoil, p.flash),
  wallnut:    (t, p) => drawWallnut(p.hp/p.maxHp, t, p.phase),
  potato:     (t, p) => drawPotato(p.armed, t, p.phase),
  cherry:     (t, p) => drawCherry(p.fuse, t, p.phase),
  torch:      (t, p) => drawTorch(t, p.phase),
  puff:       (t, p) => drawPuff(t, p.phase, p.asleep),
  sunshroom:  (t, p) => drawSunshroom(t, p.phase, p.asleep),
  coffee:     (t, p) => drawCoffee(t, p.phase),
  tiga:       (t, p) => drawTiga(t, p.phase, p.recoil, p.maxLifeT ? p.lifeT/p.maxLifeT : 1, p.flash),
};

// 图鉴 / 卡槽 / 种子栏用的固定姿势：每个角色挑一个最有代表性的相位。
// 这些取值与原 switch 逐项一致，改动会被 5 条绘制轨迹基线抓住。
export const ICON_POSE = {
  qiuqiu:     { phase:1,  recoil:0 },
  sunflower:  { phase:1 },
  peashooter: { phase:2,  recoil:0, flash:0 },
  snowpea:    { phase:3,  recoil:0, flash:0 },
  repeater:   { phase:4,  recoil:0, flash:0 },
  wallnut:    { phase:5,  hp:1, maxHp:1 },
  potato:     { phase:6,  armed:true },
  cherry:     { phase:7,  fuse:0.9 },
  torch:      { phase:8 },
  puff:       { phase:9,  asleep:false },
  sunshroom:  { phase:10, asleep:false },
  coffee:     { phase:11 },
  tiga:       { phase:12, recoil:0, lifeT:0.85, maxLifeT:1, flash:0 },
};

export function drawPlantEntity(t, p){
  ctx.save();
  ctx.translate(p.cx, p.fy);
  ctx.fillStyle = 'rgba(35,65,20,0.32)';
  ctx.beginPath(); ctx.ellipse(0,3,25,7.5,0,0,TAU); ctx.fill();
  ctx.fillStyle = 'rgba(35,65,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0,3,32,10,0,0,TAU); ctx.fill();
  const draw = PLANT_DRAWERS[p.type];
  if(draw) draw(t, p);
  if(p.asleep) drawSleepZzz(t, p.phase);
  ctx.restore();
}

// 图标缩放修正：比其它植物高出一截的角色要收一下，否则图鉴卡、卡槽、种子槽里的名字都会压在脑袋上。
// 导出给绘制投影（脚下阴影）用，保证人和影子一起缩。
export const ICON_FIT = { tiga: 0.76 };

export function drawPlantIcon(t, type, x, y, s){
  const fit = ICON_FIT[type] || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s*fit, s*fit);
  const draw = PLANT_DRAWERS[type];
  if(draw) draw(t, ICON_POSE[type]);
  ctx.restore();
}

