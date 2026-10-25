// 关卡解锁存档。localStorage 在隐私模式/沙箱里会抛，读写都吞掉并退回「只解锁第 1 关」。

import { clamp } from './util.js';
import { LEVELS } from './data/levels.js';

export function loadUnlocked(){ try{ return clamp(parseInt(localStorage.getItem('pvzweb_unlocked'))||1,1,LEVELS.length); }catch(e){ return 1; } }
export function saveUnlocked(n){ try{ localStorage.setItem('pvzweb_unlocked', String(n)); }catch(e){} }
