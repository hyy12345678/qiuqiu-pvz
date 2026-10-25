// 波次生成：出怪时刻表。rng 可注入（默认 Math.random），便于用固定种子断言总数守恒等不变量。

function pickType(lv, prog, rng){
  const pool = lv.types.map(([t,w])=>{
    let ww = w;
    if(t==='bucket'||t==='vault') ww += prog*3;
    if(t==='cone') ww += prog*1.5;
    if(t==='newspaper') ww += prog*2;
    return [t, ww];
  });
  let sum = pool.reduce((a,p)=>a+p[1],0), r = rng()*sum;
  for(const [t,w] of pool){ if((r-=w) <= 0) return t; }
  return 'normal';
}

export function buildSpawns(lv, rng = Math.random){
  // rand 就地派生自 rng：出怪间隔与批量判定都跟着同一个随机源
  const rand = (a, b) => a + rng() * (b - a);
  const n = lv.count;
  const finalCount = Math.max(4, Math.round(n*0.33));
  const pre = n - finalCount;
  const ev = [];
  let t = 26, i = 0, spawned = 0;
  while(i < pre){
    const progress = i/pre;
    // 前期保持单只出怪，让玩家有时间布局
    let size = 1;
    if(progress > 0.15) size += (rng() < 0.26 + 0.3*progress ? 1 : 0);
    if(progress > 0.55) size += (rng() < 0.35 ? 1 : 0);
    size = Math.min(size, pre-i);
    for(let k=0;k<size;k++){
      // 前 3 只固定为普通僵尸，之后才逐渐出现其它种类
      const type = spawned < 3 ? 'normal' : pickType(lv, Math.max(0, progress-0.2), rng);
      ev.push({ t: t + k*0.9, type });
      spawned++;
    }
    i += size;
    t += rand(12,21) * (1 - 0.38*progress);
  }
  const finalT = Math.max(t+7, 90);
  ev.push({ t: finalT-3.2, announce:true });
  for(let k=0;k<finalCount;k++){
    ev.push({ t: finalT + k*0.4, type: k===0 ? 'flag' : pickType(lv, 1, rng) });
  }
  ev.sort((a,b)=>a.t-b.t);
  return { events:ev, total:n };
}
