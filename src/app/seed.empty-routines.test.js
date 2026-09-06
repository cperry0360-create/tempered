import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { seedLibrary } from './seed.js'

test('seedLibrary removes an old empty seeded routine and does not recreate it', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  await storage.put('routines', { id: 'cardio', name: 'Cardio', exercises: [] })

  const result = await seedLibrary(storage, {
    exercises: [],
    routines: [
      { id: 'cardio', name: 'Cardio', exercises: [] },
      { id: 'upper', name: 'Upper', exercises: [{ id: 'press', sets: 3 }] },
    ],
  })

  assert.equal(await storage.get('routines', 'cardio'), null)
  assert.deepEqual(await storage.get('routines', 'upper'), {
    id: 'upper', name: 'Upper', exercises: [{ id: 'press', sets: 3 }],
  })
  assert.deepEqual(result, { exercises: 0, routines: 1 })
})

test('seedLibrary preserves a user-modified seeded routine once it has exercises', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const customised = {
    id: 'cardio',
    name: 'My Cardio',
    exercises: [{ id: 'custom_interval', sets: 4 }],
  }
  await storage.put('routines', customised)

  await seedLibrary(storage, {
    exercises: [],
    routines: [{ id: 'cardio', name: 'Cardio', exercises: [] }],
  })

  assert.deepEqual(await storage.get('routines', 'cardio'), customised)
})
