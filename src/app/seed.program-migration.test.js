import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { fixedClock } from '../adapters/clock/clock.js'
import { seedPrograms } from './seed.js'

test('a versioned seeded-program upgrade reaches existing installs without resetting progress', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const clock = fixedClock('2026-09-09T09:00:00.000Z')
  await storage.put('programs', {
    id: 'november-physique',
    schemaVersion: 1,
    weeks: 8,
    days: [{ id: 'monday', exercises: [{ exerciseId: 'press', weight: 115 }] }],
  })
  await storage.put('programState', {
    programId: 'november-physique', startedOn: '2026-08-31', active: true,
  })

  const result = await seedPrograms(storage, { programs: [{
    id: 'november-physique',
    schemaVersion: 2,
    weeks: 8,
    days: [
      { id: 'monday', exercises: [{ exerciseId: 'press', weight: 95 }] },
      { id: 'wednesday', exercises: [{ exerciseId: 'calf_raise' }, { exerciseId: 'ab_wheel_rollout' }] },
    ],
  }] }, clock)

  const upgraded = await storage.get('programs', 'november-physique')
  assert.equal(result.programs, 0)
  assert.equal(upgraded.schemaVersion, 2)
  assert.equal(upgraded.days[0].exercises[0].weight, 115, 'user-configured working weight survives')
  assert.equal(upgraded.days[1].exercises[0].exerciseId, 'calf_raise')
  assert.deepEqual(await storage.get('programState', 'november-physique'), {
    programId: 'november-physique', startedOn: '2026-08-31', active: true,
  })
})
