// rng 由调用方显式传入：战斗读 world.rng，表现读 world.fxRng。
// 这里不提供默认随机源——默认值会让“以为分流了、其实还在走全局源”悄悄通过。
export function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
export function rand(rng,a,b){ return a + rng()*(b-a); }
export function randi(rng,a,b){ return Math.floor(rand(rng,a,b+1)); }
export function lerp(a,b,t){ return a+(b-a)*t; }
export function easeOut(t){ return 1-(1-t)*(1-t); }

export function isBlinking(t, ph){ const c = (t+ph)%3.8; return c < 0.12; }

export function shuffle(arr, rng = Math.random){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rng() * (i + 1));   // 等价于原 randi(0, i)
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
