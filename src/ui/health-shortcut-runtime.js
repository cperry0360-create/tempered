export const HEALTH_SNAPSHOT_PREFIX = 'TEMPERED_HEALTH_V1'
export const DEFAULT_HEALTH_IMPORT_URL = 'https://cperry0360-create.github.io/tempered/'

export const HEALTH_SHORTCUT_RECIPE = `TEMPERED HEALTH — iPhone Shortcut recipe

Goal: read Apple Health on-device and hand a tiny snapshot to Tempered. No developer account, Mac, server, or AI provider is required.

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

PREFERRED ONE-TAP FINISH
6. Add “URL Encode” and give it the Text action above.
7. Add a Text action containing this URL, with the URL-encoded result inserted after the equals sign:
https://cperry0360-create.github.io/tempered/?temperedHealth=<URL-encoded Text>
8. Add “Open URLs” using that URL.
9. Run the shortcut. Tempered will detect the temperedHealth parameter, import it, and immediately remove the health values from the address bar.

Whether iOS opens that HTTPS link inside the installed Home Screen Tempered or in Safari varies by web-app handoff behavior. If it opens your installed Tempered, normal use is one shortcut tap. If iOS opens Safari instead, use the guaranteed fallback below so your existing Home Screen app remains the data owner.

GUARANTEED FALLBACK
6. Add “Copy to Clipboard” using the original Text action.
7. Open your Home Screen Tempered.
8. Tap IMPORT HEALTH on Today. Tempered reads the snapshot locally and does not double-count replacement metrics on later syncs.

Optional automation: personal automations can run this shortcut from triggers such as App, Time of Day, Sleep, and Apple Watch Workout. If an App automation can target your installed Tempered on your iPhone, try running Tempered Health when Tempered opens; otherwise keep Tempered Health as a Home Screen shortcut.`

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
    // Health tags include SPO2, so digits are intentionally valid in names.
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
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

/** Build the exact handoff URL the Shortcut's URL Encode + Open URLs path creates. */
export function healthImportUrl(snapshot, base = DEFAULT_HEALTH_IMPORT_URL) {
  const raw = String(snapshot ?? '').trim()
  if (!parseHealthSnapshot(raw)) throw new Error('No Tempered Health snapshot found')
  const url = new URL(base)
  url.searchParams.set('temperedHealth', raw)
  return url.toString()
}

export async function importHealthSnapshot(context, snapshot) {
  if (!context?.daily || !context?.storage || !context?.clock) throw new Error('Tempered is not ready')
  const parsed = typeof snapshot === 'string' ? parseHealthSnapshot(snapshot) : snapshot
  if (!parsed) throw new Error('No Tempered Health snapshot found')
  const date = parsed.date && parsed.date <= context.clock.today() ? parsed.date : context.clock.today()

  // All three are replace-mode trackers. Re-running the Shortcut updates the
  // same day's canonical value; it never adds yesterday's or an earlier sync's
  // steps/sleep/weight a second time.
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

  function openImportSheet(button, initialText = '') {
    document.querySelector('[data-health-import-overlay]')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'health-import-overlay'
    overlay.dataset.healthImportOverlay = 'true'

    const sheet = document.createElement('section')
    sheet.className = 'health-import-sheet'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-labelledby', 'health-import-title')
    sheet.setAttribute('aria-describedby', 'health-import-copy')

    const eyebrow = document.createElement('span')
    eyebrow.className = 'health-import-sheet__eyebrow'
    eyebrow.textContent = 'APPLE HEALTH'
    const title = document.createElement('h2')
    title.id = 'health-import-title'
    title.className = 'health-import-sheet__title'
    title.textContent = 'PASTE HEALTH SNAPSHOT'
    const copy = document.createElement('p')
    copy.id = 'health-import-copy'
    copy.className = 'health-import-sheet__copy'
    copy.textContent = 'Run the Tempered Health Shortcut, then touch and hold in the box and tap Paste.'

    const input = document.createElement('textarea')
    input.className = 'health-import-sheet__input'
    input.dataset.healthImportInput = 'true'
    input.value = parseHealthSnapshot(initialText) ? initialText : ''
    input.placeholder = `${HEALTH_SNAPSHOT_PREFIX}\nDATE=2026-09-08\nSTEPS=10527\nSLEEP=7.75`
    input.rows = 8
    input.autocapitalize = 'off'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', 'Tempered Health snapshot')

    const status = document.createElement('p')
    status.className = 'health-import-sheet__status'
    status.dataset.healthImportStatus = 'true'
    status.setAttribute('role', 'status')
    status.textContent = 'Your Health data stays on this device.'

    const actions = document.createElement('div')
    actions.className = 'health-import-sheet__actions'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'button health-import-sheet__cancel'
    cancel.dataset.healthImportCancel = 'true'
    cancel.textContent = 'CANCEL'
    const submit = document.createElement('button')
    submit.type = 'button'
    submit.className = 'button health-import-sheet__submit'
    submit.dataset.healthImportSubmit = 'true'
    submit.textContent = 'IMPORT'
    actions.append(cancel, submit)
    sheet.append(eyebrow, title, copy, input, status, actions)
    overlay.append(sheet)

    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      document.removeEventListener('keydown', onKeyDown)
      overlay.remove()
      if (button?.isConnected) button.focus()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }
    cancel.onclick = close
    overlay.onclick = (event) => { if (event.target === overlay) close() }
    submit.onclick = async () => {
      submit.disabled = true
      status.textContent = 'Importing…'
      try {
        await importHealthSnapshot(context, input.value)
      } catch {
        status.textContent = `Paste text beginning with ${HEALTH_SNAPSHOT_PREFIX}, then try again.`
        submit.disabled = false
        input.focus()
        return
      }
      close()
      await context.app?.show('today')
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.append(overlay)
    requestAnimationFrame(() => input.focus())
    return { overlay, input, status, submit, close }
  }

  async function importClipboard(button) {
    // Installed iPhone web apps can leave navigator.clipboard.readText()
    // pending instead of rejecting it. Mount the manual paste path first so
    // tapping IMPORT HEALTH always has an immediate, visible result.
    const sheet = openImportSheet(button)
    try {
      if (!navigator.clipboard?.readText) throw new Error('clipboard')
      const text = await navigator.clipboard.readText()
      if (!sheet.overlay.isConnected) return
      if (!parseHealthSnapshot(text)) throw new Error('snapshot')
      sheet.input.value = text
      sheet.submit.disabled = true
      sheet.status.textContent = 'Snapshot found. Importing…'
      const result = await importHealthSnapshot(context, text)
      sheet.close()
      button.textContent = `SYNCED ${result.date}`
      button.dataset.state = 'success'
    } catch {
      if (sheet.overlay.isConnected) {
        sheet.status.textContent = `Touch and hold in the box, tap Paste, then tap IMPORT.`
      }
      return
    }
    await context.app?.show('today')
  }

  function makeImportButton(className = 'health-bridge__import') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.dataset.healthBridge = 'import'
    button.textContent = 'IMPORT HEALTH'
    button.setAttribute('aria-label', 'Import Apple Health snapshot')
    button.onclick = () => importClipboard(button)
    return button
  }

  function enhanceToday() {
    const screen = mount.querySelector('.screen--today')
    if (screen?.dataset?.date && screen.dataset.date !== context.clock.today()) return
    const snapshot = screen?.querySelector('[data-lifestyle="snapshot"]')
    if (!snapshot || snapshot.querySelector('[data-health-bridge="import"]')) return
    const row = document.createElement('div')
    row.className = 'health-bridge__today'
    row.append(
      makeImportButton(),
      Object.assign(document.createElement('span'), { textContent: 'Apple Health · Shortcut sync' }),
    )
    snapshot.append(row)
  }

  function enhanceSettings() {
    const screen = mount.querySelector('.screen--settings')
    if (!screen || screen.querySelector('[data-health-bridge="settings"]')) return
    const section = document.createElement('section')
    section.className = 'card health-bridge__settings'
    section.dataset.healthBridge = 'settings'
    section.innerHTML = '<h2 class="block__title">Apple Health Shortcut</h2><p class="block__hint">No Mac or developer account required. Health stays on your iPhone. The preferred recipe passes the snapshot into Tempered by URL for a possible one-tap handoff; clipboard + IMPORT HEALTH remains the reliable fallback.</p><p class="block__hint"><strong>Best case:</strong> tap Tempered Health and iOS opens the installed Tempered with the data already imported. <strong>Fallback:</strong> the Shortcut copies the snapshot, then you tap IMPORT HEALTH here or on Today.</p>'
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
    // URLSearchParams.get() already percent-decodes the value. Do NOT run
    // decodeURIComponent again: a legitimate value such as SPO2=97% would then
    // contain a bare percent sign and could throw URIError.
    const snapshot = url.searchParams.get('temperedHealth')
    if (!snapshot) return false
    try {
      await importHealthSnapshot(context, snapshot)
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
  const screenShown = (event) => {
    if (event?.detail?.tab === 'today' || event?.detail?.tab === 'settings') schedule()
  }
  const todayRendered = () => schedule()
  const lifestyleReady = (event) => {
    if (!event?.detail?.date || event.detail.date === context.clock.today()) schedule()
  }
  window.addEventListener('tempered:screen-shown', screenShown)
  window.addEventListener('tempered:today-rendered', todayRendered)
  window.addEventListener('tempered:lifestyle-ready', lifestyleReady)
  schedule()
  return () => {
    window.removeEventListener('tempered:screen-shown', screenShown)
    window.removeEventListener('tempered:today-rendered', todayRendered)
    window.removeEventListener('tempered:lifestyle-ready', lifestyleReady)
    document.querySelector('[data-health-import-overlay]')?.remove()
  }
}
