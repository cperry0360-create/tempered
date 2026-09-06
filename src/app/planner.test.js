import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage } from '../adapters/storage/memory-storage.js'
import { createPlannerService } from './planner.js'

function fixedClock() {
  let now = 1_725_580_000_000
  return {
    today: () => '2026-09-05',
    now: () => now++,
    nowIso: () => new Date(now++).toISOString(),
  }
}

test('planner keeps dated work and personal tasks separate from other days', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const planner = createPlannerService({ storage, clock: fixedClock() })

  await planner.add({ date: '2026-09-05', title: 'Draft memo', kind: 'work' })
  await planner.add({ date: '2026-09-05', title: 'Call plumber', kind: 'personal' })
  await planner.add({ date: '2026-09-06', title: 'Review deck', kind: 'work' })

  const saturday = await planner.list('2026-09-05')
  assert.equal(saturday.length, 2)
  assert.deepEqual(saturday.map((row) => [row.title, row.kind]), [
    ['Draft memo', 'work'],
    ['Call plumber', 'personal'],
  ])
})

test('planner completion is reversible and completed tasks sort after open tasks', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const planner = createPlannerService({ storage, clock: fixedClock() })

  const first = await planner.add({ title: 'Draft memo', kind: 'work' })
  await planner.add({ title: 'Walk Bailey', kind: 'personal' })
  const done = await planner.toggle(first.id)
  assert.equal(done.done, true)
  assert.ok(done.completedAt)
  assert.deepEqual((await planner.list()).map((row) => row.title), ['Walk Bailey', 'Draft memo'])

  const reopened = await planner.toggle(first.id)
  assert.equal(reopened.done, false)
  assert.equal(reopened.completedAt, null)
})
