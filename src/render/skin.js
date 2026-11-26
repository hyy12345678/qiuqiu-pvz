// 界面皮肤：面板、按钮、徽章、标题字。所有 2D 界面元素都从这里取画法，换风格只改这一个文件。
//
// 视觉语言：深色琉璃面板 + 金色描边（压在 3D 场景上仍然读得清），
// 糖果感的厚按钮（下沿有一道「侧壁」，按下去像真的按钮），粗描边白字。
import { TAU } from '../core/constants.js';
import { ctx } from './target.js';
import { rr, drawText } from './paint.js';

export const FONT = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif';

export const PALETTE = {
  green:  { top: '#9ff05a', mid: '#4cc22a', bot: '#2a8a18', lip: '#17580c', ink: '#0f3a06' },
  orange: { top: '#ffd36a', mid: '#ff9a1e', bot: '#e0620e', lip: '#8a3404', ink: '#5a2002' },
  red:    { top: '#ff9a8a', mid: '#f0443a', bot: '#b8221c', lip: '#6a0c08', ink: '#4a0604' },
  blue:   { top: '#a8e4ff', mid: '#3aa6f0', bot: '#1a6ac0', lip: '#0c3a72', ink: '#06224a' },
  purple: { top: '#e0b8ff', mid: '#9a5ae8', bot: '#6430b8', lip: '#38166e', ink: '#220a48' },
  gray:   { top: '#c8ccd0', mid: '#8a9096', bot: '#5c6268', lip: '#33373c', ink: '#1e2124' },
};

function shadow(blur, color, oy = 0){
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy;
}
function noShadow(){ ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }

function goldStroke(y0, y1){
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.3, '#f0c552'); g.addColorStop(0.65, '#b07a1c'); g.addColorStop(1, '#ffe08a');
  return g;
}

// 琉璃面板：tone 决定底色（'jade' 默认、'night' 夜色、'wine' 失败、'cream' 浅色纸面）
const TONES = {
  jade:  ['rgba(30,74,60,0.93)', 'rgba(10,34,30,0.95)', 'rgba(150,255,210,0.16)'],
  night: ['rgba(40,44,96,0.93)', 'rgba(14,16,46,0.95)', 'rgba(170,190,255,0.18)'],
  wine:  ['rgba(92,26,40,0.94)', 'rgba(34,8,16,0.96)', 'rgba(255,170,180,0.16)'],
  cream: ['rgba(255,248,226,0.97)', 'rgba(236,214,166,0.97)', 'rgba(255,255,255,0.6)'],
};
export function panel(x, y, w, h, o = {}){
  const r = o.r || 18;
  const tone = TONES[o.tone || 'jade'];
  ctx.save();
  shadow(o.blur === undefined ? 26 : o.blur, 'rgba(0,0,0,0.5)', 8);
  rr(x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tone[0]); g.addColorStop(1, tone[1]);
  ctx.fillStyle = g; ctx.fill();
  noShadow();
  // 上半部的柔光，像玻璃里映着天空
  ctx.save();
  rr(x, y, w, h, r); ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 120));
  gl.addColorStop(0, tone[2]); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, y, w, Math.min(h, 120));
  ctx.restore();
  // 双线描边：外金内暗
  rr(x, y, w, h, r);
  ctx.strokeStyle = goldStroke(y, y + h); ctx.lineWidth = o.lw || 3.5; ctx.stroke();
  rr(x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5));
  ctx.strokeStyle = o.tone === 'cream' ? 'rgba(160,110,40,0.35)' : 'rgba(255,240,190,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
  if(o.corners !== false) for(const [cx, cy] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) gem(cx, cy, 4.2, '#ffe08a');
  ctx.restore();
}

// 小宝石：面板四角与徽章上的点缀
export function gem(x, y, r, color = '#ffe08a'){
  ctx.save();
  ctx.translate(x, y); ctx.rotate(TAU / 8);
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, color); g.addColorStop(1, '#8a5a10');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

// 糖果按钮。state：{ hover, pressed, disabled }；color：PALETTE 的键
export function candyButton(x, y, w, h, label, o = {}){
  const c = PALETTE[o.disabled ? 'gray' : (o.color || 'green')];
  const lift = o.hover && !o.disabled ? 2 : 0;
  const lipH = Math.max(4, Math.round(h * 0.12));
  const r = o.r === undefined ? h / 2 : o.r;
  ctx.save();
  // 落地阴影 + 侧壁
  shadow(o.hover && !o.disabled ? 18 : 10, o.hover && !o.disabled ? 'rgba(255,230,120,0.55)' : 'rgba(0,0,0,0.45)', 3);
  rr(x, y + lipH - lift, w, h, r);
  ctx.fillStyle = c.lip; ctx.fill();
  noShadow();
  const yy = y - lift;
  rr(x, yy, w, h, r);
  const g = ctx.createLinearGradient(0, yy, 0, yy + h);
  g.addColorStop(0, c.top); g.addColorStop(0.5, c.mid); g.addColorStop(1, c.bot);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = c.ink; ctx.lineWidth = 2.5; ctx.stroke();
  // 顶部高光带
  ctx.save();
  rr(x, yy, w, h, r); ctx.clip();
  const hg = ctx.createLinearGradient(0, yy, 0, yy + h * 0.5);
  hg.addColorStop(0, 'rgba(255,255,255,0.75)'); hg.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = hg;
  rr(x + 6, yy + 3, w - 12, h * 0.42, Math.max(2, r - 4)); ctx.fill();
  // 扫光：悬停时一道斜光掠过
  if(o.hover && !o.disabled && o.t !== undefined){
    const sx = x - 40 + ((o.t * 260) % (w + 120));
    const sg = ctx.createLinearGradient(sx, 0, sx + 40, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx, yy, 40, h);
  }
  ctx.restore();
  ctx.restore();
  const size = o.size || Math.round(h * 0.42);
  if(o.icon) o.icon(x + h * 0.55, yy + h / 2);
  drawText(label, x + w / 2 + (o.icon ? h * 0.22 : 0), yy + h / 2 + 1, size, o.disabled ? '#e6e6e6' : '#ffffff', c.ink, Math.max(3, size * 0.22), 'center', '900');
}

// 大标题：逐字挤出（8 层叠影）+ 渐变面 + 粗描边，波浪起伏
export function heroTitle(text, cx, cy, size, t, o = {}){
  const gap = size * (o.gap || 0.98);
  const n = text.length;
  const depth = o.depth || Math.round(size * 0.12);
  ctx.save();
  ctx.font = '900 ' + size + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for(let i = 0; i < n; i++){
    const x = cx + (i - (n - 1) / 2) * gap;
    const y = cy + Math.sin(t * 2.4 + i * 0.7) * size * 0.06;
    const rot = Math.sin(t * 1.7 + i * 1.3) * 0.05;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    // 投影
    shadow(size * 0.35, 'rgba(0,0,0,0.45)', size * 0.14);
    ctx.fillStyle = o.edge || '#1d4a0c';
    ctx.lineWidth = size * 0.2; ctx.strokeStyle = o.edge || '#1d4a0c';
    ctx.strokeText(text[i], 0, depth);
    noShadow();
    // 侧面挤出
    for(let k = depth; k > 0; k--){
      ctx.strokeStyle = k > depth / 2 ? (o.edge || '#1d4a0c') : (o.side || '#2e7414');
      ctx.strokeText(text[i], 0, k);
    }
    // 正面
    ctx.lineWidth = size * 0.13; ctx.strokeStyle = o.rim || '#fffbe0';
    ctx.strokeText(text[i], 0, 0);
    const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.45);
    const fc = o.face || ['#fbffd8', '#c8f55a', '#62c21e', '#2f8a10'];
    g.addColorStop(0, fc[0]); g.addColorStop(0.35, fc[1]); g.addColorStop(0.62, fc[2]); g.addColorStop(1, fc[3]);
    ctx.fillStyle = g;
    ctx.fillText(text[i], 0, 0);
    // 字面上沿的一道亮光
    ctx.save();
    ctx.beginPath(); ctx.rect(-size, -size, size * 2, size * 0.78); ctx.clip();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    ctx.restore();
  }
  ctx.restore();
}

// 丝带横幅
export function ribbon(cx, cy, w, h, text, o = {}){
  const c = PALETTE[o.color || 'red'];
  ctx.save();
  shadow(10, 'rgba(0,0,0,0.4)', 4);
  for(const s of [-1, 1]){
    ctx.beginPath();
    const ex = cx + s * (w / 2 - 6), tx = cx + s * (w / 2 + h * 0.7);
    ctx.moveTo(ex, cy - h / 2 + 6); ctx.lineTo(tx, cy - h / 2 + 6); ctx.lineTo(tx - s * h * 0.35, cy + 6); ctx.lineTo(tx, cy + h / 2 + 6); ctx.lineTo(ex, cy + h / 2 + 6); ctx.closePath();
    ctx.fillStyle = c.bot; ctx.fill();
  }
  noShadow();
  rr(cx - w / 2, cy - h / 2, w, h, 6);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, c.top); g.addColorStop(0.45, c.mid); g.addColorStop(1, c.bot);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(cx - w / 2 + 6, cy - h / 2 + 3, w - 12, h * 0.25);
  ctx.restore();
  drawText(text, cx, cy + 1, o.size || Math.round(h * 0.52), '#fffaf0', c.ink, 4, 'center', '900');
}

// 太阳图标：发光核 + 两圈光芒（会慢慢转）
export function sunIcon(x, y, s, t = 0){
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  halo.addColorStop(0, 'rgba(255,240,150,0.9)'); halo.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
  ctx.rotate(t * 0.6);
  for(let k = 0; k < 12; k++){
    ctx.rotate(TAU / 12);
    ctx.beginPath(); ctx.moveTo(-4.2, -13); ctx.lineTo(0, k % 2 ? -21 : -24); ctx.lineTo(4.2, -13); ctx.closePath();
    ctx.fillStyle = k % 2 ? '#ffb21e' : '#ffd23a'; ctx.fill();
  }
  ctx.rotate(-t * 0.6);
  const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 15);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffd84a'); g.addColorStop(1, '#ff9a10');
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(170,80,0,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-4.5, -6, 4.5, 2.6, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// 铲子图标
export function shovelIcon(x, y, s){
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.7); ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, 4);
  ctx.strokeStyle = '#3a2208'; ctx.lineWidth = 9; ctx.stroke();
  const hg = ctx.createLinearGradient(-4, 0, 4, 0);
  hg.addColorStop(0, '#e0a868'); hg.addColorStop(1, '#8a5420');
  ctx.strokeStyle = hg; ctx.lineWidth = 5.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -28, 6.5, 0, TAU);
  ctx.fillStyle = '#c8843c'; ctx.fill(); ctx.strokeStyle = '#3a2208'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11, 2); ctx.lineTo(11, 2); ctx.lineTo(10, 18); ctx.quadraticCurveTo(0, 30, -10, 18); ctx.closePath();
  const bg = ctx.createLinearGradient(-11, 0, 11, 24);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.35, '#c8d2dc'); bg.addColorStop(1, '#68727c');
  ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = '#2a3036'; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-7, 5, 3, 11);
  ctx.restore();
}

// 3D 肖像（没有 WebGL 时是 null）：没有就画一个带首字的圆章，保证卡片不会是空的
export function portrait(img, name, x, y, w, h, o = {}){
  if(img){
    const iw = img.width, ih = img.height;
    const k = Math.min(w / iw, h / ih);
    ctx.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / (o.bottom ? 1 : 2), iw * k, ih * k);
    return;
  }
  const r = Math.min(w, h) * 0.38;
  ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r, 0, TAU);
  ctx.fillStyle = o.color || '#5cb444'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  drawText(name.slice(0, 1), x + w / 2, y + h / 2 + 1, r * 1.1, '#ffffff', 'rgba(0,0,0,0.5)', 3, 'center', '900');
}

// 全屏压暗 + 中心透光：弹层底
export function dimmer(W, H, a = 0.55){
  const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, 'rgba(6,14,12,' + (a * 0.6).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(4,8,8,' + Math.min(0.95, a * 1.35).toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// 星光：标题、胜利面板上闪烁的四角星
export function sparkle(x, y, r, a){
  if(a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.quadraticCurveTo(0, 0, 0, r); ctx.quadraticCurveTo(0, 0, -r, 0); ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
}

export { drawText, rr };
