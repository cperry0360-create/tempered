/**
 * Grit — showing up over time.
 *
 * There is no streak multiplier here and there never may be one. Streaks display
 * for information only; multiplying XP by them manufactures exactly the anxiety
 * this app exists to avoid. `grit.test.js` asserts this directly.
 *
 * The return-after-a-gap bonus is the counterpart: coming back is the hardest
 * single act in fitness, so the app pays for it rather than punishing the
 * absence that preceded it.
 *
 * `docs/10-task-model.md`: a day on which any slot was completed is a training
 * day, whether or not a formal session was run. So the day-level awards — showing
 * up, coming back, meeting the week's plan — fire once per day, on the first work
 * logged, and `context.isFirstOfDay: false` suppresses them for everything after.
 * Time under load still accrues every time, because it is a measurement rather
 * than a milestone. Without this, a day of micro sets would either score zero on
 * the attribute specifically about showing up, or pay the session bonus five
 * times over.
 */

/**
 * @param {import('./types.js').SessionInput} session
 * @param {import('./types.js').SessionContext} context
 * @param {import('./types.js').Balance} balance
 * @returns {import('./types.js').Award[]}
 */
export function gritAwards(session, context, balance) {
  const grit = balance.grit
  /** @type {import('./types.js').Award[]} */
  const awards = []

  /** @param {string} source @param {string} label @param {number} xp */
  const add = (source, label, xp) => {
    if (xp > 0) awards.push({ attribute: 'grit', source, label, xp })
  }

  // Defaults to true, so a normal session behaves exactly as it always has.
  const firstOfDay = context.isFirstOfDay !== false

  // Flat, for any training type. This is the one Grit source that does not care
  // what you did, only that you did it — so it fires once for the day, however
  // many slots that day turns out to contain.
  if (firstOfDay) add('grit.session', 'Trained today', grit.xpPerSession)

  // Always: this is measured time, and a second slot is more time under load.
  const hours = Math.max(0, session.durationMinutes ?? 0) / 60
  add('grit.hours', 'Time under load', hours * grit.xpPerTrainingHour)

  // Requires a previous session to have returned from: `daysSinceLastSession` is
  // Infinity for the very first session ever, which is a beginning, not a return.
  if (firstOfDay
      && Number.isFinite(context.daysSinceLastSession)
      && context.daysSinceLastSession >= grit.returnGapDaysThreshold) {
    add('grit.return', 'Back after time away', grit.returnAfterGapBonus)
  }

  // Awarded on the day that reaches the weekly target, once per week.
  if (firstOfDay && context.sessionsThisWeekBefore + 1 === context.planTargetSessionsPerWeek) {
    add('grit.weekPlan', 'Week met plan', grit.weekMetPlanBonus)
  }

  return awards
}
