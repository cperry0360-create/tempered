import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyWorkoutQueue } from '../src/ui/today-workout.js'

const slot = (name, exerciseId, sets = 3) => ({ name, exerciseId, sets, repMin: 8, repMax: 12 })
const task = (dayId, index, name, logged, prescribed = 3) => ({
  key: `${dayId}#${index}`,
  index,
  slot: slot(name, name.toLowerCase().replaceAll(' ', '_'), prescribed),
  logged,
  prescribed,
  done: logged >= prescribed,
  started: logged > 0 && logged < prescribed,
})
const day = (id, name, tasks) => ({ day: { id, name }, tasks })

function status() {
  return {
    week: {
      days: [
        day('monday', 'Delts + Arms', [
          task('monday', 0, 'Lateral Raise', 1, 3),
          task('monday', 1, 'Curl', 3, 3),
        ]),
        day('tuesday', 'Lower', [task('tuesday', 0, 'Front Squat', 3, 3)]),
        day('thursday', 'Push', [
          task('thursday', 0, 'Incline Bench', 0, 4),
          task('thursday', 1, 'Cable Fly', 3, 3),
        ]),
        day('friday', 'Back', [task('friday', 0, 'Lat Pulldown', 0, 3)]),
      ],
    },
  }
}

test('Today workout contains today slots plus unfinished earlier slots, not the whole week', () => {
  const queue = buildDailyWorkoutQueue(status(), '2026-09-10') // Thursday

  assert.deepEqual(queue.active.map((row) => row.name), ['Lateral Raise', 'Incline Bench'])
  assert.deepEqual(queue.completed.map((row) => row.name), ['Cable Fly'])
  assert.equal(queue.rollover.length, 1)
  assert.equal(queue.rollover[0].programDay.id, 'monday')
  assert.equal(queue.rollover[0].logged, 1)
  assert.equal(queue.rollover[0].prescribed, 3)
  assert.equal(queue.primaryDay.id, 'thursday')
  assert.equal(queue.active.some((row) => row.programDay.id === 'friday'), false, 'future work does not appear early')
})

test('a rest day carries unfinished earlier work forward', () => {
  const queue = buildDailyWorkoutQueue(status(), '2026-09-09') // Wednesday, no scheduled program day
  assert.deepEqual(queue.active.map((row) => row.name), ['Lateral Raise'])
  assert.equal(queue.completed.length, 0)
  assert.equal(queue.scheduledDay, null)
  assert.equal(queue.primaryDay.id, 'monday')
})

test('completed work from this morning remains represented on Today', () => {
  const complete = status()
  complete.week.days.find((entry) => entry.day.id === 'thursday').tasks[0] = task('thursday', 0, 'Incline Bench', 4, 4)
  const queue = buildDailyWorkoutQueue(complete, '2026-09-10')

  assert.equal(queue.today.length, 2)
  assert.equal(queue.completed.length, 2)
  assert.deepEqual(queue.active.map((row) => row.name), ['Lateral Raise'])
  assert.equal(queue.primaryDay.id, 'monday', 'after today is finished, the full-session action can pick up rollover work')
})
