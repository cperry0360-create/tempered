import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance, loadExercises } from '../../test/helpers/balance.js'
import { weekFromStart, isDeloadWeek, prescribeFromProgram, weeklyHardSets } from './programs.js'

const balance = loadBalance()
const exercises = loadExercises()
const programs = JSON.parse(readFileSync(new URL('../../data/programs.json', import.meta.url), 'utf8'))
const november = programs.programs.find((p) => p.id === 'november-physique')
const slot = november.days[0].exercises[0]        // Incline Barbell Bench, 4 x 6-10
const perSideSlot = november.days[1].exercises[2] // One-Arm Dumbbell Row, 3 x 8-12 /side

test('the seeded program is the one docs/09 describes', () => {
  assert.equal(november.weeks, 8)
  assert.equal(november.days.length, 5)
  assert.equal(november.days.reduce((n, d) => n + d.exercises.length, 0), 30)
  const unique = new Set(november.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))
  assert.equal(unique.size, 17)
})

test('every program slot resolves to a real exercise', () => {
  for (const day of november.days) {
    for (const entry of day.exercises) {
      assert.ok(exercises.get(entry.exerciseId), `${entry.name} -> ${entry.exerciseId} is not in the library`)
    }
  }
})

test('weeks roll over on the calendar, not per session', () => {
  assert.equal(weekFromStart(0, 8), 1)
  assert.equal(weekFromStart(6, 8), 1)
  assert.equal(weekFromStart(7, 8), 2)
  assert.equal(weekFromStart(48, 8), 7)   // day 49 begins week 8
  assert.equal(weekFromStart(49, 8), 8)
})

test('a program does not run past its last week', () => {
  assert.equal(weekFromStart(365, 8), 8)
})

test('the final week is a deload', () => {
  assert.equal(isDeloadWeek(7, november), false)
  assert.equal(isDeloadWeek(8, november), true)
})

test('a deload holds weight rather than adding it', () => {
  const last = { date: 'd1', sets: [{ weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }] }
  const plan = prescribeFromProgram({ slot, week: 8, program: november, last, exercise: exercises.get(slot.exerciseId) }, balance)
  assert.equal(plan.deload, true)
  assert.equal(plan.isIncrease, false)
  assert.equal(plan.sets[0].weight, 135, 'deload must not add load')
  assert.match(plan.reason, /Hold the weight/)
})

test('rep ranges are the prescription: a first session aims at the bottom', () => {
  const plan = prescribeFromProgram({ slot, week: 1, program: november, last: null, exercise: exercises.get(slot.exerciseId) }, balance)
  assert.equal(plan.sets.length, slot.sets)
  assert.equal(plan.sets[0].reps, slot.repMin)
  assert.match(plan.reason, /6–10/)
})

test('a Phase 7 starting weight prefills the first session without creating fake history', () => {
  const configured = { ...slot, weight: 115 }
  const plan = prescribeFromProgram({ slot: configured, week: 1, program: november, last: null, exercise: exercises.get(slot.exerciseId) }, balance)
  assert.equal(plan.sets.length, slot.sets)
  assert.equal(plan.sets[0].weight, 115)
  assert.equal(plan.sets[0].reps, slot.repMin)
  assert.match(plan.reason, /Start at 115/)
})

test('real history outranks a configured starting weight after the first session', () => {
  const configured = { ...slot, weight: 115 }
  const last = { date: 'd1', sets: Array.from({ length: 4 }, () => ({ weight: 125, reps: 7 })) }
  const plan = prescribeFromProgram({ slot: configured, week: 2, program: november, last, exercise: exercises.get(slot.exerciseId) }, balance)
  assert.equal(plan.sets[0].weight, 125)
  assert.equal(plan.sets[0].reps, 8)
})

test('double progression: hit the top of the range everywhere, then add load', () => {
  const last = { date: 'd1', sets: Array.from({ length: 4 }, () => ({ weight: 135, reps: 10 })) }
  const plan = prescribeFromProgram({ slot, week: 2, program: november, last, exercise: exercises.get(slot.exerciseId) }, balance)
  assert.equal(plan.isIncrease, true)
  assert.equal(plan.sets[0].weight, 135 + balance.progressionDefaults.linearIncrementUpperLbs)
  assert.equal(plan.sets[0].reps, slot.repMin, 'reps reset to the bottom of the range')
})

test('short of the top of the range, the weight holds and the reps climb', () => {
  const last = { date: 'd1', sets: Array.from({ length: 4 }, () => ({ weight: 135, reps: 7 })) }
  const plan = prescribeFromProgram({ slot, week: 2, program: november, last, exercise: exercises.get(slot.exerciseId) }, balance)
  assert.equal(plan.isIncrease, false)
  assert.equal(plan.sets[0].weight, 135)
  assert.equal(plan.sets[0].reps, 8)
})

test('one set short of the top does not earn the load', () => {
  const last = { date: 'd1', sets: [
    { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 10 }, { weight: 135, reps: 9 },
  ] }
  const plan = prescribeFromProgram({ slot, week: 2, program: november, last, exercise: exercises.get(slot.exerciseId) }, balance)
  assert.equal(plan.isIncrease, false)
  assert.equal(plan.sets[0].weight, 135)
})

test('per-side sets are carried through to the session', () => {
  assert.equal(perSideSlot.perSide, true)
  const plan = prescribeFromProgram({ slot: perSideSlot, week: 1, program: november, last: null, exercise: exercises.get(perSideSlot.exerciseId) }, balance)
  assert.equal(plan.sets[0].perSide, true)
  assert.match(plan.reason, /per side/)
})

test('the guide is derived from the program, so it cannot drift from it', () => {
  const targets = weeklyHardSets(november, exercises)
  assert.ok(targets.length > 4, 'a five-day upper-biased program touches several groups')
  const groups = Object.fromEntries(targets.map((t) => [t.group, t.sets]))

  // docs/09 calls this upper-body-biased with one short lower day.
  assert.ok(groups.mid_delts > 0 && groups.pecs > 0 && groups.lats > 0)
  assert.ok((groups.quads ?? 0) < groups.pecs, 'legs must not out-volume chest in this program')
  assert.equal(targets[0].sets, Math.max(...targets.map((t) => t.sets)), 'sorted by volume')
})

test('Might scoring is untouched by rep ranges', () => {
  // The prescription is a range; the score is what was performed. A range
  // appears nowhere in the sets handed to the XP engine.
  const plan = prescribeFromProgram({ slot, week: 1, program: november, last: null, exercise: exercises.get(slot.exerciseId) }, balance)
  for (const set of plan.sets) {
    assert.ok(!('repMin' in set) && !('repMax' in set) && !('range' in set))
    assert.equal(typeof set.reps, 'number')
  }
})
