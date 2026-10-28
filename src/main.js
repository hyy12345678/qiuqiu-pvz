"use strict";
/* ============================================================
   球球的植物大战僵尸 · 网页同人复刻版（增强美术版）
   全部图形由 Canvas 程序化绘制，音效音乐由 Web Audio 实时合成，
   无任何外部资源，可完全离线运行。仅供个人学习娱乐。
   ============================================================ */

// 常量、数值表、音频、题目、波次、状态与模拟已拆到 core/ 与 audio/；本文件只剩渲染与输入。
import { W, H, COLS, ROWS, CW, CH, LX, LY, TAU } from './core/constants.js';
import { clamp, rand, lerp, easeOut, isBlinking } from './core/util.js';
import { mulberry32 } from './core/rng.js';
import { PLANTS, PLANT_ORDER } from './core/data/plants.js';
import { LEVELS } from './core/data/levels.js';
import { SFX } from './audio/sfx.js';
import { G, startLevel, startQuiz, answerQuiz, updateQuiz, toggleUnlockAll, isNight } from './core/world.js';
import { cellCX, cellFY, placePlant, removePlant, applyCoffee } from './core/entities.js';
import { addLeafBurst } from './core/particles.js';
import { updatePlay } from './core/sim.js';



const cv = document.getElementById('game');
let ctx = cv.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * DPR; cv.height = H * DPR;
ctx.scale(DPR, DPR);

function rr(x,y,w,h,r){ // 圆角矩形路径
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function O(fill, stroke, lw){ // 填充+描边当前路径
  if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw||2.5; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke(); }
}



// ---------------- 全局状态 ----------------
let AT = 0;               // 全局动画时间


// ---------------- 实体行为 ----------------
// ---------------- 更新逻辑 ----------------

// 粒子辅助
// ---------------- 预渲染背景 ----------------
let bgCanvas = null, bgTheme = null;
function ensureBG(){
  const theme = isNight() ? 'night' : 'day';
  if(bgCanvas && bgTheme === theme) return;
  bgTheme = theme;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = W*DPR; bgCanvas.height = H*DPR;
  const bgc = bgCanvas.getContext('2d');
  bgc.scale(DPR, DPR);
  const saved = ctx;
  ctx = bgc;
  paintBattleBG(theme==='night');
  ctx = saved;
}
function paintBattleBG(night){
  const R = mulberry32(20260814);
  // 天空
  let g = ctx.createLinearGradient(0,0,0,LY);
  g.addColorStop(0,'#7ec8ee'); g.addColorStop(1,'#b8e4f6');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,LY);
  // 远景树丛（草坪上缘之后）
  ctx.fillStyle = '#4d8a3a';
  for(let x=-10;x<W+20;x+=26){
    ctx.beginPath(); ctx.arc(x, LY-20, 20+R()*10, Math.PI, 0); ctx.fill();
  }
  ctx.fillStyle = '#5f9e46';
  for(let x=-4;x<W+20;x+=30){
    ctx.beginPath(); ctx.arc(x, LY-16, 15+R()*8, Math.PI, 0); ctx.fill();
  }
  // 白色栅栏
  ctx.fillStyle = '#f2ead4';
  ctx.strokeStyle = '#b8a880'; ctx.lineWidth = 1.5;
  for(let x=204;x<W;x+=26){
    rr(x, LY-30, 14, 30, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, LY-30); ctx.lineTo(x+7, LY-38); ctx.lineTo(x+14, LY-30); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#e8dfc6';
  ctx.fillRect(200, LY-22, W-200, 5);
  ctx.fillRect(200, LY-12, W-200, 5);
  ctx.strokeStyle = 'rgba(120,105,70,0.4)';
  ctx.strokeRect(200, LY-22, W-200, 5);

  // 草坪基底
  ctx.fillStyle = '#7dbb43';
  ctx.fillRect(0, LY-4, W, ROWS*CH+8);
  // 棋盘格（带微渐变）
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x = LX+c*CW, y = LY+r*CH;
    const light = (r+c)%2===0;
    g = ctx.createLinearGradient(0,y,0,y+CH);
    if(light){ g.addColorStop(0,'#aede66'); g.addColorStop(1,'#96cd52'); }
    else { g.addColorStop(0,'#98cf54'); g.addColorStop(1,'#84bd44'); }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, CW, CH);
  }
  // 草丛点缀
  ctx.strokeStyle = 'rgba(70,120,40,0.5)'; ctx.lineWidth = 1.6; ctx.lineCap='round';
  for(let k=0;k<150;k++){
    const x = LX + R()*COLS*CW, y = LY + R()*ROWS*CH;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x-2, y-5-R()*3);
    ctx.moveTo(x, y); ctx.lineTo(x+1, y-6-R()*3);
    ctx.moveTo(x, y); ctx.lineTo(x+3, y-4-R()*3);
    ctx.stroke();
  }
  // 棋盘格描边
  ctx.strokeStyle = 'rgba(60,95,30,0.25)'; ctx.lineWidth = 1.5;
  for(let c=0;c<=COLS;c++){ ctx.beginPath(); ctx.moveTo(LX+c*CW, LY); ctx.lineTo(LX+c*CW, LY+ROWS*CH); ctx.stroke(); }
  for(let r=0;r<=ROWS;r++){ ctx.beginPath(); ctx.moveTo(LX, LY+r*CH); ctx.lineTo(LX+COLS*CW, LY+r*CH); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(45,80,22,0.5)'; ctx.lineWidth = 2.5;
  ctx.strokeRect(LX-1, LY-1, COLS*CW+2, ROWS*CH+2);

  // 右侧入场暗区
  g = ctx.createLinearGradient(LX+COLS*CW, 0, W, 0);
  g.addColorStop(0,'rgba(40,70,25,0)'); g.addColorStop(1,'rgba(24,46,14,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(LX+COLS*CW, LY-34, W-(LX+COLS*CW), ROWS*CH+38);

  // ---- 左侧房屋 ----
  const y0 = LY-34, y1 = LY+ROWS*CH+4;
  g = ctx.createLinearGradient(0,0,198,0);
  g.addColorStop(0,'#f0e2c0'); g.addColorStop(1,'#dcc79c');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, 198, y1-y0);
  // 木板缝
  ctx.strokeStyle = 'rgba(120,95,60,0.3)'; ctx.lineWidth = 2;
  for(let y=y0+20; y<y1; y+=22){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(198,y); ctx.stroke();
  }
  // 屋顶檐口
  ctx.fillStyle = '#8a5c34';
  ctx.fillRect(0, y0, 200, 12);
  ctx.fillStyle = '#6b4522';
  ctx.fillRect(0, y0+12, 200, 4);
  // 砖基座
  ctx.fillStyle = '#b08968';
  ctx.fillRect(0, y1-26, 198, 26);
  ctx.strokeStyle = 'rgba(90,60,40,0.4)'; ctx.lineWidth = 1.5;
  for(let y=y1-26;y<y1;y+=9){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(198,y); ctx.stroke(); }
  for(let x=8;x<198;x+=18){ ctx.beginPath(); ctx.moveTo(x,y1-26); ctx.lineTo(x,y1); ctx.stroke(); }
  // 窗户（两扇，带花盆）
  for(const wy of [LY+34, LY+ROWS*CH-140]){
    ctx.fillStyle = '#7a5c38';
    rr(54, wy-6, 96, 106, 6); ctx.fill();
    g = ctx.createLinearGradient(54,wy,54,wy+94);
    g.addColorStop(0,'#cdeaf5'); g.addColorStop(1,'#8fc4da');
    ctx.fillStyle = g;
    ctx.fillRect(62, wy+2, 80, 90);
    // 窗帘
    ctx.fillStyle = 'rgba(232,120,90,0.85)';
    ctx.beginPath(); ctx.moveTo(62,wy+2); ctx.lineTo(80,wy+2); ctx.quadraticCurveTo(70,wy+40,62,wy+58); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(142,wy+2); ctx.lineTo(124,wy+2); ctx.quadraticCurveTo(134,wy+40,142,wy+58); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a5c38'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(102, wy+2); ctx.lineTo(102, wy+92);
    ctx.moveTo(62, wy+47); ctx.lineTo(142, wy+47); ctx.stroke();
    // 窗台花盆
    ctx.fillStyle = '#a86238';
    ctx.beginPath(); ctx.moveTo(76,wy+100); ctx.lineTo(92,wy+100); ctx.lineTo(89,wy+112); ctx.lineTo(79,wy+112); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e86a8a';
    ctx.beginPath(); ctx.arc(80,wy+97,4,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(88,wy+95,4.5,0,TAU); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(84,wy+99,3,0,TAU); ctx.fill();
  }
  // 门廊立柱与壁灯
  ctx.fillStyle = '#8a6b44';
  ctx.fillRect(188, y0+12, 12, y1-y0-38);
  ctx.fillStyle = '#3c3428';
  ctx.fillRect(170, y0+40, 10, 16);
  ctx.fillStyle = '#ffd83d';
  ctx.beginPath(); ctx.arc(175, y0+48, 4, 0, TAU); ctx.fill();

  // 小推车泥土带
  g = ctx.createLinearGradient(198,0,LX,0);
  g.addColorStop(0,'#c9a76e'); g.addColorStop(1,'#b28f58');
  ctx.fillStyle = g;
  ctx.fillRect(198, LY-4, LX-198, ROWS*CH+8);
  ctx.strokeStyle = 'rgba(90,66,38,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(199, LY-4); ctx.lineTo(199, LY+ROWS*CH+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(LX-1, LY-4); ctx.lineTo(LX-1, LY+ROWS*CH+4); ctx.stroke();
  for(let r=0;r<ROWS;r++){
    for(let k=0;k<4;k++){
      ctx.fillStyle = 'rgba(120,90,50,'+(0.18+R()*0.15)+')';
      ctx.beginPath();
      ctx.ellipse(208+R()*50, LY+r*CH+14+R()*70, 4+R()*4, 2.5+R()*2, R(), 0, TAU);
      ctx.fill();
    }
  }

  // 底部草地
  g = ctx.createLinearGradient(0,LY+ROWS*CH,0,H);
  g.addColorStop(0,'#74b240'); g.addColorStop(1,'#5d9633');
  ctx.fillStyle = g;
  ctx.fillRect(0, LY+ROWS*CH+4, W, H-(LY+ROWS*CH)-4);
  // 底部小花小草
  for(let k=0;k<40;k++){
    const x = R()*W, y = LY+ROWS*CH+12+R()*28;
    if(R()<0.4){
      ctx.fillStyle = ['#ffd23e','#ff8ab0','#fff'][k%3];
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(50,95,28,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-2,y-5); ctx.moveTo(x,y); ctx.lineTo(x+2,y-6); ctx.stroke();
    }
  }

  // ---- 夜色处理（仅夜间关卡） ----
  if(night){
    // 整体压成冷调夜色
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#46588e'); g.addColorStop(0.28,'#3a4774'); g.addColorStop(1,'#243050');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
    // 星空
    for(let k=0;k<80;k++){
      const sx = R()*W, sy = 6 + R()*(LY-56), tw = 0.45 + R()*0.55;
      ctx.fillStyle = 'rgba(255,252,232,'+(0.3+tw*0.55).toFixed(3)+')';
      ctx.beginPath(); ctx.arc(sx, sy, 0.8+tw*1.4, 0, TAU); ctx.fill();
      if(tw > 0.9){
        ctx.strokeStyle = 'rgba(255,252,232,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx-3.2, sy); ctx.lineTo(sx+3.2, sy);
        ctx.moveTo(sx, sy-3.2); ctx.lineTo(sx, sy+3.2);
        ctx.stroke();
      }
    }
    // 月亮与月晕
    g = ctx.createRadialGradient(884,64,10, 884,64,130);
    g.addColorStop(0,'rgba(214,230,255,0.5)'); g.addColorStop(1,'rgba(214,230,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(884,64,130,0,TAU); ctx.fill();
    g = ctx.createRadialGradient(876,56,5, 884,64,28);
    g.addColorStop(0,'#fffdf0'); g.addColorStop(1,'#cdd6ea');
    ctx.beginPath(); ctx.arc(884,64,26,0,TAU);
    O(g, '#9aa6c4', 1.6);
    ctx.fillStyle = 'rgba(158,170,200,0.5)';
    ctx.beginPath(); ctx.arc(875,55,5.2,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(893,70,3.4,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(879,74,2.6,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(890,52,2.2,0,TAU); ctx.fill();
    // 草地雾气
    ctx.fillStyle = 'rgba(188,212,255,0.10)';
    for(let k=0;k<11;k++){
      const fx = R()*W, fy = LY + 22 + R()*(ROWS*CH-26);
      ctx.beginPath(); ctx.ellipse(fx, fy, 58+R()*74, 6+R()*5, 0, 0, TAU); ctx.fill();
    }
    // 房屋窗户透出暖光
    for(const wy of [LY+34, LY+ROWS*CH-140]){
      g = ctx.createLinearGradient(62,wy,62,wy+92);
      g.addColorStop(0,'#ffeab0'); g.addColorStop(1,'#f0b04a');
      ctx.fillStyle = g;
      ctx.fillRect(62, wy+2, 80, 90);
      ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(102, wy+2); ctx.lineTo(102, wy+92);
      ctx.moveTo(62, wy+47); ctx.lineTo(142, wy+47); ctx.stroke();
      g = ctx.createRadialGradient(102, wy+47, 8, 102, wy+47, 104);
      g.addColorStop(0,'rgba(255,214,124,0.42)'); g.addColorStop(1,'rgba(255,214,124,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(102, wy+47, 104, 0, TAU); ctx.fill();
    }
    // 门廊壁灯光晕
    g = ctx.createRadialGradient(175, y0+48, 3, 175, y0+48, 70);
    g.addColorStop(0,'rgba(255,226,146,0.7)'); g.addColorStop(1,'rgba(255,226,146,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(175, y0+48, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe89a';
    ctx.beginPath(); ctx.arc(175, y0+48, 5.2, 0, TAU); ctx.fill();
    // 月光在地面的冷高光
    g = ctx.createLinearGradient(0, LY+ROWS*CH, 0, H);
    g.addColorStop(0,'rgba(170,200,255,0.10)'); g.addColorStop(1,'rgba(170,200,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, LY+ROWS*CH+4, W, H-(LY+ROWS*CH)-4);
  }
}

function drawBackground(){
  ensureBG();
  ctx.drawImage(bgCanvas, 0, 0, W, H);
  if(isNight()){
    // 萤火虫 + 星光微微闪
    ctx.save();
    for(let k=0;k<10;k++){
      const x = ((AT*(6+k*1.4) + k*163) % (W+80)) - 40;
      const y = LY + 34 + ((k*101) % (ROWS*CH-56)) + Math.sin(AT*0.85+k*2.1)*16;
      const a = clamp(0.30 + Math.sin(AT*2.3+k*1.4)*0.34, 0, 1);
      if(a < 0.06) continue;
      ctx.globalAlpha = a*0.28;
      ctx.fillStyle = '#e9ff9a';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    return;
  }
  // 花粉光斑
  ctx.save();
  for(let k=0;k<7;k++){
    const x = ((AT*14 + k*197) % (W+60)) - 30;
    const y = LY + 46 + ((k*89) % (ROWS*CH-70)) + Math.sin(AT*0.9+k*1.7)*13;
    ctx.globalAlpha = 0.16 + Math.sin(AT*1.3+k)*0.08;
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath(); ctx.arc(x, y, 2.2+(k%3), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------- 绘制：植物 ----------------
function drawLeafShape(x,y,dir,s,col,outline){
  ctx.beginPath();
  ctx.moveTo(x,y);
  ctx.quadraticCurveTo(x+dir*15*s, y-9*s, x+dir*27*s, y-2*s);
  ctx.quadraticCurveTo(x+dir*15*s, y+8*s, x, y);
  O(col||'#5cb444', outline||'#2c6b1c', 2);
  ctx.strokeStyle = 'rgba(35,90,20,0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x+dir*3*s, y); ctx.quadraticCurveTo(x+dir*14*s, y-3*s, x+dir*23*s, y-2*s); ctx.stroke();
}

function drawSunflower(t, ph){
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

function drawShooter(t, ph, kind, recoil, flash){
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

function drawWallnut(hpFrac, t, ph){
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

function drawPotato(armed, t, ph){
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

function drawCherry(fuse, t, ph){
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

function drawTorch(t, ph){
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
function drawShroomFace(ey, asleep, t, ph){
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
function drawSleepZzz(t, ph){
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

function drawShroomBody(cap, capOut, hi, spots){
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

function drawPuff(t, ph, asleep){
  ctx.save();
  ctx.translate(0, Math.sin(t*2.6+ph)*0.9);
  drawShroomBody(['#c9a2ea','#9459c0','#6b3490'], '#401d5c', 'rgba(255,255,255,0.22)', 'rgba(232,208,255,0.5)');
  drawShroomFace(-13, asleep, t, ph);
  ctx.restore();
}

function drawSunshroom(t, ph, asleep){
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

function drawCoffee(t, ph){
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

// ---- 球球：彩色小皮球 ----
function drawBallIcon(x,y,r,spin){
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
function drawGatling(ox, oy, spin, muzzle){
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

function drawQiuqiu(t, ph, throwT){
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

function drawPlantEntity(p){
  const t = AT;
  ctx.save();
  ctx.translate(p.cx, p.fy);
  ctx.fillStyle = 'rgba(35,65,20,0.32)';
  ctx.beginPath(); ctx.ellipse(0,3,25,7.5,0,0,TAU); ctx.fill();
  ctx.fillStyle = 'rgba(35,65,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0,3,32,10,0,0,TAU); ctx.fill();
  switch(p.type){
    case 'qiuqiu': drawQiuqiu(t, p.phase, p.recoil); break;
    case 'sunflower': drawSunflower(t, p.phase); break;
    case 'peashooter': drawShooter(t, p.phase, 'pea', p.recoil, p.flash); break;
    case 'snowpea': drawShooter(t, p.phase, 'snow', p.recoil, p.flash); break;
    case 'repeater': drawShooter(t, p.phase, 'repeater', p.recoil, p.flash); break;
    case 'wallnut': drawWallnut(p.hp/p.maxHp, t, p.phase); break;
    case 'potato': drawPotato(p.armed, t, p.phase); break;
    case 'cherry': drawCherry(p.fuse, t, p.phase); break;
    case 'torch': drawTorch(t, p.phase); break;
    case 'puff': drawPuff(t, p.phase, p.asleep); break;
    case 'sunshroom': drawSunshroom(t, p.phase, p.asleep); break;
    case 'coffee': drawCoffee(t, p.phase); break;
  }
  if(p.asleep) drawSleepZzz(t, p.phase);
  ctx.restore();
}

function drawPlantIcon(type, x, y, s){
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  switch(type){
    case 'qiuqiu': drawQiuqiu(AT, 1, 0); break;
    case 'sunflower': drawSunflower(AT, 1); break;
    case 'peashooter': drawShooter(AT, 2, 'pea', 0, 0); break;
    case 'snowpea': drawShooter(AT, 3, 'snow', 0, 0); break;
    case 'repeater': drawShooter(AT, 4, 'repeater', 0, 0); break;
    case 'wallnut': drawWallnut(1, AT, 5); break;
    case 'potato': drawPotato(true, AT, 6); break;
    case 'cherry': drawCherry(0.9, AT, 7); break;
    case 'torch': drawTorch(AT, 8); break;
    case 'puff': drawPuff(AT, 9, false); break;
    case 'sunshroom': drawSunshroom(AT, 10, false); break;
    case 'coffee': drawCoffee(AT, 11); break;
  }
  ctx.restore();
}

// ---------------- 绘制：僵尸 ----------------
function drawZombieEntity(z, fyOverride){
  const fyBase = (fyOverride !== undefined) ? fyOverride : LY + (z.row+1)*CH - 4;
  const fy = fyBase + (z.vy || 0);
  const slowed = z.slowT > 0;
  const C = {
    skin:  slowed ? '#8fb4c4' : '#a3b187',
    skinD: slowed ? '#6a92a4' : '#7f8b66',
    line:  '#39412e',
    suit:  slowed ? '#4a5a68' : '#544f46',
    suitD: slowed ? '#394854' : '#3d3931',
    shirt: slowed ? '#9db4c2' : '#b3ac98',
    pants: slowed ? '#42525e' : '#4d463c',
    tie:   '#b8382c',
  };
  const eat = z.state==='eat', walk = z.state==='walk';
  const at = z.animT || 0;
  const ph = at*5.2;
  const swing = walk ? Math.sin(ph) : 0;
  const bob = walk ? Math.abs(Math.cos(ph))*2.6 : 0;
  const armSway = walk ? Math.sin(ph+1.1)*3 : (eat ? Math.sin(z.eatT*9)*2.4 : 0);
  const mouth = eat ? Math.abs(Math.sin(z.eatT*9))*7 : 2;
  const lunge = eat ? Math.abs(Math.sin(z.eatT*9))*5 : 0;
  const angry = z.type==='newspaper' && !!z.angry;   // 报纸被打掉后暴怒
  const reading = z.type==='newspaper' && !angry;    // 正在看报

  ctx.save();
  ctx.translate(z.x, fy);
  if(z.state==='dying'){
    const d = z.deathT;
    ctx.globalAlpha = clamp(1 - (d-0.25)/0.7, 0, 1);
    ctx.rotate(d*1.5);
    ctx.translate(0, d*10);
  }
  ctx.fillStyle = 'rgba(25,45,15,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 2, 23, 6.5, 0, 0, TAU); ctx.fill();

  ctx.rotate(swing*0.035);
  if(angry && walk) ctx.rotate(-0.11);   // 暴怒前冲
  ctx.translate(-lunge*0.35, -bob);

  // 后手臂（躯干后）
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(9,-66); ctx.lineTo(-4,-59-armSway*0.5); ctx.lineTo(-24,-52-armSway*0.5);
  ctx.strokeStyle = C.line; ctx.lineWidth = 9.5; ctx.stroke();
  ctx.strokeStyle = C.suitD; ctx.lineWidth = 6.5; ctx.stroke();
  ctx.fillStyle = C.skinD;
  ctx.beginPath(); ctx.arc(-26,-52-armSway*0.5,4.2,0,TAU); ctx.fill();

  // 腿
  const legDraw = (hipX, footX, lift)=>{
    const kneeX = (hipX+footX)/2 + 2;
    ctx.beginPath(); ctx.moveTo(hipX,-38); ctx.quadraticCurveTo(kneeX,-22, footX,-4-lift);
    ctx.strokeStyle = C.line; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = C.pants; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(footX-3,-3-lift,7.5,3.8,0,0,TAU);
    O('#2e2a24', '#17140f', 1.6);
  };
  legDraw(5, 6 - swing*9, walk ? Math.max(0,Math.sin(ph))*3 : 0);
  legDraw(-4, -2 + swing*9, walk ? Math.max(0,-Math.sin(ph))*3 : 0);

  // 躯干：衬衫
  ctx.beginPath(); rr(-13,-76,26,42,6);
  O(C.shirt, C.line, 2.4);
  // 西装外套（敞开，破边）
  let g = ctx.createLinearGradient(-17,-80,15,-36);
  g.addColorStop(0,C.suit); g.addColorStop(1,C.suitD);
  ctx.beginPath();
  ctx.moveTo(-17,-74);
  ctx.quadraticCurveTo(-18,-79,-12,-79);
  ctx.lineTo(-6,-79); ctx.lineTo(-9,-40);
  ctx.lineTo(-13,-43); ctx.lineTo(-10,-37); ctx.lineTo(-17,-39);
  ctx.closePath();
  O(g, C.line, 2.2);
  ctx.beginPath();
  ctx.moveTo(17,-74);
  ctx.quadraticCurveTo(18,-79,12,-79);
  ctx.lineTo(6,-79); ctx.lineTo(9,-40);
  ctx.lineTo(13,-43); ctx.lineTo(10,-37); ctx.lineTo(17,-39);
  ctx.closePath();
  O(g, C.line, 2.2);
  // 领带（飘动）
  const tieWave = Math.sin(at*3.1)*2;
  ctx.beginPath();
  ctx.moveTo(-1.5,-76); ctx.lineTo(2.5,-76);
  ctx.quadraticCurveTo(3+tieWave,-60, 1.5+tieWave,-48);
  ctx.lineTo(0+tieWave,-44);
  ctx.lineTo(-1.5+tieWave,-48);
  ctx.quadraticCurveTo(-2+tieWave,-60,-1.5,-76);
  ctx.closePath();
  O(C.tie, '#6e1c12', 1.8);
  ctx.beginPath(); ctx.moveTo(-3,-77); ctx.lineTo(4,-77); ctx.lineTo(0.5,-72); ctx.closePath();
  O(C.tie, '#6e1c12', 1.4);

  // 前手臂（平伸）
  ctx.beginPath(); ctx.moveTo(-11,-70); ctx.lineTo(-27,-66+armSway);
  ctx.strokeStyle = C.line; ctx.lineWidth = 10; ctx.stroke();
  ctx.strokeStyle = C.suit; ctx.lineWidth = 7; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-27,-66+armSway); ctx.lineTo(-44,-62+armSway);
  ctx.strokeStyle = C.line; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = C.skin; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(-47,-61+armSway,5,0,TAU);
  O(C.skin, C.line, 2);
  ctx.beginPath(); ctx.arc(-45,-65.5+armSway,2.2,0,TAU);
  ctx.fillStyle = C.skin; ctx.fill();

  // 撑杆
  if(z.type==='vault' && !z.poleLost){
    const px = z.state==='vault' ? -18 : -54;
    const py = z.state==='vault' ? -58 : 0;
    ctx.beginPath(); ctx.moveTo(-18,-74); ctx.quadraticCurveTo((px-18)/2-6,(py-74)/2, px, py);
    ctx.strokeStyle = '#5c564a'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#b8b2a2'; ctx.lineWidth = 3.6; ctx.stroke();
  }
  // 旗帜
  if(z.type==='flag'){
    ctx.beginPath(); ctx.moveTo(-30,-60+armSway); ctx.lineTo(-32,-132);
    ctx.strokeStyle = '#4a3c22'; ctx.lineWidth = 5.5; ctx.stroke();
    ctx.strokeStyle = '#8a744a'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-32,-132);
    ctx.quadraticCurveTo(-54, -128 + Math.sin(AT*4.2)*3.4, -76, -121 + Math.sin(AT*4.2+1)*3.6);
    ctx.lineTo(-73, -101 + Math.sin(AT*4.2)*2.4);
    ctx.quadraticCurveTo(-52, -108, -31, -104);
    ctx.closePath();
    O('#b02a20', '#5e120c', 2.2);
    ctx.beginPath(); ctx.arc(-53,-115+Math.sin(AT*4.2)*1.8,7,0,TAU);
    O('#a3b187', '#4a5238', 1.8);
    ctx.fillStyle = '#39412e';
    ctx.beginPath(); ctx.arc(-55.5,-116,1.5,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-50.5,-116,1.5,0,TAU); ctx.fill();
    ctx.strokeStyle = '#39412e'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(-53,-111.5,2,0.2,Math.PI-0.2); ctx.stroke();
  }

  // ---- 头 ----
  const hx = -7, hy = -96;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(swing*0.06 + (eat ? Math.sin(z.eatT*9)*0.07 : Math.sin(at*1.7)*0.03));
  ctx.fillStyle = C.skinD;
  ctx.fillRect(-4, 10, 9, 8);
  g = ctx.createRadialGradient(-6,-7,3, 0,0,18);
  g.addColorStop(0, slowed?'#a8cad8':'#bcc7a0'); g.addColorStop(1, C.skin);
  ctx.beginPath(); ctx.arc(0,0,16,0,TAU);
  O(g, C.line, 2.4);
  ctx.beginPath(); ctx.ellipse(13,-2,3.2,4.4,0.2,0,TAU);
  O(C.skinD, C.line, 1.6);
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-13,-8); ctx.lineTo(-4,-9.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-9.5); ctx.lineTo(7,-8.5); ctx.stroke();
  ctx.fillStyle = slowed ? '#3f5a68' : '#5c6247';
  ctx.beginPath(); ctx.ellipse(-8.5,-3.5,4.6,5.4,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(2.5,-3.5,4,4.9,0,0,TAU); ctx.fill();
  ctx.fillStyle = '#e8e4d4';
  ctx.beginPath(); ctx.arc(-9,-3,2.1,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(2,-2.6,1.7,0,TAU); ctx.fill();
  ctx.fillStyle = '#2c2c22';
  ctx.beginPath(); ctx.arc(-9.4,-2.7,0.9,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(1.7,-2.4,0.8,0,TAU); ctx.fill();
  ctx.fillStyle = C.line;
  ctx.beginPath(); ctx.arc(-4,3,1,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-1.5,3.2,1,0,TAU); ctx.fill();
  ctx.fillStyle = '#2e2018';
  ctx.beginPath(); ctx.ellipse(-6, 9, 8.5, mouth*0.62+1.6, -0.08, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-7, 10.5+mouth*0.5, 9.5, 5.6, -0.12, 0, TAU);
  O(C.skin, C.line, 2.2);
  ctx.fillStyle = '#ddd8c6';
  ctx.strokeStyle = '#8a8470'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.rect(-12, 5.6, 2.8, 3.2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(-8.2, 6.2, 2.8, 3); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,-15); ctx.quadraticCurveTo(-3,-19,-1,-21); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2,-15); ctx.quadraticCurveTo(3,-19,5,-20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8,-13); ctx.quadraticCurveTo(10,-16,12,-17); ctx.stroke();
  // ---- 头饰 ----
  if(z.type==='cone'){
    ctx.beginPath();
    ctx.moveTo(-16,-9);
    ctx.quadraticCurveTo(-2,-13, 13,-11);
    ctx.lineTo(4,-44);
    ctx.quadraticCurveTo(1,-46, -2,-44);
    ctx.closePath();
    g = ctx.createLinearGradient(-14,-40,12,-12);
    g.addColorStop(0,'#f09a3e'); g.addColorStop(1,'#c06a18');
    O(g, '#7a420c', 2.2);
    ctx.beginPath();
    ctx.moveTo(-11.5,-19); ctx.lineTo(9.5,-20.5); ctx.lineTo(8,-26); ctx.lineTo(-9.5,-24.5);
    ctx.closePath();
    O('#f2e6d4', '#7a420c', 1.4);
    ctx.beginPath(); ctx.ellipse(-1.5,-10,15,4.6,-0.07,0,TAU);
    O('#e89542', '#7a420c', 1.8);
    ctx.strokeStyle = 'rgba(90,50,10,0.45)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-8,-30); ctx.lineTo(-4,-33); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5,-15); ctx.lineTo(8,-17); ctx.stroke();
  } else if(z.type==='bucket'){
    g = ctx.createLinearGradient(-15,-38,13,-10);
    g.addColorStop(0,'#d4dade'); g.addColorStop(0.45,'#98a2a9'); g.addColorStop(1,'#667077');
    ctx.beginPath();
    ctx.moveTo(-16,-9); ctx.lineTo(14,-11); ctx.lineTo(10.5,-40); ctx.lineTo(-13,-38);
    ctx.closePath();
    O(g, '#3f474d', 2.2);
    ctx.beginPath(); ctx.ellipse(-1,-9.5,15.5,4.6,-0.06,0,TAU);
    O('#b8c1c7', '#3f474d', 1.8);
    ctx.strokeStyle = 'rgba(63,71,77,0.6)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-14.5,-17); ctx.lineTo(12.5,-18.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-13.8,-27); ctx.lineTo(11.6,-28.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(4,-22,3.4,0.6,2.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-9,-34); ctx.lineTo(-10.5,-15); ctx.stroke();
  } else if(z.type==='vault' && !z.poleLost){
    ctx.beginPath(); ctx.rect(-14,-14,27,5.5);
    O('#c03028', '#6e1810', 1.6);
    ctx.beginPath(); ctx.moveTo(13,-12); ctx.lineTo(19,-15); ctx.lineTo(17,-9); ctx.closePath();
    O('#c03028', '#6e1810', 1.4);
  }
  ctx.restore();

  // 报纸（举在身前，遮住半张脸）
  if(reading){
    const wob = Math.sin(at*2.6)*0.05 + (walk ? swing*0.03 : 0);
    ctx.save();
    ctx.translate(-34, -78);
    ctx.rotate(-0.22 + wob);
    // 对开页：左页略折
    ctx.beginPath(); ctx.moveTo(-24,-19); ctx.lineTo(0,-16); ctx.lineTo(0,18); ctx.lineTo(-24,21); ctx.closePath();
    O('#e6e0d0', '#6e6858', 2);
    ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(23,-19); ctx.lineTo(23,21); ctx.lineTo(0,18); ctx.closePath();
    O('#f4efe2', '#6e6858', 2);
    // 中缝
    ctx.strokeStyle = '#8d8676'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(0,18); ctx.stroke();
    // 报头色块
    ctx.fillStyle = '#5a5245';
    ctx.fillRect(3,-15, 17, 3.4);
    ctx.fillStyle = 'rgba(90,82,69,0.75)';
    // 正文线条
    for(let k=0;k<5;k++){
      const yy = -9 + k*5.4;
      ctx.fillRect(3.5, yy, 16 - (k===4?6:0), 1.8);
      ctx.fillRect(-21, yy+0.8, 16 - (k===3?5:0), 1.8);
    }
    // 图片框
    ctx.fillStyle = 'rgba(120,112,96,0.55)';
    ctx.fillRect(-21, 12, 8, 5);
    ctx.restore();
    // 握报的手
    ctx.fillStyle = C.skin; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-13,-60,5,0,TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-52,-70,4.6,0,TAU); ctx.fill(); ctx.stroke();
  }

  // 暴怒：发红的眼与头顶青筋
  if(angry){
    ctx.save();
    ctx.translate(-7, -96);
    ctx.fillStyle = 'rgba(200,40,30,0.35)';
    ctx.beginPath(); ctx.arc(0,0,16.5,0,TAU); ctx.fill();
    ctx.fillStyle = '#c03028';
    ctx.beginPath(); ctx.ellipse(-8.5,-3.5,3.6,4.2,0,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2.5,-3.5,3.2,3.9,0,0,TAU); ctx.fill();
    ctx.strokeStyle = '#6e1810'; ctx.lineWidth = 2.6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-14,-9); ctx.lineTo(-4,-5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7,-9.5); ctx.lineTo(-1,-5.5); ctx.stroke();
    // 青筋
    ctx.strokeStyle = '#8e2018'; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(4,-19); ctx.lineTo(4,-24); ctx.moveTo(1,-21.5); ctx.lineTo(7,-21.5);
    ctx.stroke();
    // 怒吼的血盆大口
    ctx.fillStyle = '#3a0e0a';
    ctx.beginPath(); ctx.ellipse(-5, 10, 9, 6.2, -0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ddd8c6';
    ctx.beginPath(); ctx.moveTo(-12,5.6); ctx.lineTo(-8.4,5.6); ctx.lineTo(-10.2,10.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5.5,5.8); ctx.lineTo(-1.8,5.8); ctx.lineTo(-3.6,10.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 怒气符号
    const ang = Math.sin(AT*9)*2;
    ctx.save();
    ctx.translate(14, -118 + ang*0.4);
    ctx.strokeStyle = '#e0382a'; ctx.lineWidth = 4.6; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-7,-7); ctx.lineTo(-2.4,-2.4); ctx.moveTo(0,-9); ctx.lineTo(0,-3);
    ctx.moveTo(7,-7); ctx.lineTo(2.4,-2.4); ctx.moveTo(-5,0); ctx.lineTo(5,0);
    ctx.stroke();
    ctx.restore();
    // 疾驰残影
    if(walk){
      ctx.strokeStyle = 'rgba(255,240,220,0.22)'; ctx.lineWidth = 3; ctx.lineCap='round';
      for(let k=0;k<3;k++){
        const yy = -30 - k*22;
        ctx.beginPath(); ctx.moveTo(30+k*6, yy); ctx.lineTo(52+k*10, yy); ctx.stroke();
      }
    }
  }

  // 减速冰霜
  if(slowed){
    ctx.fillStyle = 'rgba(170,225,255,0.65)';
    for(let k=0;k<4;k++){
      const a = AT*2 + k*TAU/4;
      ctx.beginPath();
      ctx.arc(Math.cos(a)*17, -62+Math.sin(a*1.3)*26, 1.9, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(140,200,240,0.4)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-14,-70); ctx.lineTo(-9,-74); ctx.moveTo(-11.5,-76); ctx.lineTo(-11.5,-68); ctx.stroke();
  }
  ctx.restore();
}

function drawZombieHeadIcon(x, y, s, acc){
  ctx.save();
  ctx.translate(x,y); ctx.scale(s,s);
  let g = ctx.createRadialGradient(-5,-6,2, 0,0,16);
  g.addColorStop(0,'#bcc7a0'); g.addColorStop(1,'#a3b187');
  ctx.beginPath(); ctx.arc(0,0,14,0,TAU);
  O(g, '#39412e', 2.2);
  ctx.fillStyle = '#5c6247';
  ctx.beginPath(); ctx.ellipse(-5,-3,3.8,4.6,0,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4.5,-3,3.4,4.2,0,0,TAU); ctx.fill();
  ctx.fillStyle = '#e8e4d4';
  ctx.beginPath(); ctx.arc(-5.5,-2.6,1.5,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(4,-2.6,1.4,0,TAU); ctx.fill();
  ctx.fillStyle = '#2e2018';
  ctx.beginPath(); ctx.ellipse(-1,7.5,6,2.6,0,0,TAU); ctx.fill();
  ctx.fillStyle = '#ddd8c6';
  ctx.fillRect(-5,4.6,2.2,2.6); ctx.fillRect(-1.4,4.9,2.2,2.4);
  if(acc==='cone'){
    ctx.beginPath(); ctx.moveTo(-12,-8); ctx.lineTo(11,-9); ctx.lineTo(2,-33); ctx.closePath();
    g = ctx.createLinearGradient(-10,-30,10,-10);
    g.addColorStop(0,'#f09a3e'); g.addColorStop(1,'#c06a18');
    O(g, '#7a420c', 2);
  } else if(acc==='bucket'){
    ctx.beginPath(); ctx.moveTo(-13,-7); ctx.lineTo(12,-8); ctx.lineTo(9,-30); ctx.lineTo(-10,-28); ctx.closePath();
    g = ctx.createLinearGradient(-12,-28,11,-8);
    g.addColorStop(0,'#d4dade'); g.addColorStop(1,'#77818a');
    O(g, '#3f474d', 2);
  } else if(acc==='flag'){
    ctx.strokeStyle = '#4a3c22'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(10,-5); ctx.lineTo(16,-34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16,-34); ctx.lineTo(33,-30); ctx.lineTo(16,-24); ctx.closePath();
    O('#b02a20', '#5e120c', 1.6);
  } else if(acc==='vault'){
    ctx.strokeStyle = '#5c564a'; ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(-16,11); ctx.lineTo(16,-24); ctx.stroke();
    ctx.strokeStyle = '#b8b2a2'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-16,11); ctx.lineTo(16,-24); ctx.stroke();
  } else if(acc==='newspaper'){
    ctx.save();
    ctx.translate(-7, 6); ctx.rotate(-0.2);
    ctx.beginPath(); rr(-11,-9,22,17,1.5);
    g = ctx.createLinearGradient(-11,-9,11,8);
    g.addColorStop(0,'#f4efe2'); g.addColorStop(1,'#d8d2be');
    O(g, '#6e6858', 1.8);
    ctx.fillStyle = '#5a5245'; ctx.fillRect(-9,-7,18,2.4);
    ctx.fillStyle = 'rgba(90,82,69,0.7)';
    for(let k=0;k<3;k++) ctx.fillRect(-9,-2.4+k*3, 17, 1.2);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------- 绘制：其它实体 ----------------
function drawSun(s){
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
  const pulse = 1 + Math.sin(AT*4 + s.t)*0.05;
  ctx.scale(pulse, pulse);
  let g = ctx.createRadialGradient(0,0,4, 0,0,40);
  g.addColorStop(0,'rgba(255,244,160,0.95)');
  g.addColorStop(0.45,'rgba(255,214,90,0.4)');
  g.addColorStop(1,'rgba(255,190,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0,0,40,0,TAU); ctx.fill();
  ctx.save();
  ctx.rotate(AT*0.7);
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

function drawPea(p){
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

function drawMower(m){
  if(m.state==='gone') return;
  ctx.save();
  ctx.translate(m.x, LY + m.row*CH + CH - 14);
  const run = m.state==='run';
  if(run) ctx.translate(0, Math.sin(AT*42)*1.4);
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
    ctx.fillStyle = 'rgba(120,120,120,'+(0.3+Math.sin(AT*30)*0.15)+')';
    ctx.beginPath(); ctx.arc(-11,-16-Math.abs(Math.sin(AT*18))*5,3.4,0,TAU); ctx.fill();
  }
  const wa = run ? AT*24 : 0;
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

// ---------------- 绘制：UI ----------------
const BANK_Y = 8, BANK_H = 88;
const CARD_X0 = 148, CARD_W = 60, CARD_H = 84, CARD_GAP = 6;
const SUN_BOX = { x:14, y:BANK_Y, w:120, h:BANK_H };

function drawText(text, x, y, size, fill, stroke, sw, align, weight){
  ctx.font = (weight||'900') + ' ' + size + 'px "PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  if(stroke){ ctx.lineWidth = sw||4; ctx.strokeStyle = stroke; ctx.lineJoin='round'; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawSeedBank(){
  let g = ctx.createLinearGradient(0,BANK_Y,0,BANK_Y+BANK_H);
  g.addColorStop(0,'#96652f'); g.addColorStop(0.5,'#7d5124'); g.addColorStop(1,'#5f3a16');
  ctx.beginPath(); rr(8, BANK_Y, 744, BANK_H, 12);
  O(g, '#3a220c', 3);
  ctx.save();
  rr(8, BANK_Y, 744, BANK_H, 12); ctx.clip();
  ctx.strokeStyle = 'rgba(58,34,12,0.25)'; ctx.lineWidth = 1.6;
  for(let k=0;k<5;k++){
    const y = BANK_Y + 12 + k*17;
    ctx.beginPath(); ctx.moveTo(10, y);
    ctx.bezierCurveTo(200, y+4, 500, y-4, 750, y+3);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,230,180,0.14)';
  ctx.fillRect(10, BANK_Y+2, 740, 6);
  ctx.restore();
  for(const sx of [22, 738]){
    ctx.fillStyle = '#3a220c';
    ctx.beginPath(); ctx.arc(sx, BANK_Y+13, 3.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, BANK_Y+BANK_H-13, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    ctx.beginPath(); ctx.arc(sx-1, BANK_Y+12, 1.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx-1, BANK_Y+BANK_H-14, 1.2, 0, TAU); ctx.fill();
  }
  const flash = G.sunFlash > 0 && Math.sin(AT*30) > 0;
  g = ctx.createLinearGradient(0,BANK_Y,0,BANK_Y+BANK_H);
  g.addColorStop(0, flash ? '#fff8d0' : '#f8ecbe'); g.addColorStop(1, flash ? '#ffe98a' : '#e2c88a');
  ctx.beginPath(); rr(SUN_BOX.x, SUN_BOX.y, SUN_BOX.w, SUN_BOX.h, 10);
  O(g, '#8a6b3a', 2.6);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(SUN_BOX.x+4, SUN_BOX.y+3, SUN_BOX.w-8, 8);
  drawSunIcon(SUN_BOX.x+30, SUN_BOX.y+32, 0.85);
  drawText(String(G.sun), SUN_BOX.x+78, SUN_BOX.y+33, 26, '#3a2c10', 'rgba(255,250,230,0.7)', 3, 'center');
  drawText('阳光', SUN_BOX.x+SUN_BOX.w/2, SUN_BOX.y+66, 13, '#7a5c28', null, 0, 'center', '600');

  for(let i=0;i<G.slots.length;i++){
    const s = G.slots[i];
    const def = PLANTS[s.type];
    const x = CARD_X0 + i*(CARD_W+CARD_GAP);
    const y = BANK_Y + 2;
    const afford = G.sun >= def.cost && s.cool <= 0;
    const selected = G.sel === i;
    const hover = G.mouse.x>=x && G.mouse.x<=x+CARD_W && G.mouse.y>=y && G.mouse.y<=y+CARD_H;
    G.hotspots.push({ x, y:y-4, w:CARD_W, h:CARD_H+4, id:'card'+i, cb:(()=>{ const ii=i; return ()=>clickCard(ii); })() });
    ctx.save();
    if(selected) ctx.translate(0,-4);
    ctx.fillStyle = 'rgba(30,18,6,0.35)';
    ctx.beginPath(); rr(x+2, y+3, CARD_W, CARD_H, 8); ctx.fill();
    g = ctx.createRadialGradient(x+CARD_W/2, y+CARD_H*0.42, 6, x+CARD_W/2, y+CARD_H/2, CARD_H*0.75);
    g.addColorStop(0,'#f2e4bc'); g.addColorStop(1,'#bfa06a');
    ctx.beginPath(); rr(x, y, CARD_W, CARD_H, 8);
    O(g, selected ? '#ffe86e' : '#5f451f', selected ? 3.4 : 2.2);
    if(selected){
      ctx.strokeStyle = 'rgba(255,220,80,0.55)'; ctx.lineWidth = 7;
      rr(x-2, y-2, CARD_W+4, CARD_H+4, 10); ctx.stroke();
    } else if(hover && afford){
      ctx.strokeStyle = '#fff0b8'; ctx.lineWidth = 2.4;
      rr(x+1, y+1, CARD_W-2, CARD_H-2, 7); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x+3, y+2.5, CARD_W-6, 5);
    ctx.save();
    if(!afford) ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(60,40,15,0.25)';
    ctx.beginPath(); ctx.ellipse(x+CARD_W/2, y+CARD_H-24, 16, 4, 0, 0, TAU); ctx.fill();
    drawPlantIcon(s.type, x+CARD_W/2, y+CARD_H-22, 0.5);
    ctx.restore();
    drawText(def.name, x+CARD_W/2, y+12, 11.5, '#42300f', 'rgba(255,246,220,0.5)', 2, 'center', '700');
    drawSunIcon(x+18, y+CARD_H-11, 0.34);
    drawText(String(def.cost), x+40, y+CARD_H-11, 13, G.sun>=def.cost ? '#3a2c10' : '#a02818', 'rgba(255,246,220,0.5)', 2, 'center', '800');
    if(s.cool > 0){
      const frac = s.cool / def.cool;
      ctx.fillStyle = 'rgba(15,15,25,0.6)';
      ctx.save();
      rr(x, y, CARD_W, CARD_H, 8); ctx.clip();
      ctx.fillRect(x, y, CARD_W, CARD_H*frac);
      ctx.restore();
    }
    ctx.restore();
  }

  const sx = CARD_X0 + 8*(CARD_W+CARD_GAP) + 8, sy = BANK_Y+8;
  const active = G.shovel;
  const hoverS = G.mouse.x>=sx && G.mouse.x<=sx+64 && G.mouse.y>=sy && G.mouse.y<=sy+72;
  G.hotspots.push({ x:sx, y:sy, w:64, h:72, id:'shovel', cb:()=>{ G.shovel=!G.shovel; G.sel=-1; SFX.click(); } });
  let g2 = ctx.createLinearGradient(0,sy,0,sy+72);
  g2.addColorStop(0, active ? '#efd28a' : '#b8946a'); g2.addColorStop(1, active ? '#c8a24e' : '#8a6b42');
  ctx.beginPath(); rr(sx, sy, 64, 72, 8);
  O(g2, active ? '#ffe86e' : '#5f451f', active?3:2.2);
  drawShovelIcon(sx+32, sy+34, hoverS||active ? 1.08 : 1);
  drawText('铲子', sx+32, sy+62, 11, '#42300f', null, 0, 'center', '700');
}

function clickCard(i){
  if(G.state!=='play' || G.paused) return;
  const s = G.slots[i];
  const def = PLANTS[s.type];
  if(G.sel === i){ G.sel = -1; SFX.click(); return; }
  if(s.cool > 0){ SFX.error(); return; }
  if(G.sun < def.cost){ SFX.error(); G.sunFlash = 0.5; return; }
  G.sel = i; G.shovel = false;
  SFX.select();
}

function drawSunIcon(x,y,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.save(); ctx.rotate(AT*0.7);
  ctx.fillStyle = '#ffc82e';
  for(let k=0;k<10;k++){
    ctx.rotate(TAU/10);
    ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(3.6,-21); ctx.lineTo(-3.6,-21); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  let g = ctx.createRadialGradient(-3,-3,2, 0,0,14);
  g.addColorStop(0,'#fff2b0'); g.addColorStop(1,'#ffa82a');
  ctx.beginPath(); ctx.arc(0,0,13.5,0,TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(210,130,20,0.6)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}

function drawShovelIcon(x,y,s){
  ctx.save(); ctx.translate(x,y); ctx.rotate(-0.7); ctx.scale(s,s);
  ctx.beginPath(); ctx.moveTo(0,-27); ctx.lineTo(0,6);
  ctx.strokeStyle = '#5f3c18'; ctx.lineWidth = 8; ctx.lineCap='round'; ctx.stroke();
  ctx.strokeStyle = '#a8763c'; ctx.lineWidth = 5; ctx.stroke();
  let g = ctx.createLinearGradient(-9,4,9,22);
  g.addColorStop(0,'#d8dee4'); g.addColorStop(1,'#8a929a');
  ctx.beginPath();
  ctx.moveTo(-10,4); ctx.lineTo(10,4); ctx.lineTo(8,20);
  ctx.quadraticCurveTo(0,28,-8,20);
  ctx.closePath();
  O(g, '#4a525a', 2);
  ctx.beginPath(); ctx.arc(0,-28,5.6,0,TAU);
  O('#a8763c', '#5f3c18', 2.4);
  ctx.restore();
}

function drawProgressBar(){
  const x0 = 600, x1 = 985, y = 611, h = 20;
  let g = ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,'#6b4520'); g.addColorStop(1,'#3c220c');
  ctx.beginPath(); rr(x0, y, x1-x0, h, 9);
  O(g, '#241204', 2.4);
  const inner = { x:x0+4, w:(x1-x0)-8 };
  const p = G.total ? clamp(G.killed / G.total, 0, 1) : 0;
  const flagAt = (frac)=>{
    const fx = inner.x + inner.w*(1-frac);
    ctx.beginPath(); ctx.moveTo(fx, y+3); ctx.lineTo(fx, y-10);
    ctx.strokeStyle = '#4a3c22'; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = '#8a744a'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, y-10); ctx.lineTo(fx+13, y-6); ctx.lineTo(fx, y-2); ctx.closePath();
    O('#c03028', '#6e1810', 1.4);
  };
  flagAt(0.5); flagAt(1.0);
  ctx.fillStyle = 'rgba(20,12,4,0.6)';
  ctx.beginPath(); rr(inner.x, y+4, inner.w, h-8, 6); ctx.fill();
  g = ctx.createLinearGradient(0,y+4,0,y+h-4);
  g.addColorStop(0,'#c8f08a'); g.addColorStop(1,'#6fa83e');
  ctx.fillStyle = g;
  ctx.save();
  rr(inner.x, y+4, inner.w, h-8, 6); ctx.clip();
  ctx.fillRect(inner.x + inner.w*(1-p), y+4, inner.w*p, h-8);
  ctx.restore();
  const hx = inner.x + inner.w*(1-p);
  drawZombieHeadIcon(hx, y+h/2, 0.64, null);
  drawText('关卡进度', x0-52, y+h/2+1, 12, '#f0e2c0', '#3a2410', 3, 'center', '700');
}

function drawTopRightButtons(){
  const btns = [
    { id:'pause', label: G.paused ? '继续' : '暂停', cb:()=>{ G.paused = !G.paused; SFX.click(); } },
    { id:'mute', label: SFX.musicOn ? '音乐开' : '音乐关', cb:()=>{ SFX.musicOn = !SFX.musicOn; SFX.click(); } },
  ];
  let x = W - 12;
  for(const b of btns){
    const w = 74;
    x -= w + 8;
    const y = 12, h = 30;
    const hover = G.mouse.x>=x && G.mouse.x<=x+w && G.mouse.y>=y && G.mouse.y<=y+h;
    G.hotspots.push({ x, y, w, h, id:b.id, cb:b.cb });
    let g = ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0, hover ? '#9a6b38' : '#7a4c22'); g.addColorStop(1, hover ? '#7a4c22' : '#5f3a18');
    ctx.beginPath(); rr(x, y, w, h, 8);
    O(g, '#42280f', 2);
    ctx.fillStyle = 'rgba(255,230,180,0.18)';
    ctx.fillRect(x+3, y+2, w-6, 5);
    drawText(b.label, x+w/2, y+h/2+1, 13.5, '#f5e6b8', null, 0, 'center', '700');
  }
}

function drawWaveText(){
  if(!G.waveText) return;
  const t = G.waveText.t;
  let alpha = 1, scale = 1;
  if(t < 0.35) scale = 0.4 + easeOut(t/0.35)*0.7;
  if(t > 2.1) alpha = clamp((2.6-t)/0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W/2, H/2 - 40);
  ctx.scale(scale, scale);
  ctx.rotate(Math.sin(AT*14)*0.012);
  drawText(G.waveText.text, 0, 0, 46, '#d02818', '#3a0a04', 9);
  ctx.restore();
}

function drawIntro(){
  if(G.state !== 'play' || G.t >= 0) return;
  const t = G.t;
  let txt = null;
  if(t >= -3.2 && t < -1.4) txt = '准备……';
  else if(t >= -1.4) txt = '开始！';
  if(!txt) return;
  const inPhase = t >= -1.4;
  const k = inPhase ? clamp((t+1.4)/0.3, 0, 1) : clamp((t+3.2)/0.3, 0, 1);
  const scale = 0.5 + easeOut(k)*0.6 + (inPhase ? Math.sin(AT*10)*0.02 : 0);
  ctx.save();
  ctx.translate(W/2, H/2 - 30);
  ctx.scale(scale, scale);
  drawText(txt, 0, 0, 64, inPhase ? '#ffe86e' : '#f5f0d8', '#3a2c10', 10);
  ctx.restore();
}

// ---------------- 绘制：场景 ----------------
function renderPlay(){
  drawBackground();

  for(const d of G.decals){
    ctx.save();
    ctx.globalAlpha = clamp(d.ttl/d.max, 0, 1) * 0.55;
    let g = ctx.createRadialGradient(d.x, d.fy, 4, d.x, d.fy, d.r);
    g.addColorStop(0,'rgba(40,28,12,0.9)'); g.addColorStop(1,'rgba(40,28,12,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(d.x, d.fy, d.r, d.r*0.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  for(const m of G.mowers) drawMower(m);

  // 悬停高亮 + 幽灵植物
  const hc = G.hoverCell;
  if(hc && G.state==='play' && !G.paused){
    const x = LX + hc.col*CW, y = LY + hc.row*CH;
    if(G.shovel){
      ctx.fillStyle = 'rgba(220,90,45,0.3)';
      ctx.fillRect(x, y, CW, CH);
      ctx.strokeStyle = 'rgba(220,90,45,0.85)'; ctx.lineWidth = 2.5;
      ctx.strokeRect(x+2, y+2, CW-4, CH-4);
    } else if(G.sel >= 0){
      const selType = G.slots[G.sel].type;
      const target = G.grid[hc.row][hc.col];
      // 咖啡豆反过来：只有「睡着的蘑菇」是合法目标，空格子反而不行
      const isCoffee = selType === 'coffee';
      const ok = isCoffee ? !!(target && target.asleep) : !target;
      ctx.fillStyle = ok ? 'rgba(255,255,220,0.32)' : 'rgba(200,40,30,0.32)';
      ctx.fillRect(x, y, CW, CH);
      ctx.strokeStyle = ok ? 'rgba(255,250,200,0.9)' : 'rgba(230,60,40,0.9)';
      ctx.lineWidth = 2.5;
      const bl = 12, pu = Math.sin(AT*6)*1.5;
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
          asleep: !!PLANTS[selType].mushroom && !isNight() };
        drawPlantEntity(ghost);
        ctx.restore();
      }
    }
  }

  for(let r=0;r<ROWS;r++){
    for(const p of G.plants) if(p.row===r) drawPlantEntity(p);
    const zs = G.zombies.filter(z=>z.row===r).sort((a,b)=>a.x-b.x);
    for(const z of zs) drawZombieEntity(z);
  }

  for(const p of G.peas) drawPea(p);

  for(const p of G.parts){
    ctx.save();
    ctx.globalAlpha = clamp(p.life/p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    ctx.restore();
  }

  for(const s of G.suns) drawSun(s);

  drawSeedBank();
  drawProgressBar();
  drawTopRightButtons();
  drawText(LEVELS[G.level].name, W-16, 62, 13, '#f0e2c0', '#3a2410', 3, 'right', '700');
  drawWaveText();
  drawIntro();

  // 夜战提示条
  if(G.nightHint > 0 && isNight()){
    const a = clamp(G.nightHint/1.4, 0, 1);
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

  if(G.shovel && G.mouse.x >= 0){
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawShovelIcon(G.mouse.x, G.mouse.y - 10, 1.1);
    ctx.restore();
  }

  // 爆炸白闪
  if(G.flash > 0){
    ctx.fillStyle = 'rgba(255,250,230,' + clamp(G.flash,0,0.35) + ')';
    ctx.fillRect(-20,-20,W+40,H+40);
  }

  if(G.paused){
    ctx.fillStyle = 'rgba(10,16,10,0.55)';
    ctx.fillRect(0,0,W,H);
    drawText('已暂停', W/2, H/2-20, 54, '#f5e6b8', '#3a2410', 9);
    drawText('点击「继续」或按 P 键继续游戏', W/2, H/2+36, 18, '#e0d2a8', '#3a2410', 4, 'center', '600');
  }
}

function drawButton(x, y, w, h, label, id, cb, opts){
  opts = opts || {};
  const hover = G.mouse.x>=x && G.mouse.x<=x+w && G.mouse.y>=y && G.mouse.y<=y+h;
  G.hotspots.push({ x, y, w, h, id, cb });
  const disabled = opts.disabled;
  let g = ctx.createLinearGradient(0,y,0,y+h);
  if(disabled){
    g.addColorStop(0,'#6b6b62'); g.addColorStop(1,'#4c4c44');
  } else if(opts.red){
    g.addColorStop(0, hover ? '#d8554a' : '#c04438'); g.addColorStop(1, hover ? '#a83428' : '#8a281e');
  } else {
    g.addColorStop(0, hover ? '#96c862' : '#7aa848'); g.addColorStop(1, hover ? '#649838' : '#4e7a2a');
  }
  ctx.save();
  // 按钮投影
  ctx.fillStyle = 'rgba(15,25,8,0.4)';
  ctx.beginPath(); rr(x+3, y+4, w, h, 11); ctx.fill();
  ctx.beginPath(); rr(x, y, w, h, 10);
  O(g, disabled ? '#3a3a34' : '#2e4a14', 3);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x+5, y+3, w-10, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x+5, y+h-7, w-10, 4);
  if(hover && !disabled){
    ctx.strokeStyle = 'rgba(255,240,160,0.75)'; ctx.lineWidth = 2;
    rr(x+2, y+2, w-4, h-4, 8); ctx.stroke();
  }
  ctx.restore();
  drawText(label, x+w/2, y+h/2+1, opts.size||20, disabled ? '#9a9a90' : '#fffbe8', '#2e3a10', 4, 'center', '800');
  return hover;
}

function drawMenuScene(){
  // 天空
  let g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#6ec0ea'); g.addColorStop(0.55,'#a9dcf2'); g.addColorStop(0.75,'#c8e8a0'); g.addColorStop(1,'#8fc94e');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  // 太阳光晕
  g = ctx.createRadialGradient(880,70,10, 880,70,150);
  g.addColorStop(0,'rgba(255,244,180,0.9)'); g.addColorStop(1,'rgba(255,244,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(880,70,150,0,TAU); ctx.fill();
  drawSunIcon(880, 70, 1.9);
  // 云
  const cloud = (x,y,s)=>{
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(x,y,18*s,0,TAU); ctx.arc(x+24*s,y-9*s,23*s,0,TAU); ctx.arc(x+50*s,y,17*s,0,TAU);
    ctx.arc(x+26*s,y+6*s,20*s,0,TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,215,235,0.5)';
    ctx.beginPath(); ctx.ellipse(x+26*s, y+12*s, 34*s, 7*s, 0, 0, TAU); ctx.fill();
  };
  cloud(((AT*9)%(W+260))-130, 88, 1.1);
  cloud(((AT*6+500)%(W+260))-130, 150, 0.85);
  cloud(((AT*7.5+900)%(W+260))-130, 58, 1.35);
  // 远山
  ctx.fillStyle = '#7fb85a';
  ctx.beginPath();
  ctx.moveTo(0,470);
  ctx.quadraticCurveTo(180, 400, 380, 462);
  ctx.quadraticCurveTo(560, 415, 760, 465);
  ctx.quadraticCurveTo(900, 430, 1024, 468);
  ctx.lineTo(W,520); ctx.lineTo(0,520);
  ctx.closePath(); ctx.fill();
  // 栅栏
  ctx.fillStyle = '#f2ead4';
  ctx.strokeStyle = '#b8a880'; ctx.lineWidth = 1.5;
  for(let x=0;x<W;x+=30){
    rr(x+6, 452, 16, 34, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+6,452); ctx.lineTo(x+14,443); ctx.lineTo(x+22,452); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#e8dfc6';
  ctx.fillRect(0, 462, W, 6); ctx.fillRect(0, 474, W, 6);
  // 灌木
  ctx.fillStyle = '#4d8a3a';
  for(let x=-10;x<W+20;x+=34){
    ctx.beginPath(); ctx.arc(x, 490, 22+((x*7)%13), Math.PI, 0); ctx.fill();
  }
  ctx.fillStyle = '#5f9e46';
  for(let x=4;x<W+20;x+=38){
    ctx.beginPath(); ctx.arc(x, 492, 16+((x*5)%9), Math.PI, 0); ctx.fill();
  }
  // 草坪
  ctx.fillStyle = '#7dbb43';
  ctx.fillRect(0, H-150, W, 150);
  for(let c=0;c<13;c++){
    g = ctx.createLinearGradient(0,H-150,0,H);
    if(c%2){ g.addColorStop(0,'#98cf54'); g.addColorStop(1,'#84bd44'); }
    else { g.addColorStop(0,'#aede66'); g.addColorStop(1,'#96cd52'); }
    ctx.fillStyle = g;
    ctx.fillRect(c*80, H-150, 80, 150);
  }
  // 角色
  ctx.save(); ctx.translate(110, H-36); ctx.scale(1.55,1.55); drawSunflower(AT, 0); ctx.restore();
  ctx.save(); ctx.translate(225, H-28); ctx.scale(1.35,1.35); drawShooter(AT, 2, 'pea', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(315, H-24); ctx.scale(1.15,1.15); drawWallnut(1, AT, 4); ctx.restore();
  ctx.save(); ctx.translate(465, H-14); ctx.scale(1.12,1.12); drawQiuqiu(AT, 5, 0); ctx.restore();
  ctx.save(); ctx.translate(W-140, H-26); ctx.scale(1.55,1.55);
  drawZombieEntity({ type:'normal', row:0, x:0, vy:0, state:'walk', animT:AT, eatT:0, slowT:0, deathT:0, dustT:0 }, 0);
  ctx.restore();
  ctx.save(); ctx.translate(W-262, H-18); ctx.scale(1.3,1.3);
  drawZombieEntity({ type:'cone', row:0, x:0, vy:0, state:'walk', animT:AT+2, eatT:0, slowT:0, deathT:0, dustT:0 }, 0);
  ctx.restore();
  ctx.save(); ctx.translate(W-372, H-14); ctx.scale(1.12,1.12);
  drawZombieEntity({ type:'bucket', row:0, x:0, vy:0, state:'walk', animT:AT+4, eatT:0, slowT:0, deathT:0, dustT:0 }, 0);
  ctx.restore();
  ctx.save(); ctx.translate(W-470, H-16); ctx.scale(1.2,1.2);
  drawZombieEntity({ type:'newspaper', row:0, x:0, vy:0, state:'walk', animT:AT+1.2, eatT:0, slowT:0, deathT:0, dustT:0, paper:400, angry:false }, 0);
  ctx.restore();
}

function renderMenu(){
  drawMenuScene();

  // 标题（带投影与光泽）
  const title = '球球的植物大战僵尸';
  const tScale = title.length > 6 ? 64/86 : 1;   // 长标题自适应缩小
  const tGap = 86 * tScale;
  const tSize = Math.round(86 * tScale);
  ctx.save();
  ctx.translate(W/2, 128);
  // 投影
  for(let i=0;i<title.length;i++){
    const cx = (i - (title.length-1)/2) * tGap;
    const dy = Math.sin(AT*2 + i*0.9)*4;
    ctx.font = '900 ' + tSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(30,50,15,0.35)';
    ctx.fillText(title[i], cx+5, dy+8);
  }
  for(let i=0;i<title.length;i++){
    const cx = (i - (title.length-1)/2) * tGap;
    const rot = Math.sin(AT*1.5 + i)*0.04;
    const dy = Math.sin(AT*2 + i*0.9)*4;
    ctx.save();
    ctx.translate(cx, dy);
    ctx.rotate(rot);
    let tg = ctx.createLinearGradient(0,-48*tScale,0,38*tScale);
    tg.addColorStop(0,'#d8f8a0'); tg.addColorStop(0.45,'#8fc050'); tg.addColorStop(0.55,'#6ba234'); tg.addColorStop(1,'#4e7a22');
    ctx.font = '900 ' + tSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 13*tScale; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2c4210';
    ctx.strokeText(title[i], 0, 0);
    ctx.fillStyle = tg;
    ctx.fillText(title[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
  // 丝带副标题
  const sub = '网 页 版 · 离 线 可 玩';
  const sw2 = sub.length * 21 + 56;
  ctx.beginPath();
  ctx.moveTo(W/2-sw2/2-14, 188); ctx.lineTo(W/2+sw2/2+14, 188);
  ctx.lineTo(W/2+sw2/2, 205); ctx.lineTo(W/2+sw2/2+14, 222);
  ctx.lineTo(W/2-sw2/2-14, 222); ctx.lineTo(W/2-sw2/2, 205);
  ctx.closePath();
  O('#c8542e', '#7a2c10', 2.5);
  drawText(sub, W/2, 206, 21, '#fff4d8', '#6e2408', 3.5, 'center', '800');

  // 关卡卡片
  const cardW = 214, cardH = 150, gap = 22;
  const nLv = LEVELS.length;
  const x0 = W/2 - (nLv*cardW + (nLv-1)*gap)/2;
  for(let i=0;i<nLv;i++){
    const lv = LEVELS[i];
    const locked = !G.unlockAll && i+1 > G.unlocked;
    const x = x0 + i*(cardW+gap), y = 258;
    const hover = !locked && G.mouse.x>=x && G.mouse.x<=x+cardW && G.mouse.y>=y && G.mouse.y<=y+cardH;
    G.hotspots.push({ x, y, w:cardW, h:cardH, id:'lv'+i, cb: locked ? ()=>{} : (()=>{ const ii=i; return ()=>startLevel(ii); })() });
    ctx.save();
    if(hover) ctx.translate(0,-4);
    ctx.fillStyle = 'rgba(20,35,10,0.35)';
    ctx.beginPath(); rr(x+3, y+5, cardW, cardH, 12); ctx.fill();
    let bg = ctx.createLinearGradient(0,y,0,y+cardH);
    if(locked){ bg.addColorStop(0,'#5a5a54'); bg.addColorStop(1,'#3c3c38'); }
    else { bg.addColorStop(0, hover ? '#f6e8c4' : '#ecd9ae'); bg.addColorStop(1, hover ? '#d8c088' : '#c8b078'); }
    ctx.beginPath(); rr(x, y, cardW, cardH, 12);
    O(bg, locked ? '#2c2c28' : '#6b4c20', 3);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x+6, y+4, cardW-12, 7);
    drawText(lv.name, x+cardW/2, y+28, 18, locked ? '#8a8a80' : '#42280f', locked?null:'rgba(255,246,220,0.6)', 2.5, 'center', '800');
    if(lv.night && !locked){
      // 夜间关标记：左上角小月亮
      const mx = x+15, my = y+22;
      const g = ctx.createRadialGradient(mx, my, 1, mx, my, 12);
      g.addColorStop(0,'rgba(255,246,200,0.6)'); g.addColorStop(1,'rgba(255,246,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 12, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx, my, 6.6, 0, TAU);
      O('#f6eec6', '#b8a860', 1.4);
      ctx.fillStyle = 'rgba(184,168,96,0.5)';
      ctx.beginPath(); ctx.arc(mx-2.2, my-1.8, 1.5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx+2.4, my+2.2, 1.1, 0, TAU); ctx.fill();
    }
    if(locked){
      ctx.fillStyle = '#2c2c28';
      ctx.beginPath(); rr(x+cardW/2-15, y+72, 30, 26, 5); ctx.fill();
      ctx.strokeStyle = '#2c2c28'; ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.arc(x+cardW/2, y+72, 11, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#6b6b62';
      ctx.beginPath(); ctx.arc(x+cardW/2, y+83, 3, 0, TAU); ctx.fill();
      drawText('通关上一关解锁', x+cardW/2, y+124, 13, '#9a9a90', null, 0, 'center', '600');
    } else {
      const zs = lv.types.map(t=>t[0]).slice(0,5);
      const zx0 = x+cardW/2 - (zs.length-1)*21;
      for(let k=0;k<zs.length;k++){
        const acc = zs[k]==='normal' ? null : zs[k];
        drawZombieHeadIcon(zx0+k*42, y+80, 0.86, acc);
      }
      drawText('僵尸 × ' + lv.count + (lv.night ? ' · 夜间' : ''), x+cardW/2, y+126, 14, '#6b4c20', null, 0, 'center', '700');
    }
    ctx.restore();
  }

  drawButton(W/2-290, 462, 180, 52, '操作说明', 'help', ()=>{ G.state='help'; SFX.click(); }, {});
  drawButton(W/2-90, 462, 180, 52, SFX.musicOn ? '音乐：开' : '音乐：关', 'music', ()=>{ SFX.ensure(); SFX.musicOn = !SFX.musicOn; SFX.click(); }, {});
  drawButton(W/2+110, 462, 180, 52, G.unlockAll ? '全部关卡：开' : '全部关卡：关', 'unlockall', ()=>toggleUnlockAll(), { size: 18 });
  drawText('同人复刻 · 图形与音乐均为程序生成 · 仅供个人学习娱乐', W/2, H-20, 12.5, 'rgba(30,50,18,0.75)', null, 0, 'center', '600');
}

function renderHelp(){
  drawMenuScene();
  ctx.fillStyle = 'rgba(10,16,10,0.6)';
  ctx.fillRect(0,0,W,H);
  const pw = 660, ph = 520, px = W/2-pw/2, py = H/2-ph/2-10;
  let g = ctx.createLinearGradient(0,py,0,py+ph);
  g.addColorStop(0,'#f0e2bc'); g.addColorStop(1,'#d8c090');
  ctx.fillStyle = 'rgba(15,25,8,0.45)';
  ctx.beginPath(); rr(px+5, py+7, pw, ph, 14); ctx.fill();
  ctx.beginPath(); rr(px, py, pw, ph, 14);
  O(g, '#6b4c20', 4);
  ctx.strokeStyle = 'rgba(107,76,32,0.25)'; ctx.lineWidth = 1.5;
  for(let k=1;k<6;k++){
    ctx.beginPath(); ctx.moveTo(px+14, py+k*66); ctx.lineTo(px+pw-14, py+k*66); ctx.stroke();
  }
  drawText('操 作 说 明', W/2, py+44, 30, '#42280f', 'rgba(255,246,220,0.7)', 4, 'center', '900');
  const lines = [
    '· 支持鼠标和触屏（平板/手机）操作',
    '· 点击天上掉落的阳光或向日葵产出的阳光，收集阳光资源',
    '· 点击上方卡片选择植物，再点击草坪格子种下（再点一次卡片取消选择）',
    '· 数字键 1-8 可快速选择对应卡片',
    '· 铲子可以移除已种下的植物（点击铲子后再点植物）',
    '· 豌豆射手家族会自动攻击本行前方的僵尸',
    '· 球球是核心输出：加特林扫射，还有概率发射范围导弹',
    '· 火炬树桩能让穿过的豌豆变成双倍伤害的火豌豆',
    '· 樱桃炸弹 / 土豆雷威力巨大，但土豆雷需要时间成长',
    '· 小喷菇免费但射程只有两格；阳光菇只要 25 阳光，产量是向日葵的一半',
    '· 蘑菇夜里直接开工；白天种下会打盹，点一株蘑菇用咖啡豆唤醒它',
    '· 报纸僵尸：报纸是它的护盾，打掉报纸它会暴怒加速冲过来！',
    '· 夜间关卡：天上不会掉太阳，只能靠向日葵（开局多给 100 阳光）',
    '· 每行最左侧的小推车是最后防线，被突破则游戏失败',
    '· 消灭本关全部僵尸即可过关，P 键暂停（触屏点右上角按钮）',
  ];
  for(let i=0;i<lines.length;i++){
    drawText(lines[i], px+42, py+94+i*24, 15.5, '#3c2a10', null, 0, 'left', '600');
  }
  drawButton(W/2-80, py+ph-58, 160, 44, '返 回', 'back', ()=>{ G.state='menu'; SFX.click(); }, {});
}

function renderSelect(){
  const lv = LEVELS[G.level];
  let g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#3c5a2a'); g.addColorStop(1,'#243818');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  g = ctx.createLinearGradient(0,70,0,H-40);
  g.addColorStop(0,'#96652f'); g.addColorStop(1,'#6b4520');
  ctx.beginPath(); rr(40, 70, W-80, H-120, 16);
  O(g, '#3a220c', 4.5);
  // 木板纹
  ctx.save();
  rr(40, 70, W-80, H-120, 16); ctx.clip();
  ctx.strokeStyle = 'rgba(58,34,12,0.3)'; ctx.lineWidth = 2;
  for(let k=0;k<7;k++){
    const y = 96 + k*72;
    ctx.beginPath(); ctx.moveTo(44,y); ctx.bezierCurveTo(300,y+5,700,y-5,W-44,y+4); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,230,180,0.1)';
  ctx.fillRect(46, 74, W-92, 8);
  ctx.restore();

  drawText('选 择 你 的 植 物', W/2, 40, 30, '#f5e6b8', '#2c1c08', 6, 'center', '900');
  drawText(lv.name + '　·　可携带 ' + lv.slots + ' 种植物' + (lv.night ? '　·　夜战：开局 +100 阳光' : ''), W/2, 96, 16, '#e8d2a0', null, 0, 'center', '700');

  const slotW = 72, slotH = 100;
  const sx0 = W/2 - (lv.slots*(slotW+10))/2 + 5;
  for(let i=0;i<lv.slots;i++){
    const x = sx0 + i*(slotW+10), y = 118;
    let bg = ctx.createLinearGradient(0,y,0,y+slotH);
    bg.addColorStop(0,'#4a3418'); bg.addColorStop(1,'#33220e');
    ctx.beginPath(); rr(x, y, slotW, slotH, 8);
    O(bg, '#20140a', 2.5);
    const s = G.slots[i];
    if(s){
      G.hotspots.push({ x, y, w:slotW, h:slotH, id:'slot'+i, cb:(()=>{ const ii=i; return ()=>{ G.slots.splice(ii,1); if(G.sel===ii)G.sel=-1; else if(G.sel>ii)G.sel--; SFX.click(); }; })() });
      ctx.fillStyle = 'rgba(60,40,15,0.3)';
      ctx.beginPath(); ctx.ellipse(x+slotW/2, y+slotH-26, 18, 4, 0, 0, TAU); ctx.fill();
      drawPlantIcon(s.type, x+slotW/2, y+slotH-26, 0.6);
      drawText(PLANTS[s.type].name, x+slotW/2, y+13, 11, '#e8d2a0', null, 0, 'center', '700');
      drawText(String(PLANTS[s.type].cost), x+slotW/2, y+slotH-9, 11, '#ffd83d', null, 0, 'center', '700');
    } else {
      drawText(String(i+1), x+slotW/2, y+slotH/2, 22, 'rgba(232,210,160,0.25)', null, 0, 'center', '800');
    }
  }

  drawText('植物图鉴（点击加入队伍）', 200, 244, 15, '#e8d2a0', null, 0, 'left', '700');
  const cw = 108, ch = 92;
  for(let i=0;i<PLANT_ORDER.length;i++){
    const type = PLANT_ORDER[i];
    const def = PLANTS[type];
    const x = 76 + (i%4)*(cw+12), y = 254 + Math.floor(i/4)*(ch+8);
    const inTeam = G.slots.some(s=>s.type===type);
    const full = G.slots.length >= lv.slots;
    const hover = G.mouse.x>=x && G.mouse.x<=x+cw && G.mouse.y>=y && G.mouse.y<=y+ch;
    G.hotspots.push({ x, y, w:cw, h:ch, id:'pick'+type, cb:(()=>{ const tp=type, inT=inTeam, fu=full; return ()=>{
      if(inT){ const idx = G.slots.findIndex(s=>s.type===tp); G.slots.splice(idx,1); SFX.click(); }
      else if(!fu){ G.slots.push({type:tp, cool:0}); SFX.select(); }
      else SFX.error();
    }; })() });
    ctx.save();
    if(hover && !inTeam) ctx.translate(0,-3);
    ctx.fillStyle = 'rgba(20,12,4,0.35)';
    ctx.beginPath(); rr(x+2, y+4, cw, ch, 9); ctx.fill();
    let bg = ctx.createLinearGradient(0,y,0,y+ch);
    if(inTeam){ bg.addColorStop(0,'#c4e096'); bg.addColorStop(1,'#94c060'); }
    else { bg.addColorStop(0, hover ? '#f6e8c4' : '#e8d7ae'); bg.addColorStop(1, hover ? '#e0c898' : '#ccb586'); }
    ctx.beginPath(); rr(x, y, cw, ch, 9);
    O(bg, inTeam ? '#3c6a1c' : '#5f451f', inTeam ? 3 : 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x+4, y+3, cw-8, 6);
    ctx.fillStyle = 'rgba(60,40,15,0.25)';
    ctx.beginPath(); ctx.ellipse(x+cw/2, y+ch-30, 18, 4, 0, 0, TAU); ctx.fill();
    drawPlantIcon(type, x+cw/2, y+ch-28, 0.52);
    drawText(def.name, x+cw/2, y+13, 12, '#3c2a10', 'rgba(255,246,220,0.5)', 2, 'center', '800');
    drawSunIcon(x+24, y+ch-11, 0.3);
    drawText(String(def.cost), x+42, y+ch-11, 12, '#6b4c10', null, 0, 'left', '800');
    if(inTeam){
      ctx.beginPath(); ctx.arc(x+cw-16, y+14, 9, 0, TAU);
      O('#3c6a1c', '#244510', 2);
      ctx.strokeStyle = '#e8f5d8'; ctx.lineWidth = 2.4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x+cw-20, y+14); ctx.lineTo(x+cw-17, y+17.5); ctx.lineTo(x+cw-11.5, y+10.5); ctx.stroke();
    }
    ctx.restore();
  }

  const zx = 640, zy = 270;
  drawText('本关出没的僵尸', zx+110, zy-20, 15, '#e8d2a0', null, 0, 'left', '700');
  let gi = ctx.createLinearGradient(0,zy,0,zy+220);
  gi.addColorStop(0,'#4a3418'); gi.addColorStop(1,'#33220e');
  ctx.beginPath(); rr(zx, zy, 330, 220, 10);
  O(gi, '#20140a', 2.5);
  const nIco = lv.types.length;
  const izx0 = zx + 165 - (nIco-1)*31;
  for(let k=0;k<nIco;k++){
    const zt = lv.types[k][0];
    const acc = zt==='normal' ? null : zt;
    drawZombieHeadIcon(izx0+k*62, zy+44, 1.1, acc);
  }
  const tips = [
    '普通僵尸：最基础的敌人。',
    '路障 / 铁桶僵尸：头戴护具，非常耐打。',
    '撑杆僵尸：跑得快，还会跳过第一株植物！',
    '报纸僵尸：看报时很慢，报纸被打掉会暴怒加速！',
    '旗帜僵尸：出现在总攻的最前线。',
    lv.night ? '夜战：天上不掉太阳，靠向日葵与阳光菇。' : '消灭全部僵尸即可过关，小心小推车。',
    '白天蘑菇会打盹，用咖啡豆点它唤醒。',
  ];
  for(let i2=0;i2<tips.length;i2++){
    drawText(tips[i2], zx+22, zy+88+i2*20, 12.5, '#d8c090', null, 0, 'left', '600');
  }

  drawButton(88, H-88, 150, 46, '返回', 'back', ()=>{ G.state='menu'; SFX.click(); }, {});
  drawButton(W-286, H-88, 198, 46, G.slots.length ? '开 始 游 戏' : '请先选择植物', 'go',
    ()=>{ if(G.slots.length) startQuiz(); else SFX.error(); },
    { disabled: !G.slots.length, size:19 });
}

function renderQuiz(){
  drawMenuScene();
  ctx.fillStyle = 'rgba(10,16,10,0.6)';
  ctx.fillRect(0,0,W,H);
  const q = G.quiz;
  const cur = q.questions[q.idx];
  const pw=640, ph=400, px=W/2-pw/2, py=H/2-ph/2;
  ctx.fillStyle='rgba(15,25,8,0.45)';
  ctx.beginPath(); rr(px+5, py+7, pw, ph, 14); ctx.fill();
  let g = ctx.createLinearGradient(0,py,0,py+ph);
  g.addColorStop(0,'#f0e2bc'); g.addColorStop(1,'#d8c090');
  ctx.beginPath(); rr(px, py, pw, ph, 14); O(g,'#6b4c20',4);
  drawText('战 前 热 身', W/2, py+42, 30, '#42280f', null, 0, 'center', '900');
  drawText('答对一题，初始能量 ×2', W/2, py+74, 16, '#6b4c20', null, 0, 'center', '700');
  drawSunIcon(px+86, py+120, 0.7);
  drawText('初始能量：' + q.energy, px+150, py+120, 22, '#3a6b18', null, 0, 'left', '800');
  drawText('第 ' + (q.idx+1) + ' / 3 题', W/2, py+168, 16, '#8a6b3a', null, 0, 'center', '700');
  drawText(cur.text, W/2, py+222, 46, '#3c2a10', '#fff6dc', 6, 'center', '900');
  // 四个答案按钮（2×2）
  const bw=240, bh=54, bx0=W/2-bw-12, bx1=W/2+12, by0=py+262, by1=py+330;
  for(let i=0;i<4;i++){
    const bx = (i%2===0)?bx0:bx1;
    const by = (i<2)?by0:by1;
    const hover = G.mouse.x>=bx && G.mouse.x<=bx+bw && G.mouse.y>=by && G.mouse.y<=by+bh;
    let bg = ctx.createLinearGradient(0,by,0,by+bh);
    bg.addColorStop(0, hover ? '#96c862' : '#7aa848'); bg.addColorStop(1, hover ? '#649838' : '#4e7a2a');
    ctx.fillStyle='rgba(15,25,8,0.35)'; ctx.beginPath(); rr(bx+2, by+3, bw, bh, 10); ctx.fill();
    ctx.beginPath(); rr(bx, by, bw, bh, 10); O(bg, '#2e4a14', 3);
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(bx+5, by+3, bw-10, 6);
    drawText(String(cur.options[i]), bx+bw/2, by+bh/2+1, 24, '#fffbe8', '#2e3a10', 4, 'center', '800');
    G.hotspots.push({ x:bx, y:by, w:bw, h:bh, id:'ans'+i, cb:(()=>{ const a=cur.options[i]; return ()=>answerQuiz(a); })() });
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

function renderEndOverlay(){
  ctx.fillStyle = 'rgba(10,16,10,0.62)';
  ctx.fillRect(0,0,W,H);
  const won = G.state==='won';
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
      const cx = px + ((k*97 + AT*70) % pw);
      const cy = py + ((k*53 + AT*(40+k*3)) % ph);
      ctx.fillStyle = ['#ffd23e','#8fd44a','#ff8ab0','#7cc4ec'][k%4];
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(AT*3+k);
      ctx.fillRect(-3, -1.6, 6, 3.2);
      ctx.restore();
    }
    ctx.restore();
    drawText('关 卡 完 成 ！', W/2, py+62, 44, '#3c7a18', '#1e3c0a', 8, 'center', '900');
    drawText('消灭僵尸：' + G.killed + ' 只　　剩余阳光：' + G.sun, W/2, py+122, 19, '#4a3414', null, 0, 'center', '700');
    const lastLv = G.level >= LEVELS.length-1;
    if(!lastLv) drawText('新的关卡已解锁！', W/2, py+158, 17, '#a05c10', null, 0, 'center', '700');
    else drawText('你通关了全部 ' + LEVELS.length + ' 个关卡，草坪安全了！', W/2, py+158, 17, '#a05c10', null, 0, 'center', '700');
    const leftLabel = lastLv ? '再玩一次' : '下一关';
    const leftCb = lastLv ? ()=>startLevel(G.level) : ()=>startLevel(G.level+1);
    drawButton(W/2-215, py+ph-76, 200, 48, leftLabel, 'next', leftCb, {});
    drawButton(W/2+15, py+ph-76, 200, 48, '主菜单', 'menu', ()=>{ G.state='menu'; SFX.click(); }, {});
  } else {
    drawText('僵尸吃掉了你的脑子！', W/2, py+66, 37, '#e8554a', '#3a0a04', 8, 'center', '900');
    drawText('消灭僵尸：' + G.killed + ' / ' + G.total, W/2, py+130, 19, '#d8b8c0', null, 0, 'center', '700');
    drawButton(W/2-215, py+ph-76, 200, 48, '重新挑战', 'retry', ()=>startLevel(G.level), { red:true });
    drawButton(W/2+15, py+ph-76, 200, 48, '主菜单', 'menu', ()=>{ G.state='menu'; SFX.click(); }, {});
  }
}

// ---------------- 主渲染 ----------------
function render(){
  G.hotspots.length = 0;
  ctx.save();
  if(G.shake > 0 && G.state==='play'){
    ctx.translate(rand(-1,1)*G.shake*14, rand(-1,1)*G.shake*14);
  }
  if(G.state==='menu') renderMenu();
  else if(G.state==='help') renderHelp();
  else if(G.state==='select') renderSelect();
  else if(G.state==='quiz') renderQuiz();
  else {
    renderPlay();
    if(G.state==='won' || G.state==='lost') renderEndOverlay();
  }
  ctx.restore();
  // 轻微暗角
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.55, W/2, H/2, H*0.95);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(10,20,8,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);
}

// ---------------- 输入 ----------------
function toCanvas(e){
  const r = cv.getBoundingClientRect();
  return { x:(e.clientX - r.left) * W / r.width, y:(e.clientY - r.top) * H / r.height };
}

// 统一输入层：鼠标与触屏共用
function handleMove(p){
  G.mouse = p;
  G.hoverCell = null;
  if(G.state==='play'){
    const c = Math.floor((p.x - LX)/CW), r = Math.floor((p.y - LY)/CH);
    if(c>=0 && c<COLS && r>=0 && r<ROWS) G.hoverCell = { row:r, col:c };
  }
  let pointer = false;
  for(const h of G.hotspots){
    if(p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h){ pointer = true; break; }
  }
  cv.style.cursor = pointer ? 'pointer' : ((G.shovel || G.sel>=0) ? 'crosshair' : 'default');
}

function handlePress(p){
  SFX.ensure(); SFX.resume();
  G.mouse = p;
  for(let i=G.hotspots.length-1;i>=0;i--){
    const h = G.hotspots[i];
    if(p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h){
      h.cb();
      return;
    }
  }
  if(G.state !== 'play' || G.paused) return;
  for(let i=G.suns.length-1;i>=0;i--){
    const s = G.suns[i];
    if(s.state==='fly') continue;
    const dx = p.x - s.x, dy = p.y - s.y;
    if(dx*dx + dy*dy < 36*36){
      s.state = 'fly'; s.ft = 0;
      return;
    }
  }
  const c = Math.floor((p.x - LX)/CW), r = Math.floor((p.y - LY)/CH);
  if(c>=0 && c<COLS && r>=0 && r<ROWS){
    const existing = G.grid[r][c];
    if(G.shovel){
      if(existing){
        addLeafBurst(existing.cx, existing.fy-30);
        removePlant(existing);
        SFX.dig();
        G.shovel = false;
      }
      return;
    }
    if(G.sel >= 0){
      const s = G.slots[G.sel];
      const def = PLANTS[s.type];
      if(s.cool > 0){ SFX.error(); return; }
      if(s.type === 'coffee'){
        if(applyCoffee(existing)){
          G.sun -= def.cost; s.cool = def.cool; G.sel = -1;
        } else SFX.error();
        return;
      }
      if(existing){ SFX.error(); return; }
      if(G.sun < def.cost){ SFX.error(); G.sunFlash = 0.5; return; }
      placePlant(s.type, r, c);
      s.cool = def.cool;
      G.sel = -1;
    }
  }
}

// ---- 鼠标输入 ----
cv.addEventListener('mousemove', e=> handleMove(toCanvas(e)));
cv.addEventListener('mousedown', e=>{
  if(e.button === 2) return;
  handlePress(toCanvas(e));
});
// ---- 触屏输入（平板/手机） ----
cv.addEventListener('touchstart', e=>{
  e.preventDefault();
  const t = e.changedTouches[0];
  const p = toCanvas(t);
  handleMove(p);
  handlePress(p);
}, {passive:false});
cv.addEventListener('touchmove', e=>{
  e.preventDefault();
  handleMove(toCanvas(e.changedTouches[0]));
}, {passive:false});
cv.addEventListener('touchend', e=> e.preventDefault(), {passive:false});
// iOS 捏合缩放
document.addEventListener('gesturestart', e=> e.preventDefault());

cv.addEventListener('contextmenu', e=>{
  e.preventDefault();
  G.sel = -1; G.shovel = false;
});

window.addEventListener('keydown', e=>{
  if(G.state==='play'){
    if(e.key >= '1' && e.key <= '8'){
      const i = parseInt(e.key)-1;
      if(i < G.slots.length && !G.paused) clickCard(i);
    } else if(e.key==='Escape'){ G.sel=-1; G.shovel=false; }
    else if(e.key==='p' || e.key==='P'){ G.paused = !G.paused; SFX.click(); }
    else if(e.key==='m' || e.key==='M'){ SFX.musicOn = !SFX.musicOn; }
  }
});

// ---------------- 主循环 ----------------
let last = performance.now();
function frame(now){
  let dt = (now-last)/1000; last = now;
  dt = Math.min(dt, 0.05);
  AT += dt;
  if(G.state==='play' && !G.paused) updatePlay(dt);
  else if(G.state==='quiz') updateQuiz(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
