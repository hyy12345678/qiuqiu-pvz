// 主菜单：背景、标题、关卡卡片与按钮。

import { W, H, TAU } from '../../core/constants.js';
import { LEVELS } from '../../core/data/levels.js';
import { addHotspot } from '../../ui/hotspots.js';
import { ctx } from '../target.js';
import { rr, O, drawText } from '../paint.js';
import { drawSunflower, drawShooter, drawWallnut, drawQiuqiu } from '../plant.js';
import { drawZombieEntity, drawZombieHeadIcon } from '../zombie.js';
import { drawSunIcon } from '../hud.js';
import { drawButton } from './common.js';

export function drawMenuScene(t){
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
  drawSunIcon(t, 880, 70, 1.9);
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
  cloud(((t*9)%(W+260))-130, 88, 1.1);
  cloud(((t*6+500)%(W+260))-130, 150, 0.85);
  cloud(((t*7.5+900)%(W+260))-130, 58, 1.35);
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
  ctx.save(); ctx.translate(110, H-36); ctx.scale(1.55,1.55); drawSunflower(t, 0); ctx.restore();
  ctx.save(); ctx.translate(225, H-28); ctx.scale(1.35,1.35); drawShooter(t, 2, 'pea', 0, 0); ctx.restore();
  ctx.save(); ctx.translate(315, H-24); ctx.scale(1.15,1.15); drawWallnut(1, t, 4); ctx.restore();
  ctx.save(); ctx.translate(465, H-14); ctx.scale(1.12,1.12); drawQiuqiu(t, 5, 0); ctx.restore();
  ctx.save(); ctx.translate(W-140, H-26); ctx.scale(1.55,1.55);
  drawZombieEntity(t, { type:'normal', row:0, x:0, vy:0, state:'walk', animT:t, eatT:0, slowT:0, deathT:0, dustT:0 }, 0);
  ctx.restore();
  ctx.save(); ctx.translate(W-262, H-18); ctx.scale(1.3,1.3);
  drawZombieEntity(t, { type:'cone', row:0, x:0, vy:0, state:'walk', animT:t+2, eatT:0, slowT:0, deathT:0, dustT:0 }, 0);
  ctx.restore();
  ctx.save(); ctx.translate(W-372, H-14); ctx.scale(1.12,1.12);
  drawZombieEntity(t, { type:'bucket', row:0, x:0, vy:0, state:'walk', animT:t+4, eatT:0, slowT:0, deathT:0, dustT:0 }, 0);
  ctx.restore();
  ctx.save(); ctx.translate(W-470, H-16); ctx.scale(1.2,1.2);
  drawZombieEntity(t, { type:'newspaper', row:0, x:0, vy:0, state:'walk', animT:t+1.2, eatT:0, slowT:0, deathT:0, dustT:0, paper:400, angry:false }, 0);
  ctx.restore();
  // E22：铁门僵尸。放在球球右侧的空档（x≈612）。之前试过最右边，会被"全部关卡"按钮
  // 和报纸僵尸挤住只露半个；这里原本是一片空草坪。
  ctx.save(); ctx.translate(612, H-12); ctx.scale(1.04,1.04);
  drawZombieEntity(t, { type:'screen', row:0, x:0, vy:0, state:'walk', animT:t+3, eatT:0, slowT:0, deathT:0, dustT:0 }, 0);
  ctx.restore();
}

export function renderMenu(t, world, ui, musicOn){
  drawMenuScene(t);

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
    const dy = Math.sin(t*2 + i*0.9)*4;
    ctx.font = '900 ' + tSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(30,50,15,0.35)';
    ctx.fillText(title[i], cx+5, dy+8);
  }
  for(let i=0;i<title.length;i++){
    const cx = (i - (title.length-1)/2) * tGap;
    const rot = Math.sin(t*1.5 + i)*0.04;
    const dy = Math.sin(t*2 + i*0.9)*4;
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
    const locked = !world.unlockAll && i+1 > world.unlocked;
    const x = x0 + i*(cardW+gap), y = 258;
    const hover = !locked && ui.mouse.x>=x && ui.mouse.x<=x+cardW && ui.mouse.y>=y && ui.mouse.y<=y+cardH;
    addHotspot(ui, x, y, cardW, cardH, 'lv'+i, { type:'level', index:i });
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

  drawButton(ui, W/2-290, 462, 180, 52, '操作说明', 'help', { type:'nav', state:'help' }, {});
  drawButton(ui, W/2-90, 462, 180, 52, musicOn ? '音乐：开' : '音乐：关', 'music', { type:'music', ensure:true }, {});
  drawButton(ui, W/2+110, 462, 180, 52, world.unlockAll ? '全部关卡：开' : '全部关卡：关', 'unlockall', { type:'unlockAll' }, { size: 18 });
  // 这行小字原来用半透明深绿、无描边，正好被僵尸的脚和腿压住，中段完全看不清。
  // 改成浅色 + 深色描边：无论底下是草地、僵尸还是按钮都读得出来。
  drawText('同人复刻 · 图形与音乐均为程序生成 · 仅供个人学习娱乐', W/2, H-20, 12.5,
    'rgba(252,248,236,0.95)', 'rgba(24,34,14,0.85)', 3, 'center', '700');
}
