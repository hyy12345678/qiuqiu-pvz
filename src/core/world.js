// 世界工厂与关卡流程：每个实例持有自己的状态。装配层创建实例并显式传入，核心不持有单例。
// R1b：createWorld() 取代模块级 G；渲染与输入仍只通过传入的实例读写状态。
// R2a：每个世界带两条互不影响的随机流——rng 决定战斗，fxRng 只影响表现。
// R2b：声音 / 存档走注入的 ports；粒子与震屏等收进 world.visual。

import { COLS, LX, ROWS } from './constants.js';
import { LEVELS } from './data/levels.js';
import { createPorts } from './ports.js';
import { FX_SEED_XOR, mulberry32, randomSeed } from './rng.js';
import { makeQuiz } from './quiz.js';
import { buildSpawns } from './waves.js';

export function createWorld(init = {}){
  const seed = init.seed === undefined ? randomSeed() : (init.seed >>> 0);
  return {
    seed,
    rng: init.rng || mulberry32(seed),                       // 战斗：出怪、速度、射击概率、资源时刻
    fxRng: init.fxRng || mulberry32((seed ^ FX_SEED_XOR) >>> 0),   // 表现：粒子、动画初相、表现计时
    ports: createPorts(init.ports),                          // 声音与存档：装配层注入，核心只发同步调用
    state:'menu',           // menu | help | select | play | won | lost
    level:0, unlocked: init.unlocked === undefined ? 1 : init.unlocked,
    unlockAll: init.unlockAll === undefined ? false : init.unlockAll,   // 主页特殊开关：打开后所有关卡直接进入
    paused:false,
    t:0,                    // 关卡时钟（负数为开场白）
    sun:50, sunFlash:0,
    slots:[],
    sel:-1, shovel:false,
    grid:null, plants:[], zombies:[], peas:[], suns:[], mowers:[],
    events:[], evIdx:0, total:0, killed:0,
    skyTimer:5, lastRows:[],
    visual:{
      parts:[], decals:[], shake:0, flash:0,
      waveText:null, nightHint:0, groanTimer:4,
    },
    winT:0, loseZombie:null,
    quiz:null,
    hoverCell:null, mouse:{x:-99,y:-99},
    hotspots:[],
  };
}

export function startLevel(world, li){
  world.level = li;
  world.state = 'select';
  world.slots = [];
  world.sel = -1; world.shovel = false;
  world.ports.sound('click');
}

// 昼夜判定：背景、天降太阳、蘑菇是否打盹都读这一处
export function isNight(world){ return !!(LEVELS[world.level] && LEVELS[world.level].night); }

// 主页的特殊开关：打开后所有关卡都能直接进，关掉则回到真实进度（真实进度始终单独保存）
export function toggleUnlockAll(world){
  world.unlockAll = !world.unlockAll;
  world.ports.saveUnlockAll(world.unlockAll);
  world.ports.sound('click');
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
  world.plants=[]; world.zombies=[]; world.peas=[]; world.suns=[];
  world.visual.parts=[]; world.visual.decals=[];
  world.lastRows = [];
  world.mowers = Array.from({length:ROWS}, (_,r)=>({row:r, x:LX-52, state:'idle'}));
  world.slots = world.slots.map(s=>({type:s.type, cool:0}));
  const built = buildSpawns(lv, world.rng);
  world.events = built.events; world.total = built.total;
  world.evIdx = 0; world.killed = 0;
  world.skyTimer = 2; world.visual.groanTimer = 4;
  world.visual.waveText = null; world.winT = 0; world.loseZombie = null;
  world.visual.nightHint = lv.night ? 8 : 0;
  world.sel = -1; world.shovel = false;
  world.visual.shake = 0; world.visual.flash = 0;
  world.ports.sound('click');
}

export function startQuiz(world){
  world.state = 'quiz';
  world.quiz = { idx: 0, energy: 50, questions: makeQuiz(world.rng), feedback: 0, correct: true };
  world.ports.sound('click');
}
export function answerQuiz(world, a){
  if(world.state !== 'quiz' || world.quiz.feedback > 0) return;
  const q = world.quiz;
  if(a === q.questions[q.idx].answer){
    q.energy *= 2;
    q.correct = true;
    world.ports.sound('select');
  } else {
    q.correct = false;
    world.ports.sound('error');
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
