/**
 * The task model: the unit of work is the exercise slot, not the session.
 *
 * `docs/10-task-model.md` corrects the assumption in `docs/05` that a session is
 * the only way to log. Slots are independently completable, they roll forward
 * through the program week, and at the week boundary the slate resets.
 *
 * Two rules shape everything here:
 *
 *   - **Rollover is within the week, never indefinite.** Outstanding work from a
 *     finished week is gone, not accumulated. Accumulating it would make this a
 *     debt tracker, which is the punishment pattern CLAUDE.md forbids.
 *   - **There is no overdue state.** Outstanding is outstanding. Nothing is late,
 *     nothing is missed, nothing accrues a penalty.
 *
 * Completion is *derived* from logged sets inside the current week rather than
 * stored as a flag. That is what makes the week boundary self-cleaning: ask a
 * different week and you get a different answer, with nothing to reset.
 */

/**
 * Coarse muscle groups the weekly targets are expressed in, mapped to the
 * activation keys the exercise library uses.
 *
 * The library tracks finer detail than a target needs — `mid_delts` and
 * `front_delts` are both shoulders when you are asking whether the week worked.
 */
export const TARGET_GROUPS = Object.freeze({
  chest: ['pecs'],
  back: ['lats', 'traps'],
  quads: ['quads'],
  hamstrings_glutes: ['hamstrings', 'glutes'],
  shoulders: ['front_delts', 'mid_delts', 'rear_delts'],
  arms: ['biceps', 'triceps'],
  core: ['core'],
})

/** A set counts toward a group when the movement meaningfully loads it. */
const MEANINGFUL_ACTIVATION = 1

/**
 * A stable identity for one slot within a program week.
 * @param {string} dayId
 * @param {number} slotIndex
 */
export const slotKey = (dayId, slotIndex) => `${dayId}#${slotIndex}`

/**
 * The state of every slot in a program day, given the week's logged sets.
 *
 * @param {{id: string, exercises: any[]}} day
 * @param {{programDayId?: string, slotIndex?: number, exerciseId: string, isWarmup?: boolean}[]} weekLogs
 *        Working sets logged inside the current program week.
 * @returns {{slot: any, index: number, key: string, logged: number, prescribed: number,
 *            done: boolean, started: boolean}[]}
 */
export function dayTasks(day, weekLogs) {
  return day.exercises.map((slot, index) => {
    const key = slotKey(day.id, index)
    const logged = weekLogs.filter((log) =>
      log.isWarmup !== true
      && log.programDayId === day.id
      && log.slotIndex === index).length
    return {
      slot,
      index,
      key,
      logged,
      prescribed: slot.sets,
      done: logged >= slot.sets,
      started: logged > 0 && logged < slot.sets,
    }
  })
}

/**
 * The whole week: every day's slots, and how much of the week is behind you.
 *
 * @param {{days: any[]}} program
 * @param {any[]} weekLogs
 */
export function weekTasks(program, weekLogs) {
  const days = program.days.map((day) => {
    const tasks = dayTasks(day, weekLogs)
    return {
      day,
      tasks,
      done: tasks.filter((task) => task.done).length,
      total: tasks.length,
    }
  })
  return {
    days,
    done: days.reduce((sum, entry) => sum + entry.done, 0),
    total: days.reduce((sum, entry) => sum + entry.total, 0),
  }
}

/**
 * Hard sets actually completed this week per muscle group, against the program's
 * targets.
 *
 * Derived from logged sets and the library's activation data, never hand-entered
 * — this is the number that says whether the week worked, so it has to come from
 * what was done rather than what was planned.
 *
 * @param {any[]} weekLogs
 * @param {Map<string, {activation?: Record<string, number>}>} exercises
 * @param {Record<string, [number, number]>} [targets]
 * @returns {{group: string, sets: number, target: [number, number]|null,
 *            met: boolean, short: number}[]}
 */
export function weeklyHardSetsCompleted(weekLogs, exercises, targets = {}) {
  /** @type {Map<string, number>} */
  const counts = new Map()

  for (const log of weekLogs) {
    if (log.isWarmup === true) continue
    const activation = exercises.get(log.exerciseId)?.activation ?? {}
    for (const [group, members] of Object.entries(TARGET_GROUPS)) {
      const loads = members.some((muscle) => (activation[muscle] ?? 0) >= MEANINGFUL_ACTIVATION)
      if (loads) counts.set(group, (counts.get(group) ?? 0) + 1)
    }
  }

  const groups = new Set([...Object.keys(targets).filter((k) => !k.startsWith('_')), ...counts.keys()])
  return [...groups]
    .map((group) => {
      const sets = counts.get(group) ?? 0
      const target = /** @type {[number, number]|undefined} */ (targets[group]) ?? null
      return {
        group,
        sets,
        target,
        met: target ? sets >= target[0] : false,
        // How many more would reach the bottom of the range. Never negative:
        // this is work still available, not a debt.
        short: target ? Math.max(0, target[0] - sets) : 0,
      }
    })
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group))
}

/**
 * Whether a date falls inside the program week that contains `reference`.
 *
 * Used to scope logs to the current week, which is what makes outstanding work
 * disappear at the boundary rather than pile up.
 *
 * @param {string} startedOn  Program start, YYYY-MM-DD.
 * @param {string} date       The date being tested.
 * @param {string} reference  Any date inside the week of interest.
 * @param {(from: string, to: string) => number} daysBetween
 */
export function isInSameProgramWeek(startedOn, date, reference, daysBetween) {
  const weekOf = (day) => Math.floor(daysBetween(startedOn, day) / 7)
  return weekOf(date) === weekOf(reference)
}
