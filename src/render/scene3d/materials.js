// 材质：全场共用几种「材质类」，每个实体实例按类各持一份（受击闪白、冰冻染色要逐个改）。
//
// 观感目标是「上釉的软胶玩具」：顶点色给固有色，标准 PBR 给体积，环境贴图给高光，
// 再叠一圈菲涅尔轮廓光把角色从草地上剥出来——这是小尺寸下最有效的「冲击力」来源。
// 注意 Material.clone() 不会复制 onBeforeCompile，所以实例材质必须走 makeMaterial 重新造。
import { Color, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, DoubleSide } from 'three';

// 全场共享的轮廓光颜色与强度：昼夜切换时改这里，所有材质下一帧生效。
export const RIM = {
  color: { value: new Color('#fff4d6') },
  strength: { value: 0.55 },
};

function withRim(mat, k = 1){
  mat.onBeforeCompile = sh => {
    sh.uniforms.rimColor = RIM.color;
    sh.uniforms.rimStrength = RIM.strength;
    sh.uniforms.rimLocal = mat.userData.rimLocal;
    sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimLocal;\n'
      + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float rimD = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += rimColor * pow(rimD, 3.0) * rimStrength * rimLocal;
      }`);
  };
  mat.userData.rimLocal = { value: k };
  mat.customProgramCacheKey = () => 'rim-' + mat.type;
  return mat;
}

// 材质类：
//   m 哑光（皮肤、布料、木头）  g 釉面（豌豆、坚果、眼睛）  x 金属（铁桶、铁门、迪迦银色）
//   e 自发光（不受光照，颜色可超过 1 以触发泛光）  t 半透明（铁门纱网、幽灵预览）
export function makeMaterial(key){
  switch(key){
    case 'm': return withRim(new MeshStandardMaterial({ vertexColors:true, roughness:0.68, metalness:0 }));
    case 'g': return withRim(new MeshPhysicalMaterial({ vertexColors:true, roughness:0.32, metalness:0, clearcoat:0.9, clearcoatRoughness:0.18 }));
    case 'x': return withRim(new MeshStandardMaterial({ vertexColors:true, roughness:0.32, metalness:0.72 }), 0.6);
    case 'e': return new MeshBasicMaterial({ vertexColors:true, color:new Color(1.7, 1.7, 1.7) });
    case 't': return new MeshStandardMaterial({ vertexColors:true, roughness:0.4, metalness:0.6, transparent:true, opacity:0.45, side:DoubleSide, depthWrite:false });
    default: throw new Error('未知材质类 ' + key);
  }
}

export const MATERIAL_KEYS = ['m', 'g', 'x', 'e', 't'];

// 一个实例的一组材质。flash 把所有受光材质推向白色，tint 用于冰冻/焦黑，ghost 用于种植预览。
export function createMaterialSet({ ghost = false } = {}){
  const mats = {};
  for(const k of MATERIAL_KEYS){
    const m = makeMaterial(k);
    if(ghost){
      m.transparent = true; m.opacity = 0.48; m.depthWrite = false;
    }
    mats[k] = m;
  }
  const base = new Color(1, 1, 1);
  let lastFlash = -1, lastTint = '', lastFade = -1;
  return {
    mats,
    // 每帧调用一次即可；只在值变化时写材质，避免无谓的 uniform 上传。
    set(flash, tint, fade = 1){
      const tk = tint ? tint.getHexString() : '';
      if(flash === lastFlash && tk === lastTint && fade === lastFade) return;
      lastFlash = flash; lastTint = tk; lastFade = fade;
      for(const k of ['m', 'g', 'x']){
        const m = mats[k];
        m.color.copy(tint || base);
        m.emissive.setRGB(flash, flash, flash * 0.92);
      }
      if(!ghost){
        for(const k of MATERIAL_KEYS){
          const m = mats[k];
          const want = fade < 1;
          if(m.transparent !== (want || k === 't')){ m.transparent = want || k === 't'; m.needsUpdate = true; }
          m.opacity = k === 't' ? 0.45 * fade : fade;
        }
      }
    },
    dispose(){ for(const k of MATERIAL_KEYS) mats[k].dispose(); },
  };
}
