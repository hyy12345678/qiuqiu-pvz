// 选卡场景：卡槽、植物图鉴、僵尸预告与开始按钮，压在 3D 菜单场景之上。
import { W, H, TAU } from '../../core/constants.js';
import { PLANTS, PLANT_ORDER } from '../../core/data/plants.js';
import { LEVELS } from '../../core/data/levels.js';
import { ZTYPES } from '../../core/data/zombies.js';
import { addHotspot } from '../../ui/hotspots.js';
import { hotRect, drawButton } from './common.js';
import { ctx } from '../target.js';
import { rr, drawText } from '../paint.js';
import { panel, dimmer, ribbon, portrait, sunIcon, gem } from '../skin.js';
import { getIcon } from '../icons.js';

const TIPS = {
  normal: '最基础的敌人',
  cone: '头顶路障，比较耐打',
  bucket: '铁桶护头，非常耐打',
  vault: '跑得快，会跳过第一株植物',
  newspaper: '报纸被打掉会暴怒加速',
  screen: '弹道伤害只剩 1/4，炸弹破门',
  flag: '总攻的领头人',
};

export function renderSelect(t, world, ui){
  const lv = LEVELS[world.level];
  dimmer(W, H, 0.5);
  panel(28, 64, W - 56, H - 84, { tone: lv.night ? 'night' : 'jade' });
  ribbon(W / 2, 64, 300, 42, '选 择 你 的 植 物', { color: 'green', size: 23 });
  drawText(lv.name + '　·　可携带 ' + lv.slots + ' 种植物' + (lv.night ? '　·　夜战：开局 +100 阳光' : ''), W / 2, 100, 15, '#f4ecd0', 'rgba(0,0,0,0.5)', 3, 'center', '800');

  // ---- 卡槽 ----
  const slotW = 72, slotH = 100;
  const sx0 = W / 2 - (lv.slots * (slotW + 10)) / 2 + 5;
  for(let i = 0; i < lv.slots; i++){
    const x = sx0 + i * (slotW + 10), y = 118;
    const s = world.slots[i];
    ctx.save();
    rr(x, y, slotW, slotH, 12);
    const g = ctx.createLinearGradient(0, y, 0, y + slotH);
    g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = s ? 'rgba(255,224,138,0.9)' : 'rgba(255,240,200,0.25)'; ctx.lineWidth = s ? 2.5 : 1.5; ctx.stroke();
    if(s){
      addHotspot(ui, x, y, slotW, slotH, 'slot' + i, { type: 'slot', index: i });
      const glow = ctx.createRadialGradient(x + slotW / 2, y + slotH * 0.55, 4, x + slotW / 2, y + slotH * 0.55, 46);
      glow.addColorStop(0, 'rgba(255,240,170,0.35)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = glow; ctx.fillRect(x, y, slotW, slotH);
      portrait(getIcon('plant', s.type), PLANTS[s.type].name, x + 4, y + 16, slotW - 8, slotH - 34, { bottom: true });
      drawText(PLANTS[s.type].name, x + slotW / 2, y + 11, 11, '#fff8e0', 'rgba(0,0,0,0.6)', 3, 'center', '800');
      sunIcon(x + 18, y + slotH - 10, 0.32, t);
      drawText(String(PLANTS[s.type].cost), x + slotW / 2 + 8, y + slotH - 10, 12, '#ffe58a', 'rgba(0,0,0,0.6)', 3, 'center', '900');
    } else {
      drawText(String(i + 1), x + slotW / 2, y + slotH / 2, 24, 'rgba(255,240,200,0.22)', null, 0, 'center', '900');
    }
    ctx.restore();
  }

  // ---- 植物图鉴：5 列，每行居中 ----
  drawText('植物图鉴 · 点击加入队伍', 60, 242, 14, '#ffe58a', 'rgba(0,0,0,0.5)', 3, 'left', '800');
  const cw = 104, ch = 78, GAP_X = 8, COLS = 5, GRID_X = 60;
  const gridW = COLS * cw + (COLS - 1) * GAP_X;
  let hovered = null;
  for(let i = 0; i < PLANT_ORDER.length; i++){
    const type = PLANT_ORDER[i];
    const def = PLANTS[type];
    const row = Math.floor(i / COLS);
    const inRow = Math.min(COLS, PLANT_ORDER.length - row * COLS);
    const rowW = inRow * cw + (inRow - 1) * GAP_X;
    const x = GRID_X + (gridW - rowW) / 2 + (i % COLS) * (cw + GAP_X), y = 254 + row * (ch + 6);
    const inTeam = world.slots.some(s => s.type === type);
    const hover = hotRect(ui, x, y, cw, ch, 'pick' + type, { type: 'plantPick', plant: type });
    if(hover) hovered = type;
    ctx.save();
    if(hover) ctx.translate(0, -3);
    ctx.shadowColor = inTeam ? 'rgba(140,255,90,0.6)' : hover ? 'rgba(255,220,120,0.55)' : 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = inTeam || hover ? 16 : 8; ctx.shadowOffsetY = 3;
    rr(x, y, cw, ch, 12);
    const bg = ctx.createLinearGradient(0, y, 0, y + ch);
    if(inTeam){ bg.addColorStop(0, '#3f8a34'); bg.addColorStop(1, '#1f5a1c'); }
    else { bg.addColorStop(0, hover ? '#3a6a62' : '#2c5450'); bg.addColorStop(1, '#14302e'); }
    ctx.fillStyle = bg; ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = inTeam ? '#b8ff7a' : hover ? '#ffe08a' : 'rgba(255,230,170,0.45)'; ctx.lineWidth = inTeam || hover ? 2.5 : 1.5; ctx.stroke();
    // 舞台光：肖像背后的一团暖光
    const sg = ctx.createRadialGradient(x + cw / 2, y + ch * 0.62, 2, x + cw / 2, y + ch * 0.62, 40);
    sg.addColorStop(0, 'rgba(255,246,200,0.38)'); sg.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(x, y, cw, ch);
    portrait(getIcon('plant', type), def.name, x + cw / 2 - 26, y + 14, 52, 58, { bottom: true });
    drawText(def.name, x + cw / 2, y + 11, 12, '#fff8e0', 'rgba(0,0,0,0.65)', 3, 'center', '900');
    // 价格徽章
    rr(x + 4, y + ch - 20, 46, 16, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    sunIcon(x + 13, y + ch - 12, 0.26, t);
    drawText(String(def.cost), x + 34, y + ch - 12, 11.5, '#ffe58a', null, 0, 'center', '900');
    if(inTeam){
      ctx.beginPath(); ctx.arc(x + cw - 14, y + 14, 10, 0, TAU);
      ctx.fillStyle = '#5ad62a'; ctx.fill();
      ctx.strokeStyle = '#0f3a06'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + cw - 19, y + 14); ctx.lineTo(x + cw - 15.5, y + 18); ctx.lineTo(x + cw - 9, y + 10); ctx.stroke();
    }
    if(def.life){
      rr(x + cw - 34, y + ch - 20, 30, 16, 8);
      ctx.fillStyle = 'rgba(40,120,220,0.85)'; ctx.fill();
      drawText(def.life + 's', x + cw - 19, y + ch - 12, 10.5, '#ffffff', null, 0, 'center', '900');
    }
    ctx.restore();
  }
  // 悬停说明
  if(hovered){
    const d = PLANTS[hovered];
    rr(60, 510, gridW, 30, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    drawText(d.name + '：' + d.desc + '　冷却 ' + d.cool + ' 秒', 60 + gridW / 2, 525, 13.5, '#fff4d0', null, 0, 'center', '700');
  }

  // ---- 本关僵尸 ----
  const zx = 640, zy = 254;
  drawText('本关出没的僵尸', zx + 165, zy - 12, 14, '#ffe58a', 'rgba(0,0,0,0.5)', 3, 'center', '800');
  ctx.save();
  rr(zx, zy, 330, 248, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,170,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  const types = lv.types.map(tp => tp[0]).concat(['flag']);
  for(let k = 0; k < types.length; k++){
    const col = k % 2, row = Math.floor(k / 2);
    const x = zx + 12 + col * 160, y = zy + 10 + row * 58;
    portrait(getIcon('head', types[k]), ZTYPES[types[k]].name, x, y, 46, 54, { color: '#7f9a6c' });
    drawText(ZTYPES[types[k]].name, x + 52, y + 18, 13, '#fff8e0', null, 0, 'left', '900');
    drawText(TIPS[types[k]] || '', x + 52, y + 38, 10.5, '#c8dcc0', null, 0, 'left', '700');
  }
  if(types.length < 8){
    const tip = lv.night ? '夜战：天上不掉太阳，靠向日葵与阳光菇' : '白天蘑菇会打盹，用咖啡豆唤醒它';
    drawText(tip, zx + 165, zy + 232, 11.5, '#ffe58a', null, 0, 'center', '700');
  }
  gem(zx + 8, zy + 8, 3.5); gem(zx + 322, zy + 8, 3.5);

  drawButton(ui, 56, 20, 128, 40, '返回', 'back', { type: 'nav', state: 'menu' }, { size: 17, color: 'blue' });
  drawButton(ui, W - 286, H - 88, 198, 52, world.slots.length ? '开 始 战 斗' : '请先选择植物', 'go',
    { type: 'startQuiz' }, { disabled: !world.slots.length, size: 20, color: 'orange' });
}
