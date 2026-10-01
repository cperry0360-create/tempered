/** Weekly training score, derived from canonical history. No I/O or current clock. */
import { effectiveLoad } from './records.js'
import { estimateOneRepMax } from './e1rm.js'
import { programForWeek, programWeekIndex, isDeloadWeek } from './programs.js'

const DAY = 86400000
const stamp = date => Date.parse(date + 'T12:00:00Z')
const monthDays = (year, month) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
const shift = (date, days) => {
  let [year, month, day] = date.split('-').map(Number)
  day += days
  while (day < 1) {
    month -= 1
    if (month < 1) { month = 12; year -= 1 }
    day += monthDays(year, month)
  }
  while (day > monthDays(year, month)) {
    day -= monthDays(year, month); month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}
const between = (a, b) => Math.round((stamp(b) - stamp(a)) / DAY)
const monday = date => shift(date, -(((Math.floor(stamp(date) / DAY) + 3) % 7 + 7) % 7))
const mean = values => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null
const cap = n => Math.max(0, Math.min(1, n))
const rounded = n => Math.round(n * 10) / 10
const grade = n => n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : n >= 60 ? 'D' : 'Rebuild week'

/**
 * @param {object} input Canonical rows, local YYYY-MM-DD today supplied by clock adapter.
 * @param {string} input.today
 * @param {any[]} [input.sessions]
 * @param {any[]} [input.setLogs]
 * @param {any[]} [input.programs]
 * @param {any[]} [input.programStates]
 * @param {any[]} [input.revisions]
 * @param {Map<string, any>} [input.exercises]
 * @param {string|null} [input.trackingStartedOn]
 */
export function trainingScore({ today, sessions = [], setLogs = [], programs = [], programStates = [], revisions = [], exercises = new Map(), trackingStartedOn = null }) {
  const finished = sessions.filter(s => s.endedAt && s.date <= today)
  const bySession = new Map(finished.map(s => [s.id, s]))
  const logs = setLogs.filter(s => !s.isWarmup && s.setType !== 'warmup' && bySession.has(s.sessionId))
    .map(s => ({ ...s, date: bySession.get(s.sessionId).date, session: bySession.get(s.sessionId) }))
  const starts = [trackingStartedOn, ...finished.map(s => s.date), ...programStates.map(s => s.startedOn)].filter(d => d && d <= today).sort()
  const start = starts[0]
  const currentStart = monday(today)
  function planAt(date) {
    const state = programStates.filter(s => s.startedOn <= date).sort((a,b) => b.startedOn.localeCompare(a.startedOn) || Number(Boolean(b.active)) - Number(Boolean(a.active)))[0]
    if (!state) return null
    const program = programs.find(p => p.id === state.programId)
    if (!program) return null
    // A session's immutable revision takes precedence over today's edited envelope.
    const session = finished.filter(s => monday(s.date) === monday(date) && s.programId === program.id && s.programRevisionId).sort((a,b) => a.date.localeCompare(b.date))[0]
    const revision = revisions.find(r => r.id === (session?.programRevisionId ?? state.revisionId ?? program.currentRevisionId))
    const snapshot = { ...program, ...(revision?.snapshot ?? {}) }
    const week = Math.min(programWeekIndex(state.startedOn, date, between) + 1, snapshot.weeks ?? 1)
    return { program: programForWeek(snapshot, week), deload: isDeloadWeek(week, snapshot), state }
  }
  const inWeek = (date, week) => monday(date) === week
  function dayCounts(week) {
    const totals = new Map()
    for (const session of finished.filter(s => inWeek(s.date, week))) {
      totals.set(session.date, (totals.get(session.date) ?? 0) + Math.max(0, Number(session.durationMinutes) || 0))
    }
    return [...totals].map(([date, minutes]) => ({ date, minutes, qualifies: minutes >= 30 }))
  }
  function plannedDays(week) {
    const p = planAt(week === currentStart ? today : shift(week, 6))
    return p?.program.days?.filter(d => (d.exercises ?? []).some(s => s.sets > 0)).length ?? 0
  }
  function calculate(week) {
    const end = week === currentStart ? today : shift(week, 6)
    const plan = planAt(end)
    const weekLogs = logs.filter(s => inWeek(s.date, week))
    const recentStart = shift(week, -7), earlierStart = shift(week, -35)
    const history = logs.filter(s => s.date >= earlierStart && s.date <= end && s.reps > 0)
    const lifts = new Map()
    for (const set of history) {
      // Different equipment methods are different lift histories.
      const key = set.exerciseId + ':' + (set.method ?? '')
      const rows = lifts.get(key) ?? []; rows.push(set); lifts.set(key, rows)
    }
    const progressionDetails = []
    for (const rows of lifts.values()) {
      if (new Set(rows.map(s => s.sessionId)).size < 3) continue
      const old = rows.filter(s => s.date < recentStart), recent = rows.filter(s => s.date >= recentStart)
      if (!old.length || !recent.length) continue
      const best = sets => Math.max(0, ...sets.map(s => estimateOneRepMax(effectiveLoad(s, exercises), s.reps)))
      const before = best(old), after = best(recent)
      const moreReps = recent.some(s => old.some(p => effectiveLoad(p, exercises) === effectiveLoad(s, exercises) && s.reps > Math.max(...old.filter(o => effectiveLoad(o, exercises) === effectiveLoad(s, exercises)).map(o => o.reps))))
      if (!before || !after) {
        // Unloaded movements cannot claim an estimated max; compare reps at the same logged load.
        if (!rows.every(s => effectiveLoad(s, exercises) === 0)) continue
      }
      const oldReps = Math.max(...old.map(s => s.reps)), newReps = Math.max(...recent.map(s => s.reps))
      const status = moreReps || after > before || (!before && newReps > oldReps) ? 'up'
        : before ? (after >= before * .99 ? 'held' : 'down') : (newReps === oldReps ? 'held' : 'down')
      const name = exercises.get(rows[0].exerciseId)?.name ?? rows[0].exerciseId
      progressionDetails.push({ exerciseId: rows[0].exerciseId, status, value: status === 'up' ? 1 : status === 'held' ? .6 : 0,
        reason: `${name}${rows[0].method ? ' · ' + rows[0].method : ''}: ${status} · ${before ? `e1RM ${rounded(before)} → ${rounded(after)} lb` : `${oldReps} → ${newReps} reps at the same load`}` })
    }
    const progression = { id:'progression', label:'Progression', baseWeight:.35,
      value: plan?.deload ? null : mean(progressionDetails.map(d => d.value)),
      reason: plan?.deload ? 'Deload: progression rests this week' : progressionDetails.length ? `${progressionDetails.filter(d => d.status === 'up').length} of ${progressionDetails.length} lifts up` : 'Needs 3 sessions per lift across both comparison periods',
      details: progressionDetails }
    const slots = (plan?.program.days ?? []).flatMap(day => (day.exercises ?? []).map((slot, index) => ({ dayId:day.id, index, slot })))
    const adherenceDetails = slots.map(({ dayId, index, slot }) => {
      const matching = weekLogs.filter(s => (s.programId ?? s.session.programId) === plan.program.id && s.programDayId === dayId && s.slotIndex === index)
      const target = Math.max(0, slot.sets || 0)
      const completed = Math.min(target, matching.length)
      const repSets = matching.filter(s => Number.isFinite(s.reps) && Number.isFinite(s.prescribed?.repMin ?? slot.repMin))
      const reached = repSets.filter(s => s.reps >= (s.prescribed?.repMin ?? slot.repMin)).length
      return { completed, prescribed:target, reached, repSets:repSets.length,
        reason:`${exercises.get(slot.exerciseId)?.name ?? slot.exerciseId} · ${dayId}: ${completed} of ${target} sets; ${reached} of ${repSets.length} reached the rep minimum` }
    })
    const sum = key => adherenceDetails.reduce((n, d) => n + d[key], 0)
    const prescribed = sum('prescribed'), completed = sum('completed'), repSets = sum('repSets'), reached = sum('reached')
    const adherence = { id:'adherence', label:'Plan adherence', baseWeight:.30,
      value: prescribed ? .7 * cap(completed / prescribed) + .3 * (repSets ? cap(reached / repSets) : 0) : null,
      prescribed, completed, reached, repSets,
      reason:prescribed ? `${completed} of ${prescribed} planned sets · ${reached} of ${repSets} reached rep minimum` : 'No prescribed working sets for this week', details:adherenceDetails }
    const days = dayCounts(week), target = plannedDays(week)
    const recentWeeks = [0,1,2,3].map(n => shift(week,-n*7)).filter(w => start && shift(w,6) >= start)
    const weekDetails = recentWeeks.map(w => ({ week:w, days:dayCounts(w).filter(d => d.qualifies).length, target:plannedDays(w) })).filter(w => w.target > 0)
    const met = weekDetails.filter(w => w.days >= w.target).length, qualified = days.filter(d => d.qualifies).length
    const consistency = { id:'consistency', label:'Consistency', baseWeight:.25,
      value:target ? .7 * cap(qualified / target) + .3 * (weekDetails.length ? met / weekDetails.length : 0) : null,
      days:qualified, plannedDays:target, metWeeks:met, trackedWeeks:weekDetails.length,
      reason:target ? `${qualified} of ${target} training days · ${met} of ${weekDetails.length} weeks met target` : 'No planned training days for this week',
      details:[...days.map(d => ({ reason:`${d.date}: ${rounded(d.minutes)} min · ${d.qualifies ? 'qualifying day' : '30 min qualifies'}` })), ...weekDetails.map(w => ({ reason:`Week of ${w.week}: ${w.days} of ${w.target} days` }))] }
    const prior = [1,2,3,4].map(n => shift(week,-n*7)).filter(w => start && shift(w,6) >= start)
    const baseline = mean(prior.map(w => logs.filter(s => inWeek(s.date,w)).length))
    const volume = { id:'volume', label:'Volume trend', baseWeight:.10,
      value:plan?.deload || baseline === null || baseline <= 0 ? null : cap(weekLogs.length / (baseline * .95)),
      sets:weekLogs.length, average:baseline,
      reason:plan?.deload ? 'Deload: volume rests this week' : baseline > 0 ? `${weekLogs.length} sets vs ${rounded(baseline)} avg` : 'Building a prior-week working-set baseline',
      details:[{reason:`Week of ${week}: ${weekLogs.length} working sets`},...prior.map(w => ({ reason:`Week of ${w}: ${logs.filter(s => inWeek(s.date,w)).length} working sets` }))] }
    const components = [progression, adherence, consistency, volume]
    const weight = components.filter(c => c.value !== null).reduce((n,c) => n+c.baseWeight,0)
    for (const component of components) component.weight = component.value === null ? 0 : component.baseWeight / weight
    const score = weight ? Math.round(100 * components.reduce((n,c) => n+(c.value ?? 0)*c.weight,0)) : null
    return { week, score, grade:score === null ? null : grade(score), soFar:week === currentStart, deload:plan?.deload ?? false, components }
  }
  const weeks = []
  if (start) for (let w=monday(start);w<=currentStart;w=shift(w,7)) weeks.push(calculate(w))
  const current = weeks.at(-1) ?? calculate(currentStart)
  const comparison = weeks.slice(-5,-1).filter(w => w.score !== null)
  const average = mean(comparison.map(w => w.score))
  return { current, weeks:weeks.slice(-12), average, change:current.score !== null && average !== null ? Math.round(current.score-average) : null }
}
