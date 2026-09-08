export const HEALTH_SNAPSHOT_PREFIX = 'TEMPERED_HEALTH_V1'

export const HEALTH_SHORTCUT_RECIPE = `TEMPERED HEALTH — iPhone Shortcut recipe

Goal: read Apple Health on-device, copy one small text snapshot, then import it into Tempered. No developer account, Mac, server, or AI provider is required.

1. In Shortcuts, create a shortcut named “Tempered Health”.
2. Add “Find Health Samples” for Steps, filtered to today. Sum the sample values.
3. Add “Find Health Samples” for Sleep, filtered to the most recent overnight sleep. Sum the durations of asleep samples and convert seconds/minutes to decimal hours.
4. Optional: fetch the latest Weight, Resting Heart Rate, Heart Rate Variability, Respiratory Rate, Oxygen Saturation, and Body Temperature samples.
5. Add a Text action with this exact shape, replacing each value with the Shortcut variables. Leave a line blank if you are not collecting that metric:

TEMPERED_HEALTH_V1
DATE=<yyyy-mm-dd>
STEPS=<whole-number steps>
SLEEP=<decimal hours, e.g. 7.75>
WEIGHT_LB=<weight in pounds>
RESTING_HR=<bpm>
HRV_MS=<milliseconds>
RESP_RATE=<breaths per minute>
SPO2=<percent, e.g. 97>
BODY_TEMP_C=<degrees C>

6. Add “Copy to Clipboard” using that Text action.
7. Optional: add “Open App” and choose Tempered if iOS offers the installed Home Screen app. If it does not, simply end the Shortcut after Copy to Clipboard.
8. In Tempered tap IMPORT HEALTH. That is the normal sync gesture.

Optional automation: Shortcuts personal automations can run without asking for several triggers, including App, Time of Day, Sleep, and Apple Watch Workout. If Tempered appears as an App trigger on your iPhone, you can run this shortcut automatically when Tempered opens; otherwise keep the one-tap shortcut on the Home Screen.`

const TAGS = {
  DATE: 'date', STEPS: 'steps', SLEEP: 'sleepHours', WEIGHT_LB: 'weightLb',
  RESTING_HR: 'restingHr', HRV_MS: 'hrvMs', RESP_RATE: 'respiratoryRate',
  SPO2: 'spo2', BODY_TEMP_C: 'bodyTempC',
}

function numberValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const cleaned = String(raw).replace(/,/g, '').replace(/%/g, '').trim()
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

export function parseHealthSnapshot(text) {
  const raw = String(text ?? '').trim()
  if (!raw.includes(HEALTH_SNAPSHOT_PREFIX)) return null
  const result = {}
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (!match) continue
    const [, tag, value] = match
    const key = TAGS[tag]
    if (!key) continue
    if (tag === 'DATE') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) result.date = value
      continue
    }
    const parsed = numberValue(value)
    if (parsed !== null) result[key] = parsed
  }
  const meaningful = Object.keys(result).some((key) => key !== 'date')
  return meaningful ? result : null
}

export async function importHealthSnapshot(context, snapshot) {
  if (!context?.daily || !context?.storage || !context?.clock) throw new Error('Tempered is not ready')
  const parsed = typeof snapshot === 'string' ? parseHealthSnapshot(snapshot) : snapshot
  if (!parsed) throw new Error('No Tempered Health snapshot found')
  const date = parsed.date && parsed.date <= context.clock.today() ? parsed.date : context.clock.today()

  if (Number.isFinite(parsed.steps) && parsed.steps >= 0) {
    await context.daily.logAt(date, 'steps', Math.round(parsed.steps))
  }
  if (Number.isFinite(parsed.sleepHours) && parsed.sleepHours > 0 && parsed.sleepHours < 24) {
    await context.daily.logAt(date, 'sleep', Math.round(parsed.sleepHours * 100) / 100)
  }
  if (Number.isFinite(parsed.weightLb) && parsed.weightLb > 0) {
    await context.daily.logAt(date, 'body_metrics', Math.round(parsed.weightLb * 10) / 10)
  }

  const current = await context.daily.dayLog(date)
  const healthMetrics = { ...(current.healthMetrics ?? {}) }
  for (const key of ['restingHr', 'hrvMs', 'respiratoryRate', 'spo2', 'bodyTempC']) {
    if (Number.isFinite(parsed[key])) healthMetrics[key] = parsed[key]
  }
  const next = {
    ...current,
    ...(Object.keys(healthMetrics).length ? { healthMetrics } : {}),
    healthBridge: { source: 'shortcuts', importedAt: context.clock.nowIso() },
  }
  await context.storage.put('dayLogs', next)
  return { date, ...parsed }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const node = document.createElement('textarea')
    node.value = text
    node.setAttribute('readonly', '')
    node.style.position = 'fixed'
    node.style.opacity = '0'
    document.body.append(node)
    node.select()
    const ok = document.execCommand?.('copy') === true
    node.remove()
    return ok
  }
}

export function installHealthShortcutRuntime(context) {
  const mount = document.getElementById('app')
  if (!mount) return () => {}
  let scheduled = false

  async function importClipboard(button) {
    const prior = button.textContent
    try {
      if (!navigator.clipboard?.readText) throw new Error('clipboard')
      const text = await navigator.clipboard.readText()
      const result = await importHealthSnapshot(context, text)
      button.textContent = `SYNCED ${result.date}`
      button.dataset.state = 'success'
      await context.app?.show('today')
    } catch {
      button.textContent = 'COPY SNAPSHOT, THEN TAP HERE'
      button.dataset.state = 'error'
    }
    window.setTimeout(() => {
      if (!button.isConnected) return
      button.textContent = prior
      delete button.dataset.state
    }, 2200)
  }

  function makeImportButton(className = 'health-bridge__import') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.dataset.healthBridge = 'import'
    button.textContent = 'IMPORT HEALTH'
    button.setAttribute('aria-label', 'Import Apple Health snapshot from the clipboard')
    button.onclick = () => importClipboard(button)
    return button
  }

  function enhanceToday() {
    const snapshot = mount.querySelector('.screen--today [data-lifestyle="snapshot"]')
    if (!snapshot || snapshot.querySelector('[data-health-bridge="import"]')) return
    const row = document.createElement('div')
    row.className = 'health-bridge__today'
    row.append(
      makeImportButton(),
      Object.assign(document.createElement('span'), { textContent: 'Apple Health via iPhone Shortcut' }),
    )
    snapshot.append(row)
  }

  function enhanceSettings() {
    const screen = mount.querySelector('.screen--settings')
    if (!screen || screen.querySelector('[data-health-bridge="settings"]')) return
    const section = document.createElement('section')
    section.className = 'card health-bridge__settings'
    section.dataset.healthBridge = 'settings'
    section.innerHTML = '<h2 class="block__title">Apple Health Shortcut</h2><p class="block__hint">Light-touch sync for the Home Screen app. Health stays on your iPhone; the shortcut copies a tiny snapshot and Tempered imports it locally.</p><p class="block__hint"><strong>Normal use:</strong> run Tempered Health → tap IMPORT HEALTH. If iOS lets your shortcut open Tempered, that becomes one shortcut tap plus the import tap.</p>'
    const actions = document.createElement('div')
    actions.className = 'health-bridge__actions'
    const recipe = document.createElement('button')
    recipe.type = 'button'
    recipe.className = 'button'
    recipe.dataset.healthBridge = 'recipe'
    recipe.textContent = 'COPY SHORTCUT RECIPE'
    recipe.onclick = async () => {
      const ok = await copyText(HEALTH_SHORTCUT_RECIPE)
      recipe.textContent = ok ? 'RECIPE COPIED' : 'COPY FAILED'
      window.setTimeout(() => { if (recipe.isConnected) recipe.textContent = 'COPY SHORTCUT RECIPE' }, 1800)
    }
    actions.append(recipe, makeImportButton('button health-bridge__import'))
    section.append(actions)
    const targets = screen.querySelector('[data-section="targets"]')
    ;(targets ?? screen.querySelector('.card'))?.after(section)
  }

  async function importQuerySnapshot() {
    const url = new URL(window.location.href)
    const encoded = url.searchParams.get('temperedHealth')
    if (!encoded) return false
    try {
      await importHealthSnapshot(context, decodeURIComponent(encoded))
    } catch {
      url.searchParams.delete('temperedHealth')
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      return false
    }
    url.searchParams.delete('temperedHealth')
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    return true
  }

  const enhance = () => {
    scheduled = false
    enhanceToday()
    enhanceSettings()
  }
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(enhance)
  }

  importQuerySnapshot().then((imported) => {
    if (imported) context.app?.show('today')
  }).catch(() => {})
  const observer = new MutationObserver(schedule)
  observer.observe(mount, { childList: true, subtree: true })
  schedule()
  return () => observer.disconnect()
}
