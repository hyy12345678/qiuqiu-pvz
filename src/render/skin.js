// 界面皮肤（方块风）：面板、按钮、横幅、像素标题字、像素图标。所有 2D 界面元素都从这里取画法。
//
// 视觉语言：方块游戏的界面——硬边、切角、两像素的亮暗斜面（左上亮、右下暗）、黑色外框，
// 文字带一像素的硬投影。大标题用「像素字」：先用小字号画到离屏画布、把半透明边缘二值化，
// 再关掉平滑放大，于是中文也变成一格一格的方块字。
import { TAU } from '../core/constants.js';
import { ctx } from './target.js';
import { rr, drawText, UI_FONT } from './paint.js';

export const FONT = UI_FONT;

export const PALETTE = {
  green:  { top: '#8fe05a', mid: '#4cae2a', bot: '#2e7a18', lip: '#1a4a0c', ink: '#0e2a06' },
  orange: { top: '#ffc860', mid: '#e8901e', bot: '#b0600e', lip: '#5a2c04', ink: '#3a1a02' },
  red:    { top: '#ff8a7a', mid: '#d0382e', bot: '#982018', lip: '#4a0a06', ink: '#2a0402' },
  blue:   { top: '#9ad4ff', mid: '#3a8ad8', bot: '#1f5aa0', lip: '#0c2a58', ink: '#061838' },
  purple: { top: '#d4a8ff', mid: '#8a4ad8', bot: '#5a28a0', lip: '#2a0c58', ink: '#180638' },
  gray:   { top: '#bdbdbd', mid: '#8b8b8b', bot: '#6a6a6a', lip: '#373737', ink: '#1e1e1e' },
};

function shadow(blur, color, oy = 0){ ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy; }
function noShadow(){ ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }

// 两像素斜面：左上亮、右下暗（方块游戏界面的立体感全靠这一下）
function bevel(x, y, w, h, light, dark, t = 2){
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w - t, t); ctx.fillRect(x, y, t, h - t);
  ctx.fillStyle = dark;
  ctx.fillRect(x + t, y + h - t, w - t, t); ctx.fillRect(x + w - t, y + t, t, h - t);
}

// 面板：tone 决定底色（'jade' 深石绿、'night' 夜色、'wine' 失败、'cream' 浅色石面）
const TONES = {
  jade:  { fill: ['rgba(44,58,50,0.95)', 'rgba(26,36,30,0.96)'], light: 'rgba(150,190,160,0.55)', dark: 'rgba(0,0,0,0.55)', edge: '#0b0f0c' },
  night: { fill: ['rgba(40,44,84,0.95)', 'rgba(20,22,48,0.96)'], light: 'rgba(160,170,240,0.5)', dark: 'rgba(0,0,0,0.55)', edge: '#06070f' },
  wine:  { fill: ['rgba(80,28,34,0.95)', 'rgba(40,10,14,0.96)'], light: 'rgba(240,150,150,0.45)', dark: 'rgba(0,0,0,0.55)', edge: '#0f0304' },
  cream: { fill: ['rgba(198,198,198,0.98)', 'rgba(178,178,178,0.98)'], light: '#ffffff', dark: '#555555', edge: '#000000' },
};
export function panel(x, y, w, h, o = {}){
  const t = TONES[o.tone || 'jade'];
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.save();
  shadow(o.blur === undefined ? 18 : o.blur, 'rgba(0,0,0,0.5)', 6);
  ctx.fillStyle = t.edge;
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  noShadow();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, t.fill[0]); g.addColorStop(1, t.fill[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  bevel(x, y, w, h, t.light, t.dark, 3);
  if(o.corners !== false) for(const [cx, cy] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]]) gem(cx, cy, 3, '#ffe08a');
  ctx.restore();
}

// 小宝石：一颗像素钻石
export function gem(x, y, r, color = '#5ae8e0'){
  const s = Math.max(1, Math.round(r / 1.5));
  ctx.save();
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(x - s * 2, y - s, s * 4, s * 2); ctx.fillRect(x - s, y - s * 2, s * 2, s * 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - s, y - s, s * 2, s * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - s, y - s, s, s);
  ctx.restore();
}

// 方块按钮：彩色石面 + 斜面 + 黑框，悬停时亮一档、白框、微微上浮
export function candyButton(x, y, w, h, label, o = {}){
  const c = PALETTE[o.disabled ? 'gray' : (o.color || 'green')];
  const hover = o.hover && !o.disabled;
  x = Math.round(x); y = Math.round(y - (hover ? 2 : 0)); w = Math.round(w); h = Math.round(h);
  ctx.save();
  shadow(hover ? 14 : 8, hover ? 'rgba(255,240,150,0.6)' : 'rgba(0,0,0,0.45)', 3);
  ctx.fillStyle = hover ? '#ffffff' : '#000000';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 6);
  noShadow();
  ctx.fillStyle = c.lip; ctx.fillRect(x, y + h - 2, w, 4);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, hover ? c.top : c.mid); g.addColorStop(1, hover ? c.mid : c.bot);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h - 2);
  // 石面纹理：几道确定位置的暗块（不用随机数，绘制轨迹才稳定）
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for(let k = 0; k < Math.floor(w / 14); k++) ctx.fillRect(x + 4 + ((k * 37) % (w - 10)), y + 4 + ((k * 23) % Math.max(1, h - 12)), 4, 2);
  bevel(x, y, w, h - 2, 'rgba(255,255,255,0.45)', 'rgba(0,0,0,0.35)', 2);
  if(hover && o.t !== undefined){
    const sx = x + ((o.t * 220) % (w + 60)) - 30;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(Math.max(x, sx), y + 2, Math.max(0, Math.min(14, x + w - sx)), h - 6);
  }
  ctx.restore();
  const size = o.size || Math.round(h * 0.42);
  if(o.icon) o.icon(x + h * 0.55, y + h / 2);
  shadowText(label, x + w / 2 + (o.icon ? h * 0.22 : 0), y + h / 2, size, o.disabled ? '#d0d0d0' : '#ffffff', '#3f3f3f');
}

// 带一像素硬投影的文字（方块游戏的字就是这样）
export function shadowText(text, x, y, size, fill = '#ffffff', shade = '#3f3f3f', align = 'center', weight = '900'){
  const d = Math.max(1, Math.round(size / 10));
  drawText(text, x + d, y + d, size, shade, null, 0, align, weight);
  drawText(text, x, y, size, fill, null, 0, align, weight);
}

// ---- 像素字：小字号画到离屏 → 二值化 → 关平滑放大 ----
const PIXEL_CACHE = new Map();
let pixelOK = null;
function canPixel(){
  if(pixelOK !== null) return pixelOK;
  pixelOK = false;
  try {
    if(typeof document === 'undefined' || !document.createElement) return false;
    const c = document.createElement('canvas');
    const g = c.getContext && c.getContext('2d');
    // 记录型 Canvas 替身没有像素读写能力：这里用 in 探测，不会触发替身的「未登记 API」报错
    pixelOK = !!g && ('getImageData' in g) && ('putImageData' in g) && ('measureText' in g);
  } catch(e){ pixelOK = false; }
  return pixelOK;
}
// colors：[上半部颜色, 下半部颜色]；返回离屏画布（每个字形像素是 1×1）
function pixelBitmap(text, px, colors){
  const key = text + '|' + px + '|' + colors.join(',');
  let c = PIXEL_CACHE.get(key);
  if(c) return c;
  c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = '900 ' + px + 'px ' + UI_FONT;
  const w = Math.ceil(g.measureText(text).width) + 4, h = Math.ceil(px * 1.35) + 2;
  c.width = w; c.height = h;
  g.font = '900 ' + px + 'px ' + UI_FONT;
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#ffffff';
  g.fillText(text, 2, h / 2);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const top = hexRgb(colors[0]), bot = hexRgb(colors[1]);
  for(let y = 0; y < h; y++){
    const col = y < h * 0.52 ? top : bot;
    for(let x = 0; x < w; x++){
      const i = (y * w + x) * 4;
      if(d[i + 3] > 110){ d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; }
      else d[i + 3] = 0;
    }
  }
  g.putImageData(img, 0, 0);
  PIXEL_CACHE.set(key, c);
  return c;
}
function hexRgb(c){ const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// 像素字：cx, cy 居中；scale 每个字形像素放大几倍；o.face / o.edge / o.depth 控制颜色与立体厚度
export function pixelText(text, cx, cy, px, scale, o = {}){
  const face = o.face || ['#ffffff', '#d8d8d8'];
  const edge = o.edge || '#1a1a1a';
  const depth = o.depth === undefined ? 2 : o.depth;
  if(!canPixel()){
    // 记录替身 / 不支持像素读写：退回普通粗体字（只影响测试，浏览器里总是像素字）
    drawText(text, cx, cy + depth, px * scale, edge, null, 0, 'center', '900');
    drawText(text, cx, cy, px * scale, face[0], edge, Math.max(2, scale), 'center', '900');
    return;
  }
  const bmFace = pixelBitmap(text, px, face), bmEdge = pixelBitmap(text, px, [edge, edge]);
  const w = bmFace.width * scale, h = bmFace.height * scale;
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // 外描边：上下左右各偏一个字形像素；再往下叠 depth 层作厚度
  for(const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(bmEdge, x + dx * scale, y + dy * scale, w, h);
  for(let k = 1; k <= depth; k++) ctx.drawImage(bmEdge, x, y + k * scale, w, h);
  if(o.side) for(let k = 1; k < depth; k++) ctx.drawImage(pixelBitmap(text, px, [o.side, o.side]), x, y + k * scale, w, h);
  ctx.drawImage(bmFace, x, y, w, h);
  ctx.restore();
}

// 大标题：逐字像素字，波浪起伏
export function heroTitle(text, cx, cy, size, t, o = {}){
  const n = text.length;
  const gap = size * (o.gap || 0.98);
  const px = o.px || 22;
  const scale = Math.max(2, Math.round(size / px));
  const face = o.face ? [o.face[0], o.face[2] || o.face[1]] : ['#c8ff6a', '#5cc23a'];
  const edge = o.edge || '#0e2a06', side = o.side || '#2e7414';
  for(let i = 0; i < n; i++){
    const x = cx + (i - (n - 1) / 2) * gap;
    const y = cy + Math.round(Math.sin(t * 2.4 + i * 0.7) * size * 0.05 / scale) * scale;
    pixelText(text[i], x, y, px, scale, { face, edge, side, depth: 3 });
  }
}

// 横幅：一条带像素燕尾的彩色石条
export function ribbon(cx, cy, w, h, text, o = {}){
  const c = PALETTE[o.color || 'red'];
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  ctx.save();
  shadow(10, 'rgba(0,0,0,0.45)', 4);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  noShadow();
  for(const s of [-1, 1]){
    const ex = s < 0 ? x - h * 0.8 : x + w;
    ctx.fillStyle = '#000000'; ctx.fillRect(ex - 2, y + 4, h * 0.8 + 4, h);
    ctx.fillStyle = c.bot; ctx.fillRect(ex, y + 6, h * 0.8, h - 4);
    const nx = s < 0 ? ex : ex + h * 0.8 - h * 0.3;
    ctx.fillStyle = '#000000'; ctx.fillRect(nx, y + h * 0.5, h * 0.3, h * 0.3);
  }
  ctx.fillStyle = c.mid; ctx.fillRect(x, y, w, h);
  bevel(x, y, w, h, c.top, c.lip, 3);
  ctx.restore();
  shadowText(text, cx, cy + 1, o.size || Math.round(h * 0.52), '#ffffff', c.ink);
}

// 像素图案：rows 一行一个字符串，pal 调色板，每个字符画成 s×s 的方块
export function pix(rows, pal, x, y, s){
  for(let r = 0; r < rows.length; r++){
    const row = rows[r];
    for(let q = 0; q < row.length; q++){
      const ch = row[q];
      if(ch === '.' || !pal[ch]) continue;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x + q * s, y + r * s, s, s);
    }
  }
}

// 太阳图标：方形的像素太阳，外圈光芒一闪一闪
const SUN_ROWS = [
  '...y..y...',
  '..........',
  'y.oooooo.y',
  '..owwyyo..',
  '..owyyyo..',
  '..oyyyyo..',
  '..oyyyyo..',
  'y.oooooo.y',
  '..........',
  '...y..y...',
];
export function sunIcon(x, y, s, t = 0){
  const k = Math.max(1, Math.round(3 * s));
  const blink = Math.floor(t * 3) % 2;
  ctx.save();
  const halo = ctx.createRadialGradient(x, y, 2, x, y, 18 * s + 6);
  halo.addColorStop(0, 'rgba(255,230,120,0.75)'); halo.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = halo; ctx.fillRect(x - 18 * s - 6, y - 18 * s - 6, 36 * s + 12, 36 * s + 12);
  pix(SUN_ROWS, { y: blink ? '#ffe23a' : '#ffc020', o: '#ff9a10', w: '#fffbe0' }, Math.round(x - 5 * k), Math.round(y - 5 * k), k);
  ctx.restore();
}

// 铲子图标：像素铁铲
const SHOVEL_ROWS = [
  '.........kk',
  '........kwk',
  '.......kwk.',
  '......kbk..',
  '.....kbk...',
  '..kkkbk....',
  '.kssskk....',
  'ksswsk.....',
  'kswssk.....',
  'kssssk.....',
  '.kkkk......',
];
export function shovelIcon(x, y, s){
  const k = Math.max(1, Math.round(3 * s));
  pix(SHOVEL_ROWS, { k: '#1a1a1a', w: '#c89a5a', b: '#8a5a2a', s: '#c8d0d8', w2: '#ffffff' }, Math.round(x - 5.5 * k), Math.round(y - 5.5 * k), k);
}

// 3D 肖像（没有 WebGL 时是 null）：没有就画一个带首字的方章，保证卡片不会是空的
export function portrait(img, name, x, y, w, h, o = {}){
  if(img){
    const iw = img.width, ih = img.height;
    const k = Math.min(w / iw, h / ih);
    ctx.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / (o.bottom ? 1 : 2), iw * k, ih * k);
    return;
  }
  const r = Math.min(w, h) * 0.38;
  ctx.fillStyle = o.color || '#5cb444';
  ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r, 0, TAU); ctx.fill();
  drawText(name.slice(0, 1), x + w / 2, y + h / 2 + 1, r * 1.1, '#ffffff', 'rgba(0,0,0,0.5)', 3, 'center', '900');
}

// 全屏压暗：弹层底
export function dimmer(W, H, a = 0.55){
  ctx.fillStyle = 'rgba(8,10,12,' + Math.min(0.92, a * 1.1).toFixed(3) + ')';
  ctx.fillRect(0, 0, W, H);
}

// 星光：十字形像素闪光
export function sparkle(x, y, r, a){
  if(a <= 0 || r <= 0.5) return;
  const s = Math.max(1, Math.round(r / 3));
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - s / 2, y - s * 2.5, s, s * 5);
  ctx.fillRect(x - s * 2.5, y - s / 2, s * 5, s);
  ctx.restore();
}

export { drawText, rr };
