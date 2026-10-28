// 核心对外的同步副作用端口。默认实现什么都不做，浏览器适配器由装配层注入。

const SILENT = {
  sound(){},
  saveProgress(){},
  saveUnlockAll(){},
};

export function createPorts(overrides){
  return Object.assign({}, SILENT, overrides);
}
