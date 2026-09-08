/**
 * Pulls read-only device health data into the canonical day log.
 *
 * HealthKit is just another adapter boundary. The existing daily settlement
 * remains the only path that awards XP, so importing the same sample repeatedly
 * cannot pay twice and corrections never claw progression back.
 */

export function createHealthSyncService({ storage, health, daily, clock }) {
  let authorizationAttempted = false

  async function ensureAuthorization() {
    if (authorizationAttempted) return true
    if (!(await health.isAvailable())) return false
    if (typeof health.requestAuthorization === 'function') {
      await health.requestAuthorization()
    }
    authorizationAttempted = true
    return true
  }

  async function syncDate(date) {
    if (!(await ensureAuthorization())) return { ok: false, reason: 'unavailable', date }
    const sample = await health.read(date)
    if (!sample) return { ok: true, date, sample: null }

    if (typeof sample.steps === 'number' && Number.isFinite(sample.steps)) {
      await daily.logAt(date, 'steps', sample.steps, { mode: 'replace' })
    }
    if (typeof sample.sleepHours === 'number' && Number.isFinite(sample.sleepHours)) {
      await daily.logAt(date, 'sleep', sample.sleepHours, { mode: 'replace' })
    }

    const day = (await storage.get('dayLogs', date)) ?? { date }
    const healthSources = { ...(day.healthSources ?? {}) }
    if (typeof sample.steps === 'number' && Number.isFinite(sample.steps)) healthSources.steps = 'apple-health'
    if (typeof sample.sleepHours === 'number' && Number.isFinite(sample.sleepHours)) healthSources.sleep = 'apple-health'
    const syncedAt = clock.nowIso()
    await storage.put('dayLogs', {
      ...day,
      healthSources,
      healthSyncedAt: syncedAt,
    })

    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    await storage.put('profile', {
      ...profile,
      healthIntegration: {
        provider: 'apple-health',
        readOnly: true,
        lastSyncedAt: syncedAt,
      },
    })

    return { ok: true, date, sample, syncedAt }
  }

  async function syncToday() {
    return syncDate(clock.today())
  }

  return { syncDate, syncToday }
}
