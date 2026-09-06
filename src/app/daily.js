/**
 * Non-workout logging and cadence.
 *
 * A trackable activity can be OFF, DAILY, or WEEKLY with a target count. The
 * cadence controls what Today asks for; XP still comes only from what was
 * actually logged. Missing a target never subtracts anything.
 */

import {
  applyActivity, activityValue, isLogged, splitActivities, defaultDailyIds, ACTIVITY_FIELDS,
} from '../domain/activities.js'
import {
  awardsForDay, totalsByAttribute, totalsBySource, createInitialState, applyAwards,
} from '../domain/xp-engine.js'
import { tierName } from '../domain/tiers.js'
import { rankFromLevels } from '../domain/rank.js'
import { proteinGoalGrams, proteinGoalMet } from '../domain/protein.js'

/** @type {import('../domain/types.js').AttributeId[]} */
const ATTRIBUTE_IDS = ['might', 'wind', 'grit', 'vitality', 'mind']
const CADENCES = new Set(['off', 'daily', 'weekly'])

const clampTarget = (value) => Math.max(1, Math.min(7, Math.round(Number(value) || 1)))

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Monday containing a YYYY-MM-DD date. */
function calendarWeekStart(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return formatDate(date)
}

/**
 * @param {object} deps
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 * @param {import('../adapters/health/health-adapter.js').HealthAdapter} [deps.health]
 * @param {import('../domain/types.js').Balance} deps.balance
 * @param {{activities: any[]}} deps.catalogue
 */
export function createDailyService({ storage, clock, health, balance, catalogue }) {
  const activities = catalogue?.activities ?? []

  /** @param {string} date */
  async function dayLog(date) {
    return (await storage.get('dayLogs', date)) ?? { date }
  }

  async function proteinGoalFor(date, candidateDay = null) {
    const profile = await storage.get('profile', 'profile')
    let weight = candidateDay?.bodyMetrics?.weight
    if (!(typeof weight === 'number' && Number.isFinite(weight) && weight > 0)) {
      const latest = (await storage.getAll('dayLogs'))
        .filter((row) => row.date <= date
          && typeof row.bodyMetrics?.weight === 'number'
          && Number.isFinite(row.bodyMetrics.weight)
          && row.bodyMetrics.weight > 0)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      weight = latest?.bodyMetrics?.weight ?? null
    }
    return proteinGoalGrams(weight, profile?.units ?? 'imperial')
  }

  async function resolveProteinDay(day) {
    const goal = await proteinGoalFor(day.date, day)
    if (goal === null) return day
    if (typeof day.proteinGrams !== 'number') return { ...day, proteinGoalGrams: goal }
    return {
      ...day,
      proteinGoalGrams: goal,
      proteinTargetMet: proteinGoalMet(day.proteinGrams, goal),
    }
  }

  async function calorieTarget() {
    const profile = await storage.get('profile', 'profile')
    const value = Number(profile?.calorieTarget)
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null
  }

  async function setCalorieTarget(value) {
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    const parsed = Number(value)
    const target = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
    await storage.put('profile', { ...profile, calorieTarget: target })
    return target
  }

  /** User-owned one-tap amounts, e.g. Water = one 20 oz bottle. */
  async function quickAddPresets() {
    const profile = await storage.get('profile', 'profile')
    return { ...(profile?.quickAddPresets ?? {}) }
  }

  async function setQuickAddPreset(activityId, value) {
    if (!ACTIVITY_FIELDS[activityId] || ACTIVITY_FIELDS[activityId].mode !== 'add') return quickAddPresets()
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    const next = { ...(profile.quickAddPresets ?? {}) }
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) delete next[activityId]
    else next[activityId] = parsed
    await storage.put('profile', { ...profile, quickAddPresets: next })
    return next
  }

  /**
   * Backwards-compatible schedule. Older profiles only know `dailyActivityIds`;
   * those remain daily and everything else stays off until setup is rerun.
   * Micro cardio is a new default and therefore opts into DAILY once unless the
   * user has explicitly given it a cadence.
   */
  async function activitySchedule() {
    const profile = await storage.get('profile', 'profile')
    const legacyDaily = new Set(profile?.dailyActivityIds ?? defaultDailyIds(activities))
    const stored = profile?.activitySchedule ?? {}

    return Object.fromEntries(activities.map((activity) => {
      const raw = stored[activity.id]
      if (raw && CADENCES.has(raw.cadence)) {
        return [activity.id, {
          cadence: raw.cadence,
          target: raw.cadence === 'weekly' ? clampTarget(raw.target) : 1,
        }]
      }
      if (activity.id === 'micro_cardio') return [activity.id, { cadence: 'daily', target: 1 }]
      return [activity.id, legacyDaily.has(activity.id)
        ? { cadence: 'daily', target: 1 }
        : { cadence: 'off', target: 1 }]
    }))
  }

  async function dailyIds() {
    const schedule = await activitySchedule()
    return activities.map((a) => a.id).filter((id) => schedule[id]?.cadence === 'daily')
  }

  /**
   * Set one activity's cadence. `dailyActivityIds` is maintained as a legacy
   * mirror so older code/backups still degrade cleanly.
   */
  async function setCadence(activityId, cadence, target = 1) {
    if (!ACTIVITY_FIELDS[activityId] || !CADENCES.has(cadence)) return activitySchedule()
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    const schedule = await activitySchedule()
    schedule[activityId] = {
      cadence,
      target: cadence === 'weekly' ? clampTarget(target) : 1,
    }
    const legacyDaily = activities.map((a) => a.id)
      .filter((id) => schedule[id]?.cadence === 'daily')
    await storage.put('profile', {
      ...profile,
      activitySchedule: schedule,
      dailyActivityIds: legacyDaily,
    })
    return schedule
  }

  /** Compatibility wrapper for the old Settings toggle. */
  async function setDaily(activityId, on) {
    await setCadence(activityId, on ? 'daily' : 'off', 1)
    return dailyIds()
  }

  /** The XP state, as the engine wants it. */
  async function loadState() {
    const stored = await storage.getAll('attributeState')
    const state = createInitialState()
    for (const row of stored) {
      if (state[row.attribute]) {
        state[row.attribute] = { xp: row.xp, level: row.level, lifetimeSources: { ...row.lifetimeSources } }
      }
    }
    return state
  }

  /** Pay only the increase over what this day has already earned. */
  async function settleDay(day) {
    day = await resolveProteinDay(day)
    const profile = await storage.get('profile', 'profile')
    const context = { paceBaselineMinPerMile: profile?.paceBaselineMinPerMile ?? null }

    // Micro cardio is intentionally lightweight: it contributes cardiovascular
    // minutes without pretending that every two-minute bike burst is a formal
    // workout session (and therefore without repeatedly paying session Grit).
    const microMinutes = typeof day.microCardioMinutes === 'number' ? Math.max(0, day.microCardioMinutes) : 0
    const scoringDay = microMinutes > 0
      ? { ...day, cardio: [...(day.cardio ?? []), { minutes: microMinutes }] }
      : day

    const full = awardsForDay(scoringDay, context, balance)
    const owed = totalsBySource(full)
    const paid = day.awarded ?? {}

    /** @type {import('../domain/types.js').Award[]} */
    const delta = []
    for (const award of full) {
      const difference = owed[award.source] - (paid[award.source] ?? 0)
      if (difference <= 0) continue
      delta.push({ ...award, xp: difference })
      paid[award.source] = owed[award.source]
    }

    const awarded = { ...day.awarded }
    for (const [source, xp] of Object.entries(owed)) {
      awarded[source] = Math.max(awarded[source] ?? 0, xp)
    }

    const state = await loadState()
    const before = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, state[id].level]))
    const after = applyAwards(state, delta, balance)

    if (delta.length > 0) {
      await storage.putAll('attributeState', ATTRIBUTE_IDS.map((id) => ({
        attribute: id, xp: after[id].xp, level: after[id].level, lifetimeSources: after[id].lifetimeSources,
      })))
    }

    const settled = { ...day, awarded }
    await storage.put('dayLogs', settled)

    const levels = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, after[id].level]))
    return {
      day: settled,
      awards: delta,
      xpByAttribute: totalsByAttribute(delta),
      xpBySource: totalsBySource(delta),
      levels,
      rank: rankFromLevels(levels, balance),
      levelledUp: ATTRIBUTE_IDS
        .filter((id) => after[id].level > before[id])
        .map((id) => ({ attribute: id, level: after[id].level, tier: tierName(id, after[id].level) })),
    }
  }

  function emptyResult(day) {
    return { day, awards: [], xpByAttribute: totalsByAttribute([]), xpBySource: {}, levelledUp: [], levels: {}, rank: null }
  }

  /** One activity logged against an explicit calendar date. Future health logs are not allowed. */
  async function logAt(date, activityId, value = null, options = {}) {
    const day = await dayLog(date)
    if (date > clock.today() || !ACTIVITY_FIELDS[activityId]) return emptyResult(day)
    return settleDay(applyActivity(day, activityId, value, options))
  }

  /** One activity, logged for today. */
  async function log(activityId, value = null, options = {}) {
    return logAt(clock.today(), activityId, value, options)
  }

  async function settle() {
    return settleDay(await dayLog(clock.today()))
  }

  /** Decorate one catalogue row against one day. */
  function decorate(activity, day, schedule, dynamicProteinGoal = null, dynamicCalorieTarget = null) {
    const cadence = schedule[activity.id]?.cadence ?? 'off'
    const decorated = {
      ...activity,
      daily: cadence === 'daily',
      cadence,
      weeklyTarget: cadence === 'weekly' ? schedule[activity.id].target : null,
      spec: ACTIVITY_FIELDS[activity.id],
      value: ACTIVITY_FIELDS[activity.id]?.stores === 'bodyMetrics'
        ? day.bodyMetrics?.weight ?? null
        : activityValue(activity, day),
      logged: isLogged(activity, day),
    }
    if (activity.id === 'protein_target') {
      return { ...decorated, dailyCap: day.proteinGoalGrams ?? dynamicProteinGoal ?? null }
    }
    if (activity.id === 'calories_logged') {
      return { ...decorated, dailyCap: dynamicCalorieTarget ?? null }
    }
    return decorated
  }

  /** Daily activities plus all catalogue rows for optional logging on one date. */
  async function forDate(date = clock.today()) {
    const day = await dayLog(date)
    const schedule = await activitySchedule()
    const proteinGoal = await proteinGoalFor(date, day)
    const caloriesGoal = await calorieTarget()
    const { outstanding, logged } = splitActivities(activities, day)
    return {
      date,
      day,
      schedule,
      dailyIds: activities.map((a) => a.id).filter((id) => schedule[id]?.cadence === 'daily'),
      outstanding: outstanding.map((activity) => decorate(activity, day, schedule, proteinGoal, caloriesGoal)),
      logged: logged.map((activity) => decorate(activity, day, schedule, proteinGoal, caloriesGoal)),
    }
  }

  async function today() {
    return forDate(clock.today())
  }

  /**
   * Weekly activities count distinct days on which the activity was logged.
   * That makes "3x/week" mean three actual days, not three taps on Tuesday.
   */
  async function week(anchorDate = clock.today()) {
    const start = calendarWeekStart(anchorDate)
    const schedule = await activitySchedule()
    const days = (await storage.getAll('dayLogs'))
      .filter((day) => day.date >= start && day.date <= anchorDate)
    const anchorDay = days.find((day) => day.date === anchorDate) ?? { date: anchorDate }
    const proteinGoal = await proteinGoalFor(anchorDate, anchorDay)
    const caloriesGoal = await calorieTarget()
    const completedOnDay = (activity, row) => activity.id === 'protein_target'
      ? row.proteinTargetMet === true
      : isLogged(activity, row)

    const weekly = activities
      .filter((activity) => schedule[activity.id]?.cadence === 'weekly')
      .map((activity) => {
        const target = clampTarget(schedule[activity.id]?.target)
        const done = days.filter((day) => completedOnDay(activity, day)).length
        return {
          ...decorate(activity, anchorDay, schedule, proteinGoal, caloriesGoal),
          weeklyDone: done,
          weeklyTarget: target,
          complete: done >= target,
          loggedToday: completedOnDay(activity, anchorDay),
        }
      })

    return { start, date: anchorDate, activities: weekly }
  }

  async function sample(date = clock.today()) {
    return health ? health.read(date) : null
  }

  return {
    activities, today, forDate, week, log, logAt, settle, dayLog, sample,
    dailyIds, setDaily, activitySchedule, setCadence, calorieTarget, setCalorieTarget,
    quickAddPresets, setQuickAddPreset,
  }
}
