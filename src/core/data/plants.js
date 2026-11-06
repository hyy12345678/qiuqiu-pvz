// 植物数值表：cost 阳光消耗、hp 生命、cool 卡片冷却（秒）、mushroom 是否蘑菇（白天需咖啡豆唤醒）、
// life 登场限时（秒，光之巨人的彩色计时器；到点自行离场，换到来的是高伤害）。

export const PLANTS = {
  qiuqiu:     { name:'球球',     cost:150, hp:900,  cool:20,  desc:'5岁的小男孩，加特林火力全开' },
  sunflower:  { name:'向日葵',   cost:50,  hp:300,  cool:7.5, desc:'生产阳光，经济的基石' },
  peashooter: { name:'豌豆射手', cost:100, hp:300,  cool:7.5, desc:'发射豌豆攻击前方僵尸' },
  snowpea:    { name:'寒冰射手', cost:175, hp:300,  cool:7.5, desc:'冰豌豆可减速僵尸' },
  repeater:   { name:'双发射手', cost:200, hp:300,  cool:7.5, desc:'一次发射两颗豌豆' },
  wallnut:    { name:'坚果墙',   cost:50,  hp:4000, cool:24,  desc:'坚固的屏障，阻挡僵尸' },
  potato:     { name:'土豆雷',   cost:25,  hp:300,  cool:24,  desc:'钻出地面后爆炸，需要时间准备' },
  torch:      { name:'火炬树桩', cost:175, hp:300,  cool:7.5, desc:'让穿过的豌豆变成火豌豆' },
  cherry:     { name:'樱桃炸弹', cost:150, hp:300,  cool:32,  desc:'轰！炸飞一片区域的僵尸' },
  puff:       { name:'小喷菇',   cost:0,   hp:300,  cool:7.5, mushroom:true, desc:'免费，但射程只有两格' },
  sunshroom:  { name:'阳光菇',   cost:25,  hp:300,  cool:7.5, mushroom:true, desc:'比向日葵便宜，产阳光也只有一半' },
  coffee:     { name:'咖啡豆',   cost:25,  hp:300,  cool:20,  desc:'点一株白天打盹的蘑菇，把它唤醒' },
  tiga:       { name:'迪迦奥特曼', cost:275, hp:1200, cool:30, life:25, desc:'光之巨人限时登场，蓄力后发射哉佩利敖光线贯穿整行' },
};
export const PLANT_ORDER = ['qiuqiu','sunflower','peashooter','snowpea','repeater','wallnut','potato','torch','cherry','puff','sunshroom','coffee','tiga'];
