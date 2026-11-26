// 像素图集：所有方块模型的面贴图都画进同一张画布，全场只有一张纹理。
//
// 方块风的关键是「纹素密度一致」：一个 8×8 像素的脸就分配 8×8 的图集区域，
// 一条 4×12 的胳膊就分配 4×12。于是放大后每个像素在屏幕上一样大，像真的方块游戏。
//
// 分配（打包）不依赖画布：Node 测试里没有 document，照样能算出每个面的 UV，
// 几何体在 Node 与浏览器里逐字节一致；只是不真的画像素。
import { CanvasTexture, NearestFilter, SRGBColorSpace, RepeatWrapping } from 'three';
import { mulberry32 } from '../../core/rng.js';

export const ATLAS_SIZE = 1024;
const PAD = 1;          // 区域之间留 1 像素，并把边缘像素外扩进去，避免采样时串色

let canvas = null, g = null, texture = null, triedCanvas = false;
const regions = new Map();
let shelfX = 0, shelfY = 0, shelfH = 0;

function ensureCanvas(){
  if(triedCanvas) return g;
  triedCanvas = true;
  if(typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas');
  c.width = ATLAS_SIZE; c.height = ATLAS_SIZE;
  const cg = c.getContext && c.getContext('2d');
  if(!cg || typeof cg.fillRect !== 'function') return null;
  canvas = c; g = cg;
  return g;
}

export function atlasTexture(){
  if(texture) return texture;
  if(!ensureCanvas()) return null;
  texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

// 简单的字符串哈希：给每个区域一个稳定的随机种子，同一个 key 永远画出同样的噪点
export function hashKey(s){
  let h = 2166136261 >>> 0;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

// 申请一块 w×h 像素的区域，并用 paint(px, w, h, rng) 画出来。同 key 只画一次。
// 返回 [u0, v0, u1, v1]（three 的 UV：v 向上）
export function region(key, w, h, paint){
  const hit = regions.get(key);
  if(hit) return hit.uv;
  if(shelfX + w + PAD * 2 > ATLAS_SIZE){ shelfX = 0; shelfY += shelfH; shelfH = 0; }
  if(shelfY + h + PAD * 2 > ATLAS_SIZE) throw new Error('像素图集已满：' + key);
  const x = shelfX + PAD, y = shelfY + PAD;
  shelfX += w + PAD * 2;
  shelfH = Math.max(shelfH, h + PAD * 2);
  const uv = [x / ATLAS_SIZE, 1 - (y + h) / ATLAS_SIZE, (x + w) / ATLAS_SIZE, 1 - y / ATLAS_SIZE];
  regions.set(key, { uv, x, y, w, h });
  const cg = ensureCanvas();
  if(cg && paint){
    cg.save();
    cg.translate(x, y);
    cg.beginPath(); cg.rect(-PAD, -PAD, w + PAD * 2, h + PAD * 2); cg.clip();
    paint(makePixels(cg, w, h), w, h, mulberry32(hashKey(key)));
    cg.restore();
    // 边缘外扩：把四条边各复制一像素到留白里
    cg.drawImage(canvas, x, y, w, 1, x, y - 1, w, 1);
    cg.drawImage(canvas, x, y + h - 1, w, 1, x, y + h, w, 1);
    cg.drawImage(canvas, x, y - 1, 1, h + 2, x - 1, y - 1, 1, h + 2);
    cg.drawImage(canvas, x + w - 1, y - 1, 1, h + 2, x + w, y - 1, 1, h + 2);
    if(texture) texture.needsUpdate = true;
  }
  return uv;
}

// 区域内的像素画笔：坐标都是区域内的整数像素
function makePixels(cg, w, h){
  const css = c => typeof c === 'string' ? c : 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  return {
    w, h,
    fill(c){ cg.fillStyle = css(c); cg.fillRect(0, 0, w, h); },
    px(x, y, c){ cg.fillStyle = css(c); cg.fillRect(x | 0, y | 0, 1, 1); },
    rect(x, y, rw, rh, c){ cg.fillStyle = css(c); cg.fillRect(x | 0, y | 0, rw | 0, rh | 0); },
    clear(x = 0, y = 0, rw = w, rh = h){ cg.clearRect(x, y, rw, rh); },
  };
}

// ---- 颜色工具 ----
export function hex(c){
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(rgb, k){ return [Math.min(255, rgb[0] * k), Math.min(255, rgb[1] * k), Math.min(255, rgb[2] * k)]; }
export function mix(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// 平铺用的独立小纹理（地面、路面这种大平面不能从图集里重复采样）
export function tileTexture(key, size, paint, repeat){
  if(typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const cg = c.getContext && c.getContext('2d');
  if(!cg || typeof cg.fillRect !== 'function') return null;
  paint(makePixels(cg, size, size), size, size, mulberry32(hashKey(key)));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter; t.minFilter = NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = RepeatWrapping;
  if(repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// 测试用：图集当前占用了多少
export function atlasStats(){ return { regions: regions.size, height: shelfY + shelfH }; }
