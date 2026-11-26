// 逻辑坐标（核心层用的 1024×640 像素平面）与 3D 世界坐标之间的换算。
//
// 约定：草坪左后角在原点，列沿 +X（1 列 = 1 单位），行沿 +Z（1 行 = ROW_D 单位，朝向镜头），
// 地面 y = 0，高度 1 单位 = 80 逻辑像素（与列宽同比例）。
// 核心层只认逻辑像素；这里是两套坐标唯一的换算点，模型、特效与拾取都从这里取数。
import { CH, CW, LX, LY, ROWS, COLS } from '../../core/constants.js';

export const ROW_D = 1.4;
export const PX = 1 / CW;                 // 1 逻辑像素对应的世界单位
export const LAWN_W = COLS, LAWN_D = ROWS * ROW_D;

export function toX(x){ return (x - LX) / CW; }
export function fromX(X){ return LX + X * CW; }
export function rowZ(r){ return (r + 0.5) * ROW_D; }
// 逻辑 y 在某一行里的「离地高度」：行的地面基线是 cellFY = LY + (r+1)*CH - 6。
export function heightIn(row, y){ return (LY + (row + 1) * CH - 6 - y) * PX; }
// 粒子没有行号：按出生时的 y 落在哪一行的带子里来归行。
export function rowOfY(y){ return Math.max(0, Math.min(ROWS - 1, Math.floor((y - LY) / CH))); }
// 地面点 → 逻辑坐标（拾取用）。Z 换算回行带，行内位置线性映射到 CH。
export function groundToLogical(X, Z){ return { x: fromX(X), y: LY + (Z / ROW_D) * CH }; }
