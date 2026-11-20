// 背景绘制轨迹：把 paintBattleBG 的每一次 Canvas 调用与属性写入记成一行文本。
//
// 为什么需要它：背景是整幅预渲染后缓存进离屏画布的，浏览器套件的轨迹只能记到
// drawImage([object HTMLCanvasElement])，看不到背景本身画了什么。也就是说在 E7 之前，
// 这幅背景（全项目最大的一张图）没有任何回归防护——改了它，所有检查都会绿。
//
// 记录口径与浏览器轨迹一致：数字保留 3 位小数，渐变按创建顺序编号。

import { bindCanvas } from '../../src/render/target.js';

export function recordBackground(paint, night){
  const ops = [];
  let gradSeq = 0;

  const fmt = v => {
    if (v && typeof v === 'object' && v.__grad !== undefined) return '[gradient ' + v.__grad + ']';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
    return String(v);
  };

  const makeGradient = (kind, args) => {
    const id = ++gradSeq;
    ops.push(kind + '(' + args.map(fmt).join(',') + ')');
    return {
      __grad: id,
      addColorStop(offset, color){ ops.push('  stop(' + fmt(offset) + ',' + fmt(color) + ')'); },
    };
  };

  const target = {};
  const canvas = new Proxy(target, {
    get(t, key){
      if (typeof key !== 'string') return undefined;
      if (key in t) return t[key];
      const method = (...args) => {
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          return makeGradient(key, args);
        }
        ops.push(key === 'scale' ? 'scale(' + args.map(fmt).join(',') + ')' : key + '(' + args.map(fmt).join(',') + ')');
        return undefined;
      };
      t[key] = method;
      return method;
    },
    set(t, key, value){
      ops.push(key + ' = ' + fmt(value));
      t[key] = value;
      return true;
    },
  });

  bindCanvas({ width: 0, height: 0, getContext: () => canvas }, 1);
  paint(night);
  return ops;
}
