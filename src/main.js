"use strict";
/* ============================================================
   球球的植物大战僵尸 · 网页同人复刻版（增强美术版）
   全部图形由 Canvas 程序化绘制，音效音乐由 Web Audio 实时合成，
   无任何外部资源，可完全离线运行。仅供个人学习娱乐。
   ============================================================ */

import { DRAW_SEED_XOR, mulberry32, randomSeed } from './core/rng.js';
import { SFX } from './audio/sfx.js';
import { createWorld } from './core/world.js';
import { createUI } from './ui/state.js';
import { bindInput } from './ui/input.js';
import { loadUnlocked, loadUnlockAll, saveUnlocked, saveUnlockAll } from './platform/persist.js';
import { bindCanvas } from './render/target.js';
import { render } from './render/scenes/index.js';
import { createGame } from './game.js';

const SEED = randomSeed();
const ports = {
  sound: name => SFX[name](),
  saveProgress: value => saveUnlocked(value),
  saveUnlockAll: on => saveUnlockAll(on),
};
const G = createWorld({ seed: SEED, ports, unlocked: loadUnlocked(), unlockAll: loadUnlockAll() });
const UI = createUI();
const drawRng = mulberry32((SEED ^ DRAW_SEED_XOR) >>> 0);
const cv = document.getElementById('game');
bindCanvas(cv);
const frameState = { t: 0, rng: drawRng, musicOn: SFX.musicOn };
const game = createGame({
  world: G, ui: UI, frameState, audio: SFX, render,
  now: () => performance.now(),
  requestFrame: cb => requestAnimationFrame(cb),
});
bindInput({
  canvas: cv, document, window, world: G, ui: UI,
  onPress: game.handlePress, onKey: game.handleKey,
});
game.start();
