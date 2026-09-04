/**
 * The workout service: everything a session does, from start to XP.
 *
 * This is the seam between the pure domain and stored state. It reads records,
 * asks the domain what a session earned, and writes the results back. The domain
 * still knows nothing about storage, and storage still knows nothing about XP.
 */

import { awardsForSession, applyAwards, createInitialState, totalsByAttribute, totalsBySource } from '../domain/xp-engine.js'
import { applyRecords, detectRecords, volumeByExercise, workingSets } from '../domain/records.js'
import { proposeNext } from '../domain/progression.js'
import { levelFromXp, levelProgress } from '../domain/levels.js'
import { ATTRIBUTE_IDS, tierName } from '../domain/tiers.js'
import { rankFromLevels } from '../domain/rank.js'
import { generateDirective } from '../domain/directive.js'
import { daysBetween } from '../adapters/clock/clock.js'

/** Monday-start week key, so "sessions this week" matches how people plan. */
function weekStart(date) {
  const [y, m, d] = date.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d))
  const weekday = (at.getUTCDay() + 6) % 7
  at.setUTCDate(at.getUTCDate() - weekday)
  return at.toISOString().slice(0, 10)
}

/**
 * @param {object} deps
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 * @param {import('../domain/types.js').Balance} deps.balance
 */
export function createWorkoutService({ storage, clock, balance }) {
  /** @returns {Promise<Map<string, any>>} */
  async function exerciseMap() {
    return new Map((await storage.getAll('exercises')).map((e) => [e.id, e]))
  }

  /** @returns {Promise<Map<string, any>>} */
  async function recordMap() {
    return new Map((await storage.getAll('records')).map((r) => [r.exerciseId, r]))
  }

  /**
   * The last time this exercise was performed, for the prefill and the header.
   * @param {string} exerciseId
   */
  async function lastPerformance(exerciseId) {
    const logs = await storage.getAllByIndex('setLogs', 'exerciseId', exerciseId)
    if (logs.length === 0) return null
    const sessions = new Map((await storage.getAll('sessions')).map((s) => [s.id, s]))

    let latestDate = ''
    for (const log of logs) {
      const date = sessions.get(log.sessionId)?.date ?? ''
      if (date > latestDate) latestDate = date
    }
    if (!latestDate) return null

    const sets = logs
      .filter((log) => sessions.get(log.sessionId)?.date === latestDate && !log.isWarmup)
      .sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0))
    return sets.length > 0 ? { date: latestDate, sets } : null
  }

  /**
   * Everything the set row needs before a single set is entered: what you did
   * last time, what your best is, and what to try today.
   * @param {string} exerciseId
   * @param {{sets?: number, reps?: number|null, weight?: number|null, distance?: number|null}} [prescribed]
   */
  async function prepareExercise(exerciseId, prescribed = {}) {
    const exercises = await exerciseMap()
    const exercise = exercises.get(exerciseId)
    const last = await lastPerformance(exerciseId)
    const record = (await recordMap()).get(exerciseId) ?? null
    const proposal = proposeNext({ exercise, last, prescribed: { sets: 3, reps: null, weight: null, ...prescribed } }, balance)
    return { exercise, last, record, proposal }
  }

  /**
   * @param {string|null} routineId
   * @returns {Promise<object>} the open session
   */
  async function startSession(routineId) {
    const session = {
      id: `s_${clock.now()}_${Math.floor(clock.now() % 100000)}`,
      routineId,
      date: clock.today(),
      startedAt: clock.nowIso(),
      endedAt: null,
    }
    await storage.put('sessions', session)
    return session
  }

  /**
   * @param {object} session
   * @param {object} set
   */
  async function logSet(session, set) {
    const existing = await storage.getAllByIndex('setLogs', 'sessionId', session.id)
    const log = {
      id: `sl_${session.id}_${existing.length}_${Math.round(clock.now() % 1000000)}`,
      sessionId: session.id,
      exerciseId: set.exerciseId,
      setIndex: set.setIndex ?? existing.length,
      weight: set.weight ?? null,
      reps: set.reps ?? null,
      timeSec: set.timeSec ?? null,
      distance: set.distance ?? null,
      isWarmup: set.isWarmup === true,
      completedAt: clock.nowIso(),
    }
    await storage.put('setLogs', log)
    return log
  }

  /** @param {string} sessionId */
  async function setsFor(sessionId) {
    const logs = await storage.getAllByIndex('setLogs', 'sessionId', sessionId)
    return logs.sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0))
  }

  /**
   * Finishes a session: writes it, awards XP, updates records, and returns
   * everything the post-session screen needs in one object — because docs/05
   * requires that screen to be one screen.
   *
   * @param {object} session
   * @param {{durationMinutes?: number}} [options]
   */
  async function finishSession(session, options = {}) {
    const sets = await setsFor(session.id)
    const exercises = await exerciseMap()
    const records = await recordMap()

    const endedAt = clock.nowIso()
    const durationMinutes = options.durationMinutes
      ?? Math.max(1, Math.round((clock.now() - Date.parse(session.startedAt)) / 60000))

    // Context the domain needs but cannot look up for itself.
    const finished = (await storage.getAll('sessions'))
      .filter((s) => s.id !== session.id && s.endedAt)
    const previous = finished
      .map((s) => s.date)
      .filter((date) => date <= session.date)
      .sort()
      .at(-1)
    const thisWeek = weekStart(session.date)
    const sessionsThisWeekBefore = finished.filter((s) => weekStart(s.date) === thisWeek).length
    const profile = await storage.get('profile', 'profile')

    const input = {
      id: session.id,
      routineId: session.routineId,
      durationMinutes,
      sets: sets.map((log) => ({
        exerciseId: log.exerciseId,
        weight: log.weight,
        reps: log.reps,
        timeSec: log.timeSec,
        distance: log.distance,
        isWarmup: log.isWarmup,
      })),
    }
    const context = {
      date: session.date,
      exercises,
      records,
      daysSinceLastSession: previous ? daysBetween(previous, session.date) : Infinity,
      sessionsThisWeekBefore,
      planTargetSessionsPerWeek: profile?.planTargetSessionsPerWeek ?? 4,
    }

    const detected = detectRecords(input.sets, records, exercises)
    const awards = awardsForSession(input, context, balance)

    // Load state, apply, persist.
    const stored = await storage.getAll('attributeState')
    const state = createInitialState()
    for (const row of stored) {
      if (state[row.attribute]) {
        state[row.attribute] = { xp: row.xp, level: row.level, lifetimeSources: { ...row.lifetimeSources } }
      }
    }
    const before = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, state[id].level]))
    const after = applyAwards(state, awards, balance)

    await storage.putAll('attributeState', ATTRIBUTE_IDS.map((id) => ({
      attribute: id, xp: after[id].xp, level: after[id].level, lifetimeSources: after[id].lifetimeSources,
    })))

    const updatedRecords = applyRecords(records, input.sets, session.date, exercises)
    await storage.putAll('records', [...updatedRecords.values()])

    const completed = { ...session, endedAt, durationMinutes }
    await storage.put('sessions', completed)

    const volumes = volumeByExercise(input.sets, exercises)
    const totalVolume = [...volumes.values()].reduce((sum, v) => sum + v, 0)
    const levels = Object.fromEntries(ATTRIBUTE_IDS.map((id) => [id, after[id].level]))

    return {
      session: completed,
      durationMinutes,
      setsCompleted: workingSets(input.sets).length,
      totalVolume,
      awards,
      xpByAttribute: totalsByAttribute(awards),
      xpBySource: totalsBySource(awards),
      records: detected,
      levelledUp: ATTRIBUTE_IDS
        .filter((id) => after[id].level > before[id])
        .map((id) => ({ attribute: id, level: after[id].level, tier: tierName(id, after[id].level) })),
      state: after,
      levels,
      rank: rankFromLevels(levels, balance),
      directive: generateDirective(after, dailyRates(after), balance),
    }
  }

  /** Rough recent rate per attribute, for directive nearness. */
  function dailyRates(state) {
    /** @type {Record<string, number>} */
    const rates = {}
    for (const id of ATTRIBUTE_IDS) rates[id] = Math.max(1, state[id].xp / 30)
    return rates
  }

  return {
    exerciseMap, recordMap, lastPerformance, prepareExercise,
    startSession, logSet, setsFor, finishSession,
    async attributeSummary() {
      const stored = await storage.getAll('attributeState')
      return ATTRIBUTE_IDS.map((id) => {
        const row = stored.find((r) => r.attribute === id)
        const xp = row?.xp ?? 0
        return {
          attribute: id, xp, level: levelFromXp(xp, balance),
          tier: tierName(id, levelFromXp(xp, balance)),
          progress: levelProgress(xp, balance),
          lifetimeSources: row?.lifetimeSources ?? {},
        }
      })
    },
  }
}
