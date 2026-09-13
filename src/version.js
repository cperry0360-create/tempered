/**
 * The build's identity.
 *
 * There is no build step, so nothing generates this — it is bumped by hand.
 * The service worker derives its cache key from this value, which guarantees
 * installed Home Screen copies receive a clean asset handoff on release.
 */

export const VERSION = '0.23.0 (31)'

/** The day this version was cut. Shown in Settings beside the version. */
export const BUILD_DATE = '2026-09-13'
