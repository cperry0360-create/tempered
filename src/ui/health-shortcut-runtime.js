export const HEALTH_SNAPSHOT_PREFIX = 'TEMPERED_HEALTH_V1'
export const DEFAULT_HEALTH_IMPORT_URL = 'https://cperry0360-create.github.io/tempered/'
export const HEALTH_SHORTCUT_NAME = 'Tempered Health'
export const HEALTH_SHORTCUT_RUN_URL = 'shortcuts://run-shortcut?name=Tempered%20Health'
export const HEALTH_SHORTCUT_EDIT_URL = 'shortcuts://open-shortcut?name=Tempered%20Health'
export const MAX_SHORTCUT_SLEEP_HOURS = 16
export const LAUNCH_MOTIVATIONS = [
  ['SHOW UP STRONG.', 'The first rep is showing up.'],
  ['BUILD WHAT LASTS.', 'Small effort. Real momentum.'],
  ['MAKE TODAY COUNT.', 'Your next move is the one that matters.'],
  ['KEEP FORGING.', 'Progress is built one day at a time.'],
]

export const HEALTH_SHORTCUT_RECIPE = `TEMPERED HEALTH — iPhone Shortcut recipe

This Shortcut reads Apple Health on-device and copies a snapshot for Tempered. No Mac, developer account, server, or AI provider is required.

IMPORTANT FIX FOR “CONVERSION ERROR”
Never send Find Health Samples directly into Calculate Statistics. Health samples are objects, not numbers. Insert Get Details of Health Samples first and choose Value (or Duration for sleep). Calculate Statistics must receive that numeric Details result, never a Text action.

1. Create a shortcut named “Tempered Health”.

2. STEPS
• Find Health Samples where Type is Steps and Start Date is today.
• Get Details of Health Samples and choose Value.
• Calculate Statistics: Sum. Its input must be the Value output from Get Details. Rename the result Steps Total.

3. SLEEP
• Find Health Samples where Type is Sleep and Start Date is between 6 PM yesterday and noon today.
• Use one source (normally Apple Watch) so the same night is not counted again from another device.
• Include Asleep Core, Asleep Deep, and Asleep REM. Exclude In Bed, Awake, and overlapping Asleep Unspecified summaries.
• Get Details of Health Samples and choose Duration.
• Calculate Statistics: Sum using those Duration values. Convert the result to decimal hours if needed. Rename it Sleep Hours.

4. LATEST BODY DATA
For each type below, Find Health Samples sorted newest first with Limit 1, then Get Details of Health Samples → Value. Do not use Calculate Statistics for these latest-value metrics.
• Weight: convert the Value to pounds.
• Resting Heart Rate: keep the numeric bpm value.
• Heart Rate Variability: keep the numeric milliseconds value.
• Respiratory Rate: keep the numeric breaths/minute value.
• Oxygen Saturation: use percent, such as 97 or 97%.
• Body Temperature: use degrees C or use the BODY_TEMP_F line below for Fahrenheit.

5. Add Current Date, then Format Date with custom format yyyy-MM-dd.

6. Add one Text action with this exact shape. Insert the named Shortcut variables after each equals sign. A line may be blank only when Apple Health truly has no sample:

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

For Fahrenheit, replace the last line with BODY_TEMP_F=<degrees F>.

7. FINISH FOR THE HOME SCREEN WEB APP
• Add Copy to Clipboard using the completed Text action.
• Run the Shortcut, return to the installed Tempered icon, and tap Import Copy. That one tap reads and saves the snapshot immediately.
• Do not use Open URLs: iOS opens an HTTPS URL in Safari, whose local Tempered data is separate from the installed Home Screen copy.

AUTOMATIC OPTION
The native Tempered iOS build reads HealthKit directly on launch and when returning to the foreground. It does not need this Shortcut. iOS does not let a Home Screen web app read HealthKit or register a private return URL.

AUTOMATED COPY (ONE READY TAP IS STILL REQUIRED)
In Shortcuts → Automation, a Time of Day, Sleep, or Apple Watch Workout trigger can run Tempered Health and copy its snapshot. An App Opened trigger may not list the installed Home Screen web app. When you launch the installed Tempered icon, tap Yes, I'm Ready on the launch card to read and import a copy dated today. iOS may also ask you to allow Paste. If no automation ran, use Run Health Shortcut on that card, then return and tap Yes, I'm Ready. The Home Screen web app cannot itself launch the Shortcut or silently paste on launch. For automatic Health import on launch, use the native Tempered iOS build with HealthKit instead.`

const TAGS = {
  DATE: 'date', STEPS: 'steps', SLEEP: 'sleepHours', WEIGHT_LB: 'weightLb', WEIGHT_KG: 'weightKg',
  RESTING_HR: 'restingHr', HRV_MS: 'hrvMs', RESP_RATE: 'respiratoryRate',
  SPO2: 'spo2', BODY_TEMP_C: 'bodyTempC', BODY_TEMP_F: 'bodyTempF',
}

function numberValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const cleaned = String(raw).replace(/,/g, '').trim()
  const match = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number(match[0])
  return Number.isFinite(value) ? value : null
}

export function parseHealthSnapshot(text) {
  const raw = String(text ?? '').trim()
  // A copied setup recipe contains the marker and example values, but is not
  // a Health export. Only a snapshot whose first line is the exact marker can
  // be imported; never turn instructions or unrelated clipboard text into data.
  if (raw.split(/\r?\n/, 1)[0] !== HEALTH_SNAPSHOT_PREFIX) return null
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
    const parsed = /^-?\d/.test(value) ? numberValue(value) : null
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
  const normalized = {
    ...parsed,
    ...(Number.isFinite(parsed.weightLb) ? {} : (Number.isFinite(parsed.weightKg) ? { weightLb: parsed.weightKg * 2.2046226218 } : {})),
    ...(Number.isFinite(parsed.bodyTempC) ? {} : (Number.isFinite(parsed.bodyTempF) ? { bodyTempC: (parsed.bodyTempF - 32) * (5 / 9) } : {})),
    ...(Number.isFinite(parsed.spo2) && parsed.spo2 > 0 && parsed.spo2 <= 1 ? { spo2: parsed.spo2 * 100 } : {}),
  }
  const warnings = []
  const validSleep = Number.isFinite(normalized.sleepHours)
    && normalized.sleepHours > 0 && normalized.sleepHours <= MAX_SHORTCUT_SLEEP_HOURS
  if (Number.isFinite(normalized.sleepHours) && !validSleep) {
    warnings.push(`Sleep was skipped because the Shortcut returned ${normalized.sleepHours} hours. Use one Health source and exclude overlapping summary samples.`)
  }

  // All three are replace-mode trackers. Re-running the Shortcut updates the
  // same day's canonical value; it never adds yesterday's or an earlier sync's
  // steps/sleep/weight a second time.
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
    ...(!validSleep && Number(current.sleepHours) > MAX_SHORTCUT_SLEEP_HOURS ? { sleepHours: null } : {}),
    ...(Object.keys(healthMetrics).length ? { healthMetrics } : {}),
    healthBridge: { source: 'shortcuts', importedAt: context.clock.nowIso(), ...(warnings.length ? { warnings } : {}) },
  }
  await context.storage.put('dayLogs', next)
  return { date, ...normalized, warnings }
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

export function installHealthShortcutRuntime(context, { showLaunchGate = null } = {}) {
  const mount = document.getElementById('app')
  if (!mount) return () => {}
  let scheduled = false
  let activeOverlay = null
  let launchOverlay = null

  function announceImport(result) {
    window.dispatchEvent(new CustomEvent('tempered:health-imported', { detail: result }))
  }

  function importMessage(result) {
    return result.warnings?.length
      ? `Health imported for ${result.date}. ${result.warnings.join(' ')}`
      : `Health data imported for ${result.date}.`
  }

  async function importClipboard() {
    if (!navigator.clipboard?.readText) throw new Error('Clipboard access is unavailable')
    const result = await importHealthSnapshot(context, await navigator.clipboard.readText())
    announceImport(result)
    return result
  }

  function openLaunchGate() {
    if (launchOverlay || !context.app || context.healthSync) return
    const [headline, line] = LAUNCH_MOTIVATIONS[Math.floor(Math.random() * LAUNCH_MOTIVATIONS.length)]
    const overlay = document.createElement('div')
    overlay.className = 'health-launch'
    overlay.dataset.healthLaunch = 'true'
    overlay.innerHTML = `
      <section class="health-launch__scene" role="dialog" aria-modal="true" aria-labelledby="health-launch-title">
        <div class="health-launch__brand">TEMPERED <span>· TODAY STARTS HERE</span></div>
        <div class="health-launch__center">
          <div class="health-launch__symbol" aria-hidden="true">✦</div>
          <p class="health-launch__eyebrow">A NEW DAY TO GET BETTER</p>
          <h2 id="health-launch-title">${headline}</h2>
          <p class="health-launch__line">${line}</p>
        </div>
        <div class="health-launch__bottom">
          <p class="health-launch__hint">If your Health Shortcut has copied today's data, your next tap brings it in.</p>
          <p class="health-launch__status" role="status" data-health-launch-status></p>
          <button type="button" class="health-launch__ready" data-health-launch-ready>YES, I'M READY <span aria-hidden="true">↗</span></button>
          <div class="health-launch__options">
            <a href="${HEALTH_SHORTCUT_RUN_URL}" data-health-launch-run>RUN HEALTH SHORTCUT</a>
            <a href="${HEALTH_SHORTCUT_EDIT_URL}" data-health-launch-edit>FIX SHORTCUT</a>
            <button type="button" data-health-launch-skip>CONTINUE WITHOUT SYNC</button>
          </div>
        </div>
      </section>`
    const priorFocus = document.activeElement
    const close = () => {
      overlay.remove()
      launchOverlay = null
      document.removeEventListener('keydown', onKeyDown)
      if (priorFocus?.isConnected && priorFocus !== document.body) priorFocus.focus()
    }
    const onKeyDown = (event) => { if (event.key === 'Escape') close() }
    const ready = overlay.querySelector('[data-health-launch-ready]')
    const status = overlay.querySelector('[data-health-launch-status]')
    ready.onclick = async () => {
      ready.disabled = true
      ready.textContent = 'GETTING READY…'
      // Begin the clipboard request inside this click handler. Do not await a
      // storage read or an animation first; WebKit requires a user gesture.
      try {
        const clipboardRead = navigator.clipboard?.readText?.()
        if (!clipboardRead) throw new Error('Clipboard unavailable')
        const snapshot = launchHealthSnapshot(await clipboardRead, context.clock.today())
        if (!snapshot) {
          status.textContent = 'No Health copy for today. Run the Shortcut, then tap again, or continue.'
          ready.textContent = 'TRY HEALTH COPY AGAIN'
          return
        }
        const result = await importHealthSnapshot(context, snapshot)
        announceImport(result)
        status.textContent = result.warnings?.length ? 'Health imported. Check the sleep note in Today.' : 'Health imported. Let’s go.'
        await context.app?.show('today')
        close()
      } catch {
        status.textContent = 'Could not read the copy. If iOS asks to Paste, allow it, then try again.'
        ready.textContent = 'TRY HEALTH COPY AGAIN'
      } finally {
        ready.disabled = false
      }
    }
    overlay.querySelector('[data-health-launch-skip]').onclick = close
    document.addEventListener('keydown', onKeyDown)
    document.body.append(overlay)
    launchOverlay = overlay
    ready.focus()
  }

  function openHealthSetup(trigger = null) {
    activeOverlay?.remove()
    document.querySelector('[data-health-setup-overlay]')?.remove()
    const overlay = document.createElement('div')
    overlay.className = 'health-setup-overlay'
    overlay.dataset.healthSetupOverlay = 'true'
    overlay.dataset.healthImportOverlay = 'true'
    overlay.innerHTML = `
      <section class="health-setup-screen" role="dialog" aria-modal="true" aria-labelledby="health-setup-title">
        <header class="health-setup-header">
          <button type="button" class="health-setup-header__back" data-health-setup-close aria-label="Close Health Setup">‹</button>
          <div><span>APPLE HEALTH</span><h2 id="health-setup-title">Health Setup</h2></div>
        </header>

        <section class="health-setup-hero">
          <span class="health-setup-hero__eyebrow">HOME SCREEN WEB APP · TWO STEPS</span>
          <h3>Run the Shortcut, then import its copy.</h3>
          <p>Return to this installed Tempered icon after the Shortcut copies its snapshot. Import Copy reads and saves it immediately—no text box or confirmation.</p>
          <p>A Shortcut automation can prepare the copy. The installed web app opens with a Ready card; its button imports today's copy in one tap. iOS may still ask you to allow Paste. The app cannot run the Shortcut or paste by itself on launch.</p>
          <div class="health-setup__actions">
            <a class="button health-setup__primary" data-health-bridge="run" href="${HEALTH_SHORTCUT_RUN_URL}">1 · RUN SHORTCUT</a>
            <button type="button" class="button health-setup__primary" data-health-clipboard-import>2 · IMPORT COPY</button>
          </div>
        </section>

        <section class="health-setup-section" data-health-setup="instructions">
          <h3>SET UP OR REPAIR THE SHORTCUT</h3>
          <p class="health-setup__warning"><strong>Seeing “Conversion Error”?</strong> Add <em>Get Details of Health Samples → Value</em> before <em>Calculate Statistics → Sum</em>. The Sum input must be the numeric Value result, never Find Health Samples or Text.</p>
          <ol class="health-setup-steps">
            <li><strong>Steps:</strong> Find today’s Steps → Get Details: Value → Calculate Statistics: Sum.</li>
            <li><strong>Sleep:</strong> Use one source and Core/Deep/REM samples from 6 PM yesterday to noon today → Get Details: Duration → Sum → decimal hours.</li>
            <li><strong>Latest body data:</strong> Find newest sample, Limit 1, then Get Details: Value for Weight, Resting HR, HRV, Respiratory Rate, Oxygen Saturation, and Body Temperature. Do not sum these.</li>
            <li><strong>Build the Text:</strong> include the exact TEMPERED tags from the copied instructions.</li>
            <li><strong>Finish:</strong> Copy that Text to Clipboard. Do not Open URLs; iOS sends those to Safari, not this installed copy.</li>
          </ol>
          <div class="health-setup__actions">
            <button type="button" class="button" data-health-bridge="recipe">COPY EXACT INSTRUCTIONS</button>
            <a class="button" data-health-bridge="edit" href="${HEALTH_SHORTCUT_EDIT_URL}">EDIT TEMPERED HEALTH</a>
          </div>
          <p class="health-setup__note">This opens your existing Shortcut to repair its actions. Updating Tempered does not modify a Shortcut already saved on your iPhone.</p>
          <p class="health-setup__note">A Home Screen web app cannot read HealthKit, silently install Health actions, or register its own return URL. The native iOS build syncs directly without a Shortcut.</p>
        </section>

        <section class="health-setup-section" data-health-setup="metrics">
          <h3>WHAT FILLS BODY METRICS</h3>
          <p>The standard Shortcut should pull all five signals shown on Progress. A dash means the last sync did not include that Health type or Apple Health has no sample for it.</p>
          <div class="health-setup-metrics">
            <span>Resting heart rate</span><span>HRV</span><span>Respiration</span><span>SpO₂</span><span>Body temperature</span>
          </div>
        </section>

        <section class="health-setup-section">
          <details class="health-setup-details" data-health-inspect-details>
            <summary>CHECK WHAT YOUR SHORTCUT COPIED</summary>
            <p>Run Tempered Health first, then tap Inspect Copy. This only displays its output; it never imports or changes your logs. If the numbers are wrong here, edit the Shortcut before syncing.</p>
            <button type="button" class="button health-setup__primary" data-health-inspect>INSPECT COPY</button>
            <textarea class="health-import-sheet__input" data-health-inspect-output rows="11" readonly aria-label="Copied Health data preview" placeholder="The Shortcut's copied output will appear here."></textarea>
          </details>
        </section>

        <section class="health-setup-section">
          <details class="health-setup-details" data-health-manual-details>
            <summary>ENTER BODY METRICS MANUALLY</summary>
            <form class="health-manual-form" data-health-manual-form>
              <label>Resting HR<input type="number" inputmode="decimal" min="0" step="0.1" data-health-manual="restingHr" placeholder="bpm"></label>
              <label>HRV<input type="number" inputmode="decimal" min="0" step="0.1" data-health-manual="hrvMs" placeholder="ms"></label>
              <label>Respiration<input type="number" inputmode="decimal" min="0" step="0.1" data-health-manual="respiratoryRate" placeholder="per min"></label>
              <label>SpO₂<input type="number" inputmode="decimal" min="0" max="100" step="0.1" data-health-manual="spo2" placeholder="%"></label>
              <label>Temperature<input type="number" inputmode="decimal" step="0.1" data-health-manual="bodyTempC" placeholder="°C"></label>
              <button type="submit" class="button health-setup__primary">SAVE METRICS</button>
            </form>
          </details>
        </section>

        <section class="health-setup-section">
          <details class="health-setup-details" data-health-paste-details>
            <summary>PASTE SNAPSHOT FALLBACK</summary>
            <p>Use this only if iOS opens Safari instead of the installed Tempered app.</p>
            <textarea class="health-import-sheet__input" data-health-import-input rows="8" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="Tempered Health snapshot" placeholder="${HEALTH_SNAPSHOT_PREFIX}\nDATE=2026-09-09\nSTEPS=10527\nSLEEP=7.75"></textarea>
            <button type="button" class="button health-setup__primary" data-health-import-submit>IMPORT SNAPSHOT</button>
          </details>
        </section>

        <p class="health-setup-status" data-health-import-status role="status">Health data stays on this device.</p>
      </section>`

    activeOverlay = overlay
    const close = () => {
      if (activeOverlay === overlay) activeOverlay = null
      document.removeEventListener('keydown', onKeyDown)
      overlay.remove()
      if (trigger?.isConnected) trigger.focus()
    }
    const onKeyDown = (event) => { if (event.key === 'Escape') close() }
    overlay.querySelector('[data-health-setup-close]').onclick = close
    overlay.onclick = (event) => { if (event.target === overlay) close() }

    const status = overlay.querySelector('[data-health-import-status]')
    const inspect = overlay.querySelector('[data-health-inspect]')
    inspect.onclick = async () => {
      const output = overlay.querySelector('[data-health-inspect-output]')
      try {
        const raw = await navigator.clipboard.readText()
        output.value = raw
        const parsed = parseHealthSnapshot(raw)
        status.textContent = parsed
          ? `Preview only · ${parsed.date ?? 'no date'} · ${Object.keys(parsed).filter((key) => key !== 'date').length} metric(s). Nothing imported.`
          : 'This is not a valid Tempered Health copy. Nothing imported.'
      } catch {
        status.textContent = 'Could not read the copy. Allow Paste if iOS asks, then try again.'
      }
    }
    const recipe = overlay.querySelector('[data-health-bridge="recipe"]')
    recipe.onclick = async () => {
      const ok = await copyText(HEALTH_SHORTCUT_RECIPE)
      recipe.textContent = ok ? 'INSTRUCTIONS COPIED' : 'COPY FAILED'
      status.textContent = ok ? 'Exact build instructions copied.' : 'Could not copy. The instructions remain visible above.'
    }

    const manual = overlay.querySelector('[data-health-manual-form]')
    manual.onsubmit = async (event) => {
      event.preventDefault()
      const values = {}
      for (const input of manual.querySelectorAll('[data-health-manual]')) {
        const value = numberValue(input.value)
        if (value !== null) values[input.dataset.healthManual] = value
      }
      if (Object.keys(values).length === 0) {
        status.textContent = 'Enter at least one body metric first.'
        return
      }
      status.textContent = 'Saving body metrics…'
      const result = await importHealthSnapshot(context, { date: context.clock.today(), ...values })
      status.textContent = `Body metrics saved for ${result.date}.`
      announceImport(result)
    }

    const clipboardImport = overlay.querySelector('[data-health-clipboard-import]')
    clipboardImport.onclick = async () => {
      clipboardImport.disabled = true
      status.textContent = 'Reading the copied Health snapshot…'
      try {
        const result = await importClipboard()
        status.textContent = importMessage(result)
        clipboardImport.textContent = 'IMPORTED'
      } catch {
        status.textContent = `Could not read a ${HEALTH_SNAPSHOT_PREFIX} copy. Run the Shortcut first, then return and tap Import Copy.`
      } finally {
        clipboardImport.disabled = false
      }
    }

    const input = overlay.querySelector('[data-health-import-input]')
    const submit = overlay.querySelector('[data-health-import-submit]')
    submit.onclick = async () => {
      submit.disabled = true
      status.textContent = 'Importing snapshot…'
      try {
        const result = await importHealthSnapshot(context, input.value)
        status.textContent = importMessage(result)
        announceImport(result)
      } catch {
        status.textContent = `Paste text beginning with ${HEALTH_SNAPSHOT_PREFIX}, then try again.`
        input.focus()
      } finally {
        submit.disabled = false
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.append(overlay)
    requestAnimationFrame(() => overlay.querySelector('[data-health-setup-close]')?.focus())
    return overlay
  }

  function makeSetupButton(className = 'health-bridge__setup') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.dataset.healthBridge = 'setup'
    button.textContent = 'SETUP'
    button.onclick = () => openHealthSetup(button)
    return button
  }

  function makeSyncControl() {
    if (context.healthSync && typeof context.syncHealth === 'function') {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'health-bridge__run'
      button.dataset.healthBridge = 'run'
      button.textContent = 'SYNC HEALTH'
      button.onclick = async () => {
        button.disabled = true
        button.textContent = 'SYNCING…'
        const result = await context.syncHealth({ refreshToday: true })
        button.disabled = false
        button.textContent = result ? 'SYNCED' : 'TRY AGAIN'
      }
      return button
    }
    const link = document.createElement('a')
    link.className = 'health-bridge__run'
    link.dataset.healthBridge = 'run'
    link.href = HEALTH_SHORTCUT_RUN_URL
    link.textContent = 'RUN HEALTH SYNC'
    link.setAttribute('aria-label', 'Run the Tempered Health Shortcut')
    return link
  }

  function makeClipboardControl() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'health-bridge__import'
    button.dataset.healthBridge = 'import'
    button.textContent = 'IMPORT COPY'
    button.onclick = async () => {
      button.disabled = true
      button.textContent = 'IMPORTING…'
      try {
        const result = await importClipboard()
        button.textContent = result.warnings?.length ? 'IMPORTED · CHECK SLEEP' : 'IMPORTED'
      } catch {
        button.textContent = 'RUN SHORTCUT FIRST'
      } finally {
        button.disabled = false
      }
    }
    return button
  }

  async function enhanceToday() {
    const screen = mount.querySelector('.screen--today')
    if (screen?.dataset?.date && screen.dataset.date !== context.clock.today()) return
    const snapshot = screen?.querySelector('[data-lifestyle="snapshot"]')
    if (!snapshot || snapshot.querySelector('[data-health-bridge="run"]')) return
    const row = document.createElement('div')
    row.className = 'health-bridge__today'
    const actions = document.createElement('div')
    actions.className = 'health-bridge__today-actions'
    actions.append(makeSyncControl())
    if (!context.healthSync) actions.append(makeClipboardControl())
    actions.append(makeSetupButton())
    const status = document.createElement('span')
    status.textContent = 'Apple Health · Setup available'
    row.append(actions, status)
    snapshot.append(row)
    const day = await context.daily.dayLog(context.clock.today())
    if (!row.isConnected) return
    const synced = day.healthBridge?.importedAt ?? day.healthSyncedAt
    if (synced) {
      const at = new Date(synced)
      status.textContent = Number.isNaN(at.getTime())
        ? 'Apple Health · Synced today'
        : `Apple Health · Synced ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(at)}`
    }
  }

  function enhanceSettings() {
    const screen = mount.querySelector('.screen--settings')
    if (!screen || screen.querySelector('[data-health-bridge="settings"]')) return
    const section = document.createElement('section')
    section.className = 'card health-bridge__settings'
    section.dataset.healthBridge = 'settings'
    section.innerHTML = '<h2 class="block__title">Apple Health</h2><p class="block__hint">One-tap sync, complete Shortcut setup, conversion-error repair, and manual body metrics.</p>'
    section.append(makeSetupButton('button health-bridge__setup health-bridge__settings-open'))
    screen.querySelector('.screen__title')?.after(section)
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
    enhanceToday().catch(() => {})
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
  const openSetup = (event) => openHealthSetup(event?.detail?.trigger ?? null)
  window.addEventListener('tempered:screen-shown', screenShown)
  window.addEventListener('tempered:today-rendered', todayRendered)
  window.addEventListener('tempered:lifestyle-ready', lifestyleReady)
  window.addEventListener('tempered:open-health-setup', openSetup)
  schedule()
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true
  if (showLaunchGate ?? standalone) openLaunchGate()
  return () => {
    window.removeEventListener('tempered:screen-shown', screenShown)
    window.removeEventListener('tempered:today-rendered', todayRendered)
    window.removeEventListener('tempered:lifestyle-ready', lifestyleReady)
    window.removeEventListener('tempered:open-health-setup', openSetup)
    activeOverlay?.remove()
    launchOverlay?.remove()
    document.querySelector('[data-health-setup-overlay]')?.remove()
  }
}
