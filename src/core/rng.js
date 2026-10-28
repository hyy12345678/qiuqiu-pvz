// 确定性伪随机源：同一 seed 必得同一序列，供背景预渲染、双随机流与测试复现使用。

export function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// 派生常量写死在这里：表现流与绘制流只能由 seed 决定，不能靠“谁先创建”“先调几次”分出差异。
export const FX_SEED_XOR = 0x9E3779B9;
export const DRAW_SEED_XOR = 0x51ED270B;

export function randomSeed(){ return (Math.random()*0x100000000) >>> 0; }
