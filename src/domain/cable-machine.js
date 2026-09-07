/**
 * Cable-machine selector math.
 *
 * The Inspire FT1 has two 165 lb stacks and a 2:1 pulley ratio. The numbered
 * selector positions in Cory's machine run 1–15. With 15 x 10 lb selector
 * plates, the unnumbered head/top assembly is 15 lb, which makes peg 15 land at
 * the manufacturer's 165 lb stack / 82.5 lb per-pulley specification exactly.
 *
 * Every field remains configurable in Settings so the calculator does not turn
 * one machine's assumptions into a hidden global rule.
 */

export const INSPIRE_FT1_PROFILE = Object.freeze({
  id: 'inspire_ft1',
  name: 'Inspire FT1',
  enabled: true,
  selectorPositions: 15,
  headWeight: 15,
  plateIncrement: 10,
  ratio: 2,
  stackCount: 2,
  addOnWeight: 5,
  addOnEnabled: false,
})

function finite(value, fallback, { min = 0.01, max = 1000 } = {}) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function integer(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

/** Return a safe complete profile from a partial persisted object. */
export function normalizeCableMachineProfile(value = {}) {
  return {
    id: value?.id || INSPIRE_FT1_PROFILE.id,
    name: value?.name || INSPIRE_FT1_PROFILE.name,
    enabled: value?.enabled !== false,
    selectorPositions: integer(value?.selectorPositions, INSPIRE_FT1_PROFILE.selectorPositions, { min: 1, max: 50 }),
    headWeight: finite(value?.headWeight, INSPIRE_FT1_PROFILE.headWeight, { min: 0.01, max: 200 }),
    plateIncrement: finite(value?.plateIncrement, INSPIRE_FT1_PROFILE.plateIncrement, { min: 0.01, max: 200 }),
    ratio: finite(value?.ratio, INSPIRE_FT1_PROFILE.ratio, { min: 0.1, max: 10 }),
    stackCount: integer(value?.stackCount, INSPIRE_FT1_PROFILE.stackCount, { min: 1, max: 4 }),
    addOnWeight: finite(value?.addOnWeight, INSPIRE_FT1_PROFILE.addOnWeight, { min: 0.01, max: 100 }),
    addOnEnabled: value?.addOnEnabled === true,
  }
}

/** Cable Fly on the FT1 uses both independent stacks; other movements default to one. */
export function cableStacksForExercise(exerciseId, profile = INSPIRE_FT1_PROFILE) {
  const machine = normalizeCableMachineProfile(profile)
  return exerciseId === 'cable_fly' ? Math.min(2, machine.stackCount) : 1
}

/**
 * Convert a numbered selector position into effective resistance.
 *
 * `stackWeight` is the selected physical weight on EACH stack. `perHandle` is
 * the effective resistance after the pulley ratio. `total` is the effective
 * resistance across the requested number of simultaneously used stacks.
 */
export function cableLoadForPeg(peg, { profile = INSPIRE_FT1_PROFILE, stacks = 1 } = {}) {
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

/** Reverse an effective load back to a selector peg when it maps exactly. */
export function pegForCableLoad(weight, { profile = INSPIRE_FT1_PROFILE, stacks = 1 } = {}) {
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
