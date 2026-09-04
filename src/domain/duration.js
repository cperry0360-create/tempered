/**
 * How long training actually took — `docs/11-structure-and-feel.md` F1.
 *
 * A session record spans the whole day by design: `docs/10-task-model.md` makes
 * the slot the unit, and every slot completed on a given day joins one session
 * so that a day of micro sets counts once as a training day. The consequence is
 * that the gap between the first and last log is not a duration. Log a set at
 * seven in the morning and another at half past nine, and wall-clock calls it a
 * two-and-a-half hour session — which is what put "2h 30m" on a five-minute one.
 *
 * So duration is measured, not spanned. Logs are grouped into **sittings**: runs
 * of sets close enough together to be one visit to the gym. Each sitting counts
 * for the time from its first set to its last, plus one set's worth for the last
 * set — without which a single-set sitting would be zero minutes of work. The
 * gaps *between* sittings count for nothing, because you were not training.
 *
 * Both constants live in `data/balance.json`: what counts as one sitting is a
 * balance question, not a logic one.
 *
 * Pure. No clock, no storage — the timestamps are handed in.
 */

/**
 * The logged instants, cleaned and ordered.
 *
 * Set logs are written in the order they happen, but nothing guarantees that,
 * and an older build may have written a log with no `completedAt` at all. A bad
 * timestamp is dropped rather than treated as the epoch, which would otherwise
 * turn one missing field into a fifty-six-year session.
 *
 * @param {(string|null|undefined)[]|null|undefined} times ISO timestamps
 * @returns {number[]} epoch milliseconds, ascending
 */
function instants(times) {
  return (times ?? [])
    .map((time) => (typeof time === 'string' ? Date.parse(time) : NaN))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b)
}

/**
 * The logged sets grouped into sittings — one visit to the gym each.
 *
 * A gap longer than the threshold starts a new sitting. Exactly at the
 * threshold is still the same one: rest between heavy sets is genuinely long,
 * and an inclusive boundary would split a set of triples into two visits.
 *
 * @param {(string|null|undefined)[]|null|undefined} times
 * @param {import('./types.js').Balance} balance
 * @returns {{start: number, end: number}[]}
 */
export function sittingsOf(times, balance) {
  const gapMs = balance.session.sittingGapMinutes * 60000
  /** @type {{start: number, end: number}[]} */
  const sittings = []
  for (const ms of instants(times)) {
    const current = sittings.at(-1)
    if (current && ms - current.end <= gapMs) current.end = ms
    else sittings.push({ start: ms, end: ms })
  }
  return sittings
}

/**
 * Minutes of time under load: the sittings' spans, plus the set that ends each.
 *
 * @param {(string|null|undefined)[]|null|undefined} times `completedAt` of every logged set
 * @param {import('./types.js').Balance} balance
 * @returns {number} whole minutes, never negative
 */
export function timeUnderLoad(times, balance) {
  const perSet = balance.session.minutesPerSet
  const total = sittingsOf(times, balance)
    .reduce((sum, sitting) => sum + (sitting.end - sitting.start) / 60000 + perSet, 0)
  return Math.max(0, Math.round(total))
}
