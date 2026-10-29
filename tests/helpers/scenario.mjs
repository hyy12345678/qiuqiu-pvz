// R5a 场景夹具：用真实 core + 真实 render + 手动时钟与帧队列跑完整玩法，
// 只把设备与音频换成可断言的记录替身。不再借用打包后的内部名。

import { H, W } from '../../src/core/constants.js';
import { DRAW_SEED_XOR, mulberry32 } from '../../src/core/rng.js';
import { createWorld } from '../../src/core/world.js';
import { createUI } from '../../src/ui/state.js';
import { createGame } from '../../src/game.js';
import { render } from '../../src/render/scenes/index.js';
import { bindCanvas, withTarget } from '../../src/render/target.js';

const CTX_METHODS = new Set([
  'beginPath', 'fill', 'stroke', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse',
  'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'rect', 'fillRect', 'strokeRect',
  'save', 'restore', 'translate', 'rotate', 'scale', 'clip', 'fillText', 'strokeText',
  'drawImage', 'setTransform', 'createLinearGradient', 'createRadialGradient',
]);
const CTX_PROPS = new Set([
  'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'font',
  'textAlign', 'textBaseline', 'globalAlpha', 'globalCompositeOperation',
]);

// 离屏背景缓存要 document.createElement；渲染层默认取全局，测试只提供这一处平台替身。
if (!globalThis.document) {
  globalThis.document = {
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => makeContext().ctx }),
  };
}

export function makeContext({ label = '画布', trace = null, writes = null } = {}) {
  const counts = new Map();
  const canvas = new Proxy({}, {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      if (key in target) return target[key];
      if (CTX_PROPS.has(key)) return undefined;
      if (!CTX_METHODS.has(key)) {
        throw new Error(`Canvas 桩缺少 API「${key}」（${label}）：新增绘制调用必须显式登记`);
      }
      const method = (...args) => {
        counts.set(key, (counts.get(key) || 0) + 1);
        if (key.startsWith('create')) {
          const stops = [];
          const gradient = {
            addColorStop(offset, color) {
              stops.push([offset, color]);
              if (trace) trace.push({ op: 'addColorStop', args: [offset, color], gradient });
            },
          };
          if (trace) trace.push({ op: key, args: args.slice(), gradient, stops });
          return gradient;
        }
        if (trace) trace.push({ op: key, args: args.slice() });
        return undefined;
      };
      target[key] = method;
      return method;
    },
    set(target, key, value) {
      if (typeof key === 'string' && CTX_PROPS.has(key)) {
        target[key] = value;
        if (trace) trace.push({ prop: key, value });
        if (writes && typeof value === 'string') writes.push({ prop: key, value });
        return true;
      }
      throw new Error(`Canvas 桩不支持写入属性「${String(key)}」（${label}）`);
    },
  });
  return { ctx: canvas, counts, trace, writes };
}

export function scenario({ seed = 7, dpr = 1, trace = false } = {}) {
  const sounds = [];
  const saves = [];
  const ports = {
    sound: name => sounds.push(name),
    saveProgress: value => saves.push({ kind: 'progress', value }),
    saveUnlockAll: on => saves.push({ kind: 'unlockAll', on }),
  };
  const world = createWorld({ seed, ports });
  const ui = createUI();
  const frameState = { t: 0, rng: mulberry32((seed ^ DRAW_SEED_XOR) >>> 0), musicOn: false };
  const paint = makeContext({ label: '主画布', trace: trace ? [] : null });
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => paint.ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
  };
  bindCanvas(canvas, dpr);
  const audio = {
    musicOn: false,
    ensure(){}, resume(){}, click(){}, error(){},
  };
  const queue = [];
  let clock = 0;
  const game = createGame({
    world, ui, frameState, audio, render,
    now: () => clock,
    requestFrame: cb => queue.push(cb),
  });

  function frame(){
    const callback = queue.shift();
    if (typeof callback !== 'function') throw new Error('帧链中断：没有待执行的 rAF 回调');
    clock += 1000 / 60;
    callback(clock);
    if (!queue.length) throw new Error(`帧链中断：第 ${world.t.toFixed(2)} 秒后没有重新排帧`);
    return paint;
  }

  function pump(seconds){
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) frame();
    return world;
  }

  function press(x, y){
    game.handlePress({ x, y });
    return world;
  }

  // 渲染 target 是进程级单例：再建一个场景会抢走 ctx，所以断言绘制前先重新绑定本场景画布。
  function activate(){
    bindCanvas(canvas, dpr);
  }

  activate();
  game.start();
  return { world, ui, game, audio, frameState, queue, paint, sounds, saves,
    get clock(){ return clock; },
    trace: paint.trace, activate, frame, pump, press };
}

export { withTarget };
