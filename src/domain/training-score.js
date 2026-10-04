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
const pct = n => Math.round(n * 100) + '%'
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
 * @param {{start:string,end:string}[]} [input.awayPeriods] Profile away ranges; overlapping weeks are not scored.
 */
export const TRAINING_DAY_MIN_SETS = 6
export const TRAINING_DAY_MIN_MINUTES = 30
const WEEKDAY = { monday:0, tuesday:1, wednesday:2, thursday:3, friday:4, saturday:5, sunday:6 }
/** Monday-first weekday for a program day: weekday-named ids, else its position. */
const dayIndexOf = (day, index) => WEEKDAY[String(day?.id ?? '').toLowerCase()] ?? Math.min(index, 6)

export function trainingScore({ today, sessions = [], setLogs = [], programs = [], programStates = [], revisions = [], exercises = new Map(), trackingStartedOn = null, awayPeriods = [] }) {
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
  const away = new Set()
  for (const period of awayPeriods ?? []) {
    if (!period?.start || !period?.end) continue
    const [from, to] = period.start <= period.end ? [period.start, period.end] : [period.end, period.start]
    for (let w = monday(from); w <= monday(to); w = shift(w, 7)) away.add(w)
  }
  /** A training day is 6+ working sets or 30+ minutes across every session that date. */
  function dayCounts(week) {
    const totals = new Map()
    const day = date => totals.get(date) ?? totals.set(date, { date, minutes: 0, sets: 0 }).get(date)
    for (const session of finished.filter(s => inWeek(s.date, week))) day(session.date).minutes += Math.max(0, Number(session.durationMinutes) || 0)
    for (const log of logs.filter(s => inWeek(s.date, week))) day(log.date).sets += 1
    return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, qualifies: d.sets >= TRAINING_DAY_MIN_SETS || d.minutes >= TRAINING_DAY_MIN_MINUTES }))
  }
  function plannedDays(week) {
    const p = planAt(week === currentStart ? today : shift(week, 6))
    return p?.program.days?.filter(d => (d.exercises ?? []).some(s => s.sets > 0)).length ?? 0
  }
  function calculate(week) {
    if (away.has(week)) return { week, away: true, score: null, grade: null, soFar: week === currentStart, deload: false, components: [] }
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
    const slots = (plan?.program.days ?? []).flatMap((day, dayPos) => (day.exercises ?? []).map((slot, index) => ({ dayId:day.id, dayName:day.name ?? day.id, dayIndex:dayIndexOf(day, dayPos), index, slot })))
    // Exact slot identity first, then the planned exercise or its recorded substitute,
    // however it was logged. Each set fills at most one slot, capped at its prescription.
    const used = new Set(), filled = new Map(slots.map(s => [s, []]))
    const isPlanned = s => !s.programId && !s.session.programId || (s.programId ?? s.session.programId) === plan?.program.id
    for (const entry of slots) {
      for (const log of weekLogs) {
        if (filled.get(entry).length >= (entry.slot.sets || 0)) break
        if (!used.has(log) && isPlanned(log) && log.programDayId === entry.dayId && log.slotIndex === entry.index) { used.add(log); filled.get(entry).push(log) }
      }
    }
    for (const entry of slots) {
      for (const log of weekLogs) {
        if (filled.get(entry).length >= (entry.slot.sets || 0)) break
        if (used.has(log) || (log.programDayId != null && log.slotIndex != null && slots.some(o => o.dayId === log.programDayId && o.index === log.slotIndex))) continue
        if (log.exerciseId === entry.slot.exerciseId || log.substitutedFor === entry.slot.exerciseId) { used.add(log); filled.get(entry).push(log) }
      }
    }
    const adherenceDetails = slots.map(entry => {
      const { dayId, dayName, dayIndex, slot } = entry, matching = filled.get(entry)
      const target = Math.max(0, slot.sets || 0)
      const completed = Math.min(target, matching.length)
      const repSets = matching.filter(s => Number.isFinite(s.reps) && Number.isFinite(s.prescribed?.repMin ?? slot.repMin))
      const reached = repSets.filter(s => s.reps >= (s.prescribed?.repMin ?? slot.repMin)).length
      return { completed, prescribed:target, reached, repSets:repSets.length, dayId, dayName, dayIndex,
        exerciseName: exercises.get(slot.exerciseId)?.name ?? slot.exerciseId,
        reason:`${exercises.get(slot.exerciseId)?.name ?? slot.exerciseId} · ${dayName}: ${completed} of ${target} sets; ${reached} of ${repSets.length} reached the rep minimum` }
    })
    const sum = key => adherenceDetails.reduce((n, d) => n + d[key], 0)
    const prescribed = sum('prescribed'), completed = sum('completed'), repSets = sum('repSets'), reached = sum('reached')
    const adherence = { id:'adherence', label:'Plan adherence', baseWeight:.30,
      value: prescribed ? .7 * cap(completed / prescribed) + .3 * (repSets ? cap(reached / repSets) : 0) : null,
      prescribed, completed, reached, repSets,
      reason:prescribed ? `${completed} of ${prescribed} planned sets · ${reached} of ${repSets} reached rep minimum` : 'No prescribed working sets for this week', details:adherenceDetails }
    if (prescribed) adherence.formula = `70% × ${pct(cap(completed / prescribed))} of planned sets finished (${completed} of ${prescribed}) + 30% × ${pct(repSets ? cap(reached / repSets) : 0)} of logged sets at the rep minimum (${reached} of ${repSets}) = ${pct(adherence.value)}`
    const days = dayCounts(week), target = plannedDays(week)
    const recentWeeks = [0,1,2,3].map(n => shift(week,-n*7)).filter(w => start && shift(w,6) >= start && !away.has(w))
    const weekDetails = recentWeeks.map(w => ({ week:w, days:dayCounts(w).filter(d => d.qualifies).length, target:plannedDays(w) })).filter(w => w.target > 0)
    const met = weekDetails.filter(w => w.days >= w.target).length, qualified = days.filter(d => d.qualifies).length
    const consistency = { id:'consistency', label:'Consistency', baseWeight:.25,
      value:target ? .7 * cap(qualified / target) + .3 * (weekDetails.length ? met / weekDetails.length : 0) : null,
      days:qualified, plannedDays:target, metWeeks:met, trackedWeeks:weekDetails.length,
      reason:target ? `${qualified} of ${target} training days · ${met} of ${weekDetails.length} weeks met target` : 'No planned training days for this week',
      details:[...days.map(d => ({ reason:`${d.date}: ${d.sets} working sets · ${rounded(d.minutes)} min · ${d.qualifies ? 'training day' : '6 sets or 30 min counts'}` })), ...weekDetails.map(w => ({ reason:`Week of ${w.week}: ${w.days} of ${w.target} days` }))] }
    if (target) consistency.formula = `70% × ${pct(cap(qualified / target))} of planned training days (${qualified} of ${target}) + 30% × ${pct(weekDetails.length ? met / weekDetails.length : 0)} of recent weeks that met the plan (${met} of ${weekDetails.length}) = ${pct(consistency.value)}`
    const prior = [1,2,3,4].map(n => shift(week,-n*7)).filter(w => start && shift(w,6) >= start && !away.has(w))
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
    return { week, away:false, score, grade:score === null ? null : grade(score), soFar:week === currentStart, deload:plan?.deload ?? false, components, baseline }
  }
  const all = []
  if (start) for (let w=monday(start);w<currentStart;w=shift(w,7)) all.push(calculate(w))
  // Never grade an unfinished week: the headline is the last completed, scored week.
  const graded = all.filter(w => !w.away && w.score !== null)
  const headline = graded.at(-1) ?? null
  const comparison = headline ? graded.filter(w => w.week < headline.week).slice(-4) : []
  const average = mean(comparison.map(w => w.score))
  const current = headline ?? { week: currentStart, away: false, score: null, grade: null, soFar: false, deload: false, components: [] }
  // Completed weeks after the headline that got no grade, so a report can say why the headline is older.
  const skipped = headline ? all.filter(w => w.week > headline.week).map(w => ({ week: w.week, reason: w.away ? 'away' : 'unscored' })) : []
  return { current, headline, skipped, thisWeek: progressThisWeek(), weeks: all.slice(-12), average,
    change: headline && average !== null ? Math.round(headline.score - average) : null }

  /** The week in progress, as work due so far rather than a grade. */
  function progressThisWeek() {
    const week = calculate(currentStart)
    const todayIndex = between(currentStart, today)
    if (week.away) return { week: currentStart, graded: false, away: true, due: 0, done: 0, ahead: 0, remaining: 0, status: 'away' }
    const slots = week.components.find(c => c.id === 'adherence')?.details ?? []
    let due = 0, done = 0, ahead = 0
    for (const s of slots) {
      if (s.dayIndex < todayIndex) { due += s.prescribed; done += s.completed }
      else if (s.dayIndex === todayIndex) { due += s.completed; done += s.completed }
      else ahead += s.completed
    }
    const sets = week.components.find(c => c.id === 'volume')?.sets ?? 0
    const baseline = week.baseline ?? null
    const expectedSoFar = baseline === null ? null : baseline * (todayIndex + 1) / 7
    const remaining = Math.max(0, due - done)
    return { week: currentStart, graded: false, away: false, due, done, ahead, remaining,
      status: remaining === 0 ? (ahead > 0 ? 'ahead' : 'on track') : 'still to do',
      sets, expectedSets: expectedSoFar === null ? null : rounded(expectedSoFar),
      days: week.components.find(c => c.id === 'consistency')?.days ?? 0 }
  }
}

const AVOIDED = /fail|missed|crushed|streak lost|no excuses|beast mode/i
const gradePhrase = g => g === 'Rebuild week' ? 'a rebuild week' : (g === 'A' ? 'an A' : 'a ' + g)
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const shortDay = date => MONTHS[Number(date.slice(5, 7)) - 1] + ' ' + Number(date.slice(8, 10))

/**
 * Plain-language explanation of the headline week, built only from its component data.
 * @param {ReturnType<typeof trainingScore>} result
 */
export function explainTrainingScore(result) {
  const method = [
    'Progression (35%): your lifts over the last 2 weeks against the 4 weeks before.',
    'Plan adherence (30%): 70% planned sets finished, 30% sets that reached the rep minimum.',
    'Consistency (25%): 70% training days against your plan, 30% recent weeks that met the plan. A training day is 6+ working sets or 30+ minutes.',
    'Volume trend (10%): working sets against your recent average.',
    'Deload and away weeks skip the parts that would count against rest.',
  ]
  const h = result?.headline
  if (!h) return { sentences: ['Your first full week will get a score. Until then, this card shows the work you have logged.'], method }
  const lastWeek = shift(monday(result.thisWeek?.week ?? h.week), -7) === h.week
  const sentences = [`${lastWeek ? 'Last week' : 'The week of ' + shortDay(h.week)} scored ${h.score}, ${gradePhrase(h.grade)}.`]
  const skipped = result.skipped ?? []
  if (skipped.length) {
    const names = skipped.map(w => shortDay(w.week))
    const list = names.length < 2 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names.at(-1)
    const plural = names.length > 1
    const why = skipped.every(w => w.reason === 'away') ? (plural ? 'were marked away' : 'was marked away')
      : skipped.every(w => w.reason !== 'away') ? (plural ? 'had no plan to grade' : 'had no plan to grade') : 'were away or had no plan to grade'
    sentences.push(`${list} ${why}, so ${shortDay(h.week)} is your latest graded week.`)
  }
  if (h.deload) sentences.push('It was a deload week, so progression and volume rested.')
  const scored = h.components.filter(c => c.value !== null)
  // Credit the part that added the most points, not merely the highest percentage.
  const best = [...scored].sort((a, b) => b.value * b.weight - a.value * a.weight)[0]
  const worst = [...scored].sort((a, b) => (1 - b.value) * b.weight - (1 - a.value) * a.weight)[0]
  const phrase = (c, held) => {
    if (c.id === 'progression') {
      const up = c.details.filter(d => d.status === 'up').length
      const slow = c.details.filter(d => d.status !== 'up').map(d => d.reason.split(':')[0]).slice(0, 2)
      return `${up} of ${c.details.length} lifts went up` + (held && slow.length ? `, with ${slow.join(' and ')} holding steady` : '')
    }
    if (c.id === 'adherence') {
      const byDay = new Map()
      for (const d of c.details) byDay.set(d.dayName, (byDay.get(d.dayName) ?? 0) + d.prescribed - d.completed)
      const most = [...byDay].sort((a, b) => b[1] - a[1])[0]
      return `you finished ${c.completed} of ${c.prescribed} planned sets` + (held && most?.[1] > 0 ? `, with the most still to do in ${most[0]}` : '')
    }
    if (c.id === 'consistency') return `${c.days} of ${c.plannedDays} training days` + (held ? `, and ${c.metWeeks} of ${c.trackedWeeks} recent weeks reached the plan` : '')
    return `${c.sets} working sets against a ${rounded(c.average)} average`
  }
  if (best) sentences.push(`${best.label} carried it: ${phrase(best, false)}.`)
  const lost = worst ? (1 - worst.value) * worst.weight : 0
  if (worst && worst !== best && lost >= 0.03) {
    sentences.push(`${worst.label} held it back: ${phrase(worst, true)}.`)
    const step = {
      progression: () => 'Adding a rep or a little load on your steady lifts is the quickest way up.',
      adherence: () => 'Finishing the sets still to do from the plan is the quickest way up.',
      consistency: () => 'One more training day, even a run of micro sets, is the quickest way up.',
      volume: () => `Getting back to about ${Math.round(worst.average)} working sets a week is the quickest way up.`,
    }[worst.id]
    sentences.push(step())
  } else {
    sentences.push('Nothing held it back much. Keep the same rhythm.')
  }
  if (result.weeks.slice(-5).some(w => w.away)) sentences.push('Away weeks are left out of the trend and averages.')
  return { sentences: sentences.filter(t => !AVOIDED.test(t)), method }
}
