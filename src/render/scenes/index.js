// 主渲染入口：3D 场景整幅贴底 → 按状态画界面层 → 暗角。
//
// 3D 视图由装配层创建并经 frame.view3d 传入；没有（Node 测试、浏览器不支持 WebGL）时
// 画一块深色底与提示，界面层照常绘制，所有热点与流程仍然可用。
import { W, H } from '../../core/constants.js';
import { clearHotspots } from '../../ui/hotspots.js';
import { ctx } from '../target.js';
import { drawText } from '../paint.js';
import { setUITime } from './common.js';
import { renderMenu } from './menu.js';
import { renderHelp } from './help.js';
import { renderSelect } from './select.js';
import { renderQuiz } from './quiz.js';
import { renderPlay } from './play.js';
import { renderEndOverlay } from './end.js';

const BATTLE_STATES = new Set(['play', 'won', 'lost']);
export function sceneMode(state){ return BATTLE_STATES.has(state) ? 'battle' : 'menu'; }

function drawNoWebGL(){
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#16302a'); g.addColorStop(1, '#081410');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawText('当前浏览器不支持 WebGL2，无法显示 3D 画面', W / 2, H - 40, 15, '#ffd8a0', 'rgba(0,0,0,0.6)', 3, 'center', '800');
}

export function render(world, ui, frame){
  clearHotspots(ui);
  setUITime(frame.t);
  const mode = sceneMode(world.state);
  if(frame.view3d){
    const c = frame.view3d.draw(mode, world, ui, frame.t, frame.now);
    ctx.drawImage(c, 0, 0, W, H);
  } else {
    drawNoWebGL();
  }
  ctx.save();
  // restore 必须在 finally 里：绘制抛错时若不恢复，ctx 的 save 栈会永久错位
  try {
    if(world.state === 'menu') renderMenu(frame.t, world, ui, frame.musicOn);
    else if(world.state === 'help') renderHelp(frame.t, world, ui);
    else if(world.state === 'select') renderSelect(frame.t, world, ui);
    else if(world.state === 'quiz') renderQuiz(frame.t, world, ui);
    else {
      renderPlay(frame.t, world, ui, frame.musicOn);
      if(world.state === 'won' || world.state === 'lost') renderEndOverlay(frame.t, world, ui);
    }
  } finally {
    ctx.restore();
  }
  // 暗角：把视线收向画面中央
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 1.0);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,10,8,0.32)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
