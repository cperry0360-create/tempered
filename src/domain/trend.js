/**
 * Trend maths for Progress charts. Pure: no DOM, no clock.
 *
 * Daily readings are noisy, so charts show the readings faintly and a rolling
 * average boldly. "Up" is good for some metrics and bad for others, so the
 * change is judged against a per-metric direction table, never by sign alone.
 */

export const MIN_TREND_READINGS = 7

/** Which direction counts as good. Neutral metrics never colour as good. */
export const GOOD_DIRECTION = Object.freeze({
  restingHr: 'down',
  hrvMs: 'up',
  sleepHours: 'up',
  steps: 'up',
  e1rm: 'up',
  weight: 'neutral',
  respiratoryRate: 'neutral',
  spo2: 'neutral',
})

const DAY = 86400000
const stamp = (date) => Date.parse(date + 'T12:00:00Z')

/**
 * Trailing average for each point: over the last `days` calendar days, or the
 * last `count` points.
 * @param {{date:string,value:number}[]} points sorted by date
 * @param {{days?:number,count?:number}} span
 */
export function rollingAverage(points, { days = null, count = null } = {}) {
  return points.map((point, index) => {
    const from = count ? Math.max(0, index - count + 1) : 0
    const trailing = points.slice(from, index + 1)
      .filter((p) => !days || stamp(point.date) - stamp(p.date) < days * DAY)
    return { date: point.date, value: trailing.reduce((sum, p) => sum + p.value, 0) / trailing.length }
  })
}

/**
 * Time-aware exponential smoothing (the weight-trend style used by MacroFactor
 * and Happy Scale), run forward and then backward so the line has no lag. Each
 * reading pulls the trend by an amount that grows with the gap in days.
 * @param {{date:string,value:number}[]} points sorted by date
 * @param {{halfLifeDays?:number}} [options]
 */
export function smoothTrend(points, { halfLifeDays = 7 } = {}) {
  const pass = (rows) => {
    let previous = null
    return rows.map((point) => {
      if (!previous) { previous = { date: point.date, value: point.value }; return { ...previous } }
      const gapDays = Math.max(1, Math.abs(stamp(point.date) - stamp(previous.date)) / DAY)
      const pull = 1 - Math.pow(0.5, gapDays / halfLifeDays)
      previous = { date: point.date, value: previous.value + pull * (point.value - previous.value) }
      return { ...previous }
    })
  }
  // Forward then backward: a history chart should not lag behind its own data.
  return pass(pass(points).reverse()).reverse()
}

/**
 * Usual range: mean ± 1 population standard deviation, never narrower than ±2%
 * of the mean, so a metric that barely varies (blood oxygen) is not flagged for
 * a one-point wobble.
 */
export function normalBand(values) {
  const clean = values.filter(Number.isFinite)
  if (clean.length < 2) return null
  const mean = clean.reduce((sum, n) => sum + n, 0) / clean.length
  const sd = Math.sqrt(clean.reduce((sum, n) => sum + (n - mean) ** 2, 0) / clean.length)
  const half = Math.max(sd, Math.abs(mean) * 0.02)
  return { mean, sd, low: mean - half, high: mean + half }
}

/**
 * @param {string} metric key in GOOD_DIRECTION
 * @param {number} change
 * @param {{weightGoal?:'up'|'down'|null}} [options]
 */
export function isGoodChange(metric, change, { weightGoal = null } = {}) {
  if (!Number.isFinite(change) || change === 0) return false
  const direction = metric === 'weight' && weightGoal ? weightGoal : GOOD_DIRECTION[metric] ?? 'neutral'
  if (direction === 'neutral') return false
  return direction === 'up' ? change > 0 : change < 0
}

const format = (value, digits) => Math.abs(value).toLocaleString('en-US', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
})

/**
 * Everything a trend row needs.
 * @param {{date:string,value:number}[]} points sorted by date
 * @param {{metric:string, unit?:string, digits?:number, rangeLabel?:string,
 *   average?:{halfLifeDays?:number,count?:number}, band?:boolean, weightGoal?:'up'|'down'|null}} options
 */
export function summarizeTrend(points, {
  metric, unit = '', digits = 0, rangeLabel = '', average = { halfLifeDays: 7 }, band = false, weightGoal = null,
} = {}) {
  const readings = points.filter((p) => Number.isFinite(p?.value))
  const latest = readings.at(-1) ?? null
  if (readings.length < MIN_TREND_READINGS) {
    return { readings, trend: [], latest, sparse: true, change: null, good: false, band: null, outside: null,
      changeText: 'Not enough data for a trend' }
  }
  const trend = average.count ? rollingAverage(readings, average) : smoothTrend(readings, average)
  // Daily metrics: last week of readings against the first week, so one odd day
  // at either end cannot set the headline. Session metrics: trend end to end.
  const mean = (xs) => xs.reduce((sum, p) => sum + p.value, 0) / xs.length
  const firstWeek = readings.filter((p) => stamp(p.date) - stamp(readings[0].date) < 7 * DAY)
  const lastWeek = readings.filter((p) => stamp(latest.date) - stamp(p.date) < 7 * DAY)
  const change = average.count ? trend.at(-1).value - trend[0].value : mean(lastWeek) - mean(firstWeek)
  const usual = band ? normalBand(readings.slice(-31, -1).map((p) => p.value)) : null
  const outside = usual && latest.value > usual.high ? 'above' : usual && latest.value < usual.low ? 'below' : null
  const rounded = Number(format(change, digits).replace(/,/g, ''))
  const arrow = rounded === 0 ? '→' : change > 0 ? '↑' : '↓'
  const changeText = outside
    ? (outside === 'above' ? 'Above your usual range' : 'Below your usual range')
    : rounded === 0
      ? 'Steady' + (rangeLabel ? ' over ' + rangeLabel : '')
      : `${arrow} ${format(change, digits)}${unit}${rangeLabel ? ' over ' + rangeLabel : ''}`
  return { readings, trend, latest, sparse: false, change, band: usual, outside,
    good: rounded !== 0 && isGoodChange(metric, change, { weightGoal }), changeText }
}
