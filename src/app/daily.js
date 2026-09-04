/**
 * The daily service — a calendar day's non-workout logging.
 *
 * Wiring, like `workout.js`: it joins the pure activity model and XP engine to
 * the storage, clock and health adapters, and neither side knows it exists.
 *
 * **Settlement is the whole problem.** A day is not finished and then scored; it
 * is logged a piece at a time, and every piece re-scores the whole day. Paying
 * out `awardsForDay` on each entry would pay for the morning's sleep again every
 * time a glass of water is logged. So each day records what it has already been
 * paid, per source, and a log pays only the difference.
 *
 * That ledger also gives the two directions of correction for free, both of
 * which matter because `CLAUDE.md` forbids taking anything back:
 *
 *   - a value corrected downwards pays nothing and claws nothing back
 *   - re-raising it to a figure already paid for pays nothing a second time
 */

import {
  applyActivity, activityValue, isLogged, splitActivities, defaultDailyIds, ACTIVITY_FIELDS,
} from '../domain/activities.js'
import {
  awardsForDay, totalsByAttribute, totalsBySource, createInitialState, applyAwards,
} from '../domain/xp-engine.js'
import { tierName } from '../domain/tiers.js'
import { rankFromLevels } from '../domain/rank.js'

/** @type {import('../domain/types.js').AttributeId[]} */
const ATTRIBUTE_IDS = ['might', 'wind', 'grit', 'vitality', 'mind']

/**
 * @param {object} deps
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 * @param {import('../adapters/health/health-adapter.js').HealthAdapter} [deps.health]
 * @param {import('../domain/types.js').Balance} deps.balance
 * @param {{activities: any[]}} deps.catalogue  data/activities.json
 */
export function createDailyService({ storage, clock, health, balance, catalogue }) {
  const activities = catalogue?.activities ?? []

  /** @param {string} date */
  async function dayLog(date) {
    return (await storage.get('dayLogs', date)) ?? { date }
  }

  /**
   * The activities this person tracks every day, which is what Today shows.
   *
   * Falls back to the seed's defaults when the profile carries no list — a
   * profile created before the flag existed, or one whose setup has not run
   * yet. Storing nothing until the user changes something means the defaults
   * can be retuned later without stale copies of them sitting in every profile.
   */
  async function dailyIds() {
    const profile = await storage.get('profile', 'profile')
    return profile?.dailyActivityIds ?? defaultDailyIds(activities)
  }

  /**
   * Puts an activity on the daily list, or takes it off.
   *
   * Taking one off never removes anything already logged and never costs XP;
   * it is a decision about one screen's contents, not about the day.
   *
   * @param {string} activityId
   * @param {boolean} on
   */
  async function setDaily(activityId, on) {
    if (!ACTIVITY_FIELDS[activityId]) return dailyIds()
    const current = new Set(await dailyIds())
    if (on) current.add(activityId)
    else current.delete(activityId)
    // Stored in the catalogue's own order, so the list reads the same wherever
    // it is shown.
    const next = activities.map((a) => a.id).filter((id) => current.has(id))
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    await storage.put('profile', { ...profile, dailyActivityIds: next })
    return next
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

  /**
   * Pays a day up to what it is currently worth, and returns only the difference.
   *
   * `day.awarded` is the high-water mark per source rather than the latest
   * figure, which is what makes a correction downwards cost nothing in either
   * direction.
   *
   * @param {import('../domain/types.js').DayInput} day
   */
  async function settleDay(day) {
    const profile = await storage.get('profile', 'profile')
    const context = { paceBaselineMinPerMile: profile?.paceBaselineMinPerMile ?? null }

    const full = awardsForDay(day, context, balance)
    const owed = totalsBySource(full)
    const paid = day.awarded ?? {}

    /** @type {import('../domain/types.js').Award[]} */
    const delta = []
    for (const award of full) {
      const difference = owed[award.source] - (paid[award.source] ?? 0)
      if (difference <= 0) continue
      delta.push({ ...award, xp: difference })
      // A source may be split across several awards; the first one carries the
      // whole difference and the rest are already covered.
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

  /**
   * One activity, logged. A mark takes no value; a measured activity takes the
   * number the user entered.
   *
   * @param {string} activityId
   * @param {number|string|null} [value]
   */
  async function log(activityId, value = null, options = {}) {
    const date = clock.today()
    const day = await dayLog(date)
    if (!ACTIVITY_FIELDS[activityId]) {
      // Nothing to log and nothing to say about it. An unrecognised id is a bug
      // in a caller, not something to throw in a user's face mid-day.
      return { day, awards: [], xpByAttribute: totalsByAttribute([]), xpBySource: {}, levelledUp: [], levels: {}, rank: null }
    }
    return settleDay(applyActivity(day, activityId, value, options))
  }

  /**
   * Pays for anything on today that has not been paid for yet.
   *
   * Needed because a health adapter can write a day directly — a device sample,
   * an import — without passing through `log()`.
   */
  async function settle() {
    return settleDay(await dayLog(clock.today()))
  }

  /**
   * Today, as a screen needs it: what is outstanding, what is logged, and the
   * value of each thing that is.
   *
   * Nothing here is late or missed. The two lists are "still available" and
   * "done", and there is deliberately no third.
   */
  async function today() {
    const date = clock.today()
    const day = await dayLog(date)
    const wanted = new Set(await dailyIds())
    const { outstanding, logged } = splitActivities(activities, day)
    const decorate = (activity) => ({
      daily: wanted.has(activity.id),
      ...activity,
      spec: ACTIVITY_FIELDS[activity.id],
      // A body metric's reading is read HERE and only here. The domain may not
      // touch it — see body-weight.test.js — but Phase 4 requires it shown back,
      // so the read lives at the boundary, one layer away from anything that
      // could score it.
      value: ACTIVITY_FIELDS[activity.id]?.stores === 'bodyMetrics'
        ? day.bodyMetrics?.weight ?? null
        : activityValue(activity, day),
      logged: isLogged(activity, day),
    })
    return {
      date,
      day,
      dailyIds: [...wanted],
      outstanding: outstanding.map(decorate),
      logged: logged.map(decorate),
    }
  }

  /** The health adapter's view of a date, for screens that want a device value. */
  async function sample(date = clock.today()) {
    return health ? health.read(date) : null
  }

  return { activities, today, log, settle, dayLog, sample, dailyIds, setDaily }
}
