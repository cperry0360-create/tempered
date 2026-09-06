/**
 * Short-lived checkpoint for an active workout.
 *
 * Checked sets remain canonical in IndexedDB. This localStorage record only
 * preserves the screen state that would otherwise disappear if iOS evicts the
 * installed PWA while it is backgrounded between sets.
 */
const KEY = 'tempered.activeWorkout.v1'
const DRAFT_VERSION = 1

function targetStorage(storage) {
  if (storage) return storage
  try { return globalThis.localStorage ?? null } catch { return null }
}

function validDraft(value) {
  const plan = value?.plan
  return value?.version === DRAFT_VERSION
    && typeof value?.session?.id === 'string'
    && value.session.id.length > 0
    && Array.isArray(plan)
    && plan.length > 0
    && plan.every((entry) =>
      typeof entry?.exercise?.id === 'string'
      && entry.exercise.id.length > 0
      && Array.isArray(entry.sets))
    && plan.some((entry) => entry.sets.length > 0)
}

export function saveActiveSessionDraft(draft, storage = null) {
  const target = targetStorage(storage)
  if (!target) return false
  if (!validDraft(draft)) {
    // Never leave an older resumable checkpoint behind after the current
    // session becomes empty or malformed. That stale record would otherwise
    // win again on the next launch and trap the app in a dead session.
    try { target.removeItem(KEY) } catch {}
    return false
  }
  try {
    target.setItem(KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function loadActiveSessionDraft(storage = null) {
  const target = targetStorage(storage)
  if (!target) return null
  try {
    const raw = target.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (validDraft(parsed)) return parsed
    target.removeItem(KEY)
    return null
  } catch {
    try { target.removeItem(KEY) } catch {}
    return null
  }
}

export function clearActiveSessionDraft(storage = null) {
  const target = targetStorage(storage)
  if (!target) return false
  try {
    target.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

export const ACTIVE_SESSION_DRAFT_KEY = KEY
