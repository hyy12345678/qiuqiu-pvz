// 僵尸美术：动画时间由调用方传入，绘制不接触世界状态。

import { CH, LY, TAU } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { ctx } from './target.js';
import { rr, O } from './paint.js';

// ---------------- 绘制：僵尸 ----------------
// E5：原 drawZombieEntity 是 309 行的单函数。按「后臂 / 腿 / 躯干 / 前臂 / 杆 / 旗 / 头 / 报纸 / 暴怒 / 冰霜」
// 切成片段函数：它们共享调用方已经建好的 ctx 变换（已 translate 到脚下），所以只通过 pose 传派生量，
// 不传 ctx、不传坐标。片段调用顺序即绘制顺序，与拆分前逐段对应，不得重排。
export function drawZombieEntity(t, z, fyOverride){
  const fyBase = (fyOverride !== undefined) ? fyOverride : LY + (z.row+1)*CH - 4;
  const fy = fyBase + (z.vy || 0);
  const slowed = z.slowT > 0;
  // 大色块用渐变铺出体积感：西装、衬衫、裤子占了大半身体面积，平涂时整只僵尸像纸片。
  //
  // 注意：C 里的纯色**不能**直接换成渐变——drawTorso 会把 C.suit 当作 addColorStop 的停靠色，
  // 渐变当颜色用会抛 "could not be parsed as a color"。所以纯色保留、另开 fill 字段给填充用。
  const vgrad = (a, b, x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, a); g.addColorStop(1, b);
    return g;
  };
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
  C.suitFill  = vgrad(slowed ? '#5a6c7c' : '#6a6154', slowed ? '#33414d' : '#332f28', -18, -84, 18, -34);
  C.shirtFill = vgrad(slowed ? '#b4c9d5' : '#c8c2ad', slowed ? '#8498a4' : '#8e8875', -13, -78, 13, -34);
  C.pantsFill = vgrad(slowed ? '#4d5f6d' : '#5a5145', slowed ? '#35434e' : '#3c352c', -8, -40, 8, -4);
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
  const pose = { C, eat, walk, at, ph, swing, bob, armSway, mouth, lunge, angry, reading, slowed };

  ctx.save();
  ctx.translate(z.x, fy);
  if(z.state==='dying'){
    const d = z.deathT;
    ctx.globalAlpha = clamp(1 - (d-0.25)/0.7, 0, 1);
    ctx.rotate(d*1.5);
    ctx.translate(0, d*10);
  }
  // 接触阴影：光从左上来，影子落在右下。两层叠加——外层大而淡，内层小而深，
  // 比单层平涂更接近真实的软阴影。
  ctx.fillStyle = 'rgba(26,48,14,0.15)';
  ctx.beginPath(); ctx.ellipse(7, 4.5, 26, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(26,48,14,0.24)';
  ctx.beginPath(); ctx.ellipse(3, 3, 19, 5.8, 0, 0, TAU); ctx.fill();

  ctx.rotate(swing*0.035);
  if(angry && walk) ctx.rotate(-0.11);   // 暴怒前冲
  ctx.translate(-lunge*0.35, -bob);

  drawBackArm(pose);
  drawLegs(pose);
  drawTorso(pose);
  drawFrontArm(pose);
  drawPole(z);
  drawFlag(t, z, pose);
  drawHead(t, z, pose);
  drawNewspaper(t, pose);
  drawAngryOverlay(t, pose);
  drawFrost(t, pose);

  ctx.restore();
}

// 后手臂（躯干后）
function drawBackArm(p){
  const C = p.C;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(9,-66); ctx.lineTo(-4,-59-p.armSway*0.5); ctx.lineTo(-24,-52-p.armSway*0.5);
  ctx.strokeStyle = C.line; ctx.lineWidth = 9.5; ctx.stroke();
  ctx.strokeStyle = C.suitD; ctx.lineWidth = 6.5; ctx.stroke();
  ctx.fillStyle = C.skinD;
  ctx.beginPath(); ctx.arc(-26,-52-p.armSway*0.5,4.2,0,TAU); ctx.fill();
}

// 腿：走路时两腿交替抬起
function drawLegs(p){
  const C = p.C;
  const legDraw = (hipX, footX, lift)=>{
    const kneeX = (hipX+footX)/2 + 2;
    ctx.beginPath(); ctx.moveTo(hipX,-38); ctx.quadraticCurveTo(kneeX,-22, footX,-4-lift);
    ctx.strokeStyle = C.line; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = C.pantsFill; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(footX-3,-3-lift,7.5,3.8,0,0,TAU);
    O('#2e2a24', '#17140f', 1.6);
  };
  legDraw(5, 6 - p.swing*9, p.walk ? Math.max(0,Math.sin(p.ph))*3 : 0);
  legDraw(-4, -2 + p.swing*9, p.walk ? Math.max(0,-Math.sin(p.ph))*3 : 0);
}

// 躯干：衬衫 + 敞开的西装外套（破边）+ 飘动的领带
function drawTorso(p){
  const C = p.C;
  ctx.beginPath(); rr(-13,-76,26,42,6);
  O(C.shirtFill, C.line, 2.4);
  // 西装两片直接复用 C.suitFill：省掉每只僵尸每帧一条渐变
  ctx.beginPath();
  ctx.moveTo(-17,-74);
  ctx.quadraticCurveTo(-18,-79,-12,-79);
  ctx.lineTo(-6,-79); ctx.lineTo(-9,-40);
  ctx.lineTo(-13,-43); ctx.lineTo(-10,-37); ctx.lineTo(-17,-39);
  ctx.closePath();
  O(C.suitFill, C.line, 2.2);
  ctx.beginPath();
  ctx.moveTo(17,-74);
  ctx.quadraticCurveTo(18,-79,12,-79);
  ctx.lineTo(6,-79); ctx.lineTo(9,-40);
  ctx.lineTo(13,-43); ctx.lineTo(10,-37); ctx.lineTo(17,-39);
  ctx.closePath();
  O(C.suitFill, C.line, 2.2);
  const tieWave = Math.sin(p.at*3.1)*2;
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
}

// 前手臂（平伸，伸向植物）
function drawFrontArm(p){
  const C = p.C;
  ctx.beginPath(); ctx.moveTo(-11,-70); ctx.lineTo(-27,-66+p.armSway);
  ctx.strokeStyle = C.line; ctx.lineWidth = 10; ctx.stroke();
  ctx.strokeStyle = C.suit; ctx.lineWidth = 7; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-27,-66+p.armSway); ctx.lineTo(-44,-62+p.armSway);
  ctx.strokeStyle = C.line; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = C.skin; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(-47,-61+p.armSway,5,0,TAU);
  O(C.skin, C.line, 2);
  ctx.beginPath(); ctx.arc(-45,-65.5+p.armSway,2.2,0,TAU);
  ctx.fillStyle = C.skin; ctx.fill();
}

// 撑杆僵尸的杆：跳跃时收在身下
function drawPole(z){
  if(z.type !== 'vault' || z.poleLost) return;
  const px = z.state==='vault' ? -18 : -54;
  const py = z.state==='vault' ? -58 : 0;
  ctx.beginPath(); ctx.moveTo(-18,-74); ctx.quadraticCurveTo((px-18)/2-6,(py-74)/2, px, py);
  ctx.strokeStyle = '#5c564a'; ctx.lineWidth = 6; ctx.stroke();
  ctx.strokeStyle = '#b8b2a2'; ctx.lineWidth = 3.6; ctx.stroke();
}

// 旗帜僵尸的旗
function drawFlag(t, z, p){
  if(z.type !== 'flag') return;
  ctx.beginPath(); ctx.moveTo(-30,-60+p.armSway); ctx.lineTo(-32,-132);
  ctx.strokeStyle = '#4a3c22'; ctx.lineWidth = 5.5; ctx.stroke();
  ctx.strokeStyle = '#8a744a'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-32,-132);
  ctx.quadraticCurveTo(-54, -128 + Math.sin(t*4.2)*3.4, -76, -121 + Math.sin(t*4.2+1)*3.6);
  ctx.lineTo(-73, -101 + Math.sin(t*4.2)*2.4);
  ctx.quadraticCurveTo(-52, -108, -31, -104);
  ctx.closePath();
  O('#b02a20', '#5e120c', 2.2);
  ctx.beginPath(); ctx.arc(-53,-115+Math.sin(t*4.2)*1.8,7,0,TAU);
  O('#a3b187', '#4a5238', 1.8);
  ctx.fillStyle = '#39412e';
  ctx.beginPath(); ctx.arc(-55.5,-116,1.5,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-50.5,-116,1.5,0,TAU); ctx.fill();
  ctx.strokeStyle = '#39412e'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(-53,-111.5,2,0.2,Math.PI-0.2); ctx.stroke();
}

// 头 + 脸 + 头饰（路障 / 铁桶 / 撑杆的护目镜）
function drawHead(t, z, p){
  const C = p.C;
  const hx = -7, hy = -96;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.swing*0.06 + (p.eat ? Math.sin(z.eatT*9)*0.07 : Math.sin(p.at*1.7)*0.03));
  ctx.fillStyle = C.skinD;
  ctx.fillRect(-4, 10, 9, 8);
  let g = ctx.createRadialGradient(-6,-7,3, 0,0,18);
  g.addColorStop(0, p.slowed?'#a8cad8':'#bcc7a0'); g.addColorStop(1, C.skin);
  ctx.beginPath(); ctx.arc(0,0,16,0,TAU);
  O(g, C.line, 2.4);
  ctx.beginPath(); ctx.ellipse(13,-2,3.2,4.4,0.2,0,TAU);
  O(C.skinD, C.line, 1.6);
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-13,-8); ctx.lineTo(-4,-9.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,-9.5); ctx.lineTo(7,-8.5); ctx.stroke();
  ctx.fillStyle = p.slowed ? '#3f5a68' : '#5c6247';
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
  ctx.beginPath(); ctx.ellipse(-6, 9, 8.5, p.mouth*0.62+1.6, -0.08, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-7, 10.5+p.mouth*0.5, 9.5, 5.6, -0.12, 0, TAU);
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
}

// 报纸（举在身前，遮住半张脸）
function drawNewspaper(t, p){
  if(!p.reading) return;
  const C = p.C;
  const wob = Math.sin(p.at*2.6)*0.05 + (p.walk ? p.swing*0.03 : 0);
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

// 暴怒：发红的眼、头顶青筋、怒气符号与疾驰残影
function drawAngryOverlay(t, p){
  if(!p.angry) return;
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
  const ang = Math.sin(t*9)*2;
  ctx.save();
  ctx.translate(14, -118 + ang*0.4);
  ctx.strokeStyle = '#e0382a'; ctx.lineWidth = 4.6; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-7,-7); ctx.lineTo(-2.4,-2.4); ctx.moveTo(0,-9); ctx.lineTo(0,-3);
  ctx.moveTo(7,-7); ctx.lineTo(2.4,-2.4); ctx.moveTo(-5,0); ctx.lineTo(5,0);
  ctx.stroke();
  ctx.restore();
  // 疾驰残影
  if(p.walk){
    ctx.strokeStyle = 'rgba(255,240,220,0.22)'; ctx.lineWidth = 3; ctx.lineCap='round';
    for(let k=0;k<3;k++){
      const yy = -30 - k*22;
      ctx.beginPath(); ctx.moveTo(30+k*6, yy); ctx.lineTo(52+k*10, yy); ctx.stroke();
    }
  }
}

// 减速冰霜
function drawFrost(t, p){
  if(!p.slowed) return;
  ctx.fillStyle = 'rgba(170,225,255,0.65)';
  for(let k=0;k<4;k++){
    const a = t*2 + k*TAU/4;
    ctx.beginPath();
    ctx.arc(Math.cos(a)*17, -62+Math.sin(a*1.3)*26, 1.9, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(140,200,240,0.4)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-14,-70); ctx.lineTo(-9,-74); ctx.moveTo(-11.5,-76); ctx.lineTo(-11.5,-68); ctx.stroke();
}

export function drawZombieHeadIcon(x, y, s, acc){
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
