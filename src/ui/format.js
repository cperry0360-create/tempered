/**
 * Display formatting.
 *
 * Numbers lead, per docs/04-design-system.md, and they are always tabular — a
 * weight that shifts position as it changes is unreadable mid-set.
 *
 * Language follows CLAUDE.md: tempered, forged, worked, load, recovery. Never
 * crushed, never "streak lost", never a red state for something merely not done.
 */

/** @param {number|null|undefined} value */
export function lbs(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 10) / 10}`
}

/** @param {number|null|undefined} value */
export function volume(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('en-US')
}

/** @param {number} value */
export function xp(value) {
  return Math.round(value).toLocaleString('en-US')
}

/** @param {number} seconds */
export function clock(seconds) {
  const safe = Math.max(0, Math.round(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/** @param {number} minutes */
export function duration(minutes) {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  return `${hours}h ${String(total % 60).padStart(2, '0')}m`
}

/**
 * A performed set, as shown in the RECORD column.
 * @param {{weight: number|null, reps: number|null, timeSec?: number|null, distance?: number|null}|null} set
 */
export function performance(set) {
  if (!set) return '—'
  if (typeof set.timeSec === 'number' && set.timeSec > 0) return `${set.timeSec}s`
  if (typeof set.distance === 'number' && set.distance > 0) {
    return set.weight ? `${lbs(set.weight)} × ${set.distance} ft` : `${set.distance} ft`
  }
  if (typeof set.weight === 'number' && typeof set.reps === 'number') return `${lbs(set.weight)} × ${set.reps}`
  if (typeof set.reps === 'number') return `${set.reps} reps`
  return '—'
}

/** @param {string} isoDate YYYY-MM-DD */
export function shortDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d} ${months[m - 1]} ${y}`
}

/**
 * How long ago, phrased without pressure. Never "you haven't trained in N days".
 * @param {string} from YYYY-MM-DD
 * @param {string} to   YYYY-MM-DD
 */
export function since(from, to) {
  if (!from) return 'not yet worked'
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  if (days < 60) return `${Math.round(days / 7)} weeks ago`
  return shortDate(from)
}
