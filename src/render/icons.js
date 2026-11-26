// 界面用的角色肖像来源。3D 渲染器启动时注册（见 scenes/index.js），没有 WebGL 时始终返回 null，
// 由 skin.portrait 画占位圆章。
let source = null;
export function setIconSource(fn){ source = fn; }
export function getIcon(kind, type){ return source ? source(kind, type) : null; }
