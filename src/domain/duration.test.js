/**
 * Time under load — `docs/11-structure-and-feel.md` F1.
 *
 * The bug: a five-minute session reported 2h 30m. Under the micro-set model of
 * `docs/10` a session record spans the whole day, because every slot completed
 * that day joins the same session. Wall-clock from first log to last is
 * therefore a measure of when you woke up, not of how long you trained — and it
 * fed `grit.hours` directly, so the day paid XP for the gaps between sittings.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBalance } from '../../test/helpers/balance.js'
import { timeUnderLoad, sittingsOf } from './duration.js'

const balance = loadBalance()
const gap = balance.session.sittingGapMinutes
const perSet = balance.session.minutesPerSet

/** Times, in minutes from an arbitrary origin, as ISO strings. */
const at = (...minutes) => minutes.map((m) => new Date(Date.UTC(2026, 8, 4, 8, 0, 0) + m * 60000).toISOString())

test('THE BUG: a short session logged across the day is not a long session', () => {
  // Two sets five minutes apart, then one more two and a half hours later.
  // The old computation returned the 150-minute span.
  const minutes = timeUnderLoad(at(0, 5, 150), balance)
  assert.ok(minutes < 20, `two short sittings reported ${minutes} minutes`)
})

test('one sitting is its span plus the last set, not just the span', () => {
  // Four sets over twelve minutes is twelve minutes of gaps plus a final set.
  assert.equal(timeUnderLoad(at(0, 4, 8, 12), balance), 12 + perSet)
})

test('a single set is not zero minutes of work', () => {
  assert.equal(timeUnderLoad(at(0), balance), perSet)
})

test('sittings split on a gap and their spans add up', () => {
  const times = at(0, 10, 10 + gap + 30, 10 + gap + 40)
  assert.equal(sittingsOf(times, balance).length, 2)
  // 10 + perSet for the first sitting, 10 + perSet for the second.
  assert.equal(timeUnderLoad(times, balance), (10 + perSet) * 2)
})

test('a gap exactly at the threshold is still the same sitting', () => {
  // Rest between heavy squat sets can be long. The boundary has to be
  // exclusive or a genuine five-minute rest could split a set of triples.
  const times = at(0, gap)
  assert.equal(sittingsOf(times, balance).length, 1)
  assert.equal(timeUnderLoad(times, balance), gap + perSet)
})

test('order does not matter — logs arrive as they are written, not sorted', () => {
  assert.equal(timeUnderLoad(at(12, 0, 8, 4), balance), timeUnderLoad(at(0, 4, 8, 12), balance))
})

test('nothing logged is no time under load', () => {
  assert.equal(timeUnderLoad([], balance), 0)
  assert.equal(timeUnderLoad(null, balance), 0)
})

test('unparseable timestamps are ignored rather than poisoning the total', () => {
  // A log written by an older build may carry no completedAt at all.
  const times = [...at(0, 4), null, undefined, 'not a date']
  assert.equal(timeUnderLoad(times, balance), 4 + perSet)
})

test('the result never exceeds the wall-clock span it came from', () => {
  // The whole point is that it is a floor on honesty: time under load can equal
  // the span for one continuous sitting, and must never beat it.
  for (const times of [at(0, 5, 150), at(0, 4, 8, 12), at(0, 30, 90, 200)]) {
    const span = (Date.parse(times.at(-1)) - Date.parse(times[0])) / 60000
    assert.ok(timeUnderLoad(times, balance) <= span + perSet,
      `${timeUnderLoad(times, balance)} exceeds the ${span}-minute span`)
  }
})

test('a long rest inside one sitting still counts as time under load', () => {
  // Three minutes under the threshold is rest between sets, not a second visit.
  const times = at(0, gap - 1)
  assert.equal(timeUnderLoad(times, balance), (gap - 1) + perSet)
})
