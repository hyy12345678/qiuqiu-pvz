// 3D 战场环境的结构基线：逐行记录场景树里每个网格（几何顶点数、材质类型、投影开关）与灯光参数。
//
// 2D 时代这里逐行比对背景的 Canvas 调用；3D 版的等价物是「场景里有什么、怎么打光」。
// 它挡住的是无意的布景变化：改了树、栅栏、房子或灯光，这里一定会红。
//
// 更新基线（只在有意改布景、且已人工看图之后）：
//   UPDATE_BG_TRACE=1 node --test tests/render-background-trace.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scene } from 'three';
import { createEnvironment } from '../src/render/scene3d/environment.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, 'baselines', 'background-3d.trace.txt');
const UPDATE = process.env.UPDATE_BG_TRACE === '1';
const f = v => (Math.round(v * 1000) / 1000).toString();

function record(){
  const lines = [];
  for(const night of [false, true]){
    const env = createEnvironment(), scene = new Scene();
    env.setTheme(night, scene);
    lines.push('# ' + (night ? 'night' : 'day') + ' fog ' + scene.fog.color.getHexString() + ' ' + f(scene.fog.near) + '-' + f(scene.fog.far) + ' env ' + f(scene.environmentIntensity));
    env.group.traverse(o => {
      if(o.isLight) lines.push('light ' + o.type + ' ' + o.color.getHexString() + ' ' + f(o.intensity) + (o.castShadow ? ' shadow' : ''));
      else if(o.isInstancedMesh) lines.push('instanced ' + o.count + ' x ' + o.geometry.attributes.position.count);
      else if(o.isMesh) lines.push('mesh ' + o.geometry.type + ' ' + o.geometry.attributes.position.count + ' ' + o.material.type + (o.userData.key ? '/' + o.userData.key : '') + (o.castShadow ? ' cast' : '') + (o.receiveShadow ? ' recv' : '') + (o.visible ? '' : ' hidden') + ' @' + f(o.position.x) + ',' + f(o.position.y) + ',' + f(o.position.z));
      else if(o.isPoints) lines.push('points ' + o.geometry.attributes.position.count + (o.visible ? '' : ' hidden'));
    });
  }
  return lines;
}

test('3D 战场环境结构与基线逐行一致', () => {
  const actual = record();
  if(UPDATE){
    const prev = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean) : [];
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, actual.join('\n') + '\n');
    console.log('已重写 ' + path.relative(process.cwd(), FILE) + '：' + actual.length + ' 行（原 ' + prev.length + ' 行）');
    return;
  }
  assert.ok(fs.existsSync(FILE), '缺少环境基线，先跑 UPDATE_BG_TRACE=1');
  const expected = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean);
  assert.ok(actual.length > 30, '环境结构行数异常偏少：' + actual.length);
  assert.strictEqual(actual.length, expected.length, '环境结构行数变了（基线 ' + expected.length + ' / 当前 ' + actual.length + '）');
  for(let i = 0; i < expected.length; i++) assert.strictEqual(actual[i], expected[i], '第 ' + (i + 1) + ' 行不同');
});
