/**
 * Canonical battle-art paths.
 *
 * The battle is the only illustrated surface in Tempered. Keep every path in
 * one place so the UI, tests and eventual asset import cannot drift apart.
 * Missing files are intentionally safe: the battle screen keeps its existing
 * icon fallback until the matching PNG arrives.
 */

const ROOT = new URL('../../art/battle/', import.meta.url)

/**
 * Only roster ids are allowed to become paths. This keeps a future data edit
 * from turning an art id into an arbitrary relative URL.
 * @param {unknown} value
 * @returns {string|null}
 */
export function battleArtId(value) {
  const id = String(value ?? '')
  return /^[a-z0-9_]+$/.test(id) ? id : null
}

export function heroSpriteUrl() {
  return new URL('hero.png', ROOT).href
}

/** @param {unknown} id */
export function enemySpriteUrl(id) {
  const safe = battleArtId(id)
  return safe ? new URL(`enemies/${safe}.png`, ROOT).href : null
}

/** @param {unknown} id */
export function itemSpriteUrl(id) {
  const safe = battleArtId(id)
  return safe ? new URL(`items/${safe}.png`, ROOT).href : null
}
