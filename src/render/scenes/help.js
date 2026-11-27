// 操作说明弹层：压在 3D 菜单场景之上。
import { W, H } from '../../core/constants.js';
import { ctx } from '../target.js';
import { rr, drawText } from '../paint.js';
import { panel, dimmer, ribbon } from '../skin.js';
import { drawButton } from './common.js';

export function renderHelp(t, world, ui){
  dimmer(W, H, 0.6);
  const pw = 700, ph = 540, px = W / 2 - pw / 2, py = H / 2 - ph / 2;
  panel(px, py, pw, ph, {});
  ribbon(W / 2, py + 8, 240, 40, '操 作 说 明', { color: 'green', size: 22 });
  const lines = [
    ['🖱', '支持鼠标和触屏（平板/手机）操作'],
    ['☀', '点击天上掉落的阳光或向日葵产出的阳光，收集阳光资源'],
    ['🌱', '点上方卡片选植物，再点草坪格子种下（再点一次卡片取消）'],
    ['⌨', '数字键 1-8 可快速选卡，P 暂停，Esc 取消，M 切音乐'],
    ['⛏', '铲子可以移除已种下的植物（点铲子后再点植物）'],
    ['🫛', '豌豆射手家族会自动攻击本行前方的僵尸'],
    ['👦', '球球是核心输出：加特林扫射，还有概率发射范围导弹'],
    ['🔥', '火炬树桩能让穿过的豌豆变成双倍伤害的火豌豆'],
    ['💣', '樱桃炸弹 / 土豆雷威力巨大，但土豆雷需要时间成长'],
    ['🍄', '小喷菇免费但射程只有两格；阳光菇 25 阳光，产量减半'],
    ['☕', '蘑菇夜里直接开工；白天种下会打盹，用咖啡豆唤醒'],
    ['📰', '报纸僵尸：打掉报纸它会暴怒加速冲过来！'],
    ['🚪', '铁门僵尸：弹道伤害只剩 1/4，用炸弹、光线或堆火力'],
    ['🏹', '射手僵尸：停在远处朝植物放箭，用坚果墙挡箭'],
    ['🌙', '夜间关卡：天上不掉太阳，开局多给 100 阳光'],
    ['🏁', '小推车是最后防线，消灭全部僵尸即可过关'],
  ];
  // E30：射手僵尸入册后满 16 行——行距 27→25、起点 62→60 收回面板，
  // 末行底缘（约 py+447）仍在按钮（py+474）之上。
  for(let i = 0; i < lines.length; i++){
    const y = py + 60 + i * 25;
    if(i % 2 === 0){
      // 斑马纹底，长列表才不串行
      const g = 'rgba(255,255,255,0.05)';
      drawRow(px + 26, y - 12, pw - 52, 23, g);
    }
    drawText(lines[i][0], px + 50, y + 1, 16, '#ffffff', null, 0, 'center', '700');
    drawText(lines[i][1], px + 74, y + 1, 15.5, '#eaf6e4', 'rgba(0,0,0,0.35)', 2, 'left', '700');
  }
  drawButton(ui, W / 2 - 90, py + ph - 66, 180, 48, '知道啦', 'back', { type: 'nav', state: 'menu' }, { color: 'orange' });
}

function drawRow(x, y, w, h, fill){
  ctx.fillStyle = fill;
  rr(x, y, w, h, 8); ctx.fill();
}
