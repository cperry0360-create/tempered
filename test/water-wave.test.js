import test from 'node:test'
import assert from 'node:assert/strict'
import { waterWavePath } from '../src/ui/water-wave.js'

// SVG coordinates: y = 24 at the feet and y = 0 above the head.
const waterline = (path) => [...path.matchAll(/[ML] (\d+) ([-\d.]+)/g)]
  .slice(0,25).map((match)=>Number(match[2]))

test('waterline stays empty at zero and full at the actual hydration goal',()=>{
  assert.ok(waterline(waterWavePath(0)).every(y=>y===24))
  assert.ok(waterline(waterWavePath(100)).every(y=>y===0))
  assert.equal(waterWavePath(-300),waterWavePath(0))
  assert.equal(waterWavePath(250),waterWavePath(100))
  assert.equal(waterWavePath(NaN),waterWavePath(0))
})

test('middle fill creates a restrained rippling edge bounded inside the 24px silhouette',()=>{
  const mid=waterline(waterWavePath(50,0))
  assert.equal(mid.length,25)
  assert.ok(mid.every(y=>y>=11.64&&y<=12.36))
  assert.ok(new Set(mid).size>5,'wave must not be a flat rectangle')
  assert.notEqual(waterWavePath(50,0),waterWavePath(50,1.2),
    'wave phase should shift the crest during a fill animation')
  assert.ok(waterWavePath(50).endsWith('L 24 24 L 0 24 Z'))
})

test('waterline never paints above 0 or below 24 even near the ends',()=>{
  for(const percent of [0,0.1,1,10,25,47,70,90,99,99.9,100]){
    const lines=waterline(waterWavePath(percent,4))
    assert.ok(lines.every(y=>y>=0&&y<=24),String(percent))
  }
})
