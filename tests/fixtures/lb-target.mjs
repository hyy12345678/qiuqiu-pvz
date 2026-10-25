export let ctx = null;

export function setTarget(c) { ctx = c; }

export function withTarget(c, fn) {
  const saved = ctx;
  ctx = c;
  try { return fn(); } finally { ctx = saved; }
}
