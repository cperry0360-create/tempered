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
  ['restingHr', 'Resting heart rate', (value) => `${value} bpm`],
  ['hrvMs', 'Heart rate variability', (value) => `${value} ms`],
  ['respiratoryRate', 'Respiration', (value) => `${value}/min`],
  ['spo2', 'Oxygen saturation', (value) => `${value <= 1 ? value * 100 : value}%`],
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
  let closeImport = null

  async function openImport(trigger = null) {
    closeImport?.()
    const today = context.clock.today()
    const node = document.createElement('div')
    node.className = 'health-paste-overlay'
    node.dataset.healthPasteOverlay = 'true'
    node.innerHTML = `
      <section class="health-paste-sheet" role="dialog" aria-modal="true" aria-labelledby="health-paste-title">
        <header class="health-paste-sheet__head">
          <button type="button" data-health-paste-close aria-label="Back to Today">‹</button>
          <h2 id="health-paste-title">Import health data</h2>
        </header>
        <div class="health-paste-sheet__content">
        <section class="health-paste-step">
          <h3><span>1</span> Copy prompt and open ChatGPT</h3>
          <p class="health-paste-sheet__intro">Copy the prompt into ChatGPT Health; blank fields are skipped.</p>
          <a class="button" data-health-prompt-copy href="https://chatgpt.com/" target="_blank" rel="noopener">Copy prompt and open ChatGPT</a>
        </section>
        <section class="health-paste-step health-paste-step--paste">
          <h3><span>2</span> Paste health data</h3>
          <label class="health-paste-sheet__label" for="health-paste-input">Nine-line health snapshot</label>
          <textarea id="health-paste-input" class="health-paste-sheet__input" data-health-paste-input rows="6" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Paste the nine-line health snapshot here"></textarea>
          <button type="button" class="button" data-health-paste-read>Paste copy</button>
        </section>
        <section class="health-paste-step">
          <h3><span>3</span> Review and import</h3>
        <section class="health-paste-preview" data-health-paste-preview hidden>
          <div class="health-paste-preview__head">
            <strong data-health-paste-date></strong>
            <span data-health-paste-count></span>
          </div>
          <div class="health-paste-preview__metrics" data-health-paste-metrics></div>
          <p data-health-paste-warning hidden></p>
        </section>
        <p class="health-paste-sheet__status" data-health-paste-status role="status">Nothing imports until you review and confirm.</p>
        </section>
        </div>
        <footer class="health-paste-sheet__footer">
          <button type="button" class="button health-paste-sheet__import" data-health-paste-submit disabled>Review and import</button>
        </footer>
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
      window.visualViewport?.removeEventListener('resize', fitViewport)
      window.visualViewport?.removeEventListener('scroll', fitViewport)
      closeImport = null
      node.remove()
      delete document.body.dataset.healthPasteOpen
      if (overlay === node) overlay = null
      if (trigger?.isConnected) trigger.focus()
    }
    closeImport = close
    const fitViewport = () => {
      const viewport = window.visualViewport
      if (!viewport) return
      node.style.height = `${viewport.height}px`
      node.style.top = `${viewport.offsetTop}px`
      if (document.activeElement === input) input.scrollIntoView({ block: 'center' })
    }
    window.visualViewport?.addEventListener('resize', fitViewport)
    window.visualViewport?.addEventListener('scroll', fitViewport)
    fitViewport()
    const onKeyDown = (event) => { if (event.key === 'Escape') close() }

    const refreshPreview = () => {
      current = healthSnapshotPreview(input.value, today)
      preview.hidden = !current
      submit.disabled = !current
      if (!current) {
        status.textContent = input.value.trim()
          ? 'Paste a complete health snapshot to continue.'
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
          ? `This snapshot is dated ${current.date} in the future, so Tempered will apply it to today instead.`
          : `This snapshot is dated ${current.date}, so it will update that earlier date.`
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
        status.textContent = 'Automatic paste was blocked; press and hold in the box, then choose Paste.'
        input.focus()
      } finally {
        button.disabled = false
      }
    }
    node.querySelector('[data-health-prompt-copy]').onclick = async (event) => {
      try {
        await copyText(CHATGPT_HEALTH_PROMPT)
        event.currentTarget.textContent = 'Prompt copied · opening ChatGPT'
        status.textContent = 'Paste the copied prompt into ChatGPT Health.'
      } catch {
        status.textContent = 'Could not copy the prompt on this device.'
      }
    }
    submit.onclick = async () => {
      if (imported) { close(); return }
      if (!current) return
      submit.disabled = true
      submit.textContent = 'Importing…'
      try {
        const result = await importHealthSnapshot(context, current.parsed, { source: 'chatgpt-health' })
        if (result.date === context.clock.today() && context.app?.show) await context.app.show('today')
        else if (context.app?.showTodayDate) await context.app.showTodayDate(result.date)
        window.dispatchEvent(new CustomEvent('tempered:health-imported', { detail: result }))
        status.textContent = result.warnings?.length
          ? `Imported for ${result.date}; ${result.warnings.join(' ')}`
          : `Imported ${current.metrics.length} health fields for today.`
        imported = true
        submit.textContent = 'Done'
        submit.disabled = false

      } catch {
        status.textContent = 'The health data could not be imported; your existing logs were not changed.'
        submit.textContent = 'Try import again'
        submit.disabled = false
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.append(node)
    document.body.dataset.healthPasteOpen = 'true'
    requestAnimationFrame(() => node.querySelector('[data-health-paste-close]')?.focus())
  }

  const openRequested = (event) => {
    openImport(event?.detail?.trigger ?? null).catch((error) => {
      console.error('[tempered] health import could not open', error)
    })
  }

  window.addEventListener('tempered:open-health-import', openRequested)

  return () => {
    window.removeEventListener('tempered:open-health-import', openRequested)
    closeImport?.()
    delete document.body.dataset.healthPasteOpen
  }
}
