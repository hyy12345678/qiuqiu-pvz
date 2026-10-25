import { ctx } from './lb-target.mjs';

export function currentTag() { return ctx ? ctx.tag : "none"; }

// 注意：paint 必须在调用时刻读取 ctx，才能证明 live binding 生效
export function paint() { return currentTag(); }
