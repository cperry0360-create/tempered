/**
 * Program records and revisions.
 *
 * A program is the user-owned plan envelope. Its prescription is kept in a
 * revision so a later edit can change future work without rewriting a session
 * that already happened. The functions here are pure and JSON-shaped so they
 * can be used by import, storage, and the future program builder.
 */

export const PROGRAM_SCHEMA_VERSION = 2

export const PROGRAM_STATUSES = Object.freeze([
  'draft', 'active', 'paused', 'completed', 'archived',
])

export const PROGRAM_SOURCES = Object.freeze(['seed', 'user'])

const META_FIELDS = new Set([
  'id',
  'programSchemaVersion',
  'source',
  'status',
  'templateId',
  'currentRevisionId',
  'revisionNumber',
  'createdAt',
  'updatedAt',
])

/**
 * Structured-copy helper for the JSON-shaped records used by the app.
 * @param {any} value
 * @returns {any}
 */
function copy(value) {
  if (Array.isArray(value)) return value.map(copy)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]))
  }
  return value
}

/**
 * @param {string} programId
 * @param {number} [version]
 * @returns {string}
 */
export function revisionIdFor(programId, version = 1) {
  const id = String(programId ?? '').trim()
  if (!id) throw new Error('Program id is required to create a revision id')
  const number = Number.isInteger(version) && version > 0 ? version : 1
  return id + ':r' + number
}

/**
 * The part of a program that is a prescription, excluding ownership and
 * revision metadata. A revision stores this exact snapshot.
 *
 * @param {any} program
 * @returns {Record<string, any>}
 */
export function prescriptionSnapshot(program) {
  const snapshot = {}
  for (const [key, value] of Object.entries(program ?? {})) {
    if (!META_FIELDS.has(key)) snapshot[key] = copy(value)
  }
  return snapshot
}

/**
 * @param {any} program
 * @param {{id?: string, version?: number, createdAt?: string}} [options]
 * @returns {object}
 */
export function createProgramRevision(program, options = {}) {
  const version = Number.isInteger(options.version) && options.version > 0
    ? options.version
    : (Number.isInteger(program?.revisionNumber) && program.revisionNumber > 0
        ? program.revisionNumber
        : 1)
  const id = options.id ?? revisionIdFor(program?.id, version)
  const revision = {
    id,
    programId: program?.id,
    version,
    programSchemaVersion: program?.programSchemaVersion ?? PROGRAM_SCHEMA_VERSION,
    snapshot: prescriptionSnapshot(program),
  }
  if (typeof options.createdAt === 'string' && options.createdAt) revision.createdAt = options.createdAt
  return revision
}

/**
 * Applies a stored revision to a program envelope without changing its identity
 * or lifecycle state.
 *
 * @param {any} program
 * @param {any} revision
 * @returns {any}
 */
export function applyProgramRevision(program, revision) {
  if (!program?.id || revision?.programId !== program.id || !revision?.snapshot) return program
  return {
    ...program,
    ...copy(revision.snapshot),
    programSchemaVersion: revision.programSchemaVersion ?? program.programSchemaVersion ?? PROGRAM_SCHEMA_VERSION,
    currentRevisionId: revision.id,
    revisionNumber: revision.version,
  }
}

/**
 * Wraps a legacy or newly-created program in the current ownership envelope.
 * Existing values win; defaults only fill fields that did not exist.
 *
 * @param {any} program
 * @param {{status?: string, source?: string}} [options]
 * @returns {any}
 */
export function migrateProgramRecord(program, { status = 'draft', source = 'seed' } = {}) {
  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    throw new Error('A program record is required')
  }
  if (!program.id) throw new Error('A program record needs an id')
  const next = copy(program)
  if (!Number.isInteger(next.programSchemaVersion) || next.programSchemaVersion < PROGRAM_SCHEMA_VERSION) {
    next.programSchemaVersion = PROGRAM_SCHEMA_VERSION
  }
  if (next.source === undefined || next.source === null || next.source === '') next.source = source
  if (next.status === undefined || next.status === null || next.status === '') next.status = status
  if (!Number.isInteger(next.revisionNumber) || next.revisionNumber < 1) next.revisionNumber = 1
  if (!next.currentRevisionId) next.currentRevisionId = revisionIdFor(next.id, next.revisionNumber)
  return next
}

/**
 * Validates a program before it is activated. Incomplete drafts can be saved
 * while a builder is still being edited.
 *
 * @param {any} program
 * @param {{allowIncomplete?: boolean}} [options]
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateProgram(program, { allowIncomplete = false } = {}) {
  const errors = []
  if (!program || typeof program !== 'object' || Array.isArray(program)) {
    return { ok: false, errors: ['Program must be an object'] }
  }
  if (!String(program.id ?? '').trim()) errors.push('Program needs an id')
  if (!allowIncomplete && !String(program.name ?? '').trim()) errors.push('Program needs a name')
  if (program.status !== undefined && !PROGRAM_STATUSES.includes(program.status)) {
    errors.push('Program has an invalid status')
  }
  if (program.source !== undefined && !PROGRAM_SOURCES.includes(program.source)) {
    errors.push('Program has an invalid source')
  }

  const repeating = program.repeating === true || program.repeatMode === 'repeat'
  if (!repeating && (!Number.isInteger(program.weeks) || program.weeks < 1)) {
    errors.push('Program needs a positive number of weeks')
  }

  if (!Array.isArray(program.days)) {
    errors.push('Program needs a days list')
    return { ok: errors.length === 0, errors }
  }
  if (!allowIncomplete && program.days.length === 0) errors.push('Program needs at least one training day')

  const dayIds = new Set()
  for (const [dayIndex, day] of program.days.entries()) {
    if (!day || typeof day !== 'object') {
      errors.push('Day ' + (dayIndex + 1) + ' is not an object')
      continue
    }
    if (!String(day.id ?? '').trim()) errors.push('Day ' + (dayIndex + 1) + ' needs an id')
    if (day.id && dayIds.has(day.id)) errors.push('Day ids must be unique')
    if (day.id) dayIds.add(day.id)
    if (!allowIncomplete && !String(day.name ?? '').trim()) {
      errors.push('Day ' + (dayIndex + 1) + ' needs a name')
    }
    if (!Array.isArray(day.exercises)) {
      if (!allowIncomplete || day.exercises !== undefined) {
        errors.push('Day ' + (dayIndex + 1) + ' needs an exercises list')
      }
      continue
    }
    for (const [slotIndex, slot] of day.exercises.entries()) {
      if (!slot || typeof slot !== 'object') {
        errors.push('Day ' + (dayIndex + 1) + ' exercise ' + (slotIndex + 1) + ' is not an object')
        continue
      }
      if (!allowIncomplete && !String(slot.exerciseId ?? '').trim()) {
        errors.push('Day ' + (dayIndex + 1) + ' exercise ' + (slotIndex + 1) + ' needs an exercise')
      }
      if (slot.sets !== undefined
        && (!Number.isInteger(slot.sets) || slot.sets < 1)) {
        errors.push('Day ' + (dayIndex + 1) + ' exercise ' + (slotIndex + 1) + ' needs positive sets')
      }
      const hasRange = slot.repMin !== undefined || slot.repMax !== undefined
      if (hasRange && (!Number.isFinite(slot.repMin) || !Number.isFinite(slot.repMax)
        || slot.repMin < 1 || slot.repMax < slot.repMin)) {
        errors.push('Day ' + (dayIndex + 1) + ' exercise ' + (slotIndex + 1) + ' has an invalid rep range')
      }
      if (!allowIncomplete && slot.sets === undefined) {
        errors.push('Day ' + (dayIndex + 1) + ' exercise ' + (slotIndex + 1) + ' needs sets')
      }
      if (!allowIncomplete && (slot.repMin === undefined || slot.repMax === undefined)) {
        errors.push('Day ' + (dayIndex + 1) + ' exercise ' + (slotIndex + 1) + ' needs a rep range')
      }
    }
  }
  return { ok: errors.length === 0, errors }
}
