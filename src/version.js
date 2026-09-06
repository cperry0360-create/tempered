/**
 * The build's identity.
 *
 * There is no build step, so nothing generates this — it is bumped by hand, in
 * the same commit as any phase completion. Maintenance patches keep naming the
 * last completed product phase from docs/07-build-plan.md.
 *
 * It matters more than it looks. Installed to a home screen, a PWA has no
 * address bar and no reload button: without a visible version there is no way to
 * tell a build that failed to deploy from a build that deployed and did not fix
 * the problem. `sw.js` derives its cache key from this, so bumping it also
 * guarantees a clean sweep of every old cache.
 */

export const VERSION = '0.11.14 (8)'

/** The day this version was cut. Shown in Settings beside the version. */
export const BUILD_DATE = '2026-09-05'