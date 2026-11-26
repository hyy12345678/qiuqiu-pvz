// 无 WebGL 的 3D 视图替身：真实的 createWorldView（场景树同步、动画、特效、镜头全部照跑），
// 只是不调用渲染器，draw 返回一块假画布。界面层因此按真实路径贴底、画 HUD。
//
// 用它而不是空桩，是为了让场景测试顺带覆盖「世界 → 场景树」这条映射：
// 实体增删、昼夜切换、只读约定，都在每一帧真实发生。
import { createWorldView } from '../../src/render/scene3d/world-view.js';

export function headlessView3D(){
  const view = createWorldView();
  const canvas = { width: 1024, height: 640, label: '3D 画布' };
  const draws = [];
  return {
    view, canvas, draws,
    draw(mode, world, ui, t){
      draws.push(mode);
      view.update(mode, world, ui, t, 400);
      return canvas;
    },
  };
}
