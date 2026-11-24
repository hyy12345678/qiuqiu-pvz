// 关卡表：count 僵尸总数、slots 可带卡片数、types [类型,权重]、night 夜战。

export const LEVELS = [
  { name:'第 1 关 · 前院草坪', count:20, slots:6, types:[['normal',8],['cone',2]] },
  // E20：32 → 27。L1→L2 的等效总血量原来是 1.0× → 3.0×，断崖太陡；
  // 削到 27 后约 2.5×，配合铁桶权重不变，是"明显的台阶"而不是"墙"。
  { name:'第 2 关 · 来者不善', count:27, slots:7, types:[['normal',5],['cone',3],['bucket',1],['vault',1],['newspaper',1]] },
  // E22：L3 起加入铁门僵尸（权重 1，稀客）。它是第一个"改变火力配置"的敌人，
  // 放在最终决战才出现，让玩家先熟悉其他机制。
  { name:'第 3 关 · 最终决战', count:44, slots:8, types:[['normal',4],['cone',3],['bucket',2],['vault',2],['newspaper',2],['screen',1]] },
  // E20：52 → 46。原曲线是 1.0 → 3.0 → 4.6 → 5.6，L3→L4 的台阶最陡且时长 385s（6.4 分钟）偏长。
  // 削到 46 后约 5.0×，时长降到约 340s。
  { name:'第 4 关 · 月夜突袭', count:46, slots:8, night:true, types:[['normal',3],['cone',3],['bucket',2],['vault',2],['newspaper',3],['screen',1]] },
];
