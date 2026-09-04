import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { mindAwards } from './mind.js'
import { totalsBySource } from './xp-engine.js'

const balance = loadBalance()
const src = (awards) => totalsBySource(awards)

test('SOURCE: reading pays per minute', () => {
  assert.equal(src(mindAwards({ date: 'd', readingMinutes: 30 }, balance))['mind.reading'],
    30 * balance.mind.xpPerReadingMinute)
})

test('SOURCE: study pays per minute', () => {
  assert.equal(src(mindAwards({ date: 'd', studyMinutes: 25 }, balance))['mind.study'],
    25 * balance.mind.xpPerStudyMinute)
})

test('SOURCE: meditation pays per minute', () => {
  assert.equal(src(mindAwards({ date: 'd', meditationMinutes: 10 }, balance))['mind.meditation'],
    10 * balance.mind.xpPerMeditationMinute)
})

test('SOURCE: instrument practice pays at the study rate', () => {
  assert.equal(src(mindAwards({ date: 'd', instrumentMinutes: 20 }, balance))['mind.instrument'],
    20 * balance.mind.xpPerStudyMinute)
})

test('SOURCE: journalling is a marked award', () => {
  assert.equal(src(mindAwards({ date: 'd', journalLogged: true }, balance))['mind.journal'],
    balance.mind.journalXp)
})

test('the daily cap holds, and the breakdown still sums to the total awarded', () => {
  const awards = mindAwards({
    date: 'd', readingMinutes: 300, studyMinutes: 300, meditationMinutes: 300, journalLogged: true,
  }, balance)
  const total = awards.reduce((sum, a) => sum + a.xp, 0)
  assert.ok(Math.abs(total - balance.mind.dailyMindCapXp) < 1e-9)
  assert.ok(awards.length > 1, 'the cap scales sources rather than dropping them')
})

test('under the cap nothing is scaled', () => {
  const awards = mindAwards({ date: 'd', readingMinutes: 10 }, balance)
  assert.equal(awards[0].xp, 10 * balance.mind.xpPerReadingMinute)
})
