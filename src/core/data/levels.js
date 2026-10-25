// 关卡表：count 僵尸总数、slots 可带卡片数、types [类型,权重]、night 夜战。

export const LEVELS = [
  { name:'第 1 关 · 前院草坪', count:20, slots:6, types:[['normal',8],['cone',2]] },
  { name:'第 2 关 · 来者不善', count:32, slots:7, types:[['normal',5],['cone',3],['bucket',1],['vault',1],['newspaper',1]] },
  { name:'第 3 关 · 最终决战', count:44, slots:8, types:[['normal',4],['cone',3],['bucket',2],['vault',2],['newspaper',2]] },
  { name:'第 4 关 · 月夜突袭', count:52, slots:8, night:true, types:[['normal',3],['cone',3],['bucket',2],['vault',2],['newspaper',3]] },
];
