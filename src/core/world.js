// 世界工厂与关卡流程：每个实例持有自己的状态。装配层创建实例并显式传入，核心不持有单例。
// R1b：createWorld() 取代模块级 G；渲染与输入仍只通过传入的实例读写状态。

import { COLS, LX, ROWS } from './constants.js';
import { LEVELS } from './data/levels.js';
import { loadUnlocked, loadUnlockAll, saveUnlockAll } from './persist.js';
import { makeQuiz } from './quiz.js';
import { buildSpawns } from './waves.js';
import { SFX } from '../audio/sfx.js';

export function createWorld(init = {}){
  return {
    state:'menu',           // menu | help | select | play | won | lost
    level:0, unlocked: init.unlocked === undefined ? loadUnlocked() : init.unlocked,
    unlockAll: init.unlockAll === undefined ? loadUnlockAll() : init.unlockAll,   // 主页特殊开关：打开后所有关卡直接进入
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
}

export function startLevel(world, li){
  world.level = li;
  world.state = 'select';
  world.slots = [];
  world.sel = -1; world.shovel = false;
  SFX.click();
}

// 昼夜判定：背景、天降太阳、蘑菇是否打盹都读这一处
export function isNight(world){ return !!(LEVELS[world.level] && LEVELS[world.level].night); }

// 主页的特殊开关：打开后所有关卡都能直接进，关掉则回到真实进度（真实进度始终单独保存）
export function toggleUnlockAll(world){
  world.unlockAll = !world.unlockAll;
  saveUnlockAll(world.unlockAll);
  SFX.click();
}

export function beginPlay(world, startSun){
  startSun = (startSun === undefined) ? 50 : startSun;
  const lv = LEVELS[world.level];
  if(lv.night) startSun += 100;   // 夜战没有天降太阳，开局多给一些补偿
  world.state = 'play';
  world.paused = false;
  world.t = -3.2;
  world.sun = startSun; world.sunFlash = 0;
  world.grid = Array.from({length:ROWS}, ()=>Array(COLS).fill(null));
  world.plants=[]; world.zombies=[]; world.peas=[]; world.suns=[]; world.parts=[]; world.decals=[];
  world.lastRows = [];
  world.mowers = Array.from({length:ROWS}, (_,r)=>({row:r, x:LX-52, state:'idle'}));
  world.slots = world.slots.map(s=>({type:s.type, cool:0}));
  const built = buildSpawns(lv);
  world.events = built.events; world.total = built.total;
  world.evIdx = 0; world.killed = 0;
  world.skyTimer = 2; world.groanTimer = 4;
  world.waveText = null; world.winT = 0; world.loseZombie = null;
  world.nightHint = lv.night ? 8 : 0;
  world.sel = -1; world.shovel = false;
  world.shake = 0; world.flash = 0;
  SFX.click();
}

export function startQuiz(world){
  world.state = 'quiz';
  world.quiz = { idx: 0, energy: 50, questions: makeQuiz(), feedback: 0, correct: true };
  SFX.click();
}
export function answerQuiz(world, a){
  if(world.state !== 'quiz' || world.quiz.feedback > 0) return;
  const q = world.quiz;
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
export function updateQuiz(world, dt){
  const q = world.quiz;
  if(q.feedback > 0){
    q.feedback -= dt;
    if(q.feedback <= 0){
      if(q.correct && q.idx < 2){ q.idx++; q.feedback = 0; }
      else { beginPlay(world, q.energy); }
    }
  }
}
