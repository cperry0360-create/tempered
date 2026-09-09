/**
 * Itemized nutrition ledger.
 *
 * Older Tempered builds stored only running calories/protein on the day log.
 * The first itemized write captures those values as carryover, so adding a
 * meal never loses or double-counts existing data. Aggregate day fields remain
 * canonical for Today, Progress, XP, exports, and old builds.
 */

export const NUTRIENTS = Object.freeze([
  { key: 'calories', entryField: 'calories', dayField: 'calories' },
  { key: 'protein', entryField: 'proteinGrams', dayField: 'proteinGrams' },
  { key: 'carbs', entryField: 'carbsGrams', dayField: 'carbsGrams' },
  { key: 'fat', entryField: 'fatGrams', dayField: 'fatGrams' },
  { key: 'fiber', entryField: 'fiberGrams', dayField: 'fiberGrams' },
])

const inputKeys = Object.freeze({
  calories: ['calories'],
  proteinGrams: ['proteinGrams', 'protein'],
  carbsGrams: ['carbsGrams', 'carbs'],
  fatGrams: ['fatGrams', 'fat'],
  fiberGrams: ['fiberGrams', 'fiber'],
})

function nutrientNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function readInput(values, entryField) {
  for (const key of inputKeys[entryField]) {
    const value = nutrientNumber(values?.[key])
    if (value !== null) return value
  }
  return null
}

function cleanNutrients(values) {
  const clean = {}
  for (const { entryField } of NUTRIENTS) {
    const value = readInput(values, entryField)
    if (value !== null) clean[entryField] = value
  }
  return clean
}

function hasPositiveNutrient(values) {
  return NUTRIENTS.some(({ entryField }) => Number(values?.[entryField]) > 0)
}

function legacyCarryover(day) {
  const carryover = {
    logged: day?.nutritionLogged === true,
    caloriesTracked: day?.caloriesLogged === true,
  }
  for (const { entryField, dayField } of NUTRIENTS) {
    const value = nutrientNumber(day?.[dayField])
    if (value !== null) carryover[entryField] = value
  }
  return carryover
}

function cleanCarryover(day) {
  const raw = day?.nutritionLedgerVersion === 1
    ? (day.nutritionCarryover ?? {})
    : legacyCarryover(day)
  return {
    ...cleanNutrients(raw),
    ...(raw.logged === true ? { logged: true } : {}),
    ...(raw.caloriesTracked === true ? { caloriesTracked: true } : {}),
  }
}

function cleanEntry(entry) {
  const nutrients = cleanNutrients(entry)
  if (!entry?.id || !entry?.loggedAt || !hasPositiveNutrient(nutrients)) return null
  return {
    id: String(entry.id),
    loggedAt: String(entry.loggedAt),
    source: entry.source === 'ai' ? 'ai' : 'manual',
    ...nutrients,
  }
}

function ledgerEntries(day) {
  return (Array.isArray(day?.nutritionEntries) ? day.nutritionEntries : [])
    .map(cleanEntry)
    .filter(Boolean)
}

function totalsFor(carryover, entries) {
  return Object.fromEntries(NUTRIENTS.map(({ key, entryField }) => [
    key,
    [carryover, ...entries].reduce((sum, row) => sum + (nutrientNumber(row?.[entryField]) ?? 0), 0),
  ]))
}

/** Read a day in one stable shape, including legacy aggregate-only days. */
export function nutritionLedger(day = {}) {
  const carryover = cleanCarryover(day)
  const entries = ledgerEntries(day)
  return {
    carryover,
    entries,
    totals: totalsFor(carryover, entries),
    hasCarryover: carryover.logged === true
      || NUTRIENTS.some(({ entryField }) => nutrientNumber(carryover[entryField]) !== null),
  }
}

function applyLedger(day, carryover, entries) {
  const cleanEntries = entries.map(cleanEntry).filter(Boolean)
  const totals = totalsFor(carryover, cleanEntries)
  const next = {
    ...day,
    nutritionLedgerVersion: 1,
    nutritionCarryover: { ...carryover },
    nutritionEntries: cleanEntries,
    nutritionLogged: carryover.logged === true || cleanEntries.length > 0,
  }

  for (const { key, entryField, dayField } of NUTRIENTS) {
    const present = nutrientNumber(carryover[entryField]) !== null
      || cleanEntries.some((entry) => nutrientNumber(entry[entryField]) !== null)
    if (present) next[dayField] = totals[key]
    else delete next[dayField]
  }

  if (typeof next.calories === 'number') next.caloriesLogged = true
  else if (carryover.caloriesTracked !== true) delete next.caloriesLogged
  if (typeof next.proteinGrams !== 'number') delete next.proteinTargetMet
  return next
}

/** Add one timestamped meal while preserving any pre-ledger running total. */
export function addNutritionEntry(day, values, meta) {
  const nutrients = cleanNutrients(values)
  if (!hasPositiveNutrient(nutrients)) throw new Error('Enter at least one nutrition value')
  if (!meta?.id || !meta?.loggedAt) throw new Error('Nutrition entries need an id and timestamp')
  const { carryover, entries } = nutritionLedger(day)
  const entry = cleanEntry({
    id: meta.id,
    loggedAt: meta.loggedAt,
    source: meta.source,
    ...nutrients,
  })
  return applyLedger(day, carryover, [...entries, entry])
}

/** Remove one meal and recalculate aggregate fields from the remaining ledger. */
export function removeNutritionEntry(day, entryId) {
  const { carryover, entries } = nutritionLedger(day)
  return applyLedger(day, carryover, entries.filter((entry) => entry.id !== entryId))
}

/** Restore a removed meal at its previous position for a local Undo action. */
export function restoreNutritionEntry(day, entry, index = Infinity) {
  const clean = cleanEntry(entry)
  if (!clean) throw new Error('Cannot restore an invalid nutrition entry')
  const { carryover, entries } = nutritionLedger(day)
  const withoutDuplicate = entries.filter((item) => item.id !== clean.id)
  const at = Math.max(0, Math.min(withoutDuplicate.length, Number(index)))
  withoutDuplicate.splice(Number.isFinite(at) ? at : withoutDuplicate.length, 0, clean)
  return applyLedger(day, carryover, withoutDuplicate)
}
