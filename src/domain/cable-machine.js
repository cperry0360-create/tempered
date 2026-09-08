/**
 * Cable-machine selector math.
 *
 * Cory's machine is the Inspire FTX, now sold as the Centr 2. The manufacturer
 * specifies two 165 lb stacks and a 2:1 ratio per pulley. Each numbered plate is
 * 10 lb; the 165 lb published stack total implies a 15 lb selector/head assembly
 * above the fifteen numbered plates. We call the result NOMINAL resistance in
 * the UI because cable friction and geometry can make measured force differ.
 *
 * Every field remains configurable in Settings so these machine assumptions are
 * explicit and user-owned rather than a hidden rule.
 */

const DEFAULT_EXERCISE_SETTINGS = Object.freeze({
  cable_fly: Object.freeze({ enabled: true, stacks: 2 }),
})

export const INSPIRE_FTX_PROFILE = Object.freeze({
  id: 'inspire_ftx_centr2',
  name: 'Inspire FTX / Centr 2',
  enabled: true,
  selectorPositions: 15,
  headWeight: 15,
  plateIncrement: 10,
  ratio: 2,
  stackCount: 2,
  addOnWeight: 5,
  addOnEnabled: false,
  exerciseSettings: DEFAULT_EXERCISE_SETTINGS,
})

/** Backwards-compatible export for code/tests written during the FT1 prototype. */
export const INSPIRE_FT1_PROFILE = INSPIRE_FTX_PROFILE

function finite(value, fallback, { min = 0.01, max = 1000 } = {}) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function integer(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function exerciseSetting(value, exerciseId) {
  const fallback = DEFAULT_EXERCISE_SETTINGS[exerciseId] ?? { enabled: false, stacks: 1 }
  return {
    enabled: value?.enabled === undefined ? fallback.enabled : value.enabled === true,
    stacks: integer(value?.stacks, fallback.stacks, { min: 1, max: 4 }),
  }
}

/** Return a safe complete profile from a partial persisted object. */
export function normalizeCableMachineProfile(value = {}) {
  const rawExerciseSettings = value?.exerciseSettings && typeof value.exerciseSettings === 'object'
    ? value.exerciseSettings
    : {}
  const exerciseSettings = {}
  const ids = new Set([...Object.keys(DEFAULT_EXERCISE_SETTINGS), ...Object.keys(rawExerciseSettings)])
  for (const exerciseId of ids) exerciseSettings[exerciseId] = exerciseSetting(rawExerciseSettings[exerciseId], exerciseId)

  // 0.12.15 persisted the wrong model label. Keep every numeric user setting,
  // but migrate that prototype identity to the correct FTX / Centr 2 preset.
  const legacyFt1 = value?.id === 'inspire_ft1' || value?.name === 'Inspire FT1'

  return {
    id: legacyFt1 ? INSPIRE_FTX_PROFILE.id : (value?.id || INSPIRE_FTX_PROFILE.id),
    name: legacyFt1 ? INSPIRE_FTX_PROFILE.name : (value?.name || INSPIRE_FTX_PROFILE.name),
    enabled: value?.enabled !== false,
    selectorPositions: integer(value?.selectorPositions, INSPIRE_FTX_PROFILE.selectorPositions, { min: 1, max: 50 }),
    headWeight: finite(value?.headWeight, INSPIRE_FTX_PROFILE.headWeight, { min: 0.01, max: 200 }),
    plateIncrement: finite(value?.plateIncrement, INSPIRE_FTX_PROFILE.plateIncrement, { min: 0.01, max: 200 }),
    ratio: finite(value?.ratio, INSPIRE_FTX_PROFILE.ratio, { min: 0.1, max: 10 }),
    stackCount: integer(value?.stackCount, INSPIRE_FTX_PROFILE.stackCount, { min: 1, max: 4 }),
    addOnWeight: finite(value?.addOnWeight, INSPIRE_FTX_PROFILE.addOnWeight, { min: 0.01, max: 100 }),
    addOnEnabled: value?.addOnEnabled === true,
    exerciseSettings,
  }
}

/** Whether a cable exercise is currently entered by physical selector peg. */
export function cablePegEnabledForExercise(exerciseId, profile = INSPIRE_FTX_PROFILE) {
  const machine = normalizeCableMachineProfile(profile)
  return exerciseSetting(machine.exerciseSettings?.[exerciseId], exerciseId).enabled
}

/** One or two simultaneously used stacks, configurable per exercise. */
export function cableStacksForExercise(exerciseId, profile = INSPIRE_FTX_PROFILE) {
  const machine = normalizeCableMachineProfile(profile)
  const requested = exerciseSetting(machine.exerciseSettings?.[exerciseId], exerciseId).stacks
  return Math.max(1, Math.min(machine.stackCount, requested))
}

/** Update one exercise without replacing the rest of the machine profile. */
export function withCableExerciseSetting(profile, exerciseId, patch = {}) {
  const machine = normalizeCableMachineProfile(profile)
  return normalizeCableMachineProfile({
    ...machine,
    exerciseSettings: {
      ...machine.exerciseSettings,
      [exerciseId]: {
        ...exerciseSetting(machine.exerciseSettings?.[exerciseId], exerciseId),
        ...patch,
      },
    },
  })
}

/**
 * Convert a numbered selector position into nominal effective resistance.
 *
 * `stackWeight` is the selected physical weight on EACH stack. `perHandle` is
 * the nominal effective resistance after the pulley ratio. `total` is the
 * nominal effective resistance across the requested simultaneously used stacks.
 */
export function cableLoadForPeg(peg, { profile = INSPIRE_FTX_PROFILE, stacks = 1 } = {}) {
  const machine = normalizeCableMachineProfile(profile)
  const selector = Number(peg)
  if (!Number.isInteger(selector) || selector < 1 || selector > machine.selectorPositions) return null

  const usedStacks = Math.max(1, Math.min(machine.stackCount, Math.round(Number(stacks) || 1)))
  const stackWeight = machine.headWeight
    + selector * machine.plateIncrement
    + (machine.addOnEnabled ? machine.addOnWeight : 0)
  const perHandle = stackWeight / machine.ratio
  const total = perHandle * usedStacks

  return {
    peg: selector,
    stacks: usedStacks,
    stackWeight,
    perHandle,
    total,
    ratio: machine.ratio,
    addOnEnabled: machine.addOnEnabled,
    profileId: machine.id,
  }
}

/** Reverse a nominal effective load back to a selector peg when it maps exactly. */
export function pegForCableLoad(weight, { profile = INSPIRE_FTX_PROFILE, stacks = 1 } = {}) {
  const machine = normalizeCableMachineProfile(profile)
  const effective = Number(weight)
  if (!Number.isFinite(effective) || effective <= 0) return null

  const usedStacks = Math.max(1, Math.min(machine.stackCount, Math.round(Number(stacks) || 1)))
  const stackWeight = (effective / usedStacks) * machine.ratio
  const withoutAddOn = stackWeight - (machine.addOnEnabled ? machine.addOnWeight : 0)
  const rawPeg = (withoutAddOn - machine.headWeight) / machine.plateIncrement
  const peg = Math.round(rawPeg)

  if (Math.abs(rawPeg - peg) > 1e-6 || peg < 1 || peg > machine.selectorPositions) return null
  return peg
}

/**
 * 0.12.15 inherited Cable Fly logs where the physical peg was stored in the
 * `weight` field (for example 6 or 7). Convert only that known legacy shape.
 * Other cable exercises historically used actual pounds and are left alone.
 */
export function migrateLegacyCableFlySet(set, profile = INSPIRE_FTX_PROFILE) {
  const machine = normalizeCableMachineProfile(profile)
  if (!set || set.exerciseId !== 'cable_fly' || set.cablePeg != null) return set
  const peg = Number(set.weight)
  if (!Number.isInteger(peg) || peg < 1 || peg > machine.selectorPositions) return set

  const load = cableLoadForPeg(peg, {
    profile: machine,
    stacks: cableStacksForExercise('cable_fly', machine),
  })
  if (!load) return set

  return {
    ...set,
    weight: load.total,
    cableMachineId: machine.id,
    cableMachineName: machine.name,
    cablePeg: load.peg,
    cableStacks: load.stacks,
    cableStackWeight: load.stackWeight,
    cablePerHandle: load.perHandle,
    cableEffectiveTotal: load.total,
    cableRatio: load.ratio,
    cableAddOn: load.addOnEnabled,
    cableLegacyMigrated: true,
  }
}
