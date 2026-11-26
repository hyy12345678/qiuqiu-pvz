// 战斗 HUD：阳光盒、卡片、铲子、进度条、右上按钮与波次文字。
// 只读 world / ui，热点仍只注册动作描述。
import { W, H, TAU } from '../core/constants.js';
import { clamp, easeOut } from '../core/util.js';
import { PLANTS } from '../core/data/plants.js';
import { hotRect, getUITime } from './scenes/common.js';
import { ctx } from './target.js';
import { rr, drawText } from './paint.js';
import { candyButton, portrait, shovelIcon, sunIcon } from './skin.js';
import { getIcon } from './icons.js';

const BANK_Y = 8, BANK_H = 88;
const CARD_X0 = 148, CARD_W = 60, CARD_H = 84, CARD_GAP = 6;
// 卡槽按最宽的关卡（8 卡）预留宽度，铲子按钮固定在它右侧。
// 这是布局常量而非"当前关卡卡数"：若改成读 world.slots.length，6/7 卡关卡里铲子会左右跳。
// 它与 data/levels.js 的 slots 是同一个数字的两份写法，由 tests/waves.test.mjs 的
// 「关卡卡数不超过 HUD 布局上限」用例守住：改关卡卡数必须一起改这里，否则测试会红。
export const MAX_CARDS = 8;
const SUN_BOX = { x: 14, y: BANK_Y, w: 120, h: BANK_H };
// 阳光飞向 HUD 的终点（3D 视图按这个屏幕点反投影），与阳光盒里的太阳图标对齐
export const SUN_TARGET = { x: SUN_BOX.x + 32, y: SUN_BOX.y + 34 };

function bankPlate(){
  // 一整条深色琉璃托盘，金边，压在 3D 画面上
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  rr(6, BANK_Y - 2, 748, BANK_H + 6, 16);
  const g = ctx.createLinearGradient(0, BANK_Y, 0, BANK_Y + BANK_H);
  g.addColorStop(0, 'rgba(34,64,52,0.94)'); g.addColorStop(1, 'rgba(10,26,22,0.96)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const s = ctx.createLinearGradient(0, BANK_Y, 0, BANK_Y + BANK_H);
  s.addColorStop(0, '#fff2b8'); s.addColorStop(0.4, '#d8a238'); s.addColorStop(1, '#8a5a12');
  ctx.strokeStyle = s; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

export function drawSeedBank(t, world, ui){
  bankPlate();
  // ---- 阳光盒 ----
  const flash = world.sunFlash > 0 && Math.sin(t * 30) > 0;
  ctx.save();
  rr(SUN_BOX.x + 4, SUN_BOX.y + 4, SUN_BOX.w - 8, SUN_BOX.h - 8, 12);
  const sg = ctx.createLinearGradient(0, SUN_BOX.y, 0, SUN_BOX.y + SUN_BOX.h);
  sg.addColorStop(0, flash ? '#ff8a6a' : '#fff4c0'); sg.addColorStop(1, flash ? '#c02818' : '#e8b44a');
  ctx.fillStyle = sg; ctx.fill();
  ctx.strokeStyle = '#6a4208'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  rr(SUN_BOX.x + 9, SUN_BOX.y + 7, SUN_BOX.w - 18, 12, 6); ctx.fill();
  ctx.restore();
  sunIcon(SUN_TARGET.x, SUN_TARGET.y, 1.0, t);
  drawText(String(world.sun), SUN_BOX.x + 84, SUN_BOX.y + 36, world.sun >= 1000 ? 20 : 26, '#3a2004', '#fff8e0', 4, 'center', '900');
  drawText('阳光', SUN_BOX.x + SUN_BOX.w / 2, SUN_BOX.y + 70, 13, '#6a4208', null, 0, 'center', '900');

  // ---- 卡片 ----
  const cards = Math.min(world.slots.length, MAX_CARDS);
  for(let i = 0; i < cards; i++){
    const s = world.slots[i];
    const def = PLANTS[s.type];
    const x = CARD_X0 + i * (CARD_W + CARD_GAP);
    const y = BANK_Y + 2;
    const afford = world.sun >= def.cost && s.cool <= 0;
    const selected = ui.sel === i;
    // 热点与悬停共用同一个矩形；选中态的上浮由绘制自己处理，不混进命中区域
    const hover = hotRect(ui, x, y, CARD_W, CARD_H, 'card' + i, { type: 'pickSlot', index: i });
    ctx.save();
    if(selected) ctx.translate(0, -5 + Math.sin(t * 8) * 1.2);
    else if(hover && afford) ctx.translate(0, -2);
    if(selected){ ctx.shadowColor = 'rgba(255,224,90,0.95)'; ctx.shadowBlur = 18; }
    else { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3; }
    rr(x, y, CARD_W, CARD_H, 10);
    const fg = ctx.createLinearGradient(0, y, 0, y + CARD_H);
    fg.addColorStop(0, '#fff6d0'); fg.addColorStop(0.5, '#e8c070'); fg.addColorStop(1, '#a8742a');
    ctx.fillStyle = fg; ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = selected ? '#fffbe0' : '#5a3a08'; ctx.lineWidth = selected ? 3 : 2; ctx.stroke();
    // 内框：肖像底
    rr(x + 4, y + 16, CARD_W - 8, CARD_H - 34, 7);
    const ig = ctx.createRadialGradient(x + CARD_W / 2, y + 40, 2, x + CARD_W / 2, y + 44, 36);
    ig.addColorStop(0, '#5fae7a'); ig.addColorStop(1, '#1c4434');
    ctx.fillStyle = ig; ctx.fill();
    ctx.save();
    rr(x + 4, y + 16, CARD_W - 8, CARD_H - 34, 7); ctx.clip();
    portrait(getIcon('plant', s.type), def.name, x + 4, y + 14, CARD_W - 8, CARD_H - 31, { bottom: true });
    ctx.restore();
    drawText(def.name, x + CARD_W / 2, y + 9, 10.5, '#3a2004', null, 0, 'center', '900');
    // 价格
    sunIcon(x + 15, y + CARD_H - 9, 0.3, t);
    drawText(String(def.cost), x + 38, y + CARD_H - 9, 13, world.sun >= def.cost ? '#3a2004' : '#c01808', null, 0, 'center', '900');
    // 冷却：自上而下褪去的暗幕 + 发光的进度线
    if(s.cool > 0){
      const frac = s.cool / def.cool;
      ctx.save();
      rr(x, y, CARD_W, CARD_H, 10); ctx.clip();
      ctx.fillStyle = 'rgba(8,14,30,0.68)';
      ctx.fillRect(x, y, CARD_W, CARD_H * frac);
      ctx.fillStyle = 'rgba(160,220,255,0.9)';
      ctx.fillRect(x, y + CARD_H * frac - 1.5, CARD_W, 2);
      ctx.restore();
    } else if(!afford){
      ctx.fillStyle = 'rgba(10,10,20,0.45)';
      rr(x, y, CARD_W, CARD_H, 10); ctx.fill();
    } else {
      // 可用：轻轻闪一道光，提示「现在能种」
      const k = (t * 0.5 + i * 0.13) % 1;
      if(k < 0.25){
        ctx.save();
        rr(x, y, CARD_W, CARD_H, 10); ctx.clip();
        const sx = x - 30 + k / 0.25 * (CARD_W + 60);
        const lg = ctx.createLinearGradient(sx, 0, sx + 24, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.4)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = lg; ctx.fillRect(sx, y, 24, CARD_H);
        ctx.restore();
      }
    }
    // 快捷键角标
    ctx.beginPath(); ctx.arc(x + CARD_W - 7, y + CARD_H - 24, 7, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    drawText(String(i + 1), x + CARD_W - 7, y + CARD_H - 23.5, 9.5, '#ffe58a', null, 0, 'center', '900');
    ctx.restore();
  }

  // ---- 铲子 ----
  const sx = CARD_X0 + MAX_CARDS * (CARD_W + CARD_GAP) + 8, sy = BANK_Y + 8;
  const active = ui.shovel;
  const hoverS = hotRect(ui, sx, sy, 64, 72, 'shovel', { type: 'shovel' });
  ctx.save();
  rr(sx, sy, 64, 72, 12);
  const g2 = ctx.createLinearGradient(0, sy, 0, sy + 72);
  g2.addColorStop(0, active ? '#ffe58a' : '#6a8a80'); g2.addColorStop(1, active ? '#c8902e' : '#2a4038');
  ctx.fillStyle = g2; ctx.fill();
  ctx.strokeStyle = active ? '#fffbe0' : '#d8a238'; ctx.lineWidth = active ? 3 : 2; ctx.stroke();
  ctx.restore();
  if(!active) shovelIcon(sx + 32, sy + 32, hoverS ? 1.1 : 1);
  drawText('铲子', sx + 32, sy + 62, 11, active ? '#3a2004' : '#fff8e0', null, 0, 'center', '900');
}

export function drawProgressBar(world){
  const x0 = 600, x1 = 985, y = 608, h = 22;
  const p = world.total ? clamp(world.killed / world.total, 0, 1) : 0;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  rr(x0, y, x1 - x0, h, 11);
  ctx.fillStyle = 'rgba(10,22,18,0.9)'; ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = '#d8a238'; ctx.lineWidth = 2; ctx.stroke();
  const ix = x0 + 4, iw = x1 - x0 - 8;
  ctx.save();
  rr(ix, y + 4, iw, h - 8, 7); ctx.clip();
  const g = ctx.createLinearGradient(0, y + 4, 0, y + h - 4);
  g.addColorStop(0, '#d8ff8a'); g.addColorStop(0.5, '#6ad62a'); g.addColorStop(1, '#2a8a10');
  ctx.fillStyle = g;
  ctx.fillRect(ix + iw * (1 - p), y + 4, iw * p, h - 8);
  ctx.restore();
  for(const frac of [0.5, 1.0]){
    const fx = ix + iw * (1 - frac);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(fx, y + 4); ctx.lineTo(fx, y - 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, y - 14); ctx.lineTo(fx + 15, y - 9); ctx.lineTo(fx, y - 4); ctx.closePath();
    ctx.fillStyle = p >= frac ? '#5ad62a' : '#e0302a'; ctx.fill();
    ctx.strokeStyle = '#3a0808'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  const hx = ix + iw * (1 - p);
  portrait(getIcon('head', 'normal'), '僵', hx - 16, y - 14, 32, 40, { color: '#7f9a6c' });
  ctx.restore();
  drawText('关卡进度', x0 - 48, y + h / 2 + 1, 13, '#fff8e0', 'rgba(0,0,0,0.75)', 4, 'center', '900');
}

export function drawTopRightButtons(world, ui, musicOn){
  const btns = [
    { id: 'pause', label: world.paused ? '继续' : '暂停', action: { type: 'pause' }, color: world.paused ? 'green' : 'orange' },
    { id: 'mute', label: musicOn ? '音乐开' : '音乐关', action: { type: 'music' }, color: 'blue' },
  ];
  let x = W - 12;
  for(const b of btns){
    const w = 74;
    x -= w + 8;
    const y = 12, h = 30;
    const hover = hotRect(ui, x, y, w, h, b.id, b.action);
    candyButton(x, y, w, h, b.label, { hover, color: b.color, size: 13.5, t: getUITime() });
  }
}

export function drawWaveText(at, world){
  if(!world.visual.waveText) return;
  const wv = world.visual.waveText;
  const t = wv.t;
  const size = wv.size || 50;          // 僵尸首见提示用小字，大波提示保持大字
  let alpha = 1, scale = 1;
  if(t < 0.35) scale = 2.2 - easeOut(t / 0.35) * 1.2;
  if(t > 2.1) alpha = clamp((2.6 - t) / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = Math.min(alpha, t < 0.35 ? t / 0.2 : 1);
  ctx.translate(W / 2, H / 2 - 40);
  if(size >= 40){
    // 大波：整屏红色脉冲 + 抖动
    ctx.save();
    ctx.globalAlpha *= 0.25 + 0.15 * Math.sin(at * 12);
    const g = ctx.createRadialGradient(0, 0, 60, 0, 0, 560);
    g.addColorStop(0, 'rgba(255,40,20,0)'); g.addColorStop(1, 'rgba(200,0,0,0.9)');
    ctx.fillStyle = g; ctx.fillRect(-W / 2, -H / 2 - 40, W, H + 80);
    ctx.restore();
    ctx.rotate(Math.sin(at * 14) * 0.015);
  } else {
    rr(-330, -26, 660, 52, 26);
    ctx.fillStyle = 'rgba(30,8,8,0.72)'; ctx.fill();
    ctx.strokeStyle = '#ff7a5a'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.scale(scale, scale);
  for(let k = 6; k > 0; k--) drawText(wv.text, 0, k, size, '#5a0402', '#5a0402', Math.round(size / 5));
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, '#ffe0a0'); g.addColorStop(0.45, '#ff5a2a'); g.addColorStop(1, '#b00a04');
  drawText(wv.text, 0, 0, size, g, '#2a0000', Math.round(size / 5));
  ctx.restore();
}

export function drawIntro(at, world){
  if(world.state !== 'play' || world.t >= 0) return;
  const t = world.t;
  const go = t >= -1.4;
  const txt = go ? '开始！' : '准备……';
  const k = go ? clamp((t + 1.4) / 0.3, 0, 1) : clamp((t + 3.2) / 0.3, 0, 1);
  const scale = (go ? 2 - easeOut(k) * 1.0 : 0.4 + easeOut(k) * 0.6) + (go ? Math.sin(at * 10) * 0.02 : 0);
  ctx.save();
  ctx.globalAlpha = go ? 1 : k;
  ctx.translate(W / 2, H / 2 - 30);
  ctx.scale(scale, scale);
  for(let d = 7; d > 0; d--) drawText(txt, 0, d, 72, '#2a1a02', '#2a1a02', 12);
  const g = ctx.createLinearGradient(0, -36, 0, 36);
  if(go){ g.addColorStop(0, '#fffbd0'); g.addColorStop(0.5, '#ffd23a'); g.addColorStop(1, '#e07a08'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c8dce8'); }
  drawText(txt, 0, 0, 72, g, '#3a2004', 12);
  ctx.restore();
}

