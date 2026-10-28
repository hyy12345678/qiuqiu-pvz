// 受控绘制基线用的页面环境（在页面脚本之前注入）：
//   - 种子化 Math.random
//   - 手动推进的 performance.now / requestAnimationFrame（不自动出帧）
//   - 固定 localStorage 进度
//   - 音频替身（不创建 AudioContext）
//   - Canvas 调用记录：方法、数值参数、样式写入、渐变创建与 addColorStop 顺序
//
// 这是测试夹具，不是发布物的一部分；发布页本身不做任何改写。

export function initHarness({ seed, unlocked }) {
  let s = seed >>> 0;
  Math.random = function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let now = 0;
  let pending = [];
  window.__step = function (ms) {
    now += ms;
    const run = pending;
    pending = [];
    if (!run.length) throw new Error('没有待执行的帧回调：手动时钟与 rAF 链失联');
    for (const cb of run) cb(now);
  };
  window.__advance = function (frames) {
    for (let i = 0; i < frames; i++) window.__step(1000 / 60);
  };
  window.requestAnimationFrame = cb => { pending.push(cb); return pending.length; };
  window.cancelAnimationFrame = () => {};
  Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
  Object.defineProperty(Date, 'now', { value: () => 1700000000000 + now, configurable: true });

  Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
  Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true });

  try {
    localStorage.setItem('pvzweb_unlocked', String(unlocked));
    localStorage.removeItem('pvzweb_unlockall');
  } catch (e) { /* file:// 下可能被拒绝；发布代码本身也吞掉存储异常 */ }

  // ---- 绘制记录 ----
  const trace = [];
  let on = false;
  const push = line => { if (on) trace.push(line); };
  window.__traceStart = function () { trace.length = 0; on = true; };
  window.__traceStop = function () { on = false; return trace.slice(); };

  const canvasIds = new WeakMap();
  let canvasSeq = 0;
  function labelOf(ctx) {
    const c = ctx.canvas;
    if (!c) return 'c0';
    if (!canvasIds.has(c)) canvasIds.set(c, 'c' + (++canvasSeq));
    return canvasIds.get(c);
  }
  function fmt(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
    return String(v);
  }
  function fmtStyle(v) {
    const meta = typeof v === 'object' && v !== null ? gradMeta.get(v) : null;
    return meta ? meta.id : fmt(v);
  }

  const gradMeta = new WeakMap();
  let gradSeq = 0;
  const proto = CanvasRenderingContext2D.prototype;

  for (const name of ['createLinearGradient', 'createRadialGradient']) {
    const orig = proto[name];
    proto[name] = function (...args) {
      const g = orig.apply(this, args);
      const id = 'g' + (++gradSeq);
      gradMeta.set(g, { id, canvas: labelOf(this) });
      push(labelOf(this) + ' ' + name + ' ' + id + '(' + args.map(fmt).join(',') + ')');
      return g;
    };
  }

  const gradProto = CanvasGradient.prototype;
  const addStop = gradProto.addColorStop;
  gradProto.addColorStop = function (offset, color) {
    const meta = gradMeta.get(this);
    if (meta) push(meta.canvas + ' ' + meta.id + '.addColorStop(' + fmt(offset) + ',' + fmt(color) + ')');
    return addStop.call(this, offset, color);
  };

  const METHODS = [
    'beginPath', 'fill', 'stroke', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse',
    'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'rect', 'fillRect', 'strokeRect',
    'save', 'restore', 'translate', 'rotate', 'scale', 'clip', 'fillText', 'strokeText',
    'drawImage', 'setTransform',
  ];
  for (const name of METHODS) {
    const orig = proto[name];
    proto[name] = function (...args) {
      push(labelOf(this) + ' ' + name + '(' + args.map(fmt).join(',') + ')');
      return orig.apply(this, args);
    };
  }

  const STYLES = [
    'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'font',
    'textAlign', 'textBaseline', 'globalAlpha', 'globalCompositeOperation',
  ];
  for (const prop of STYLES) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) continue;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: d.enumerable,
      get() { return d.get.call(this); },
      set(v) {
        push(labelOf(this) + ' ' + prop + '=' + fmtStyle(v));
        return d.set.call(this, v);
      },
    });
  }
}
