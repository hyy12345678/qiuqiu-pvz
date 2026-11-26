// 柔和的径向贴图（接触阴影、光晕、焦痕）：方块风里仅有的几张非像素贴图，由 2D canvas 现场画出。
// 没有 document 的环境（Node 测试）返回 null，调用方按「无贴图」处理。
import { CanvasTexture, SRGBColorSpace } from 'three';

function canvas(w, h){
  if(typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext && c.getContext('2d');
  if(!g || typeof g.fillRect !== 'function') return null;
  return { c, g };
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
