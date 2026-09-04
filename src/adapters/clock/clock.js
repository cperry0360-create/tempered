/**
 * Clock adapter.
 *
 * Domain logic never calls `Date.now()` — it takes dates as arguments, and the
 * app supplies them from here. That is what makes "a workout at 11pm belongs to
 * that day" testable rather than hopeful.
 *
 * Dates are calendar-LOCAL, never UTC. `toISOString().slice(0, 10)` is the
 * obvious implementation and it is wrong: at 11pm on the 4th in a negative
 * offset it reports the 5th, filing an evening workout under tomorrow.
 *
 * @typedef {object} Clock
 * @property {() => number} now        Epoch milliseconds.
 * @property {() => string} nowIso     Full ISO timestamp.
 * @property {() => string} today      Calendar-local date, YYYY-MM-DD.
 * @property {(date: Date) => string} toLocalDate
 */

/**
 * Formats a Date as a calendar-local YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Whole days between two calendar-local dates. Used for the return-after-a-gap
 * bonus, so it must count calendar days and not 24-hour periods.
 *
 * @param {string} from YYYY-MM-DD
 * @param {string} to   YYYY-MM-DD
 * @returns {number}
 */
export function daysBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  // UTC purely as a stable arithmetic frame; both sides are already local dates,
  // so no timezone shift can leak in.
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86400000)
}

/**
 * The real clock. The only place in the app that reads the current time.
 * @returns {Clock}
 */
export function systemClock() {
  return {
    now: () => Date.now(),
    nowIso: () => new Date().toISOString(),
    today: () => toLocalDate(new Date()),
    toLocalDate,
  }
}

/**
 * A clock frozen at a moment, for tests and for replaying a day.
 *
 * @param {string|number|Date} instant
 * @returns {Clock & {set: (next: string|number|Date) => void, advanceDays: (n: number) => void}}
 */
export function fixedClock(instant) {
  let current = new Date(instant)
  return {
    now: () => current.getTime(),
    nowIso: () => current.toISOString(),
    today: () => toLocalDate(current),
    toLocalDate,
    set(next) { current = new Date(next) },
    advanceDays(n) {
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + n,
        current.getHours(), current.getMinutes(), current.getSeconds(), current.getMilliseconds())
    },
  }
}
