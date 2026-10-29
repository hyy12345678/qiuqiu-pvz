// 主渲染入口：清热点、震屏、按状态分派、暗角。

import { W, H } from '../../core/constants.js';
import { rand } from '../../core/util.js';
import { clearHotspots } from '../../ui/hotspots.js';
import { ctx } from '../target.js';
import { renderMenu } from './menu.js';
import { renderHelp } from './help.js';
import { renderSelect } from './select.js';
import { renderQuiz } from './quiz.js';
import { renderPlay } from './play.js';
import { renderEndOverlay } from './end.js';

export function render(world, ui, frame){
  clearHotspots(ui);
  ctx.save();
  if(world.visual.shake > 0 && world.state==='play'){
    ctx.translate(rand(frame.rng,-1,1)*world.visual.shake*14, rand(frame.rng,-1,1)*world.visual.shake*14);
  }
  if(world.state==='menu') renderMenu(frame.t, world, ui, frame.musicOn);
  else if(world.state==='help') renderHelp(frame.t, world, ui);
  else if(world.state==='select') renderSelect(frame.t, world, ui);
  else if(world.state==='quiz') renderQuiz(frame.t, world, ui);
  else {
    renderPlay(frame.t, world, ui, frame.musicOn);
    if(world.state==='won' || world.state==='lost') renderEndOverlay(frame.t, world, ui);
  }
  ctx.restore();
  // 轻微暗角
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.55, W/2, H/2, H*0.95);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(10,20,8,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);
}
