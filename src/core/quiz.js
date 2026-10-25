// 战前算数热身：题目生成。阳光结算（答对 ×2）在调用方，不在这里。

import { shuffle } from './util.js';

export function makeQuiz(rng = Math.random){
  // randi 就地派生自注入的 rng，保证整道题在给定 rng 下可复现
  const randi = (a, b) => Math.floor(a + rng() * (b - a + 1));
  const qs = [];
  for(let i=0;i<3;i++){
    let a, b, ans, text;
    if(rng() < 0.5){
      a = randi(30, 89);
      b = randi(10, a - 1);
      ans = a - b;
      text = a + ' − ' + b + ' = ?';
    } else {
      a = randi(20, 79);
      b = randi(11, 99 - a);
      ans = a + b;
      text = a + ' + ' + b + ' = ?';
    }
    const opts = [ans];
    let guard = 0;
    while(opts.length < 4 && guard++ < 200){
      let d = ans + randi(-9, 9);
      if(d < 0) d = ans + randi(1, 9);
      if(!opts.includes(d)) opts.push(d);
    }
    while(opts.length < 4) opts.push(ans + opts.length + 1);
    shuffle(opts, rng);
    qs.push({ text, answer: ans, options: opts });
  }
  return qs;
}
