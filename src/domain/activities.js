/**
 * The activity model — what a day's non-workout logging is made of.
 *
 * `data/activities.json` says what exists and which attribute it feeds. This
 * module says how each one is entered and where it lands in a `DayInput`, which
 * is the piece every screen and every service would otherwise have to guess at.
 *
 * Two rules from `docs/01-attributes-and-xp.md` are load-bearing here:
 *
 *   - **If an activity can be measured, it must not be a checkbox.** Sleep,
 *     water, steps and minutes are numbers. Only genuinely binary things — you
 *     rested, you logged your food, you wrote — are marks.
 *   - **A body metric's value is never scored.** `body_metrics` is the one entry
 *     that takes a number and awards a flat amount for the act of taking it. The
 *     number goes to `bodyMetrics`, which the XP engine may not read, and the
 *     only scoring field it sets is the boolean `bodyMetricsLogged`.
 *
 * Pure, like everything else here: no clock, no storage, no mutation.
 */

/**
 * @typedef {object} ActivitySpec
 * @property {string} field    The `DayInput` field this writes.
 * @property {'mark'|'number'} entry
 * @property {'add'|'replace'} [mode]  How a second entry on the same day combines.
 * @property {'bodyMetrics'} [stores]  A value kept but never scored.
 */

/**
 * Where each activity lands.
 *
 * `add` is for things that arrive in pieces across a day — a glass of water, ten
 * minutes of reading. Typing a running total by hand is arithmetic, not logging.
 * `replace` is for things that describe the whole day already: you did not sleep
 * seven hours and then a further eight, and a step count is a total on arrival.
 *
 * @type {Readonly<Record<string, ActivitySpec>>}
 */
export const ACTIVITY_FIELDS = Object.freeze({
  rest_day: { field: 'restDay', entry: 'mark' },
  sleep: { field: 'sleepHours', entry: 'number', mode: 'replace' },
  water: { field: 'waterOz', entry: 'number', mode: 'add' },
  steps: { field: 'steps', entry: 'number', mode: 'replace' },
  nutrition_logged: { field: 'nutritionLogged', entry: 'mark' },
  // The engine scores "target met", and nothing anywhere holds a gram target to
  // compare an entry against, so this is the honest shape for it: a mark.
  protein_target: { field: 'proteinTargetMet', entry: 'mark' },
  // Takes a number, scores the act. See the hard rule above.
  body_metrics: { field: 'bodyMetricsLogged', entry: 'number', mode: 'replace', stores: 'bodyMetrics' },
  mobility: { field: 'mobilityMinutes', entry: 'number', mode: 'add' },
  read: { field: 'readingMinutes', entry: 'number', mode: 'add' },
  study: { field: 'studyMinutes', entry: 'number', mode: 'add' },
  meditate: { field: 'meditationMinutes', entry: 'number', mode: 'add' },
  instrument: { field: 'instrumentMinutes', entry: 'number', mode: 'add' },
  journal: { field: 'journalLogged', entry: 'mark' },
})

/**
 * The order a day tends to happen in — rest first because `docs/03-screens.md`
 * requires it always available and never buried, then the night before, then the
 * day's fuel and movement, then the evening's quieter work.
 *
 * Explicitly not alphabetical. "Journal, Logged your food, Meditate, Mobility"
 * is the order of a filing cabinet, not of a day.
 */
const LIKELY_NEXT = [
  'rest_day',
  'sleep',
  'water',
  'steps',
  'nutrition_logged',
  'protein_target',
  'body_metrics',
  'mobility',
  'read',
  'study',
  'instrument',
  'meditate',
  'journal',
]

/** @param {unknown} value */
function positiveNumber(value) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim())
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

/**
 * The value a day currently holds for an activity, or null.
 *
 * For a body metric this is the boolean act, never the reading. The reading is
 * shown back to the user — `docs/07` Phase 4 requires it — but that read happens
 * in the app layer, deliberately. `body-weight.test.js` asserts that no module
 * in this directory so much as reaches for a recorded metric value, and a
 * display helper is not a good enough reason to be the first one that does: the
 * guard is only worth having while it has no exceptions.
 *
 * @param {{id: string}} activity
 * @param {import('./types.js').DayInput} day
 * @returns {number|boolean|null}
 */
export function activityValue(activity, day) {
  const spec = ACTIVITY_FIELDS[activity?.id]
  if (!spec || !day) return null
  const value = day[spec.field]
  return value === undefined ? null : value
}

/**
 * Whether the day carries an entry for this activity.
 *
 * A zero counts. Nought steps is something you told the app, and an app that
 * keeps asking for a number you already gave it is not listening.
 *
 * @param {{id: string}} activity
 * @param {import('./types.js').DayInput} day
 * @returns {boolean}
 */
export function isLogged(activity, day) {
  const spec = ACTIVITY_FIELDS[activity?.id]
  if (!spec || !day) return false
  if (spec.entry === 'mark') return day[spec.field] === true
  if (spec.stores === 'bodyMetrics') return day[spec.field] === true
  return typeof day[spec.field] === 'number'
}

/**
 * A day with one more activity logged on it. Never mutates its input.
 *
 * @param {import('./types.js').DayInput} day
 * @param {string} activityId
 * @param {number|string|null} [value]  Ignored for a mark.
 * @returns {import('./types.js').DayInput}
 */
export function applyActivity(day, activityId, value = null, options = {}) {
  const spec = ACTIVITY_FIELDS[activityId]
  if (!spec) return day

  if (spec.entry === 'mark') return { ...day, [spec.field]: true }

  /**
   * How this entry combines with what the day already holds.
   *
   * The spec's mode is the default and describes how the activity usually
   * arrives. `options.mode` overrides it for one entry — `'set'` (or the
   * spec's own `'replace'`) makes this entry the total rather than another
   * piece of it. That is what lets the quick-add buttons accumulate while the
   * typed field corrects, per `docs/11 F3` as revised. Add-only left a mistyped
   * total uncorrectable: every attempt to fix 400 ounces only made it larger.
   *
   * Correcting downwards costs nothing, because `dayLogs.awarded` is a
   * high-water ledger and XP already paid is never clawed back. Same
   * no-punishment rule as everywhere else: putting a number right is not an
   * admission, and the app does not charge for it.
   */
  const mode = options.mode ?? spec.mode

  const entered = positiveNumber(value)
  // A number that is not a number leaves the last good value where it was.
  if (entered === null) return day

  if (spec.stores === 'bodyMetrics') {
    return {
      ...day,
      [spec.field]: true,
      bodyMetrics: { ...(day.bodyMetrics ?? {}), weight: entered },
    }
  }

  const existing = typeof day[spec.field] === 'number' ? day[spec.field] : 0
  // Anything that is not 'add' replaces, so 'set' and 'replace' agree.
  return { ...day, [spec.field]: mode === 'add' ? existing + entered : entered }
}

/**
 * The ids seeded as daily — what a normal person tracks every day.
 *
 * This is a starting point, not the answer: the list belongs to the user and is
 * set during setup. It exists so a first run has a sensible Today rather than
 * either an empty one or all thirteen.
 *
 * @param {{id: string, daily?: boolean}[]} activities
 * @returns {string[]}
 */
export function defaultDailyIds(activities) {
  return activities.filter((activity) => activity.daily === true).map((activity) => activity.id)
}

/**
 * The catalogue split into what Today shows and what lives one control away.
 *
 * This is the structural half of the one-view rule in `docs/03-screens.md`.
 * Today fits a phone because it shows the daily list, not because the daily
 * list happens to be short today — which means the rule survives a fourteenth
 * activity, and a fortieth. Nothing is lost by the split: everything off the
 * list is still loggable, still earns exactly the same, and still shows up in
 * what was worked.
 *
 * @param {{id: string}[]} activities
 * @param {string[]} dailyIds  The user's list.
 */
export function partitionByDaily(activities, dailyIds) {
  const wanted = new Set(dailyIds ?? [])
  const sorted = sortActivities(activities)
  return {
    daily: sorted.filter((activity) => wanted.has(activity.id)),
    other: sorted.filter((activity) => !wanted.has(activity.id)),
  }
}

/**
 * @param {{id: string}[]} activities
 * @returns {{id: string}[]} A new array, in the order a day happens.
 */
export function sortActivities(activities) {
  const rank = (activity) => {
    const index = LIKELY_NEXT.indexOf(activity.id)
    return index === -1 ? LIKELY_NEXT.length : index
  }
  return [...activities].sort((a, b) => rank(a) - rank(b))
}

/**
 * Outstanding and logged, both in likely-next order.
 *
 * Nothing here is late. An activity not yet logged is simply one still
 * available, which is why this returns two lists and not a score out of thirteen.
 *
 * @param {{id: string}[]} activities
 * @param {import('./types.js').DayInput} day
 */
export function splitActivities(activities, day) {
  const sorted = sortActivities(activities)
  return {
    outstanding: sorted.filter((activity) => !isLogged(activity, day)),
    logged: sorted.filter((activity) => isLogged(activity, day)),
  }
}
