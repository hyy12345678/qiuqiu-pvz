// 背景：白天 / 夜晚整幅预渲染并缓存。缓存只在绘制成功后生效；
// 绘制抛错时 target 已由 withTarget 恢复，下一次调用会重新尝试。

import { W, H, COLS, ROWS, CW, CH, LX, LY, TAU } from '../core/constants.js';
import { clamp } from '../core/util.js';
import { mulberry32 } from '../core/rng.js';
import { isNight } from '../core/world.js';
import { ctx, DPR, withTarget } from './target.js';
import { rr, O } from './paint.js';

export function createBackgroundCache({ createCanvas = () => document.createElement('canvas'), dpr } = {}){
  let canvas = null, theme = null;
  return {
    ensure(nextTheme, paint){
      if(canvas && theme === nextTheme) return canvas;
      // dpr 未显式给定时就地读取：bgCache 在 import 时创建，而画布在装配阶段才绑定。
      const scale = dpr === undefined ? DPR : dpr;
      const c = createCanvas();
      c.width = W*scale; c.height = H*scale;
      const cctx = c.getContext('2d');
      cctx.scale(scale, scale);
      withTarget(cctx, paint);
      canvas = c; theme = nextTheme;
      return c;
    },
    get canvas(){ return canvas; },
    get theme(){ return theme; },
  };
}

export const bgCache = createBackgroundCache();

// 房屋的纵向范围：墙面、砖基座与夜间的窗光/壁灯光晕都要对齐这一组值。
const HOUSE_Y0 = LY-34;
const HOUSE_Y1 = LY+ROWS*CH+4;

// ---------------- 绘制：战斗背景 ----------------
// E7：原 paintBattleBG 是 221 行的单函数，昼夜两套背景硬编码在一起。按「天空 / 草坪 / 入场暗区 /
// 房屋 / 泥土带 / 底部草地 / 夜色」切成七个片段。
//
// 关键约束：所有片段共用同一个 mulberry32 随机流 R，且**调用顺序就是 R 的消耗顺序**。
// 背景里每一丛草、每一颗星的位置都由 R 的第 n 次取值决定，调换任意两个片段的顺序会让整张背景重排。
// 因此 paintBattleBG 只负责建流与按序调用，片段之间不传 ctx、不传坐标。
export function paintBattleBG(night){
  const R = mulberry32(20260814);
  paintSky(R);
  paintLawn(R);
  paintEntryShade();
  paintHouse();
  paintDirtStrip(R);
  paintBottomGrass(R);
  if(night) paintNight(R);
}

// 天空、远景树丛与白色栅栏
function paintSky(R){
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
}

// 草坪：基底、棋盘格、草丛点缀与格线
function paintLawn(R){
  let g;
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
}

// 右侧入场暗区（僵尸从这边进来的视觉暗示）
function paintEntryShade(){
  const g = ctx.createLinearGradient(LX+COLS*CW, 0, W, 0);
  g.addColorStop(0,'rgba(40,70,25,0)'); g.addColorStop(1,'rgba(24,46,14,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(LX+COLS*CW, LY-34, W-(LX+COLS*CW), ROWS*CH+38);
}

// 左侧房屋：墙面、木板缝、屋檐、砖基座、两扇窗、门廊立柱与壁灯
function paintHouse(){
  let g;
  const y0 = HOUSE_Y0, y1 = HOUSE_Y1;
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
}

// 小推车所在的泥土带
function paintDirtStrip(R){
  let g;
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
}

// 草坪下方的草地与小花
function paintBottomGrass(R){
  const g = ctx.createLinearGradient(0,LY+ROWS*CH,0,H);
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
}

// 夜色处理（仅夜间关卡）：冷调压色、星空、月亮与月晕、雾气、窗光、壁灯光晕、地面冷高光
function paintNight(R){
  let g;
  const y0 = HOUSE_Y0;
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

export function drawBackground(world, t){
  const night = isNight(world);
  const c = bgCache.ensure(night ? 'night' : 'day', () => paintBattleBG(night));
  ctx.drawImage(c, 0, 0, W, H);
  if(night){
    // 萤火虫 + 星光微微闪
    ctx.save();
    for(let k=0;k<10;k++){
      const x = ((t*(6+k*1.4) + k*163) % (W+80)) - 40;
      const y = LY + 34 + ((k*101) % (ROWS*CH-56)) + Math.sin(t*0.85+k*2.1)*16;
      const a = clamp(0.30 + Math.sin(t*2.3+k*1.4)*0.34, 0, 1);
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
    const x = ((t*14 + k*197) % (W+60)) - 30;
    const y = LY + 46 + ((k*89) % (ROWS*CH-70)) + Math.sin(t*0.9+k*1.7)*13;
    ctx.globalAlpha = 0.16 + Math.sin(t*1.3+k)*0.08;
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath(); ctx.arc(x, y, 2.2+(k%3), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
