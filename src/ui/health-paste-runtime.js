/**
 * Lightweight ChatGPT Health paste bridge.
 *
 * The earlier iOS Shortcut experiment remains preserved separately. This is
 * the production PWA path: the user copies Tempered's nine-line snapshot from
 * ChatGPT Health, reviews the parsed values, and explicitly imports them.
 */

import {
  HEALTH_SNAPSHOT_PREFIX,
  importHealthSnapshot,
  parseHealthSnapshot,
} from './health-snapshot.js'

export const CHATGPT_HEALTH_PROMPT = `Use my connected Apple Health information to create today’s Tempered health snapshot.

Return only the following plain-text block. Do not include commentary, Markdown, code fences, units, commas, citations, or explanations.

TEMPERED_HEALTH_V1
DATE=
STEPS=
SLEEP=
WEIGHT_LB=
RESTING_HR=
HRV_MS=
RESP_RATE=
SPO2=

Rules:
• DATE: today’s local date in YYYY-MM-DD format.
• STEPS: current cumulative step count for today.
• SLEEP: total hours asleep for the sleep period ending today. Count Core, Deep, REM, and Asleep stages. Exclude Awake and In Bed. Do not double-count overlapping records.
• WEIGHT_LB: latest available body weight converted to pounds.
• RESTING_HR: latest available resting heart rate in bpm.
• HRV_MS: latest available heart-rate variability in milliseconds.
• RESP_RATE: latest available respiratory rate in breaths per minute.
• SPO2: latest available oxygen saturation as a percentage such as 98.
• Use numbers only after each equals sign.
• Leave a field blank if Apple Health does not provide it. Never estimate or infer a missing value.`

const METRICS = [
  ['steps', 'Steps', (value) => Math.round(value).toLocaleString()],
  ['sleepHours', 'Sleep', (value) => `${value} h`],
  ['weightLb', 'Weight', (value) => `${value} lb`],
  ['restingHr', 'Resting HR', (value) => `${value} bpm`],
  ['hrvMs', 'HRV', (value) => `${value} ms`],
  ['respiratoryRate', 'Respiration', (value) => `${value}/min`],
  ['spo2', 'SpO₂', (value) => `${value <= 1 ? value * 100 : value}%`],
]

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  throw new Error('Clipboard unavailable')
}

export function healthSnapshotPreview(text, today) {
  const parsed = parseHealthSnapshot(text)
  if (!parsed) return null
  return {
    parsed,
    date: parsed.date ?? today,
    dateMatchesToday: !parsed.date || parsed.date === today,
    dateIsFuture: Boolean(parsed.date && parsed.date > today),
    metrics: METRICS
      .filter(([key]) => Number.isFinite(parsed[key]))
      .map(([key, label, format]) => ({ key, label, value: format(parsed[key]) })),
  }
}

export function installHealthPasteRuntime(context) {
  const mount = document.getElementById('app')
  if (!mount) return () => {}
  let overlay = null
  let scheduled = false

  function importedAtLabel(day) {
    const importedAt = day?.healthBridge?.source === 'chatgpt-health'
      ? day.healthBridge.importedAt
      : null
    if (!importedAt) return 'Copy from ChatGPT Health, then paste here.'
    const date = new Date(importedAt)
    if (Number.isNaN(date.getTime())) return 'ChatGPT Health imported today.'
    return `Imported ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)}`
  }

  async function openImport(trigger = null) {
    overlay?.remove()
    const today = context.clock.today()
    const node = document.createElement('div')
    node.className = 'health-paste-overlay'
    node.dataset.healthPasteOverlay = 'true'
    node.innerHTML = `
      <section class="health-paste-sheet" role="dialog" aria-modal="true" aria-labelledby="health-paste-title">
        <header class="health-paste-sheet__head">
          <div>
            <span>CHATGPT HEALTH</span>
            <h2 id="health-paste-title">Import health snapshot</h2>
          </div>
          <button type="button" data-health-paste-close aria-label="Close health import">×</button>
        </header>
        <p class="health-paste-sheet__intro">Run your pinned Tempered prompt in ChatGPT Health, copy its nine-line result, then paste it below. Blank fields are safely skipped.</p>
        <div class="health-paste-sheet__actions">
          <button type="button" class="button" data-health-paste-read>PASTE COPY</button>
          <a class="button" data-health-prompt-copy href="https://chatgpt.com/" target="_blank" rel="noopener">COPY + OPEN CHATGPT</a>
        </div>
        <label class="health-paste-sheet__label" for="health-paste-input">HEALTH SNAPSHOT</label>
        <textarea id="health-paste-input" class="health-paste-sheet__input" data-health-paste-input rows="10" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="${HEALTH_SNAPSHOT_PREFIX}\nDATE=${today}\nSTEPS=\nSLEEP=\nWEIGHT_LB=\nRESTING_HR=\nHRV_MS=\nRESP_RATE=\nSPO2="></textarea>
        <section class="health-paste-preview" data-health-paste-preview hidden>
          <div class="health-paste-preview__head">
            <strong data-health-paste-date></strong>
            <span data-health-paste-count></span>
          </div>
          <div class="health-paste-preview__metrics" data-health-paste-metrics></div>
          <p data-health-paste-warning hidden></p>
        </section>
        <p class="health-paste-sheet__status" data-health-paste-status role="status">Nothing imports until you review and confirm.</p>
        <button type="button" class="button health-paste-sheet__import" data-health-paste-submit disabled>IMPORT HEALTH DATA</button>
      </section>`

    overlay = node
    const input = node.querySelector('[data-health-paste-input]')
    const preview = node.querySelector('[data-health-paste-preview]')
    const status = node.querySelector('[data-health-paste-status]')
    const submit = node.querySelector('[data-health-paste-submit]')
    let current = null
    let imported = false

    const close = () => {
      document.removeEventListener('keydown', onKeyDown)
      node.remove()
      if (overlay === node) overlay = null
      if (trigger?.isConnected) trigger.focus()
    }
    const onKeyDown = (event) => { if (event.key === 'Escape') close() }

    const refreshPreview = () => {
      current = healthSnapshotPreview(input.value, today)
      preview.hidden = !current
      submit.disabled = !current
      if (!current) {
        status.textContent = input.value.trim()
          ? `Paste the complete block beginning with ${HEALTH_SNAPSHOT_PREFIX}.`
          : 'Nothing imports until you review and confirm.'
        return
      }
      node.querySelector('[data-health-paste-date]').textContent = current.date
      node.querySelector('[data-health-paste-count]').textContent = `${current.metrics.length} field${current.metrics.length === 1 ? '' : 's'} ready`
      node.querySelector('[data-health-paste-metrics]').replaceChildren(...current.metrics.map((metric) => {
        const item = document.createElement('div')
        item.innerHTML = `<span></span><strong></strong>`
        item.querySelector('span').textContent = metric.label
        item.querySelector('strong').textContent = metric.value
        return item
      }))
      const warning = node.querySelector('[data-health-paste-warning]')
      warning.hidden = current.dateMatchesToday
      warning.textContent = current.dateMatchesToday
        ? ''
        : current.dateIsFuture
          ? `This snapshot is dated ${current.date}, which is in the future. Tempered will safely apply it to today instead.`
          : `This snapshot is dated ${current.date}, not today. It will update that earlier date.`
      status.textContent = 'Review these values, then import.'
    }

    input.addEventListener('input', refreshPreview)
    node.querySelector('[data-health-paste-close]').onclick = close
    node.onclick = (event) => { if (event.target === node) close() }
    node.querySelector('[data-health-paste-read]').onclick = async (event) => {
      const button = event.currentTarget
      button.disabled = true
      try {
        input.value = await navigator.clipboard.readText()
        refreshPreview()
      } catch {
        status.textContent = 'Automatic paste was blocked. Press and hold in the box and choose Paste.'
        input.focus()
      } finally {
        button.disabled = false
      }
    }
    node.querySelector('[data-health-prompt-copy]').onclick = async (event) => {
      try {
        await copyText(CHATGPT_HEALTH_PROMPT)
        event.currentTarget.textContent = 'PROMPT COPIED · OPENING CHATGPT'
        status.textContent = 'Paste the copied prompt into ChatGPT Health.'
      } catch {
        status.textContent = 'Could not copy the prompt on this device.'
      }
    }
    submit.onclick = async () => {
      if (imported) { close(); return }
      if (!current) return
      submit.disabled = true
      submit.textContent = 'IMPORTING…'
      try {
        const result = await importHealthSnapshot(context, current.parsed, { source: 'chatgpt-health' })
        window.dispatchEvent(new CustomEvent('tempered:health-imported', { detail: result }))
        status.textContent = result.warnings?.length
          ? `Imported for ${result.date}. ${result.warnings.join(' ')}`
          : `Imported ${current.metrics.length} health fields. The recap behind this sheet is updated.`
        imported = true
        submit.textContent = 'DONE · VIEW UPDATED RECAP'
        submit.disabled = false
        await enhance()
      } catch {
        status.textContent = 'The health data could not be imported. Your existing logs were not changed.'
        submit.textContent = 'TRY IMPORT AGAIN'
        submit.disabled = false
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.append(node)
    requestAnimationFrame(() => input.focus())
  }

  async function enhance() {
    const screen = mount.querySelector('.screen--today')
    if (!screen || screen.dataset.date !== context.clock.today()) return
    const host = document.querySelector('[data-lifestyle="snapshot"]')
    if (!host) return
    let row = host.querySelector('[data-health-paste-entry]')
    const day = await context.daily.dayLog(context.clock.today())
    if (!host.isConnected) return
    if (!row) {
      row = document.createElement('div')
      row.className = 'health-paste-entry'
      row.dataset.healthPasteEntry = 'true'
      row.innerHTML = `<div><strong>APPLE HEALTH</strong><span data-health-paste-last></span></div><button type="button" class="button" data-health-paste-open>IMPORT HEALTH</button>`
      row.querySelector('[data-health-paste-open]').onclick = (event) => openImport(event.currentTarget)
      host.append(row)
    }
    row.querySelector('[data-health-paste-last]').textContent = importedAtLabel(day)
  }

  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      enhance().catch(() => {})
    })
  }
  const screenShown = (event) => { if (event?.detail?.tab === 'today') schedule() }
  const todayRendered = () => schedule()
  const lifestyleReady = (event) => {
    if (!event?.detail?.date || event.detail.date === context.clock.today()) schedule()
  }
  const healthImported = () => schedule()

  window.addEventListener('tempered:screen-shown', screenShown)
  window.addEventListener('tempered:today-rendered', todayRendered)
  window.addEventListener('tempered:lifestyle-ready', lifestyleReady)
  window.addEventListener('tempered:health-imported', healthImported)
  schedule()

  return () => {
    window.removeEventListener('tempered:screen-shown', screenShown)
    window.removeEventListener('tempered:today-rendered', todayRendered)
    window.removeEventListener('tempered:lifestyle-ready', lifestyleReady)
    window.removeEventListener('tempered:health-imported', healthImported)
    overlay?.remove()
  }
}
