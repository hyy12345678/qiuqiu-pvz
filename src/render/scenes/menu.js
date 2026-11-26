// 主菜单：3D 院子在底下（由 3D 视图的 menu 模式画），这里只画标题、关卡卡片与按钮。
import { W, H, TAU } from '../../core/constants.js';
import { LEVELS } from '../../core/data/levels.js';
import { hotRect, drawButton } from './common.js';
import { ctx } from '../target.js';
import { rr, drawText } from '../paint.js';
import { panel, heroTitle, ribbon, portrait, sparkle, gem } from '../skin.js';
import { getIcon } from '../icons.js';

const ZNAME = { normal: '普', cone: '路', bucket: '桶', flag: '旗', vault: '撑', newspaper: '报', screen: '门' };

export function renderMenu(t, world, ui, musicOn){
  // 顶部压暗一道，标题才不会被天空吃掉
  const top = ctx.createLinearGradient(0, 0, 0, 250);
  top.addColorStop(0, 'rgba(8,24,40,0.45)'); top.addColorStop(1, 'rgba(8,24,40,0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, 250);

  heroTitle('球球的植物大战僵尸', W / 2, 104, 70, t);
  for(let i = 0; i < 6; i++){
    const k = (t * 0.7 + i * 0.37) % 1;
    sparkle(W / 2 + Math.sin(i * 2.3) * 330, 70 + Math.cos(i * 1.7) * 40, 9 * Math.sin(k * Math.PI), Math.sin(k * Math.PI));
  }
  ribbon(W / 2, 182, 330, 34, '网页版 · 3D 全新画面 · 离线可玩', { color: 'orange', size: 17 });

  const cardW = 214, cardH = 150, gap = 22;
  const n = LEVELS.length;
  const x0 = W / 2 - (n * cardW + (n - 1) * gap) / 2;
  for(let i = 0; i < n; i++){
    const lv = LEVELS[i];
    const locked = !world.unlockAll && i + 1 > world.unlocked;
    const x = x0 + i * (cardW + gap), y = 258;
    // 热点必须无条件注册：锁住的关卡也要能点到，由 chooseLevel 判锁并给出反馈
    const hit = hotRect(ui, x, y, cardW, cardH, 'lv' + i, { type: 'level', index: i });
    const hover = !locked && hit;
    ctx.save();
    const lift = hover ? -6 : 0;
    ctx.translate(0, lift);
    panel(x, y, cardW, cardH, { tone: locked ? 'jade' : (lv.night ? 'night' : 'jade'), r: 16, blur: hover ? 30 : 18, corners: false });
    // 卡片上半：僵尸肖像排成一列
    ctx.save();
    rr(x + 8, y + 40, cardW - 16, 72, 10); ctx.clip();
    const bg = ctx.createLinearGradient(0, y + 40, 0, y + 112);
    if(lv.night){ bg.addColorStop(0, '#2a3a78'); bg.addColorStop(1, '#141c40'); }
    else { bg.addColorStop(0, '#8fd8ff'); bg.addColorStop(1, '#5fb84a'); }
    ctx.fillStyle = bg; ctx.fillRect(x + 8, y + 40, cardW - 16, 72);
    if(lv.night && !locked){
      for(let k = 0; k < 9; k++) sparkle(x + 20 + (k * 47) % (cardW - 30), y + 48 + (k * 23) % 30, 2.2, 0.5 + 0.5 * Math.sin(t * 3 + k));
      ctx.fillStyle = '#fff4c8';
      ctx.beginPath(); ctx.arc(x + cardW - 32, y + 58, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a3a78';
      ctx.beginPath(); ctx.arc(x + cardW - 27, y + 54, 10, 0, TAU); ctx.fill();
    }
    // 锁住的关卡不剧透：卡面只留底色，由下面的挂锁遮罩盖住
    const types = locked ? [] : lv.types.map(tp => tp[0]);
    const iw = 46, step = Math.min(38, (cardW - 40) / Math.max(1, types.length - 1));
    const sx = x + cardW / 2 - (types.length - 1) * step / 2;
    for(let k = 0; k < types.length; k++){
      const bob = hover ? Math.sin(t * 6 + k) * 2 : 0;
      portrait(getIcon('head', types[k]), ZNAME[types[k]] || '僵', sx + k * step - iw / 2, y + 50 + bob, iw, 58, { color: '#7f9a6c', bottom: true });
    }
    ctx.restore();
    rr(x + 8, y + 40, cardW - 16, 72, 10);
    ctx.strokeStyle = 'rgba(255,240,190,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    drawText(lv.name, x + cardW / 2, y + 22, 17, '#fff8e0', 'rgba(0,0,0,0.55)', 4, 'center', '900');
    drawText('僵尸 × ' + lv.count + (lv.night ? '  ·  夜战' : '  ·  白天'), x + cardW / 2, y + 129, 14, lv.night ? '#c8d4ff' : '#c8f0b0', null, 0, 'center', '800');
    if(locked){
      ctx.fillStyle = 'rgba(8,12,14,0.72)';
      rr(x, y, cardW, cardH, 16); ctx.fill();
      // 金色挂锁
      const lx = x + cardW / 2, ly = y + 70;
      ctx.lineWidth = 7; ctx.strokeStyle = '#c8962e';
      ctx.beginPath(); ctx.arc(lx, ly - 4, 14, Math.PI, 0); ctx.stroke();
      rr(lx - 22, ly - 4, 44, 34, 7);
      const lg = ctx.createLinearGradient(0, ly - 4, 0, ly + 30);
      lg.addColorStop(0, '#ffe58a'); lg.addColorStop(1, '#b07a1c');
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = '#5a3a08'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#5a3a08'; ctx.beginPath(); ctx.arc(lx, ly + 10, 4.5, 0, TAU); ctx.fill();
      ctx.fillRect(lx - 2, ly + 10, 4, 10);
      drawText('通关上一关解锁', x + cardW / 2, y + 126, 13, '#d8d0b8', null, 0, 'center', '700');
    } else if(hover){
      gem(x + 14, y + 14, 5, '#ffe08a'); gem(x + cardW - 14, y + 14, 5, '#ffe08a');
    }
    ctx.restore();
  }

  drawButton(ui, W / 2 - 290, 450, 180, 52, '操作说明', 'help', { type: 'nav', state: 'help' }, { color: 'blue' });
  drawButton(ui, W / 2 - 90, 450, 180, 52, musicOn ? '音乐：开' : '音乐：关', 'music', { type: 'music', ensure: true }, { color: 'orange' });
  drawButton(ui, W / 2 + 110, 450, 180, 52, world.unlockAll ? '全部关卡：开' : '全部关卡：关', 'unlockall', { type: 'unlockAll' }, { size: 18, color: world.unlockAll ? 'green' : 'purple' });
  drawText('同人复刻 · 3D 模型、贴图与音乐均为程序生成 · 仅供个人学习娱乐', W / 2, H - 16, 12.5,
    'rgba(252,248,236,0.95)', 'rgba(10,20,10,0.85)', 3, 'center', '700');
}
