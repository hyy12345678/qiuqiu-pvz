// 僵尸数值表：hp 本体生命、acc 护盾（路障/铁桶/报纸）、speed 像素每秒。

export const ZTYPES = {
  normal:{ name:'普通僵尸', hp:200, acc:0,    speed:17 },
  cone:  { name:'路障僵尸', hp:200, acc:370,  speed:17 },
  bucket:{ name:'铁桶僵尸', hp:200, acc:1100, speed:17 },
  flag:  { name:'旗帜僵尸', hp:200, acc:0,    speed:21 },
  vault: { name:'撑杆僵尸', hp:500, acc:0,    speed:36 },
  newspaper:{ name:'报纸僵尸', hp:200, acc:400, speed:13 }, // 报纸是护盾，被打掉会狂暴加速
  // E22：铁门僵尸。铁门只吃「非弹道」伤害——豌豆、小喷菇、寒冰、球球子弹、双发全被挡住，
  // 樱桃/土豆雷/球球导弹/迪迦光线/小推车照常生效。它不改变血量，改变的是「你得换一套火力」。
  screen:{ name:'铁门僵尸', hp:200, acc:900, speed:16, screen:true },
};
