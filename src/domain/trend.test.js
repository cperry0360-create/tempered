import test from 'node:test'
import assert from 'node:assert/strict'

const run = async () => import('./trend.js')
const days = (values, start = '2026-09-01') => values.map((value, i) => ({
  date: '2026-09-' + String(Number(start.slice(8)) + i).padStart(2, '0'), value }))

test('rolling average by days uses only the trailing window', async () => {
  const { rollingAverage } = await run()
  const avg = rollingAverage(days([1, 2, 3, 4, 5, 6, 7, 8]), { days: 7 })
  assert.deepEqual(avg.map(p => p.value), [1, 1.5, 2, 2.5, 3, 3.5, 4, 5])
  const gap = rollingAverage([{ date: '2026-09-01', value: 10 }, { date: '2026-09-20', value: 20 }], { days: 7 })
  assert.deepEqual(gap.map(p => p.value), [10, 20])
})

test('rolling average by count serves session-based lifts', async () => {
  const { rollingAverage } = await run()
  assert.deepEqual(rollingAverage(days([100, 110, 120, 130]), { count: 3 }).map(p => p.value), [100, 105, 110, 120])
})

test('change compares the first and last trend values, with arrow and unit', async () => {
  const { summarizeTrend } = await run()
  const s = summarizeTrend(days([170, 170, 169, 169, 168, 168, 168, 167]), { metric: 'weight', unit: ' lb', digits: 1, rangeLabel: '30 days' })
  assert.equal(s.sparse, false)
  assert.ok(s.change < 0)
  assert.match(s.changeText, /^↓ \d+\.\d lb over 30 days$/)
  assert.equal(s.good, false, 'weight is neutral without a goal')
})

test('fewer than 7 readings is sparse: no trend line, plain message', async () => {
  const { summarizeTrend } = await run()
  const s = summarizeTrend(days([60, 61, 59, 62, 60, 61]), { metric: 'restingHr', unit: ' bpm' })
  assert.equal(s.sparse, true); assert.deepEqual(s.trend, []); assert.equal(s.changeText, 'Not enough data for a trend')
  assert.equal(s.good, false)
})

test('good-direction table: resting HR down is good, HRV up is good, neutral metrics never are', async () => {
  const { isGoodChange, GOOD_DIRECTION } = await run()
  assert.equal(isGoodChange('restingHr', -2), true); assert.equal(isGoodChange('restingHr', 2), false)
  assert.equal(isGoodChange('hrvMs', 4), true); assert.equal(isGoodChange('hrvMs', -4), false)
  for (const metric of ['sleepHours', 'steps', 'e1rm']) assert.equal(isGoodChange(metric, 1), true)
  for (const metric of ['weight', 'respiratoryRate', 'spo2']) {
    assert.equal(GOOD_DIRECTION[metric], 'neutral'); assert.equal(isGoodChange(metric, 1), false); assert.equal(isGoodChange(metric, -1), false)
  }
  assert.equal(isGoodChange('weight', -1, { weightGoal: 'down' }), true)
  assert.equal(isGoodChange('weight', 1, { weightGoal: 'down' }), false)
  assert.equal(isGoodChange('hrvMs', 0), false)
})

test('normal range band is the 30-day mean ± 1 SD, and flags readings outside it', async () => {
  const { normalBand, summarizeTrend } = await run()
  const band = normalBand([58, 60, 62, 60, 60])
  assert.equal(band.mean, 60); assert.ok(Math.abs(band.low - (60 - Math.sqrt(1.6))) < 1e-9); assert.ok(Math.abs(band.high - (60 + Math.sqrt(1.6))) < 1e-9)
  const s = summarizeTrend(days([60, 60, 61, 59, 60, 60, 61, 59, 60, 70]), { metric: 'restingHr', unit: ' bpm', band: true })
  assert.ok(s.band && s.band.high < 70); assert.equal(s.outside, 'above'); assert.equal(s.changeText, 'Above your usual range')
})

test('a barely varying metric is not flagged for a one-point wobble', async () => {
  const { summarizeTrend } = await run()
  const s = summarizeTrend(days([97, 98, 97, 98, 97, 98, 97, 98, 97, 98]), { metric: 'spo2', unit: '%', band: true })
  assert.equal(s.outside, null); assert.doesNotMatch(s.changeText, /usual range/)
})
