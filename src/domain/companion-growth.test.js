import test from 'node:test'
import assert from 'node:assert/strict'
import { COMPANION_LEVELS, companionGrowth, companionStage, companionStyle } from './companion-growth.js'

test('companion growth has ten visible levels with frequent early changes', () => {
  assert.equal(COMPANION_LEVELS.length, 10)
  assert.deepEqual(COMPANION_LEVELS.slice(0, 5).map((level) => level.min), [0, 24, 50, 85, 130])
  assert.equal(COMPANION_LEVELS.at(-1).min, 550)
})

test('Forge Guardian is the default while Ember Sprout remains selectable', () => {
  assert.equal(companionStyle(undefined), 'forge')
  assert.equal(companionStage(0).name, 'Core')
  assert.equal(companionStage(0, 'sprout').name, 'Seed')
  assert.equal(companionStage(550).name, 'Sentinel')
  assert.equal(companionStage(550, 'sprout').name, 'Luminous')
})

test('growth advances only from accumulated care and never runs backward inside a level', () => {
  assert.deepEqual(companionGrowth(49), {
    stage: companionStage(49),
    next: companionStage(50),
    percent: 96,
  })
  assert.equal(companionGrowth(-100).stage.level, 1)
  assert.equal(companionGrowth(100000).percent, 100)
})
