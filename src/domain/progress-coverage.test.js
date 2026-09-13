import test from 'node:test'
import assert from 'node:assert/strict'

import {
  observedProgressDates,
  progressDataStart,
  recordedSampleCount,
} from './progress-coverage.js'

test('progress starts with the first recorded day rather than inventing earlier zeroes', () => {
  const start = progressDataStart({
    today: '2026-09-13',
    dayLogs: [{ date: '2026-09-10', steps: 9000 }],
    sessions: [],
  })
  assert.equal(start, '2026-09-10')
  assert.deepEqual(
    observedProgressDates(['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'], start),
    ['2026-09-10', '2026-09-11'],
  )
})

test('a completed workout can establish progress coverage without a lifestyle log', () => {
  assert.equal(progressDataStart({
    today: '2026-09-13',
    dayLogs: [],
    sessions: [
      { date: '2026-09-09' },
      { date: '2026-09-11', endedAt: '2026-09-11T12:30:00Z' },
    ],
  }), '2026-09-11')
})

test('future records and unfinished workout drafts do not create fake coverage', () => {
  assert.equal(progressDataStart({
    today: '2026-09-13',
    dayLogs: [{ date: '2026-09-14', steps: 1 }],
    sessions: [{ date: '2026-09-12' }],
  }), null)
})

test('a deliberately logged zero remains a real sample while missing values do not', () => {
  assert.equal(recordedSampleCount([undefined, null, 0, 8100, Number.NaN]), 2)
})
