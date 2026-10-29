import test from 'node:test';
import assert from 'node:assert/strict';
import { toCanvas, bindInput } from '../src/ui/input.js';
import { createUI } from '../src/ui/state.js';
import { addHotspot } from '../src/ui/hotspots.js';
import { LX, LY, CW, CH, COLS, ROWS } from '../src/core/constants.js';

function eventTarget(trace){
  const listeners = [];
  return {
    listeners,
    addEventListener(type, callback, options){
      listeners.push({ type, callback, options });
    },
    emit(type, init = {}){
      const event = {
        ...init,
        defaultPrevented: false,
        preventions: 0,
        preventDefault(){
          this.defaultPrevented = true;
          this.preventions++;
          trace.push(`preventDefault:${type}`);
        },
      };
      const matches = listeners.filter(listener => listener.type === type);
      assert.ok(matches.length > 0, `未绑定 ${type}`);
      for (const { callback } of matches) callback.call(this, event);
      return event;
    },
  };
}

function fixture(dpr = 1){
  const trace = [], presses = [], keys = [];
  const ui = createUI();
  const state = { state: 'play' };
  const world = new Proxy(state, {
    get(target, key){
      assert.equal(key, 'state', `输入层不应访问 world.${String(key)}`);
      return target[key];
    },
    set(){ assert.fail('输入层不应修改 world'); },
    defineProperty(){ assert.fail('输入层不应定义 world 属性'); },
    deleteProperty(){ assert.fail('输入层不应删除 world 属性'); },
  });
  const canvas = Object.assign(eventTarget(trace), {
    width: 1024 * dpr,
    height: 640 * dpr,
    rect: { left: 80, top: 40, width: 512, height: 320 },
    style: { cursor: 'default' },
    getBoundingClientRect(){
      trace.push('rect');
      return this.rect;
    },
  });
  const document = eventTarget(trace);
  const window = Object.assign(eventTarget(trace), {
    devicePixelRatio: dpr,
    requestAnimationFrame(){ assert.fail('输入层不应注册 rAF'); },
    Audio: function(){ assert.fail('输入层不应创建音频'); },
  });
  const options = {
    canvas, document, window, world, ui,
    onPress(p){
      trace.push('press');
      presses.push({
        point: { ...p },
        mouse: { ...ui.mouse },
        hoverCell: ui.hoverCell && { ...ui.hoverCell },
        cursor: canvas.style.cursor,
      });
    },
    onKey(...args){
      trace.push('key');
      keys.push(args);
    },
  };
  return { ...options, options, state, trace, presses, keys };
}

function client(canvas, p){
  const { left, top, width, height } = canvas.rect;
  return { clientX: left + p.x * width / 1024, clientY: top + p.y * height / 640 };
}

function view(f){
  return { ui: structuredClone(f.ui), cursor: f.canvas.style.cursor };
}

const cell = { x: LX + CW * 2 + CW / 2, y: LY + CH + CH / 2 };
const hoverCell = { row: 1, col: 2 };

function cellHotspot(ui){
  addHotspot(ui, cell.x - 10, cell.y - 10, 20, 20, 'cell', { type: 'test' });
}

test('输入1 逻辑坐标不受偏移、缩放、矩形变化和 DPR backing 尺寸影响', () => {
  for (const dpr of [1, 2]){
    const { canvas, trace } = fixture(dpr);
    for (const rect of [
      { left: 0, top: 0, width: 1024, height: 640 },
      { left: 83, top: 47, width: 512, height: 320 },
      { left: -23, top: 101, width: 1536, height: 1280 },
      { left: 19.5, top: -7.25, width: 256, height: 160 },
    ]){
      canvas.rect = rect;
      for (const p of [{ x: 0, y: 0 }, cell, { x: 1024, y: 640 }, { x: -32, y: 672 }]){
        trace.length = 0;
        assert.deepEqual(toCanvas(canvas, client(canvas, p)), p);
        assert.deepEqual(trace, ['rect']);
      }
    }
  }
});

test('输入2 bindInput 只绑定指定目标和事件，触屏均 passive:false 且无返回值', () => {
  const f = fixture();
  const before = view(f);
  assert.equal(bindInput(f.options), undefined);
  assert.deepEqual(f.canvas.listeners.map(({ type }) => type).sort(),
    ['contextmenu', 'mousedown', 'mousemove', 'touchend', 'touchmove', 'touchstart']);
  assert.deepEqual(f.document.listeners.map(({ type }) => type), ['gesturestart']);
  assert.deepEqual(f.window.listeners.map(({ type }) => type), ['keydown']);
  for (const target of [f.canvas, f.document, f.window]){
    for (const listener of target.listeners) assert.equal(typeof listener.callback, 'function');
  }
  for (const type of ['touchstart', 'touchmove', 'touchend']){
    assert.equal(f.canvas.listeners.find(listener => listener.type === type).options?.passive, false);
  }
  assert.deepEqual(view(f), before);
  assert.deepEqual(f.trace, []);
  assert.deepEqual(f.presses, []);
  assert.deepEqual(f.keys, []);
  assert.deepEqual(f.state, { state: 'play' });
});

test('输入3 mousemove 实时读取 state，更新逻辑指针与草坪半开边界悬停格', () => {
  const f = fixture();
  bindInput(f.options);
  for (const [p, expected] of [
    [cell, hoverCell],
    [{ x: LX, y: LY }, { row: 0, col: 0 }],
    [{ x: LX + CW * COLS - 1, y: LY + CH * ROWS - 1 }, { row: ROWS - 1, col: COLS - 1 }],
    [{ x: LX - 1, y: LY }, null],
    [{ x: LX, y: LY - 1 }, null],
    [{ x: LX + CW * COLS, y: LY }, null],
    [{ x: LX, y: LY + CH * ROWS }, null],
  ]){
    const event = f.canvas.emit('mousemove', client(f.canvas, p));
    assert.deepEqual(f.ui.mouse, p);
    assert.deepEqual(f.ui.hoverCell, expected);
    assert.equal(event.preventions, 0);
  }
  for (const state of ['play', 'menu', 'select', 'quiz', 'play']){
    f.state.state = state;
    f.canvas.emit('mousemove', client(f.canvas, cell));
    assert.deepEqual(f.ui.mouse, cell);
    assert.deepEqual(f.ui.hoverCell, state === 'play' ? hoverCell : null);
  }
  assert.deepEqual(f.presses, []);
  assert.deepEqual(f.keys, []);
});

test('输入4 热点含边界优先 pointer，其次铲子或第零张起选卡 crosshair，否则 default', () => {
  const f = fixture();
  bindInput(f.options);
  addHotspot(f.ui, 20, 30, 40, 50, 'button', { type: 'test' });
  for (const [sel, shovel, outsideCursor] of [
    [-1, false, 'default'], [0, false, 'crosshair'], [3, false, 'crosshair'],
    [-1, true, 'crosshair'], [0, true, 'crosshair'],
  ]){
    f.ui.sel = sel;
    f.ui.shovel = shovel;
    for (const p of [{ x: 20, y: 30 }, { x: 60, y: 30 }, { x: 20, y: 80 }, { x: 60, y: 80 }, { x: 40, y: 55 }]){
      f.canvas.emit('mousemove', client(f.canvas, p));
      assert.equal(f.canvas.style.cursor, 'pointer');
    }
    for (const p of [{ x: 19, y: 55 }, { x: 61, y: 55 }, { x: 40, y: 29 }, { x: 40, y: 81 }]){
      f.canvas.emit('mousemove', client(f.canvas, p));
      assert.equal(f.canvas.style.cursor, outsideCursor);
    }
    assert.equal(f.ui.sel, sel);
    assert.equal(f.ui.shovel, shovel);
  }
  assert.deepEqual(f.presses, []);
});

test('输入5 mousedown 仅忽略右键，左键、中键及其他按钮按下均不更新 hover', () => {
  const f = fixture();
  bindInput(f.options);
  f.ui.sel = 0;
  f.ui.shovel = true;
  f.canvas.emit('mousemove', client(f.canvas, cell));
  const before = view(f);
  const p = { x: 35, y: 45 };
  cellHotspot(f.ui);
  before.ui.hotspots = structuredClone(f.ui.hotspots);
  for (const button of [2, 0, 1, 3, 2]){
    const count = f.presses.length;
    f.trace.length = 0;
    const event = f.canvas.emit('mousedown', { ...client(f.canvas, p), button });
    assert.equal(event.preventions, 0);
    assert.equal(f.presses.length, count + (button === 2 ? 0 : 1));
    assert.deepEqual(f.trace, button === 2 ? [] : ['rect', 'press']);
    if (button !== 2){
      assert.deepEqual(f.presses.at(-1), {
        point: p, mouse: cell, hoverCell, cursor: 'crosshair',
      });
    }
    assert.deepEqual(view(f), before);
  }
});

test('输入6 touchstart 先取消再移动再按下，采用首个 changedTouch，鼠标触屏同点相同', () => {
  for (const dpr of [1, 2]){
    const mouse = fixture(dpr), touch = fixture(dpr);
    for (const f of [mouse, touch]){
      bindInput(f.options);
      f.canvas.rect = { left: 31, top: -17, width: 768, height: 1280 };
      f.ui.sel = 0;
      cellHotspot(f.ui);
    }
    mouse.canvas.emit('mousemove', client(mouse.canvas, cell));
    mouse.canvas.emit('mousedown', { ...client(mouse.canvas, cell), button: 0 });
    const other = client(touch.canvas, { x: 0, y: 0 });
    const event = touch.canvas.emit('touchstart', {
      ...other,
      touches: [other],
      changedTouches: [client(touch.canvas, cell), other],
    });
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.preventions, 1);
    assert.deepEqual(touch.trace, ['preventDefault:touchstart', 'rect', 'press']);
    assert.deepEqual(touch.presses, [{ point: cell, mouse: cell, hoverCell, cursor: 'pointer' }]);
    assert.deepEqual(touch.presses, mouse.presses);
    assert.deepEqual(view(touch), view(mouse));
  }
});

test('输入7 touchmove 只取消和移动，touchend 即使无触点也只取消', () => {
  const f = fixture();
  bindInput(f.options);
  f.ui.shovel = true;
  cellHotspot(f.ui);
  f.canvas.emit('touchstart', { changedTouches: [client(f.canvas, cell)] });
  const presses = structuredClone(f.presses);
  const p = { x: 8, y: 12 };
  f.canvas.rect = { left: -50, top: 90, width: 2048, height: 320 };
  f.trace.length = 0;
  const move = f.canvas.emit('touchmove', {
    changedTouches: [client(f.canvas, p), client(f.canvas, cell)],
    touches: [client(f.canvas, cell)],
  });
  assert.equal(move.preventions, 1);
  assert.deepEqual(f.trace, ['preventDefault:touchmove', 'rect']);
  assert.deepEqual(f.ui.mouse, p);
  assert.equal(f.ui.hoverCell, null);
  assert.equal(f.canvas.style.cursor, 'crosshair');
  assert.deepEqual(f.presses, presses);
  const before = view(f);
  for (const changedTouches of [[], [client(f.canvas, cell)]]){
    f.trace.length = 0;
    const end = f.canvas.emit('touchend', { changedTouches });
    assert.equal(end.preventions, 1);
    assert.deepEqual(f.trace, ['preventDefault:touchend']);
    assert.deepEqual(view(f), before);
    assert.deepEqual(f.presses, presses);
  }
});

test('输入8 gesturestart 仅取消，contextmenu 取消并清选择但不改变指针或光标', () => {
  const f = fixture();
  bindInput(f.options);
  f.ui.sel = 2;
  f.ui.shovel = true;
  cellHotspot(f.ui);
  f.canvas.emit('mousemove', client(f.canvas, cell));
  const before = view(f);
  f.trace.length = 0;
  const gesture = f.document.emit('gesturestart');
  assert.equal(gesture.preventions, 1);
  assert.deepEqual(f.trace, ['preventDefault:gesturestart']);
  assert.deepEqual(view(f), before);
  f.trace.length = 0;
  const context = f.canvas.emit('contextmenu', client(f.canvas, { x: 0, y: 0 }));
  assert.equal(context.preventions, 1);
  assert.deepEqual(f.trace, ['preventDefault:contextmenu']);
  before.ui.sel = -1;
  before.ui.shovel = false;
  assert.deepEqual(view(f), before);
  assert.deepEqual(f.presses, []);
  assert.deepEqual(f.keys, []);
});

test('输入9 keydown 在所有状态无条件原样转发 key，不处理规则、重复或修饰键', () => {
  const f = fixture();
  bindInput(f.options);
  f.ui.sel = 0;
  f.ui.shovel = true;
  const before = view(f);
  const expected = [];
  for (const state of ['menu', 'select', 'play', 'quiz', 'won', 'lost']){
    f.state.state = state;
    for (const key of ['Escape', '1', '0', '9', 'p', 'P', 'm', 'M', ' ', 'ArrowLeft', 'Unidentified']){
      for (const repeat of [false, true]){
        const event = f.window.emit('keydown', {
          key, repeat, ctrlKey: true, metaKey: true, altKey: true, shiftKey: true,
          target: { tagName: 'INPUT' },
        });
        expected.push([key]);
        assert.equal(event.preventions, 0);
      }
    }
  }
  assert.deepEqual(f.keys, expected);
  assert.deepEqual(f.trace, expected.map(() => 'key'));
  assert.deepEqual(view(f), before);
  assert.deepEqual(f.presses, []);
});
