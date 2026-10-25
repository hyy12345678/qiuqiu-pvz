import { setTarget, withTarget } from './lb-target.mjs';
import { paint } from './lb-drawer.mjs';

// 入口在求值时就把结果写进全局，供 bundle 测试断言
const results = [];
results.push(paint());                                            // 期望 none
setTarget({ tag: 'main' });
results.push(paint());                                            // 期望 main（依赖 live binding）
results.push(withTarget({ tag: 'off' }, () => paint()));           // 期望 off（离屏渲染场景）
results.push(paint());                                            // 期望 main（已还原）
try { withTarget({ tag: 'boom' }, () => { throw new Error('x'); }); } catch (e) { /* 忽略 */ }
results.push(paint());                                            // 期望 main（finally 兜底）
globalThis.__lb = results;
