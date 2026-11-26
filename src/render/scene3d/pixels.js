// 像素画笔：方块面贴图的常用画法。全部是确定性的（随机数由图集按 key 播种），
// 同一个 key 在任何机器上都画出同一张图。
import { hex, shade, mix } from './atlas.js';

// 带明暗噪点的纯色：方块游戏里「一种材质」的基本样子
export function noise(color, amp = 0.1){
  const base = typeof color === 'string' ? hex(color) : color;
  return (p, w, h, R) => {
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      p.px(x, y, shade(base, 1 + (R() - 0.5) * 2 * amp));
    }
  };
}

// 上亮下暗的竖向渐变 + 噪点（植物茎、躯干的环境遮蔽感）
export function ramp(top, bottom, amp = 0.07){
  const a = hex(top), b = hex(bottom);
  return (p, w, h, R) => {
    for(let y = 0; y < h; y++){
      const c = mix(a, b, h > 1 ? y / (h - 1) : 0);
      for(let x = 0; x < w; x++) p.px(x, y, shade(c, 1 + (R() - 0.5) * 2 * amp));
    }
  };
}

// 叠加：先画底，再画若干层
export function layers(...fns){
  return (p, w, h, R) => { for(const f of fns) f(p, w, h, R); };
}

// 边框：一圈更深的颜色（方块边缘的「描边」，在小尺寸下最能撑住轮廓）
export function frame(color, k = 0.72){
  const c = hex(color);
  return (p, w, h, R) => {
    for(let x = 0; x < w; x++){ p.px(x, 0, shade(c, k * 1.12)); p.px(x, h - 1, shade(c, k)); }
    for(let y = 0; y < h; y++){ p.px(0, y, shade(c, k * 1.05)); p.px(w - 1, y, shade(c, k)); }
  };
}

// 斑点：散落的小块（蘑菇伞上的白点、土豆坑、种子）
export function spots(color, n, size = 1, area = null){
  const c = typeof color === 'string' ? hex(color) : color;
  return (p, w, h, R) => {
    const [ax, ay, aw, ah] = area || [0, 0, w, h];
    for(let i = 0; i < n; i++){
      const x = ax + Math.floor(R() * (aw - size + 1)), y = ay + Math.floor(R() * (ah - size + 1));
      p.rect(x, y, size, size, shade(c, 0.92 + R() * 0.16));
    }
  };
}

// 按字符画：一行一个字符串，字符查调色板；'.' 透明（不画）
export function sprite(rows, pal, ox = 0, oy = 0){
  const P = {};
  for(const k of Object.keys(pal)) P[k] = typeof pal[k] === 'string' ? hex(pal[k]) : pal[k];
  return (p) => {
    for(let y = 0; y < rows.length; y++){
      const r = rows[y];
      for(let x = 0; x < r.length; x++){
        const ch = r[x];
        if(ch === '.' || ch === ' ') continue;
        const c = P[ch];
        if(c) p.px(ox + x, oy + y, c);
      }
    }
  };
}

// 居中放一个字符画（宽高按字符串推算）
export function centered(rows, pal, dy = 0){
  return (p, w, h) => {
    const sw = rows[0].length, sh = rows.length;
    sprite(rows, pal, Math.floor((w - sw) / 2), Math.floor((h - sh) / 2) + dy)(p);
  };
}

// 木板：横向三条，接缝深色
export function planks(color = '#b8945a'){
  const c = hex(color);
  return (p, w, h, R) => {
    for(let y = 0; y < h; y++){
      const row = Math.floor(y / 4);
      const k = 1 + ((row * 7) % 3 - 1) * 0.05;
      for(let x = 0; x < w; x++){
        const seam = y % 4 === 3 || ((x + row * 5) % 8 === 0 && y % 4 !== 3);
        p.px(x, y, shade(c, seam ? 0.7 : k * (1 + (R() - 0.5) * 0.08)));
      }
    }
  };
}

// 石砖 / 圆石：不规则块面，块缝深色
export function cobble(color = '#8a8a8a'){
  const c = hex(color);
  return (p, w, h, R) => {
    p.fill(shade(c, 0.62));
    let y = 0;
    while(y < h){
      const bh = 2 + Math.floor(R() * 3);
      let x = -Math.floor(R() * 3);
      while(x < w){
        const bw = 3 + Math.floor(R() * 4);
        const k = 0.85 + R() * 0.3;
        for(let yy = y; yy < Math.min(h, y + bh - 1); yy++) for(let xx = Math.max(0, x); xx < Math.min(w, x + bw - 1); xx++){
          p.px(xx, yy, shade(c, k * (1 + (R() - 0.5) * 0.08) * (yy === y ? 1.1 : 1)));
        }
        x += bw;
      }
      y += bh;
    }
  };
}

export function bricks(color = '#9a4a3a', mortar = '#bdb3a4'){
  const c = hex(color), m = hex(mortar);
  return (p, w, h, R) => {
    for(let y = 0; y < h; y++){
      const row = Math.floor(y / 4);
      for(let x = 0; x < w; x++){
        const joint = y % 4 === 3 || ((x + (row % 2) * 4) % 8 === 7);
        p.px(x, y, joint ? shade(m, 0.95 + R() * 0.1) : shade(c, 0.9 + R() * 0.2));
      }
    }
  };
}

// 原木侧面：竖向树皮纹
export function bark(color = '#6a4a2a'){
  const c = hex(color);
  return (p, w, h, R) => {
    for(let x = 0; x < w; x++){
      const k = 0.85 + ((x * 5) % 3) * 0.08;
      for(let y = 0; y < h; y++) p.px(x, y, shade(c, k * (1 + (R() - 0.5) * 0.18) * ((x + Math.floor(y / 3)) % 4 === 0 ? 0.75 : 1)));
    }
  };
}

// 年轮：原木 / 树桩的截面
export function rings(color = '#c8a06a', ringColor = '#9a7040'){
  const c = hex(color), r = hex(ringColor);
  return (p, w, h, R) => {
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const d = Math.hypot(x - cx, y - cy);
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      p.px(x, y, edge ? shade(hex('#6a4a2a'), 0.9 + R() * 0.2) : (Math.round(d) % 3 === 0 ? r : shade(c, 0.95 + R() * 0.1)));
    }
  };
}

// 叶子方块：深浅绿斑驳，有少量透明孔（配合 cutout 材质）
export function leaves(color = '#3f8a2c', holes = 0.12){
  const c = hex(color);
  return (p, w, h, R) => {
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const r = R();
      if(r < holes){ p.clear(x, y, 1, 1); continue; }
      p.px(x, y, shade(c, 0.7 + R() * 0.55));
    }
  };
}

// 十六进制颜色调明暗，返回十六进制（面贴图说明里要用字符串当 key）
export function tone(c, k){
  return '#' + shade(hex(c), k).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export { hex, shade, mix };
