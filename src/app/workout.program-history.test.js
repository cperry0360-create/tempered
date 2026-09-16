import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBalance } from '../../test/helpers/balance.js'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { createWorkoutService } from './workout.js'
import { seedLibrary, ensureProfile, seedPrograms } from './seed.js'

const balance = loadBalance()
const library = JSON.parse(readFileSync(new URL('../../data/exercises.json', import.meta.url), 'utf8'))
const catalogue = JSON.parse(readFileSync(new URL('../../data/programs.json', import.meta.url), 'utf8'))

async function freshApp() {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-16T12:00:00.000Z')
  await seedLibrary(storage, library)
  await seedPrograms(storage, catalogue, clock)
  await ensureProfile(storage, clock)
  return { storage, workout: createWorkoutService({ storage, clock, balance }) }
}

test('a completed program slot records its program revision and prescription snapshot', async () => {
  const { storage, workout } = await freshApp()
  await workout.completeSlot(
    { dayId: 'monday', slotIndex: 0, exerciseId: 'incline_bench_bb' },
    [{ weight: 95, reps: 6 }],
  )

  const session = (await storage.getAll('sessions'))[0]
  const log = (await storage.getAll('setLogs'))[0]
  assert.equal(session.programId, 'november-physique')
  assert.equal(session.programRevisionId, 'november-physique:r1')
  assert.equal(log.programId, 'november-physique')
  assert.equal(log.programRevisionId, 'november-physique:r1')
  assert.equal(log.programDayId, 'monday')
  assert.equal(log.slotIndex, 0)
  assert.equal(log.prescribed.exerciseId, 'incline_bench_bb')
  assert.equal(log.prescribed.repMin, 6)
  assert.equal(log.prescribed.repMax, 10)
})
