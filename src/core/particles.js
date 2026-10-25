// 粒子与焦痕：只往 G.parts / G.decals 里塞数据，绘制由渲染层负责。

import { rand } from './util.js';
import { G } from './world.js';

export function addLeafBurst(x,y){
  for(let k=0;k<12;k++) G.parts.push({ x, y:y+rand(-14,14), vx:rand(-80,80), vy:rand(-130,-20), g:270, life:rand(0.35,0.75), max:0.75, size:rand(3,6), color:['#63b23f','#8fd44a','#4a9330'][k%3] });
}
export function addDirtPuff(x,y){
  for(let k=0;k<9;k++) G.parts.push({ x:x+rand(-16,16), y, vx:rand(-45,45), vy:rand(-100,-30), g:280, life:rand(0.3,0.6), max:0.6, size:rand(3,6), color:['#8a6b42','#a5875a'][k%2] });
}
export function addFlamePuff(x,y){
  for(let k=0;k<6;k++) G.parts.push({ x, y, vx:rand(-35,35), vy:rand(-80,-20), g:-50, life:rand(0.2,0.45), max:0.45, size:rand(2,5), color:['#ffb347','#ff8a2e'][k%2] });
}
// 报纸被撕碎飞散
export function addPaperShreds(x, y){
  for(let k=0;k<14;k++) G.parts.push({ x:x+rand(-10,10), y:y+rand(-12,12), vx:rand(-110,70), vy:rand(-140,-30), g:260,
    life:rand(0.45,0.95), max:0.95, size:rand(3,6), color:['#f4f0e2','#ded8c4','#c9c2ac'][k%3] });
  for(let k=0;k<4;k++) G.parts.push({ x:x+rand(-8,8), y:y+rand(-6,6), vx:rand(-40,40), vy:rand(-60,-20), g:200,
    life:rand(0.3,0.6), max:0.6, size:rand(2,3.5), color:'#5a5a52' });
}
export function addPeaSplat(x,y,type){
  const cols = type==='snow' ? ['#bfe9ff','#8fd0f2'] : (type==='fire' ? ['#ff9a2e','#ffd23e'] : (type==='ball' ? ['#e8483c','#ffd23e'] : (type==='bullet' ? ['#e8edf2','#8d949c'] : ['#8fd44a','#b8e88a'])));
  for(let k=0;k<9;k++) G.parts.push({ x, y, vx:rand(-100,100), vy:rand(-100,45), g:250, life:rand(0.2,0.45), max:0.45, size:rand(2,5.5), color:cols[k%2] });
}

