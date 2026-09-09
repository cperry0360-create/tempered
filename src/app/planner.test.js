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

test('unfinished work and personal tasks roll forward until checked off', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const planner = createPlannerService({ storage, clock: fixedClock() })

  const work = await planner.add({ date: '2026-09-03', title: 'Finish proposal', kind: 'work' })
  const personal = await planner.add({ date: '2026-09-04', title: 'Call dentist', kind: 'personal' })
  await planner.add({ date: '2026-09-05', title: 'Today task', kind: 'personal' })

  const today = await planner.list('2026-09-05')
  assert.deepEqual(today.map((row) => row.title), ['Finish proposal', 'Call dentist', 'Today task'])
  assert.deepEqual(today.slice(0, 2).map((row) => row.rolloverFrom), ['2026-09-03', '2026-09-04'])

  await planner.toggle(work.id)
  assert.deepEqual((await planner.list('2026-09-05')).map((row) => row.title), ['Call dentist', 'Today task'])
  assert.equal((await storage.get('plannerItems', personal.id)).date, '2026-09-04')
})

test('planner details preserve notes and optional due dates', async () => {
  const storage = createMemoryStorage()
  await storage.open()
  const planner = createPlannerService({ storage, clock: fixedClock() })
  const row = await planner.add({ title: 'Draft memo', kind: 'work' })

  const updated = await planner.update(row.id, {
    title: 'Draft the long international tax memo',
    notes: 'Cover the safe harbor and review comments.',
    dueDate: '2026-09-10',
  })
  assert.equal(updated.title, 'Draft the long international tax memo')
  assert.equal(updated.notes, 'Cover the safe harbor and review comments.')
  assert.equal(updated.dueDate, '2026-09-10')

  const cleared = await planner.update(row.id, { dueDate: '' })
  assert.equal(cleared.dueDate, null)
})
