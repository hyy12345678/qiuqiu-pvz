// 镜头机位：逻辑分辨率 1024×640 下标定——战斗镜头让草坪落在顶部卡槽与底部进度条之间，
// 菜单镜头平视院子，角色站在画面下沿。世界视图在这两个机位之间做阻尼过渡。
import { PerspectiveCamera } from 'three';
import { W, H } from '../../core/constants.js';

export const CAMERA = {
  battle: { pos: [3.55, 11.6, 15.3], target: [3.15, 0, 3.2], fov: 26.7 },
  menu: { pos: [4.5, 2.2, 15], target: [4.5, 2.4, 0], fov: 32 },
};

// 静止机位（无开场摇镜、无震屏）。测试与工具用它把世界坐标换算到屏幕。
export function restCamera(mode = 'battle'){
  const c = CAMERA[mode];
  const cam = new PerspectiveCamera(c.fov, W / H, 0.3, 400);
  cam.position.set(...c.pos);
  cam.lookAt(...c.target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}
