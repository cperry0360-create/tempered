import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadExercises } from '../../test/helpers/balance.js'
import { dayTasks, weekTasks, weeklyHardSetsCompleted, slotKey, isInSameProgramWeek, TARGET_GROUPS } from './tasks.js'
import { daysBetween } from '../adapters/clock/clock.js'

const exercises = loadExercises()
const programs = JSON.parse(readFileSync(new URL('../../data/programs.json', import.meta.url), 'utf8'))
const november = programs.programs.find((p) => p.id === 'november-physique')
const monday = november.days[0]

/** @param {string} dayId @param {number} index @param {number} count */
const logs = (dayId, index, count, exerciseId = 'incline_bench_bb') =>
  Array.from({ length: count }, () => ({ programDayId: dayId, slotIndex: index, exerciseId }))

test('a slot is outstanding until its prescribed sets are logged', () => {
  const partial = dayTasks(monday, logs('monday', 0, 2))[0]
  assert.equal(partial.prescribed, 4)
  assert.equal(partial.logged, 2)
  assert.equal(partial.done, false)
  assert.equal(partial.started, true)
})

test('a slot is done once its sets are in', () => {
  const complete = dayTasks(monday, logs('monday', 0, 4))[0]
  assert.equal(complete.done, true)
  assert.equal(complete.started, false, 'done is not also "started"')
})

test('slots are tracked independently, not by exercise', () => {
  // Lateral raises appear on three different days. Doing Monday's must not
  // mark Thursday's complete.
  const tasks = dayTasks(monday, logs('monday', 3, 4, 'lateral_raise_db'))
  assert.equal(tasks[3].done, true)
  const thursday = november.days[3]
  const thursdayTasks = dayTasks(thursday, logs('monday', 3, 4, 'lateral_raise_db'))
  assert.equal(thursdayTasks.every((task) => !task.done), true,
    "Monday's work must not complete Thursday's slots")
})

test('warmup sets do not complete a slot', () => {
  const warmups = logs('monday', 0, 4).map((log) => ({ ...log, isWarmup: true }))
  assert.equal(dayTasks(monday, warmups)[0].done, false)
})

test('slot keys are stable and distinguish day from index', () => {
  assert.equal(slotKey('monday', 0), 'monday#0')
  assert.notEqual(slotKey('monday', 1), slotKey('tuesday', 1))
})

test('the week view counts across every day', () => {
  const week = weekTasks(november, [...logs('monday', 0, 4), ...logs('tuesday', 0, 4, 'lat_pulldown')])
  assert.equal(week.total, 30)
  assert.equal(week.done, 2)
  assert.equal(week.days[0].done, 1)
})

// --- rollover --------------------------------------------------------------

test("an unfinished Monday slot is still completable later in the same week", () => {
  // Monday's slot 3, finished on Thursday: same week logs, so it counts.
  const doneOnThursday = logs('monday', 3, 4, 'lateral_raise_db')
  assert.equal(dayTasks(monday, doneOnThursday)[3].done, true,
    'the day a slot was completed is irrelevant within the week')
})

test('at the week boundary outstanding work clears rather than carrying', () => {
  // Completion is derived from THIS week's logs. Last week's logs are simply
  // not in the set, so nothing carries and nothing has to be reset.
  const lastWeeksLogs = []
  const tasks = dayTasks(monday, lastWeeksLogs)
  assert.equal(tasks.every((task) => !task.done && !task.started), true)
  assert.equal(tasks.length, monday.exercises.length, 'the new week is prescribed in full again')
})

test('program weeks are bounded by the start date, not the calendar week', () => {
  const started = '2026-09-07'
  assert.equal(isInSameProgramWeek(started, '2026-09-07', '2026-09-13', daysBetween), true)
  assert.equal(isInSameProgramWeek(started, '2026-09-13', '2026-09-07', daysBetween), true)
  assert.equal(isInSameProgramWeek(started, '2026-09-14', '2026-09-13', daysBetween), false,
    'day 8 begins a new program week')
})

// --- weekly hard sets ------------------------------------------------------

test('hard sets are counted from logged work, never from the prescription', () => {
  const completed = weeklyHardSetsCompleted(
    logs('monday', 0, 4, 'incline_bench_bb'), exercises, november.weeklyTargets)
  const chest = completed.find((row) => row.group === 'chest')
  assert.equal(chest.sets, 4, 'four logged incline press sets are four chest sets')
  assert.deepEqual(chest.target, [12, 16])
  assert.equal(chest.met, false)
  assert.equal(chest.short, 8, 'eight more reach the bottom of the range')
})

test('meeting the bottom of the range counts as met', () => {
  const completed = weeklyHardSetsCompleted(
    logs('monday', 0, 12, 'incline_bench_bb'), exercises, november.weeklyTargets)
  const chest = completed.find((row) => row.group === 'chest')
  assert.equal(chest.met, true)
  assert.equal(chest.short, 0)
})

test('shortfall is never negative — outstanding work is not a debt', () => {
  const completed = weeklyHardSetsCompleted(
    logs('monday', 0, 40, 'incline_bench_bb'), exercises, november.weeklyTargets)
  for (const row of completed) assert.ok(row.short >= 0, `${row.group} reported a negative shortfall`)
})

test('groups with no target are still counted, just not scored against one', () => {
  const completed = weeklyHardSetsCompleted(
    logs('monday', 0, 3, 'incline_curl_db'), exercises, november.weeklyTargets)
  const arms = completed.find((row) => row.group === 'arms')
  assert.equal(arms.sets, 3)
  assert.equal(arms.target, null)
  assert.equal(arms.short, 0)
})

test('every targeted group in the program maps to real activation keys', () => {
  const known = new Set(
    [...exercises.values()].flatMap((exercise) => Object.keys(exercise.activation ?? {})))
  for (const [group, members] of Object.entries(TARGET_GROUPS)) {
    for (const muscle of members) {
      assert.ok(known.has(muscle), `${group} maps to ${muscle}, which no exercise uses`)
    }
  }
})

test('every target in programs.json has somewhere to be counted', () => {
  for (const group of Object.keys(november.weeklyTargets)) {
    if (group.startsWith('_')) continue
    assert.ok(TARGET_GROUPS[group], `${group} has a target but no activation mapping`)
  }
})
