// 选卡场景：卡槽、图鉴、僵尸预告与开始按钮。

import { W, H, TAU } from '../../core/constants.js';
import { PLANTS, PLANT_ORDER } from '../../core/data/plants.js';
import { LEVELS } from '../../core/data/levels.js';
import { addHotspot } from '../../ui/hotspots.js';
import { ctx } from '../target.js';
import { rr, O, drawText } from '../paint.js';
import { drawPlantIcon, ICON_FIT } from '../plant.js';
import { drawZombieHeadIcon } from '../zombie.js';
import { drawSunIcon } from '../hud.js';
import { drawButton } from './common.js';

export function renderSelect(t, world, ui){
  const lv = LEVELS[world.level];
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
    const s = world.slots[i];
    if(s){
      addHotspot(ui, x, y, slotW, slotH, 'slot'+i, { type:'slot', index:i });
      ctx.fillStyle = 'rgba(60,40,15,0.3)';
      const fit = ICON_FIT[s.type] || 1;
      ctx.beginPath(); ctx.ellipse(x+slotW/2, y+slotH-26, 18*fit, 4*fit, 0, 0, TAU); ctx.fill();
      drawPlantIcon(t, s.type, x+slotW/2, y+slotH-26, 0.6);
      drawText(PLANTS[s.type].name, x+slotW/2, y+13, 11, '#e8d2a0', null, 0, 'center', '700');
      drawText(String(PLANTS[s.type].cost), x+slotW/2, y+slotH-9, 11, '#ffd83d', null, 0, 'center', '700');
    } else {
      drawText(String(i+1), x+slotW/2, y+slotH/2, 22, 'rgba(232,210,160,0.25)', null, 0, 'center', '800');
    }
  }

  drawText('植物图鉴（点击加入队伍）', 200, 244, 15, '#e8d2a0', null, 0, 'left', '700');
  // 13 张卡。原来排 4 列 → 4+4+4+1，最后一张孤零零挂在最左边，
  // 右边还空出一大片。改成 5 列（5+5+3）并把每一行居中，剩余量看起来才像有意为之。
  // 列宽 104 / 间距 8：5 列共 552px，从 x=60 起排到 612，右侧还留 23px 给僵尸信息面板。
  // （用 108/12 时 5 列会顶到 664，把面板盖住。）
  const cw = 104, ch = 78, GAP_X = 8, COLS = 5, GRID_X = 60;
  const gridW = COLS*cw + (COLS-1)*GAP_X;
  for(let i=0;i<PLANT_ORDER.length;i++){
    const type = PLANT_ORDER[i];
    const def = PLANTS[type];
    const row = Math.floor(i/COLS);
    const inRow = Math.min(COLS, PLANT_ORDER.length - row*COLS);
    const rowIdx = i % COLS;
    const rowW = inRow*cw + (inRow-1)*GAP_X;
    const x = GRID_X + (gridW - rowW)/2 + rowIdx*(cw+GAP_X), y = 254 + row*(ch+6);
    const inTeam = world.slots.some(s=>s.type===type);
    const hover = ui.mouse.x>=x && ui.mouse.x<=x+cw && ui.mouse.y>=y && ui.mouse.y<=y+ch;
    addHotspot(ui, x, y, cw, ch, 'pick'+type, { type:'plantPick', plant:type });
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
    const fit = ICON_FIT[type] || 1;
    ctx.beginPath(); ctx.ellipse(x+cw/2, y+ch-26, 17*fit, 3.6*fit, 0, 0, TAU); ctx.fill();
    drawPlantIcon(t, type, x+cw/2, y+ch-24, 0.42);
    drawText(def.name, x+cw/2, y+13, 12, '#3c2a10', 'rgba(255,246,220,0.5)', 2, 'center', '800');
    drawSunIcon(t, x+24, y+ch-11, 0.3);
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
    // E22：铁门只吃非弹道伤害，必须明说——否则玩家会以为子弹"没生效"而不是"被挡住"。
    '铁门僵尸：铁门挡豌豆！用樱桃炸弹 / 土豆雷 / 火豌豆破门。',
    '旗帜僵尸：出现在总攻的最前线。',
    lv.night ? '夜战：天上不掉太阳，靠向日葵与阳光菇。' : '消灭全部僵尸即可过关，小心小推车。',
    '白天蘑菇会打盹，用咖啡豆点它唤醒。',
  ];
  for(let i2=0;i2<tips.length;i2++){
    drawText(tips[i2], zx+22, zy+88+i2*20, 12.5, '#d8c090', null, 0, 'left', '600');
  }

  // 图鉴排到第四行后左下角已被占满，返回键移到页头
  drawButton(ui, 56, 20, 128, 40, '返回', 'back', { type:'nav', state:'menu' }, { size:17 });
  drawButton(ui, W-286, H-88, 198, 46, world.slots.length ? '开 始 游 戏' : '请先选择植物', 'go',
    { type:'startQuiz' },
    { disabled: !world.slots.length, size:19 });
}
