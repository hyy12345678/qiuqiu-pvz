// 战斗投影：只保留会影响未来逻辑的字段，供“绘制/粒子/音频不改变战斗结果”的矩阵比较。
// 排除项：动画初相、后坐力、屏震、闪光、波次文字、粒子与焦痕、呻吟计时。
// 保留项：实体顺序、生命/护甲、位置、状态、影响未来判定的计时、弹丸、阳光到账、卡槽、事件游标与胜负。

function plantRef(w, p){
  return p && w.plants.includes(p) ? w.plants.indexOf(p) : null;
}

export function projectBattle(w){
  return {
    state: w.state,
    level: w.level,
    t: w.t,
    sun: w.sun,
    unlocked: w.unlocked,
    grid: w.grid && w.grid.map(row => row.map(p => (p ? p.type : null))),
    plants: w.plants.map(p => ({
      type: p.type, row: p.row, col: p.col, hp: p.hp,
      fireT: p.fireT, sunT: p.sunT, fuse: p.fuse,
      armed: !!p.armed, armT: p.armT, asleep: !!p.asleep,
    })),
    zombies: w.zombies.map(z => ({
      type: z.type, row: z.row, x: z.x, hp: z.hp, acc: z.acc,
      state: z.state, slowT: z.slowT, poleLost: !!z.poleLost, angry: !!z.angry,
      paper: z.paper, eatT: z.eatT, eatPlant: plantRef(w, z.eatPlant),
      vt: z.vt, fromX: z.fromX, toX: z.toX, deathT: z.deathT,
    })),
    peas: w.peas.map(p => ({
      row: p.row, type: p.type, dmg: p.dmg, x: p.x, prevX: p.prevX, vx: p.vx,
    })),
    suns: w.suns.map(s => ({
      state: s.state, value: s.value, life: s.life, ft: s.ft, t: s.t, y: s.y,
    })),
    mowers: w.mowers.map(m => ({ row: m.row, state: m.state, x: m.x })),
    events: w.events.map(e => ({ t: e.t, type: e.type || null, announce: !!e.announce })),
    evIdx: w.evIdx,
    total: w.total,
    killed: w.killed,
    lastRows: w.lastRows.slice(),
    skyTimer: w.skyTimer,
    winT: w.winT,
    loseRow: w.loseZombie ? w.loseZombie.row : null,
    slots: w.slots.map(s => ({ type: s.type, cool: s.cool })),
    quiz: w.quiz ? JSON.parse(JSON.stringify(w.quiz)) : null,
  };
}

/** 受控随机序列：按给定值依次返回，耗尽后固定 0.5 */
export function seq(values){
  let i = 0;
  return () => (i < values.length ? values[i++] : 0.5);
}
