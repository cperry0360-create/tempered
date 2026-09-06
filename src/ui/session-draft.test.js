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

test('an otherwise valid empty workout draft is rejected and purged', () => {
  const storage = fakeStorage()
  const empty = {
    ...draft,
    session: { ...draft.session, id: 's_empty', title: 'Cardio' },
    plan: [],
    loggedHereIds: [],
  }
  storage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify(empty))
  assert.equal(loadActiveSessionDraft(storage), null)
  assert.equal(storage.getItem(ACTIVE_SESSION_DRAFT_KEY), null)
})

test('saving an empty state clears an older valid checkpoint', () => {
  const storage = fakeStorage()
  assert.equal(saveActiveSessionDraft(draft, storage), true)
  assert.equal(saveActiveSessionDraft({ ...draft, plan: [] }, storage), false)
  assert.equal(loadActiveSessionDraft(storage), null)
})

test('a plan may contain an emptied exercise as long as another exercise is still loggable', () => {
  const storage = fakeStorage()
  const partial = {
    ...draft,
    plan: [
      { exercise: { id: 'incline_bench_db' }, sets: [] },
      { exercise: { id: 'row' }, sets: [{ weight: 90, reps: 10, logged: false }] },
    ],
  }
  assert.equal(saveActiveSessionDraft(partial, storage), true)
  assert.deepEqual(loadActiveSessionDraft(storage), partial)
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
