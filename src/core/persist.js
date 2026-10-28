// 关卡解锁存档。localStorage 在隐私模式/沙箱里会抛，读写都吞掉并退回「只解锁第 1 关」。

import { clamp } from './util.js';
import { LEVELS } from './data/levels.js';

export function loadUnlocked(){ try{ return clamp(parseInt(localStorage.getItem('pvzweb_unlocked'))||1,1,LEVELS.length); }catch(e){ return 1; } }
export function saveUnlocked(n){ try{ localStorage.setItem('pvzweb_unlocked', String(n)); }catch(e){} }
// 「全关卡解锁」开关单独存一个键：开关只影响可进入哪些关，不覆盖真实打出来的进度。
export function loadUnlockAll(){ try{ return localStorage.getItem('pvzweb_unlockall') === '1'; }catch(e){ return false; } }
export function saveUnlockAll(on){ try{ if(on) localStorage.setItem('pvzweb_unlockall', '1'); else localStorage.removeItem('pvzweb_unlockall'); }catch(e){} }
