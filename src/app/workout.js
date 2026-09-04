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
import { prescribeFromProgram, weekFromStart, isDeloadWeek, weeklyHardSets } from '../domain/programs.js'
import { dayTasks, weekTasks, weeklyHardSetsCompleted, isInSameProgramWeek } from '../domain/tasks.js'
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
   * The active program, its current week, and whether that week is a deload.
   * @returns {Promise<{program: any, week: number, deload: boolean}|null>}
   */
  async function activeProgram() {
    const state = (await storage.getAll('programState')).find((row) => row.active)
    if (!state) return null
    const program = await storage.get('programs', state.programId)
    if (!program) return null
    const week = weekFromStart(daysBetween(state.startedOn, clock.today()), program.weeks)
    return { program, state, week, deload: isDeloadWeek(week, program) }
  }

  /**
   * Prepares one program slot: history, PR, and the week's prescription.
   * @param {object} slot
   * @param {number} week
   * @param {any} program
   */
  async function prepareSlot(slot, week, program) {
    const exercises = await exerciseMap()
    const exercise = exercises.get(slot.exerciseId)
    const last = await lastPerformance(slot.exerciseId)
    const record = (await recordMap()).get(slot.exerciseId) ?? null
    const proposal = prescribeFromProgram({ slot, week, program, last, exercise }, balance)
    return { exercise, last, record, proposal, slot }
  }

  /**
   * Recent sessions for one exercise, for the in-session history button.
   * @param {string} exerciseId
   * @param {number} [limit]
   */
  async function exerciseHistory(exerciseId, limit = 6) {
    const logs = await storage.getAllByIndex('setLogs', 'exerciseId', exerciseId)
    const sessions = new Map((await storage.getAll('sessions')).map((s) => [s.id, s]))

    /** @type {Map<string, any[]>} */
    const byDate = new Map()
    for (const log of logs) {
      if (log.isWarmup) continue
      const date = sessions.get(log.sessionId)?.date
      if (!date) continue
      if (!byDate.has(date)) byDate.set(date, [])
      byDate.get(date).push(log)
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, limit)
      .map(([date, sets]) => ({
        date,
        sets: sets.sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0)),
        volume: sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0),
      }))
  }

  /** The guide: weekly hard-set targets, derived from the program itself. */
  async function programGuide() {
    const active = await activeProgram()
    if (!active) return null
    return {
      program: active.program,
      week: active.week,
      deload: active.deload,
      hardSets: weeklyHardSets(active.program, await exerciseMap()),
    }
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
      // Set when this exercise stood in for another: the rack was taken, the
      // cable station was busy. Keeping it means history says what was actually
      // done, not what was planned.
      substitutedFor: set.substitutedFor ?? null,
      perSide: set.perSide === true,
      // Which program slot this set completes, so a slot can be finished on any
      // day of the week and still count against the day it was prescribed for.
      programDayId: set.programDayId ?? null,
      slotIndex: set.slotIndex ?? null,
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
   * Returns `null` when nothing was logged. There is nothing to summarise and
   * nothing was earned, so the caller closes the session silently.
   *
   * @param {object} session
   * @param {{durationMinutes?: number, isFirstOfDay?: boolean, onlySets?: any[]}} [options]
   * @returns {Promise<object|null>}
   */
  async function finishSession(session, options = {}) {
    // `onlySets` scores just the work being settled now. A day's session is
    // reused by every slot completed that day, so settling it a second time must
    // not re-award the first slot. Without this, completing three slots would
    // pay for the first one three times.
    const sets = options.onlySets ?? await setsFor(session.id)

    // Nothing was logged, so there is no training session here to settle: no XP,
    // and nothing to summarise. `null` tells the caller to close in silence.
    //
    // The record is also removed when it holds nothing at all, because a stored
    // empty session is not inert — it counts toward `sessionsThisWeekBefore` and
    // resets `daysSinceLastSession`, so leaving it behind would inflate the week
    // bonus and swallow a later return bonus. The check is deliberately against
    // the WHOLE session and not `onlySets`: in slot mode the record is the day's
    // and may already carry earlier slots that must not be destroyed.
    if (sets.length === 0) {
      const all = options.onlySets ? await setsFor(session.id) : sets
      if (all.length === 0) await storage.delete('sessions', session.id)
      return null
    }

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
      // Day-level Grit — showing up, coming back, meeting the week — fires once
      // per day, however many slots that day contains. See docs/10.
      isFirstOfDay: options.isFirstOfDay !== false,
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

  /**
   * Every working set logged inside the current program week.
   *
   * Completion is derived from this rather than stored, which is what makes the
   * week boundary self-cleaning: ask a different week and outstanding work is
   * simply gone, with nothing to reset and no debt to carry.
   */
  async function currentWeekLogs() {
    const active = await activeProgram()
    if (!active) return { active: null, logs: [] }
    const sessions = new Map((await storage.getAll('sessions')).map((s) => [s.id, s]))
    const today = clock.today()
    const logs = (await storage.getAll('setLogs')).filter((log) => {
      const date = sessions.get(log.sessionId)?.date
      if (!date) return false
      return isInSameProgramWeek(active.state.startedOn, date, today, daysBetween)
    })
    return { active, logs }
  }

  /** Today's prescribed slots, as tasks. */
  async function todayTasks() {
    const { active, logs } = await currentWeekLogs()
    if (!active) return null
    const weekday = new Date(`${clock.today()}T00:00:00`).getDay()
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const day = active.program.days.find((d) => d.id === names[weekday])
      ?? active.program.days.find((d) => dayTasks(d, logs).some((t) => !t.done))
      ?? active.program.days[0]
    return { ...active, day, tasks: dayTasks(day, logs) }
  }

  /** The whole week: prescribed, done, remaining, and hard sets against target. */
  async function weekStatus() {
    const { active, logs } = await currentWeekLogs()
    if (!active) return null
    return {
      ...active,
      week: weekTasks(active.program, logs),
      hardSets: weeklyHardSetsCompleted(logs, await exerciseMap(), active.program.weeklyTargets ?? {}),
    }
  }

  /**
   * Today's session, opened if it does not exist yet.
   *
   * Every slot completed on a given day shares one session record: that is what
   * makes a day of micro sets one training day rather than five.
   *
   * @returns {Promise<{session: any, isFirstOfDay: boolean}>}
   */
  async function openDaySession() {
    const today = clock.today()
    const existing = (await storage.getAll('sessions')).find((s) => s.date === today)
    return { session: existing ?? await startSession(null), isFirstOfDay: !existing }
  }

  /**
   * Completes one slot on its own — no routine, no session ceremony.
   *
   * Work still lands in a session record, because that is where set logs live,
   * but the session is the DAY's, reused by every slot completed that day. That
   * is what makes a day of micro sets count once as a training day rather than
   * five times, while every set still scores exactly what it would have scored
   * inside a block. The path does not change the reward.
   *
   * @param {{dayId: string, slotIndex: number, exerciseId: string}} slot
   * @param {any[]} sets
   * @param {{durationMinutes?: number}} [options]
   */
  async function completeSlot(slot, sets, options = {}) {
    const { session, isFirstOfDay } = await openDaySession()
    for (const [index, set] of sets.entries()) {
      await logSet(session, {
        ...set,
        exerciseId: slot.exerciseId,
        programDayId: slot.dayId,
        slotIndex: slot.slotIndex,
        setIndex: index,
      })
    }
    return finishSession(session, {
      durationMinutes: options.durationMinutes ?? Math.max(1, sets.length * 2),
      isFirstOfDay,
      onlySets: sets.map((set) => ({ ...set, exerciseId: slot.exerciseId })),
    })
  }

  return {
    exerciseMap, recordMap, lastPerformance, prepareExercise,
    activeProgram, prepareSlot, exerciseHistory, programGuide,
    todayTasks, weekStatus, completeSlot, currentWeekLogs, openDaySession,
    startSession, logSet, setsFor, finishSession,
    /** Removing a logged set, for the mistake that is currently unfixable. */
    async removeSet(logId) { await storage.delete('setLogs', logId) },
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
