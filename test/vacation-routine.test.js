import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const library = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'))
const catalogue = JSON.parse(readFileSync(new URL('../data/programs.json', import.meta.url), 'utf8'))
const trainSource = readFileSync(new URL('../src/ui/screens/train.js', import.meta.url), 'utf8')
const sessionSource = readFileSync(new URL('../src/ui/screens/session.js', import.meta.url), 'utf8')

const workoutIds = [
  'face_pull',
  'incline_bench_bb',
  'chest_supported_row_machine',
  'lat_pulldown_neutral',
  'leg_press_machine',
  'leg_curl',
  'lateral_raise_machine',
  'reverse_pec_deck',
  'preacher_curl_machine',
  'triceps_extension_machine',
]

test('vacation Full Body B is the same complete workout in the plan and Extra Routines', () => {
  const program = catalogue.programs.find((entry) => entry.id === 'grand-isolation-week')
  const planned = program.days.find((day) => day.id === 'tuesday')
  const routine = library.routines.find((entry) => entry.id === 'grand-full-body-b')

  assert.equal(program.schemaVersion, 2, 'existing installs need a seeded-program upgrade')
  assert.equal(planned.name, 'B · Full Body Physique')
  assert.equal(routine.name, 'The Grand · Full Body B')
  assert.deepEqual(planned.exercises.map((entry) => entry.exerciseId), workoutIds)
  assert.deepEqual(routine.exercises.map((entry) => entry.id), workoutIds)
  assert.equal(planned.exercises[1].method, 'Machine')
  assert.equal(routine.exercises[1].method, 'Machine')
  assert.equal(planned.exercises.reduce((sum, entry) => sum + entry.sets, 0), 25)
  assert.equal(routine.exercises.reduce((sum, entry) => sum + entry.sets, 0), 25)
  assert.equal(planned.estimatedMinutes, 60)
  assert.match(program.note, /45–60 minute/)
})

test('every Full Body B movement resolves to the exercise library', () => {
  const exercises = new Set(library.exercises.map((exercise) => exercise.id))
  for (const id of workoutIds) assert.ok(exercises.has(id), `${id} is missing from the exercise library`)
})

test('standalone routines preserve their prescribed display name and equipment method', () => {
  assert.match(trainSource, /const name = item\.name \?\? exercise\?\.name/)
  assert.match(sessionSource, /workout\.prepareExercise\(entry\.id,[\s\S]*?entry\.method \?\? null\)/)
  assert.match(sessionSource, /\.\.\.\(entry\.name \? \{ name: entry\.name \} : \{\}\)/)
})
