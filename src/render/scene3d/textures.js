// 程序生成的贴图：全部由 2D canvas 现场画出来，没有任何外部图片。
// 没有 document 的环境（Node 测试）返回 null，调用方按「无贴图」处理。
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { mulberry32 } from '../../core/rng.js';

function canvas(w, h){
  if(typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext && c.getContext('2d');
  if(!g || typeof g.fillRect !== 'function') return null;
  return { c, g };
}
function tex(cv, repeat){
  const t = new CanvasTexture(cv.c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  if(repeat){ t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// 径向软斑：接触阴影、光晕、粒子都用它
export function makeRadial(stops, size = 128){
  const cv = canvas(size, size); if(!cv) return null;
  const gr = cv.g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for(const [o, c] of stops) gr.addColorStop(o, c);
  cv.g.fillStyle = gr; cv.g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(cv.c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// 草地底色：细碎的明暗噪点 + 稀疏的草茎笔触
export function makeGrass(base = [86, 150, 52], seed = 7){
  const S = 256, cv = canvas(S, S); if(!cv) return null;
  const r = mulberry32(seed), g = cv.g;
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, S, S);
  for(let i = 0; i < 2600; i++){
    const k = (r() - 0.5) * 40;
    g.fillStyle = `rgba(${base[0] + k | 0},${base[1] + k * 1.3 | 0},${base[2] + k * 0.6 | 0},0.55)`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5);
  }
  g.lineWidth = 1.2;
  for(let i = 0; i < 900; i++){
    const x = r() * S, y = r() * S, l = 3 + r() * 6, k = r();
    g.strokeStyle = k > 0.5 ? 'rgba(170,225,110,0.35)' : 'rgba(30,70,20,0.35)';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke();
  }
  return tex(cv, [1, 1]);
}

// 木纹：门廊地板、栅栏、木桩
export function makeWood(base = [168, 118, 70], seed = 3){
  const W = 256, H = 256, cv = canvas(W, H); if(!cv) return null;
  const r = mulberry32(seed), g = cv.g;
  g.fillStyle = `rgb(${base.join(',')})`; g.fillRect(0, 0, W, H);
  for(let y = 0; y < H; y += 2){
    const k = Math.sin(y * 0.11 + Math.sin(y * 0.031) * 3) * 14 + (r() - 0.5) * 8;
    g.fillStyle = `rgba(${base[0] + k | 0},${base[1] + k | 0},${base[2] + k * 0.7 | 0},0.6)`;
    g.fillRect(0, y, W, 2);
  }
  for(let i = 0; i < 6; i++){
    const x = r() * W, y = r() * H;
    g.strokeStyle = 'rgba(70,40,15,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(x, y, 8 + r() * 10, 3 + r() * 3, 0, 0, Math.PI * 2); g.stroke();
  }
  return tex(cv, [1, 1]);
}

// 屋面瓦：交错的半圆瓦片
export function makeShingles(base = [150, 62, 48]){
  const S = 256, cv = canvas(S, S); if(!cv) return null;
  const g = cv.g, r = mulberry32(11);
  g.fillStyle = `rgb(${base.map(v => v * 0.6 | 0).join(',')})`; g.fillRect(0, 0, S, S);
  const rowH = 32, w = 32;
  for(let row = -1; row < S / rowH + 1; row++){
    for(let i = -1; i < S / w + 1; i++){
      const x = i * w + (row % 2 ? w / 2 : 0), y = row * rowH;
      const k = (r() - 0.5) * 30;
      const gr = g.createLinearGradient(0, y, 0, y + rowH);
      gr.addColorStop(0, `rgb(${base[0] + k + 20 | 0},${base[1] + k + 10 | 0},${base[2] + k | 0})`);
      gr.addColorStop(1, `rgb(${base[0] + k - 30 | 0},${base[1] + k - 20 | 0},${base[2] + k - 15 | 0})`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + rowH * 0.6);
      g.quadraticCurveTo(x + w / 2, y + rowH * 1.25, x, y + rowH * 0.6); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,10,5,0.45)'; g.lineWidth = 1.5; g.stroke();
    }
  }
  return tex(cv, [1, 1]);
}

// 外墙护墙板：横向长条，带一道道阴影
export function makeSiding(base = [236, 226, 200]){
  const S = 256, cv = canvas(S, S); if(!cv) return null;
  const g = cv.g;
  for(let y = 0; y < S; y += 32){
    const gr = g.createLinearGradient(0, y, 0, y + 32);
    gr.addColorStop(0, `rgb(${base.map(v => v - 34).join(',')})`);
    gr.addColorStop(0.18, `rgb(${base.join(',')})`);
    gr.addColorStop(1, `rgb(${base.map(v => v - 14).join(',')})`);
    g.fillStyle = gr; g.fillRect(0, y, S, 32);
  }
  return tex(cv, [1, 1]);
}

// 石板 / 沥青 / 人行道：块面 + 噪点
export function makeStone(base = [150, 145, 135], cell = 64, seed = 5, grout = 'rgba(60,55,50,0.7)'){
  const S = 256, cv = canvas(S, S); if(!cv) return null;
  const g = cv.g, r = mulberry32(seed);
  g.fillStyle = grout; g.fillRect(0, 0, S, S);
  for(let y = 0; y < S; y += cell){
    for(let x = 0; x < S; x += cell){
      const k = (r() - 0.5) * 26;
      g.fillStyle = `rgb(${base[0] + k | 0},${base[1] + k | 0},${base[2] + k | 0})`;
      g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    }
  }
  for(let i = 0; i < 2200; i++){
    const k = (r() - 0.5) * 50;
    g.fillStyle = `rgba(${base[0] + k | 0},${base[1] + k | 0},${base[2] + k | 0},0.5)`;
    g.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  return tex(cv, [1, 1]);
}

export function makeAsphalt(){
  const S = 256, cv = canvas(S, S); if(!cv) return null;
  const g = cv.g, r = mulberry32(21);
  g.fillStyle = '#4a4c52'; g.fillRect(0, 0, S, S);
  for(let i = 0; i < 6000; i++){
    const k = (r() - 0.5) * 60;
    g.fillStyle = `rgba(${74 + k | 0},${76 + k | 0},${82 + k | 0},0.6)`;
    g.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  return tex(cv, [1, 1]);
}
