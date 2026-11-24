// 战斗 HUD：阳光盒、卡片、铲子、进度条、右上按钮与波次文字。
// 只读 world / ui，热点仍只注册动作描述。

import { W, H, TAU } from '../core/constants.js';
import { clamp, easeOut } from '../core/util.js';
import { PLANTS } from '../core/data/plants.js';
import { addHotspot } from '../ui/hotspots.js';
import { ctx, withTarget } from './target.js';
import { rr, O, drawText } from './paint.js';
import { drawPlantIcon, ICON_FIT } from './plant.js';
import { drawZombieHeadIcon } from './zombie.js';

const BANK_Y = 8, BANK_H = 88;
const CARD_X0 = 148, CARD_W = 60, CARD_H = 84, CARD_GAP = 6;
// 卡槽按最宽的关卡（8 卡）预留宽度，铲子按钮固定在它右侧。
// 这是布局常量而非"当前关卡卡数"：若改成读 world.slots.length，6/7 卡关卡里铲子会左右跳。
const MAX_CARDS = 8;
const SUN_BOX = { x:14, y:BANK_Y, w:120, h:BANK_H };
// E19：HUD 的静态件离屏缓存。
// E18 之后 drawSeedBank 每帧还有 1466 次调用，其中 738 次是两个太阳图标（单个 82 次），
// 其余大头是木板本体（渐变 + 5 条曲线 + 54 道木纹 + 钉子）。这两样都不随时间变化——
// 木板完全静态，太阳只转不形变。缓存成精灵之后每帧只剩 drawImage。
const HUD_SPRITES = new Map();
function hudSprite(key, w, h, paint, k = 2){
  const cached = HUD_SPRITES.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const cc = c.getContext('2d');
  cc.scale(k, k);
  withTarget(cc, paint);
  HUD_SPRITES.set(key, c);
  return c;
}

function paintBankStatic(){
  // 顶栏投到场地上的影
  const drop = ctx.createLinearGradient(0, BANK_Y+BANK_H, 0, BANK_Y+BANK_H+20);
  drop.addColorStop(0,'rgba(22,14,4,0.34)');
  drop.addColorStop(1,'rgba(22,14,4,0)');
  ctx.fillStyle = drop;
  ctx.fillRect(6, BANK_Y+BANK_H, 748, 20);

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
  // 木纹：竖直短纹，位置由确定的算术式给出（不能用随机源，否则绘制轨迹每次都不一样）
  for(let k=0;k<54;k++){
    const gx = 12 + (k * 13.7) % 736;
    const gy = BANK_Y + 6 + ((k * 37) % (BANK_H - 14));
    const len = 6 + ((k * 7) % 14);
    ctx.strokeStyle = 'rgba(46,26,8,' + (0.10 + (k % 3) * 0.05).toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 0.6, gy + len); ctx.stroke();
  }
  // 上沿高光 + 下沿内阴影：让木条像一块有厚度的板
  ctx.fillStyle = 'rgba(255,230,180,0.14)';
  ctx.fillRect(10, BANK_Y+2, 740, 6);
  let bankShade = ctx.createLinearGradient(0, BANK_Y+BANK_H-14, 0, BANK_Y+BANK_H);
  bankShade.addColorStop(0,'rgba(30,16,4,0)'); bankShade.addColorStop(1,'rgba(30,16,4,0.45)');
  ctx.fillStyle = bankShade;
  ctx.fillRect(8, BANK_Y+BANK_H-14, 744, 14);
  ctx.restore();
  for(const sx of [22, 738]){
    ctx.fillStyle = '#3a220c';
    ctx.beginPath(); ctx.arc(sx, BANK_Y+13, 3.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx, BANK_Y+BANK_H-13, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    ctx.beginPath(); ctx.arc(sx-1, BANK_Y+12, 1.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(sx-1, BANK_Y+BANK_H-14, 1.2, 0, TAU); ctx.fill();
  }
}

export function drawSeedBank(t, world, ui){
  // 木板 + 投影 + 钉子整块静态（渐变、5 条曲线、54 道木纹、4 颗钉子），缓存成精灵。
  const bank = hudSprite('bank', 752, 116, () => {
    ctx.translate(-4, -4);
    paintBankStatic();
  });
  ctx.drawImage(bank, 4, 4, 752, 116);

  // 木板搬进 paintBankStatic 之后，这个 g 要在这里重新声明：
  // 阳光盒与卡片底色仍然复用同一个变量。
  let g;
  const flash = world.sunFlash > 0 && Math.sin(t*30) > 0;
  g = ctx.createLinearGradient(0,BANK_Y,0,BANK_Y+BANK_H);
  g.addColorStop(0, flash ? '#fff8d0' : '#f8ecbe'); g.addColorStop(1, flash ? '#ffe98a' : '#e2c88a');
  ctx.beginPath(); rr(SUN_BOX.x, SUN_BOX.y, SUN_BOX.w, SUN_BOX.h, 10);
  O(g, '#8a6b3a', 2.6);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(SUN_BOX.x+4, SUN_BOX.y+3, SUN_BOX.w-8, 8);
  drawSunIcon(t, SUN_BOX.x+30, SUN_BOX.y+32, 0.85);
  drawText(String(world.sun), SUN_BOX.x+78, SUN_BOX.y+33, 26, '#3a2c10', 'rgba(255,250,230,0.7)', 3, 'center');
  drawText('阳光', SUN_BOX.x+SUN_BOX.w/2, SUN_BOX.y+66, 13, '#7a5c28', null, 0, 'center', '600');

  for(let i=0;i<world.slots.length;i++){
    const s = world.slots[i];
    const def = PLANTS[s.type];
    const x = CARD_X0 + i*(CARD_W+CARD_GAP);
    const y = BANK_Y + 2;
    const afford = world.sun >= def.cost && s.cool <= 0;
    const selected = ui.sel === i;
    const hover = ui.mouse.x>=x && ui.mouse.x<=x+CARD_W && ui.mouse.y>=y && ui.mouse.y<=y+CARD_H;
    addHotspot(ui, x, y-4, CARD_W, CARD_H+4, 'card'+i, { type:'pickSlot', index:i });
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
    // 内侧倒角：贴着边框再压一圈，上亮下暗，卡片才有厚度而不是一张纸片
    ctx.save();
    rr(x, y, CARD_W, CARD_H, 8); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(x, y, CARD_W, 3.5);
    ctx.fillStyle = 'rgba(96,64,26,0.16)';
    ctx.fillRect(x, y+CARD_H-5, CARD_W, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x+3, y+2.5, CARD_W-6, 5);
    ctx.restore();
    ctx.save();
    if(!afford) ctx.globalAlpha = 0.55;
    ctx.fillStyle = 'rgba(60,40,15,0.25)';
    const fit = ICON_FIT[s.type] || 1;
    ctx.beginPath(); ctx.ellipse(x+CARD_W/2, y+CARD_H-24, 16*fit, 4*fit, 0, 0, TAU); ctx.fill();
    drawPlantIcon(t, s.type, x+CARD_W/2, y+CARD_H-22, 0.5);
    ctx.restore();
    drawText(def.name, x+CARD_W/2, y+12, 11.5, '#42300f', 'rgba(255,246,220,0.5)', 2, 'center', '700');
    drawSunIcon(t, x+18, y+CARD_H-11, 0.34);
    drawText(String(def.cost), x+40, y+CARD_H-11, 13, world.sun>=def.cost ? '#3a2c10' : '#a02818', 'rgba(255,246,220,0.5)', 2, 'center', '800');
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

  const sx = CARD_X0 + MAX_CARDS*(CARD_W+CARD_GAP) + 8, sy = BANK_Y+8;
  const active = ui.shovel;
  const hoverS = ui.mouse.x>=sx && ui.mouse.x<=sx+64 && ui.mouse.y>=sy && ui.mouse.y<=sy+72;
  addHotspot(ui, sx, sy, 64, 72, 'shovel', { type:'shovel' });
  let g2 = ctx.createLinearGradient(0,sy,0,sy+72);
  g2.addColorStop(0, active ? '#efd28a' : '#b8946a'); g2.addColorStop(1, active ? '#c8a24e' : '#8a6b42');
  ctx.beginPath(); rr(sx, sy, 64, 72, 8);
  O(g2, active ? '#ffe86e' : '#5f451f', active?3:2.2);
  drawShovelIcon(sx+32, sy+34, hoverS||active ? 1.08 : 1);
  drawText('铲子', sx+32, sy+62, 11, '#42300f', null, 0, 'center', '700');
}

// 太阳只转不形变，形状本身是静态的：按 t=0 缓存一次，之后只做缩放贴图。
// 代价是图标不再随时间旋转。卡片上的太阳只有 0.34 倍（约 14px），看不出转速；
// 阳光盒里那个 0.85 倍的大图标会失去缓慢旋转——这是本轮唯一的可感知变化。
const SUN_SPRITE = 46;   // 逻辑边长：射线尖端半径 21，留一点描边余量
function paintSunShape(){
  ctx.save();
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
}

export function drawSunIcon(t, x,y,s){
  const sprite = hudSprite('sun', SUN_SPRITE, SUN_SPRITE, () => {
    ctx.translate(SUN_SPRITE/2, SUN_SPRITE/2);
    paintSunShape();
  });
  const half = (SUN_SPRITE/2) * s;
  ctx.drawImage(sprite, x - half, y - half, SUN_SPRITE*s, SUN_SPRITE*s);
}

export function drawShovelIcon(x,y,s){
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

export function drawProgressBar(world){
  const x0 = 600, x1 = 985, y = 611, h = 20;
  let g = ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,'#6b4520'); g.addColorStop(1,'#3c220c');
  ctx.beginPath(); rr(x0, y, x1-x0, h, 9);
  O(g, '#241204', 2.4);
  const inner = { x:x0+4, w:(x1-x0)-8 };
  const p = world.total ? clamp(world.killed / world.total, 0, 1) : 0;
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

export function drawTopRightButtons(world, ui, musicOn){
  const btns = [
    { id:'pause', label: world.paused ? '继续' : '暂停', action:{ type:'pause' } },
    { id:'mute', label: musicOn ? '音乐开' : '音乐关', action:{ type:'music' } },
  ];
  let x = W - 12;
  for(const b of btns){
    const w = 74;
    x -= w + 8;
    const y = 12, h = 30;
    const hover = ui.mouse.x>=x && ui.mouse.x<=x+w && ui.mouse.y>=y && ui.mouse.y<=y+h;
    addHotspot(ui, x, y, w, h, b.id, b.action);
    let g = ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0, hover ? '#9a6b38' : '#7a4c22'); g.addColorStop(1, hover ? '#7a4c22' : '#5f3a18');
    ctx.beginPath(); rr(x, y, w, h, 8);
    O(g, '#42280f', 2);
    ctx.fillStyle = 'rgba(255,230,180,0.18)';
    ctx.fillRect(x+3, y+2, w-6, 5);
    drawText(b.label, x+w/2, y+h/2+1, 13.5, '#f5e6b8', null, 0, 'center', '700');
  }
}

export function drawWaveText(at, world){
  if(!world.visual.waveText) return;
  const wv = world.visual.waveText;
  const t = wv.t;
  const size = wv.size || 46;          // E24：僵尸首见提示用小字，大波提示保持 46
  let alpha = 1, scale = 1;
  if(t < 0.35) scale = 0.4 + easeOut(t/0.35)*0.7;
  if(t > 2.1) alpha = clamp((2.6-t)/0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W/2, H/2 - 40);
  ctx.scale(scale, scale);
  if(size >= 40) ctx.rotate(Math.sin(at*14)*0.012);   // 只有大波提示做抖动
  drawText(wv.text, 0, 0, size, '#d02818', '#3a0a04', Math.round(size/5));
  ctx.restore();
}

export function drawIntro(at, world){
  if(world.state !== 'play' || world.t >= 0) return;
  const t = world.t;
  let txt = null;
  if(t >= -3.2 && t < -1.4) txt = '准备……';
  else if(t >= -1.4) txt = '开始！';
  if(!txt) return;
  const inPhase = t >= -1.4;
  const k = inPhase ? clamp((t+1.4)/0.3, 0, 1) : clamp((t+3.2)/0.3, 0, 1);
  const scale = 0.5 + easeOut(k)*0.6 + (inPhase ? Math.sin(at*10)*0.02 : 0);
  ctx.save();
  ctx.translate(W/2, H/2 - 30);
  ctx.scale(scale, scale);
  drawText(txt, 0, 0, 64, inPhase ? '#ffe86e' : '#f5f0d8', '#3a2c10', 10);
  ctx.restore();
}
