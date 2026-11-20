// 背景绘制轨迹基线：day 与 night 两张整幅背景，逐行比对 Canvas 调用与参数。
//
// 这是背景唯一的回归防护。E7 拆分 paintBattleBG 时先拿**拆分前**的代码生成基线，
// 再要求拆分后的代码逐行一致——所以它证明的不是"看起来差不多"，而是"一个像素都不会变"。
//
// 更新基线（只在有意改画面、且已人工看图之后）：
//   UPDATE_BG_TRACE=1 node --test tests/render-background-trace.test.mjs

import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paintBattleBG } from '../src/render/background.js';
import { recordBackground } from './helpers/bg-trace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = path.join(HERE, 'baselines');
const UPDATE = process.env.UPDATE_BG_TRACE === '1';

const CASES = [
  { name: '白天', theme: 'day', night: false },
  { name: '夜间', theme: 'night', night: true },
];

function baselineFile(theme){
  return path.join(BASELINE_DIR, 'background-' + theme + '.trace.txt');
}

function readBaseline(file){
  return fs.readFileSync(file, 'utf8').split('\n').filter(l => l.length > 0);
}

for(const c of CASES){
  test('背景绘制轨迹：' + c.name + '与基线逐行一致', () => {
    const actual = recordBackground(paintBattleBG, c.night);
    const file = baselineFile(c.theme);

    if (UPDATE) {
      fs.mkdirSync(BASELINE_DIR, { recursive: true });
      fs.writeFileSync(file, actual.join('\n') + '\n');
      console.log('已重写 ' + path.relative(process.cwd(), file) + '：' + actual.length + ' 行');
      return;
    }

    assert.ok(fs.existsSync(file), '缺少背景基线 ' + file + '，先跑 UPDATE_BG_TRACE=1');
    const expected = readBaseline(file);
    assert.ok(actual.length > 100, c.name + '轨迹行数异常偏少：' + actual.length);
    assert.strictEqual(actual.length, expected.length,
      c.name + '绘制行数变了（基线 ' + expected.length + ' / 当前 ' + actual.length + '）');
    for(let i = 0; i < expected.length; i++){
      assert.strictEqual(actual[i], expected[i], c.name + '第 ' + (i + 1) + ' 行不同');
    }
  });
}
