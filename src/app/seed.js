/**
 * Seeds the exercise library and routines on first run.
 *
 * The seed data is passed in rather than fetched here, so this is testable
 * without a network and the caller decides where the JSON came from.
 * User-added exercises are never overwritten: seeding only fills gaps.
 */

/**
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} storage
 * @param {{exercises: any[], routines: any[]}} library
 * @returns {Promise<{exercises: number, routines: number}>} how many were added.
 */
export async function seedLibrary(storage, library) {
  const existingExercises = new Set((await storage.getAll('exercises')).map((e) => e.id))
  const existingRoutines = new Set((await storage.getAll('routines')).map((r) => r.id))

  const newExercises = library.exercises.filter((e) => !existingExercises.has(e.id))
  const newRoutines = library.routines.filter((r) => !existingRoutines.has(r.id))

  await storage.putAll('exercises', newExercises)
  await storage.putAll('routines', newRoutines)

  return { exercises: newExercises.length, routines: newRoutines.length }
}

/**
 * Creates the profile record if this is a first run.
 *
 * Profiles created before Phase 7 have no `setupComplete` field. That absence
 * deliberately means "already configured" so an update never throws an existing
 * user into onboarding. Only a genuinely new profile is marked false.
 *
 * Schema 2 makes body metrics a daily cadence once for existing profiles. The
 * migration is intentionally one-way: after it runs, a user can still change
 * that cadence in Settings without a later launch forcing it back on.
 *
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} storage
 * @param {import('../adapters/clock/clock.js').Clock} clock
 * @param {object} [defaults]
 * @returns {Promise<object>}
 */
export async function ensureProfile(storage, clock, defaults = {}) {
  const existing = await storage.get('profile', 'profile')
  if (existing) {
    if ((existing.schemaVersion ?? 1) >= 2) return existing

    const migrated = {
      ...existing,
      ...(Array.isArray(existing.dailyActivityIds)
        ? { dailyActivityIds: [...new Set([...existing.dailyActivityIds, 'body_metrics'])] }
        : {}),
      ...(existing.activitySchedule
        ? {
            activitySchedule: {
              ...existing.activitySchedule,
              body_metrics: { cadence: 'daily', target: 1 },
            },
          }
        : {}),
      schemaVersion: 2,
    }
    await storage.put('profile', migrated)
    return migrated
  }
  const profile = {
    id: 'profile',
    name: defaults.name ?? '',
    createdAt: clock.nowIso(),
    units: defaults.units ?? 'imperial',
    planTargetSessionsPerWeek: defaults.planTargetSessionsPerWeek ?? 4,
    // Which activities Today shows. Absent means "the seed's defaults", which is
    // what an older profile gets — see daily.js.
    ...(defaults.dailyActivityIds ? { dailyActivityIds: defaults.dailyActivityIds } : {}),
    setupComplete: defaults.setupComplete ?? false,
    schemaVersion: 2,
  }
  await storage.put('profile', profile)
  return profile
}

/**
 * Seeds programs, and starts the first one if nothing is active.
 *
 * Programs are time-boxed, so one has to know when it began: the week index
 * rolls over on the calendar from `startedOn`, not per session.
 *
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} storage
 * @param {{programs: any[]}} catalogue
 * @param {import('../adapters/clock/clock.js').Clock} clock
 * @returns {Promise<{programs: number, started: string|null}>}
 */
export async function seedPrograms(storage, catalogue, clock) {
  const existing = new Set((await storage.getAll('programs')).map((p) => p.id))
  const fresh = catalogue.programs.filter((p) => !existing.has(p.id))
  await storage.putAll('programs', fresh)

  const state = await storage.getAll('programState')
  if (state.some((row) => row.active)) return { programs: fresh.length, started: null }

  const first = catalogue.programs[0]
  if (!first) return { programs: fresh.length, started: null }
  await storage.put('programState', {
    programId: first.id,
    startedOn: clock.today(),
    active: true,
  })
  return { programs: fresh.length, started: first.id }
}
