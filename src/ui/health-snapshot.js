/** Shared parser and importer for Tempered's local Health snapshot contract. */

export const HEALTH_SNAPSHOT_PREFIX = 'TEMPERED_HEALTH_V1'
export const MAX_HEALTH_SLEEP_HOURS = 16

const TAGS = {
  DATE: 'date', STEPS: 'steps', SLEEP: 'sleepHours', WEIGHT_LB: 'weightLb', WEIGHT_KG: 'weightKg',
  RESTING_HR: 'restingHr', HRV_MS: 'hrvMs', RESP_RATE: 'respiratoryRate',
  SPO2: 'spo2', BODY_TEMP_C: 'bodyTempC', BODY_TEMP_F: 'bodyTempF',
}

export function healthNumberValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const cleaned = String(raw).replace(/,/g, '').trim()
  const match = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number(match[0])
  return Number.isFinite(value) ? value : null
}

export function parseHealthSnapshot(text) {
  const raw = String(text ?? '').trim()
  // iOS/ChatGPT can collapse the intended nine lines into spaces.
  // Match field boundaries rather than assuming a newline between keys.
  if (!raw.startsWith(HEALTH_SNAPSHOT_PREFIX)
    || !/^\s*$/.test(raw.slice(HEALTH_SNAPSHOT_PREFIX.length, HEALTH_SNAPSHOT_PREFIX.length + 1))) return null
  const body = raw.slice(HEALTH_SNAPSHOT_PREFIX.length).trim()
  const boundaries = [...body.matchAll(/(?:^|\s)([A-Z][A-Z0-9_]*)\s*=/g)]
  const result = {}
  for (const [index, match] of boundaries.entries()) {
    const tag = match[1]
    const key = TAGS[tag]
    if (!key) continue
    const start = match.index + match[0].length
    const end = boundaries[index + 1]?.index ?? body.length
    const value = body.slice(start, end).trim()
    if (tag === 'DATE') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) result.date = value
      continue
    }
    // Blank fields never absorb the numeric value of the following key.
    const parsed = /^-?\d/.test(value) ? healthNumberValue(value) : null
    if (parsed !== null) result[key] = parsed
  }
  const meaningful = Object.keys(result).some((key) => key !== 'date')
  return meaningful ? result : null
}

/** A launch import must not silently replay an old copy left on the pasteboard. */
export function launchHealthSnapshot(text, today) {
  const parsed = parseHealthSnapshot(text)
  return parsed?.date === today ? parsed : null
}

export async function importHealthSnapshot(context, snapshot, { source = 'shortcuts' } = {}) {
  if (!context?.daily || !context?.storage || !context?.clock) throw new Error('Tempered is not ready')
  const parsed = typeof snapshot === 'string' ? parseHealthSnapshot(snapshot) : snapshot
  if (!parsed) throw new Error('No Tempered Health snapshot found')
  const date = parsed.date && parsed.date <= context.clock.today() ? parsed.date : context.clock.today()
  const normalized = {
    ...parsed,
    ...(Number.isFinite(parsed.weightLb) ? {} : (Number.isFinite(parsed.weightKg) ? { weightLb: parsed.weightKg * 2.2046226218 } : {})),
    ...(Number.isFinite(parsed.bodyTempC) ? {} : (Number.isFinite(parsed.bodyTempF) ? { bodyTempC: (parsed.bodyTempF - 32) * (5 / 9) } : {})),
    ...(Number.isFinite(parsed.spo2) && parsed.spo2 > 0 && parsed.spo2 <= 1 ? { spo2: parsed.spo2 * 100 } : {}),
  }
  const warnings = []
  const validSleep = Number.isFinite(normalized.sleepHours)
    && normalized.sleepHours > 0 && normalized.sleepHours <= MAX_HEALTH_SLEEP_HOURS
  if (Number.isFinite(normalized.sleepHours) && !validSleep) {
    warnings.push(`Sleep was skipped because the imported value of ${normalized.sleepHours} hours is outside the supported range.`)
  }

  // These are replace-mode trackers. Re-importing updates the canonical value
  // for that date and never adds the same Health total a second time.
  if (Number.isFinite(normalized.steps) && normalized.steps >= 0) {
    await context.daily.logAt(date, 'steps', Math.round(normalized.steps))
  }
  if (validSleep) {
    await context.daily.logAt(date, 'sleep', Math.round(normalized.sleepHours * 100) / 100)
  }
  if (Number.isFinite(normalized.weightLb) && normalized.weightLb > 0) {
    await context.daily.logAt(date, 'body_metrics', Math.round(normalized.weightLb * 10) / 10)
  }

  const current = await context.daily.dayLog(date)
  const healthMetrics = { ...(current.healthMetrics ?? {}) }
  for (const key of ['restingHr', 'hrvMs', 'respiratoryRate', 'spo2', 'bodyTempC']) {
    if (Number.isFinite(normalized[key])) healthMetrics[key] = Math.round(normalized[key] * 100) / 100
  }
  const next = {
    ...current,
    ...(!validSleep && Number(current.sleepHours) > MAX_HEALTH_SLEEP_HOURS ? { sleepHours: null } : {}),
    ...(Object.keys(healthMetrics).length ? { healthMetrics } : {}),
    healthBridge: { source, importedAt: context.clock.nowIso(), ...(warnings.length ? { warnings } : {}) },
  }
  await context.storage.put('dayLogs', next)
  return { date, ...normalized, warnings }
}
