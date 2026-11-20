import { COLS, ROWS, CW, CH, LX, LY } from './core/constants.js';
import { startQuiz, answerQuiz, updateQuiz, toggleUnlockAll } from './core/world.js';
import { pickSlot, toggleShovel, pressCell, collectSun, chooseLevel, togglePause, removeSlot, pickTeamPlant } from './core/actions.js';
import { updatePlay } from './core/sim.js';
import { clearSelection } from './ui/state.js';
import { hitHotspot } from './ui/hotspots.js';

export function createGame({ world, ui, frameState, audio, render, now, requestFrame }){
  function dispatch(action){
    switch(action.type){
      case 'nav': world.state = action.state; audio.click(); return;
      case 'level': chooseLevel(world, ui, action.index); return;
      case 'unlockAll': toggleUnlockAll(world); return;
      case 'pickSlot': pickSlot(world, ui, action.index); return;
      case 'shovel': toggleShovel(world, ui); return;
      case 'slot': removeSlot(world, ui, action.index); return;
      case 'plantPick': pickTeamPlant(world, ui, action.plant); return;
      case 'startQuiz':
        if(world.slots.length) startQuiz(world); else audio.error();
        return;
      case 'answer': answerQuiz(world, action.value); return;
      case 'pause': togglePause(world); return;
      case 'music':
        if(action.ensure) audio.ensure();
        audio.musicOn = !audio.musicOn;
        audio.click();
        return;
    }
  }

  function handlePress(p){
    audio.ensure(); audio.resume();
    ui.mouse = p;
    const h = hitHotspot(ui, p);
    if(h){ dispatch(h.action); return; }
    if(world.state !== 'play' || world.paused) return;
    if(collectSun(world, p.x, p.y).ok) return;
    const c = Math.floor((p.x - LX)/CW), r = Math.floor((p.y - LY)/CH);
    if(c>=0 && c<COLS && r>=0 && r<ROWS) pressCell(world, ui, r, c);
  }

  function handleKey(key){
    if(world.state==='play'){
      if(key >= '1' && key <= '8'){
        const i = parseInt(key)-1;
        if(i < world.slots.length && !world.paused) pickSlot(world, ui, i);
      } else if(key==='Escape'){ clearSelection(ui); }
      else if(key==='p' || key==='P'){ togglePause(world); }
      else if(key==='m' || key==='M'){ audio.musicOn = !audio.musicOn; }
    }
  }

  let last;
  function frame(timestamp){
    try {
      let dt = (timestamp-last)/1000; last = timestamp;
      dt = Math.min(dt, 0.05);
      frameState.t += dt;
      frameState.musicOn = audio.musicOn;
      if(world.state==='play' && !world.paused) updatePlay(world, dt);
      else if(world.state==='quiz') updateQuiz(world, dt);
      render(world, ui, frameState);
    } finally {
      // 一帧抛错也必须继续排下一帧。原来 requestFrame 在最后一行，任何一次
      // render/update 抛异常都会让 rAF 链永久断掉：玩家看到的是「画面冻住」，
      // 而控制台里只有一行错误，极难定位。
      // 代价是持续出错时会逐帧刷错误——但那至少是可见的，冻死不是。
      requestFrame(frame);
    }
  }

  function start(){
    last = now();
    requestFrame(frame);
  }

  return { dispatch, handlePress, handleKey, start };
}
