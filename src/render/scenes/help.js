// 操作说明弹层：菜单画面之上压暗并绘制说明。

import { W, H } from '../../core/constants.js';
import { ctx } from '../target.js';
import { rr, O, drawText } from '../paint.js';
import { drawMenuScene } from './menu.js';
import { drawButton } from './common.js';

export function renderHelp(t, world, ui){
  drawMenuScene(t);
  ctx.fillStyle = 'rgba(10,16,10,0.6)';
  ctx.fillRect(0,0,W,H);
  const pw = 660, ph = 520, px = W/2-pw/2, py = H/2-ph/2-10;
  let g = ctx.createLinearGradient(0,py,0,py+ph);
  g.addColorStop(0,'#f0e2bc'); g.addColorStop(1,'#d8c090');
  ctx.fillStyle = 'rgba(15,25,8,0.45)';
  ctx.beginPath(); rr(px+5, py+7, pw, ph, 14); ctx.fill();
  ctx.beginPath(); rr(px, py, pw, ph, 14);
  O(g, '#6b4c20', 4);
  ctx.strokeStyle = 'rgba(107,76,32,0.25)'; ctx.lineWidth = 1.5;
  for(let k=1;k<6;k++){
    ctx.beginPath(); ctx.moveTo(px+14, py+k*66); ctx.lineTo(px+pw-14, py+k*66); ctx.stroke();
  }
  drawText('操 作 说 明', W/2, py+44, 30, '#42280f', 'rgba(255,246,220,0.7)', 4, 'center', '900');
  const lines = [
    '· 支持鼠标和触屏（平板/手机）操作',
    '· 点击天上掉落的阳光或向日葵产出的阳光，收集阳光资源',
    '· 点击上方卡片选择植物，再点击草坪格子种下（再点一次卡片取消选择）',
    '· 数字键 1-8 可快速选择对应卡片',
    '· 铲子可以移除已种下的植物（点击铲子后再点植物）',
    '· 豌豆射手家族会自动攻击本行前方的僵尸',
    '· 球球是核心输出：加特林扫射，还有概率发射范围导弹',
    '· 火炬树桩能让穿过的豌豆变成双倍伤害的火豌豆',
    '· 樱桃炸弹 / 土豆雷威力巨大，但土豆雷需要时间成长',
    '· 小喷菇免费但射程只有两格；阳光菇只要 25 阳光，产量是向日葵的一半',
    '· 蘑菇夜里直接开工；白天种下会打盹，点一株蘑菇用咖啡豆唤醒它',
    '· 报纸僵尸：报纸是它的护盾，打掉报纸它会暴怒加速冲过来！',
    '· 夜间关卡：天上不会掉太阳，只能靠向日葵（开局多给 100 阳光）',
    '· 每行最左侧的小推车是最后防线，被突破则游戏失败',
    '· 消灭本关全部僵尸即可过关，P 键暂停（触屏点右上角按钮）',
  ];
  for(let i=0;i<lines.length;i++){
    drawText(lines[i], px+42, py+94+i*24, 15.5, '#3c2a10', null, 0, 'left', '600');
  }
  drawButton(ui, W/2-80, py+ph-58, 160, 44, '返 回', 'back', { type:'nav', state:'menu' }, {});
}
