// rng 作为参数注入（默认 Math.random）：需要可复现随机的模块（core/quiz.js、core/waves.js）
// 必须把自己收到的 rng 一路透传到底，否则调用方以为注入了、其实一半还在走全局随机源。
export function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
export function rand(a,b){ return a + Math.random()*(b-a); }
export function randi(a,b){ return Math.floor(rand(a,b+1)); }
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
