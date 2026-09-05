import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIVE_SESSION_DRAFT_KEY,
  clearActiveSessionDraft,
  loadActiveSessionDraft,
  saveActiveSessionDraft,
} from './session-draft.js'

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

const draft = {
  version: 1,
  session: { id: 's_active', title: 'Upper A', returnTab: 'train' },
  plan: [{ exercise: { id: 'incline_bench_db' }, sets: [{ weight: 135, reps: 8, logged: true }] }],
  loggedHereIds: ['sl_1'],
  isFirstOfDay: true,
  rest: { exerciseId: 'incline_bench_db', endsAt: 123456 },
  openPanel: null,
}

test('active workout draft round-trips exactly', () => {
  const storage = fakeStorage()
  assert.equal(saveActiveSessionDraft(draft, storage), true)
  assert.deepEqual(loadActiveSessionDraft(storage), draft)
})

test('invalid or corrupt drafts are ignored and removed', () => {
  const storage = fakeStorage()
  storage.setItem(ACTIVE_SESSION_DRAFT_KEY, '{not json')
  assert.equal(loadActiveSessionDraft(storage), null)
  assert.equal(storage.getItem(ACTIVE_SESSION_DRAFT_KEY), null)
  storage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify({ version: 1, plan: [] }))
  assert.equal(loadActiveSessionDraft(storage), null)
  assert.equal(storage.getItem(ACTIVE_SESSION_DRAFT_KEY), null)
})

test('clear removes a resumable workout', () => {
  const storage = fakeStorage()
  saveActiveSessionDraft(draft, storage)
  assert.equal(clearActiveSessionDraft(storage), true)
  assert.equal(loadActiveSessionDraft(storage), null)
})

test('unavailable storage never makes workout logging throw', () => {
  const broken = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }
  assert.equal(saveActiveSessionDraft(draft, broken), false)
  assert.equal(loadActiveSessionDraft(broken), null)
  assert.equal(clearActiveSessionDraft(broken), false)
})
