/**
 * Seeds the exercise library and routines on first run.
 *
 * The seed data is passed in rather than fetched here, so this is testable
 * without a network and the caller decides where the JSON came from.
 * User-added exercises are never overwritten: seeding only fills gaps.
 */

import { createProgramRevision, migrateProgramRecord, revisionIdFor } from '../domain/program-schema.js'

/**
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} storage
 * @param {{exercises: any[], routines: any[]}} library
 * @returns {Promise<{exercises: number, routines: number}>} how many were added.
 */
export async function seedLibrary(storage, library) {
  const seededEmptyRoutineIds = new Set((library.routines ?? [])
    .filter((routine) => !Array.isArray(routine.exercises) || routine.exercises.length === 0)
    .map((routine) => routine.id))

  // Empty routines are placeholders, not runnable workouts. Older builds seeded
  // one named Cardio, so remove that stored placeholder on upgrade as long as it
  // is still empty. A user who later adds exercises to a routine keeps it.
  for (const id of seededEmptyRoutineIds) {
    const existing = await storage.get('routines', id)
    if (existing && (!Array.isArray(existing.exercises) || existing.exercises.length === 0)) {
      await storage.delete('routines', id)
    }
  }

  const existingExercises = new Set((await storage.getAll('exercises')).map((e) => e.id))
  const existingRoutines = new Set((await storage.getAll('routines')).map((r) => r.id))

  const newExercises = library.exercises.filter((e) => !existingExercises.has(e.id))
  const newRoutines = library.routines.filter((r) =>
    !existingRoutines.has(r.id)
    && Array.isArray(r.exercises)
    && r.exercises.length > 0)

  await storage.putAll('exercises', newExercises)
  await storage.putAll('routines', newRoutines)

  // Additive catalogue metadata must also reach an existing install. Methods
  // and movementName affect presentation only; logged sets and any user-owned
  // exercise fields remain untouched. Unknown ids are still never overwritten.
  for (const latest of library.exercises) {
    if (!existingExercises.has(latest.id)) continue
    if (!Array.isArray(latest.methods) && !latest.movementName) continue
    const existing = await storage.get('exercises', latest.id)
    const next = {
      ...existing,
      ...(Array.isArray(latest.methods) ? { methods: [...latest.methods] } : {}),
      ...(latest.movementName ? { movementName: latest.movementName } : {}),
    }
    if (JSON.stringify(existing) !== JSON.stringify(next)) await storage.put('exercises', next)
  }

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
  const stored = new Map((await storage.getAll('programs')).map((p) => [p.id, p]))
  const stateBefore = await storage.getAll('programState')
  const stateById = new Map(stateBefore.map((state) => [state.programId, state]))
  const fresh = catalogue.programs.filter((p) => !stored.has(p.id))

  /**
   * Seeded upgrades carry forward only explicit starting weights. Completed
   * sessions and their logs live in separate stores and are never rewritten.
   */
  function carryStartingWeights(previous, latest) {
    const weights = new Map()
    for (const day of previous.days ?? []) {
      for (const slot of day.exercises ?? []) {
        if (typeof slot.weight === 'number') weights.set(slot.exerciseId, slot.weight)
        for (const choice of slot.rotation ?? []) {
          if (typeof choice.weight === 'number') weights.set(choice.exerciseId, choice.weight)
        }
      }
    }
    return {
      ...latest,
      days: (latest.days ?? []).map((day) => ({
        ...day,
        exercises: (day.exercises ?? []).map((slot) => ({
          ...slot,
          ...(weights.has(slot.exerciseId) ? { weight: weights.get(slot.exerciseId) } : {}),
          ...(Array.isArray(slot.rotation) ? {
            rotation: slot.rotation.map((choice) => ({
              ...choice,
              ...(weights.has(choice.exerciseId) ? { weight: weights.get(choice.exerciseId) } : {}),
            })),
          } : {}),
        })),
      })),
    }
  }

  for (const latest of catalogue.programs) {
    const previous = stored.get(latest.id)
    const activeBefore = stateById.get(latest.id)?.active === true
    let next

    if (!previous) {
      next = migrateProgramRecord(latest, {
        source: 'seed',
        status: activeBefore ? 'active' : 'draft',
      })
    } else if (previous.source !== 'user'
      && (previous.schemaVersion ?? 1) < (latest.schemaVersion ?? 1)) {
      const revisionNumber = (Number.isInteger(previous.revisionNumber) && previous.revisionNumber > 0
        ? previous.revisionNumber
        : 1) + 1
      next = migrateProgramRecord({
        ...carryStartingWeights(previous, latest),
        revisionNumber,
        currentRevisionId: revisionIdFor(latest.id, revisionNumber),
      }, {
        source: previous.source ?? 'seed',
        status: previous.status ?? (activeBefore ? 'active' : 'draft'),
      })
    } else {
      next = migrateProgramRecord(previous, {
        source: previous.source ?? 'seed',
        status: previous.status ?? (activeBefore ? 'active' : 'draft'),
      })
    }

    if (!previous || JSON.stringify(previous) !== JSON.stringify(next)) {
      await storage.put('programs', next)
    }
    stored.set(next.id, next)
  }

  // Every program gets a first immutable prescription revision. A future builder
  // will add a new row instead of editing this one in place.
  const revisions = new Map((await storage.getAll('programRevisions')).map((row) => [row.id, row]))
  for (const [programId, value] of stored) {
    const version = Number.isInteger(value.revisionNumber) && value.revisionNumber > 0
      ? value.revisionNumber
      : 1
    const revisionId = value.currentRevisionId ?? revisionIdFor(programId, version)
    let program = value
    if (program.currentRevisionId !== revisionId || program.revisionNumber !== version) {
      program = { ...program, currentRevisionId: revisionId, revisionNumber: version }
      await storage.put('programs', program)
      stored.set(programId, program)
    }
    if (!revisions.has(revisionId)) {
      await storage.put('programRevisions', createProgramRevision(program, {
        id: revisionId,
        version,
        createdAt: program.createdAt ?? program.updatedAt ?? clock.nowIso(),
      }))
    }
  }

  const state = await storage.getAll('programState')
  for (const row of state) {
    const program = stored.get(row.programId)
    const revisionId = row.revisionId ?? program?.currentRevisionId
    const next = revisionId && row.revisionId !== revisionId
      ? { ...row, revisionId }
      : row
    if (JSON.stringify(row) !== JSON.stringify(next)) await storage.put('programState', next)

    // State is authoritative for which program is running. Repair a stale
    // envelope without touching its start date.
    if (row.active && program && program.status !== 'active') {
      const active = { ...program, status: 'active' }
      await storage.put('programs', active)
      stored.set(row.programId, active)
    }
  }

  if (state.some((row) => row.active)) return { programs: fresh.length, started: null }

  const first = catalogue.programs[0]
  if (!first) return { programs: fresh.length, started: null }
  const selected = stored.get(first.id)
  if (selected && selected.status !== 'active') {
    const active = { ...selected, status: 'active' }
    await storage.put('programs', active)
    stored.set(first.id, active)
  }
  await storage.put('programState', {
    programId: first.id,
    startedOn: clock.today(),
    active: true,
    revisionId: selected?.currentRevisionId ?? revisionIdFor(first.id, 1),
  })
  return { programs: fresh.length, started: first.id }
}
