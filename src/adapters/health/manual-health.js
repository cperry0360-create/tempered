/**
 * Manual-entry health adapter: the numbers are whatever the user typed.
 *
 * Backed by the same `dayLogs` store the rest of the app reads, so a manually
 * entered step count and a future device-supplied one are indistinguishable to
 * everything downstream.
 *
 * Body metrics are deliberately absent from `HealthSample`. They are stored
 * elsewhere and never travel through a path the XP engine can reach.
 *
 * @param {import('../storage/storage-adapter.js').StorageAdapter} storage
 * @returns {import('./health-adapter.js').HealthAdapter}
 */
export function createManualHealth(storage) {
  return {
    kind: 'manual',

    async isAvailable() {
      return true
    },

    async read(date) {
      const day = await storage.get('dayLogs', date)
      if (!day) return null
      return {
        date,
        steps: day.steps ?? null,
        sleepHours: day.sleepHours ?? null,
        waterOz: day.waterOz ?? null,
        source: 'manual',
      }
    },

    async write(date, sample) {
      const existing = (await storage.get('dayLogs', date)) ?? { date }
      const updated = { ...existing, date }
      if (sample.steps !== undefined) updated.steps = sample.steps
      if (sample.sleepHours !== undefined) updated.sleepHours = sample.sleepHours
      if (sample.waterOz !== undefined) updated.waterOz = sample.waterOz
      await storage.put('dayLogs', updated)
    },
  }
}
