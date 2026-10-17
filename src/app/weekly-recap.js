import { weeklyRecap } from '../domain/weekly-recap.js'

export function createWeeklyRecapService({ storage, clock }) {
  async function report() {
    const [profile, sessions, setLogs, dayLogs, programs, programStates, revisions, exercises] = await Promise.all([
      storage.get('profile', 'profile'), ...['sessions', 'setLogs', 'dayLogs', 'programs', 'programState', 'programRevisions', 'exercises'].map(store => storage.getAll(store)),
    ])
    const created = profile?.createdAt ? new Date(profile.createdAt) : null
    const report = weeklyRecap({
      today: clock.today(), sessions, setLogs, dayLogs, programs, programStates, revisions, exercises: new Map(exercises.map(exercise => [exercise.id, exercise])),
      awayPeriods: profile?.awayPeriods ?? [], lastSeenWeek: profile?.weeklyRecapLastSeenWeek ?? null,
      trackingStartedOn: created && Number.isFinite(created.getTime()) ? clock.toLocalDate(created) : null,
    })
    // Body measurements are display-only, kept outside every scoring domain.
    const weights = dayLogs.filter(day => day.date >= report.start && day.date <= report.end && Number.isFinite(day.bodyMetrics?.weight) && day.bodyMetrics.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date)).map(day => ({ date: day.date, value: day.bodyMetrics.weight }))
    report.weight = weights.length ? { first: weights[0], last: weights.at(-1), days: weights.length, change: weights.length >= 2 ? Math.round((weights.at(-1).value - weights[0].value) * 10) / 10 : null } : null
    return report
  }
  async function acknowledge(week) {
    const profile = await storage.get('profile', 'profile')
    if (!profile || (profile.weeklyRecapLastSeenWeek && profile.weeklyRecapLastSeenWeek >= week)) return
    await storage.put('profile', { ...profile, weeklyRecapLastSeenWeek: week })
  }
  return { report, acknowledge }
}
