/**
 * Temporary opt-in for the foldable/Duo shell, until the native app has a
 * platform-specific layout preference. This is UI only, not canonical data.
 * Store it per browser installation; never infer device identity from width.
 */
const KEY = 'tempered:duo-layout'

export function getDuoLayoutEnabled({
  storageRef = globalThis.localStorage,
  locationRef = globalThis.location,
} = {}) {
  try {
    const saved = storageRef?.getItem(KEY)
    if (saved === 'enabled') return true
    if (saved === 'disabled') return false
  } catch { /* private mode / denied storage: use the entry URL */ }
  return new URLSearchParams(locationRef?.search ?? '').get('layout') === 'duo'
}

/**
 * Apply immediately; returns false only if the choice couldn't be persisted.
 * The default app is still standard until the user explicitly enables this.
 */
export function setDuoLayoutEnabled(enabled, {
  storageRef = globalThis.localStorage,
  documentRef = globalThis.document,
} = {}) {
  const root = documentRef.documentElement
  if (enabled) root.dataset.layout = 'duo'
  else root.removeAttribute('data-layout')

  let saved = true
  try {
    storageRef?.setItem(KEY, enabled ? 'enabled' : 'disabled')
  } catch {
    saved = false
  }
  // A change from Duo to standard re-applies the existing portrait policy.
  documentRef.dispatchEvent?.(new Event('tempered:layout-changed'))
  return saved
}
