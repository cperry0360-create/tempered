import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPANION_LEVELS,
  companionGrowth,
  companionRevealState,
  companionStage,
  companionStyle,
  companionWorkoutCare,
} from './companion-growth.js'

test('companion growth has ten visible levels with frequent early changes', () => {
  assert.equal(COMPANION_LEVELS.length, 10)
  assert.deepEqual(COMPANION_LEVELS.slice(0, 5).map((level) => level.min), [0, 24, 50, 85, 130])
  assert.equal(COMPANION_LEVELS.at(-1).min, 550)
})

test('Trailback Turtle is the default while both prior styles remain selectable', () => {
  assert.equal(companionStyle(undefined), 'turtle')
  assert.equal(companionStage(0).name, 'Egg')
  assert.equal(companionStage(24).name, 'Breaking Through')
  assert.equal(companionStage(550).name, 'Shredded')
  assert.equal(companionStage(0, 'forge').name, 'Core')
  assert.equal(companionStage(0, 'sprout').name, 'Seed')
  assert.equal(companionStage(550, 'forge').name, 'Sentinel')
  assert.equal(companionStage(550, 'sprout').name, 'Luminous')
})

test('Trailback Turtle and Forge use a different visual at every level', () => {
  const thresholds = COMPANION_LEVELS.map((level) => level.min)
  assert.deepEqual(thresholds.map((points) => companionStage(points, 'turtle').visual), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.deepEqual(thresholds.map((points) => companionStage(points, 'forge').visual), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
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

test('earned growth waits at the last revealed form until Companion presents it', () => {
  const firstVisit = companionRevealState(340, undefined)
  assert.equal(firstVisit.earned.level, 8)
  assert.equal(firstVisit.visible.level, 1)
  assert.equal(firstVisit.pending, true)

  const returning = companionRevealState(340, 3)
  assert.equal(returning.earned.level, 8)
  assert.equal(returning.visible.level, 3)
  assert.equal(returning.pending, true)
})

test('acknowledged forms stay visible and reveal state never exceeds earned care', () => {
  const acknowledged = companionRevealState(340, 8)
  assert.equal(acknowledged.visible.level, 8)
  assert.equal(acknowledged.pending, false)

  const resetData = companionRevealState(20, 8)
  assert.equal(resetData.visible.level, 1)
  assert.equal(resetData.pending, false)
})

test('a workout can explain exactly how much care the session and sets supplied', () => {
  assert.deepEqual(companionWorkoutCare(3), { earned: 14, session: 8, sets: 6 })
  assert.deepEqual(companionWorkoutCare(2, { includeSession: false }), { earned: 4, session: 0, sets: 4 })
})
