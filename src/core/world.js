// 游戏世界状态与关卡流程：状态机的唯一持有者。渲染与输入都读它，只有这里写它。
// P3a 只做搬迁（G 仍是模块级单例）；P3b 之后才讨论要不要把 world 显式传给 simulation。

import { COLS, LX, ROWS } from './constants.js';
import { LEVELS } from './data/levels.js';
import { loadUnlocked } from './persist.js';
import { makeQuiz } from './quiz.js';
import { buildSpawns } from './waves.js';
import { SFX } from '../audio/sfx.js';

export const G = {
  state:'menu',           // menu | help | select | play | won | lost
  level:0, unlocked:loadUnlocked(),
  paused:false,
  t:0,                    // 关卡时钟（负数为开场白）
  sun:50, sunFlash:0,
  slots:[],
  sel:-1, shovel:false,
  grid:null, plants:[], zombies:[], peas:[], suns:[], mowers:[], parts:[], decals:[],
  events:[], evIdx:0, total:0, killed:0,
  skyTimer:5, groanTimer:4, lastRows:[],
  waveText:null, nightHint:0,
  winT:0, loseZombie:null,
  shake:0, flash:0, quiz:null,
  hoverCell:null, mouse:{x:-99,y:-99},
  hotspots:[],
};

export function startLevel(li){
  G.level = li;
  G.state = 'select';
  G.slots = [];
  G.sel = -1; G.shovel = false;
  SFX.click();
}

export function beginPlay(startSun){
  startSun = (startSun === undefined) ? 50 : startSun;
  const lv = LEVELS[G.level];
  if(lv.night) startSun += 100;   // 夜战没有天降太阳，开局多给一些补偿
  G.state = 'play';
  G.paused = false;
  G.t = -3.2;
  G.sun = startSun; G.sunFlash = 0;
  G.grid = Array.from({length:ROWS}, ()=>Array(COLS).fill(null));
  G.plants=[]; G.zombies=[]; G.peas=[]; G.suns=[]; G.parts=[]; G.decals=[];
  G.lastRows = [];
  G.mowers = Array.from({length:ROWS}, (_,r)=>({row:r, x:LX-52, state:'idle'}));
  G.slots = G.slots.map(s=>({type:s.type, cool:0}));
  const built = buildSpawns(lv);
  G.events = built.events; G.total = built.total;
  G.evIdx = 0; G.killed = 0;
  G.skyTimer = 2; G.groanTimer = 4;
  G.waveText = null; G.winT = 0; G.loseZombie = null;
  G.nightHint = lv.night ? 8 : 0;
  G.sel = -1; G.shovel = false;
  G.shake = 0; G.flash = 0;
  SFX.click();
}

export function startQuiz(){
  G.state = 'quiz';
  G.quiz = { idx: 0, energy: 50, questions: makeQuiz(), feedback: 0, correct: true };
  SFX.click();
}
export function answerQuiz(a){
  if(G.state !== 'quiz' || G.quiz.feedback > 0) return;
  const q = G.quiz;
  if(a === q.questions[q.idx].answer){
    q.energy *= 2;
    q.correct = true;
    SFX.select();
  } else {
    q.correct = false;
    SFX.error();
  }
  q.feedback = 0.9;
}
export function updateQuiz(dt){
  const q = G.quiz;
  if(q.feedback > 0){
    q.feedback -= dt;
    if(q.feedback <= 0){
      if(q.correct && q.idx < 2){ q.idx++; q.feedback = 0; }
      else { beginPlay(q.energy); }
    }
  }
}
