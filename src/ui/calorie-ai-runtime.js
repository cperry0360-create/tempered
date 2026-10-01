import { nutritionLedger, nutritionSuggestions } from '../domain/nutrition.js'
import { icon } from './icons.js'

export const NUTRITION_PHOTO_PROMPT = `Estimate the total calories and macros in the food and drink visible in the attached meal photo or photos for my Tempered food log.

Use any readable nutrition labels or menu information in the image. Otherwise estimate realistic portion sizes from what is visible. Include sauces, dressings, cooking oil, drinks, and sides when they appear. Do not ask follow-up questions. If there is uncertainty, choose one reasonable midpoint estimate rather than returning a range.

Return exactly ONE fenced code block and nothing else. The code block must contain exactly these six lines so I get a one-tap Copy button in the AI app:
\`\`\`text
TEMPERED_DESCRIPTION=<brief plain-language meal description>
TEMPERED_CALORIES=<whole-number calories>
TEMPERED_PROTEIN=<grams of protein>
TEMPERED_CARBS=<grams of carbohydrates>
TEMPERED_FAT=<grams of fat>
TEMPERED_FIBER=<grams of fiber>
\`\`\``

// Kept as an alias so old callers/tests/backups that imported the calorie name
// continue to work while the feature grows into one Nutrition tracker.
export const CALORIE_PHOTO_PROMPT = NUTRITION_PHOTO_PROMPT


const FIELD_DEFINITIONS = Object.freeze([
  { key: 'calories', label: 'Calories', short: 'kcal', placeholder: 'kcal', step: '1' },
  { key: 'protein', label: 'Protein', short: 'protein', placeholder: 'g', step: '0.1' },
  { key: 'carbs', label: 'Carbs', short: 'carbs', placeholder: 'g', step: '0.1' },
  { key: 'fat', label: 'Fat', short: 'fat', placeholder: 'g', step: '0.1' },
  { key: 'fiber', label: 'Fiber', short: 'fiber', placeholder: 'g', step: '0.1' },
])

const ENTRY_FIELDS = Object.freeze({
  calories: 'calories', protein: 'proteinGrams', carbs: 'carbsGrams',
  fat: 'fatGrams', fiber: 'fiberGrams',
})

function taggedNumber(raw, tag) {
  const match = raw.match(new RegExp(`${tag}\\s*[:=]\\s*([0-9]{1,5}(?:\\.[0-9]+)?)`, 'i'))
  return match ? Number(match[1]) : null
}

function taggedText(raw, tag) {
  const match = raw.match(new RegExp(`^${tag}\\s*[:=]\\s*(.+?)\\s*$`, 'im'))
  const value = match?.[1]?.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
  return value ? value.slice(0, 120) : null
}

export function parseTemperedNutrition(text) {
  const raw = String(text ?? '').trim()
  const parsed = {
    description: taggedText(raw, 'TEMPERED_DESCRIPTION'),
    calories: taggedNumber(raw, 'TEMPERED_CALORIES'),
    protein: taggedNumber(raw, 'TEMPERED_PROTEIN'),
    carbs: taggedNumber(raw, 'TEMPERED_CARBS'),
    fat: taggedNumber(raw, 'TEMPERED_FAT'),
    fiber: taggedNumber(raw, 'TEMPERED_FIBER'),
  }
  if (Object.entries(parsed).some(([key, value]) => key !== 'description' && value !== null)) return parsed

  // Backwards compatibility with the first calorie-only handoff.
  if (/^[0-9]{1,5}(?:\s*(?:kcal|calories?))?$/i.test(raw)) {
    return { description: null, calories: Number(raw.match(/[0-9]{1,5}/)?.[0]), protein: null, carbs: null, fat: null, fiber: null }
  }
  return null
}

export function parseTemperedCalories(text) {
  return parseTemperedNutrition(text)?.calories ?? null
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* fall through to legacy copy */ }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand?.('copy') === true
  textarea.remove()
  return copied
}

function makeButton(className, text, label) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = text
  button.setAttribute('aria-label', label)
  return button
}

function activityById(view, id) {
  return [...(view?.outstanding ?? []), ...(view?.logged ?? [])]
    .find((activity) => activity.id === id) ?? null
}

function shownNumber(value) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1).replace(/\.0$/, '')
}

function dateLabel(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  const value = new Date(year, month - 1, day, 12)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(value)
}

function shiftedDate(dateKey, amount) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  const value = new Date(year, month - 1, day, 12)
  value.setDate(value.getDate() + amount)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function localTimeValue(epoch) {
  const date = new Date(epoch)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function timestampFor(dateKey, time, fallback) {
  const dateParts = String(dateKey).split('-').map(Number)
  const timeParts = String(time).split(':').map(Number)
  if (dateParts.length !== 3 || timeParts.length !== 2 || [...dateParts, ...timeParts].some(Number.isNaN)) return fallback
  return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0], timeParts[1]).toISOString()
}

function formattedTime(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function nutrientLine(values) {
  const parts = []
  for (const field of FIELD_DEFINITIONS) {
    const value = values?.[ENTRY_FIELDS[field.key]]
    if (!(typeof value === 'number' && Number.isFinite(value))) continue
    parts.push(field.key === 'calories'
      ? `${shownNumber(value)} kcal`
      : `${shownNumber(value)}g ${field.short}`)
  }
  return parts.join(' · ')
}

/**
 * Provider-neutral Nutrition handoff plus the compact Lifestyle dashboard that
 * lives directly on Today. It responds only to explicit screen lifecycle
 * events, so it never observes and rebuilds DOM that it created itself.
 */
export function installCalorieAiRuntime() {
  const mount = document.getElementById('app')
  if (!mount) return () => {}
  // The full-screen overlay (earlier days, Today's +) and the inline panel on
  // Fuel share every builder below; host() is whichever is active.
  let nutritionScreen = null
  let panelScreen = null
  let lastNutritionTrigger = null
  const host = () => (nutritionScreen?.isConnected ? nutritionScreen : panelScreen?.isConnected ? panelScreen : null)
  let lastDeleted = null


  function todayRoot() {
    return mount.querySelector('.screen--today')
  }

  function selectedDate() {
    return todayRoot()?.dataset?.date ?? globalThis.tempered?.clock?.today?.()
  }

  function promptButton(className = 'today-item__ai-prompt') {
    const button = document.createElement('a')
    button.className = className
    button.href = 'https://chatgpt.com/'
    button.target = '_blank'
    button.rel = 'noopener'
    button.setAttribute('aria-label', 'Copy meal-photo prompt and open ChatGPT')
    button.replaceChildren(
      icon('food'),
      Object.assign(document.createElement('span'), { textContent: 'Meal photo' }),
    )
    button.dataset.calorieAi = 'prompt'
    button.onclick = async (event) => {
      event.stopPropagation()
      const copied = await copyText(NUTRITION_PHOTO_PROMPT)
      button.querySelector('span').textContent = copied ? 'Opening' : 'Failed'
      button.dataset.copied = String(copied)
      window.setTimeout(() => {
        if (!button.isConnected) return
        button.querySelector('span').textContent = 'Meal photo'
        delete button.dataset.copied
      }, 1600)
    }
    return button
  }

  async function refreshUnderlyingSurfaces(date = host()?.dataset.date) {
    if (!date) return
    window.dispatchEvent(new CustomEvent('tempered:fuel-updated', { detail: { date } }))
    const context = globalThis.tempered
    if (!context?.app) return
    if (document.querySelector('.screen--today')) {
      if (date === context.clock.today() && context.app.show) await context.app.show('today')
      else if (context.app.showTodayDate) await context.app.showTodayDate(date)
    }
  }

  function setScreenStatus(message, state = '') {
    const status = host()?.querySelector('[data-nutrition-status]')
    if (!status) return
    status.dataset.state = state
    status.textContent = message
  }

  function totalCard(label, value, target, key) {
    const card = document.createElement('div')
    card.className = `nutrition-total nutrition-total--${key}`
    card.dataset.nutritionTotal = key
    const name = document.createElement('span')
    name.textContent = label
    const number = document.createElement('strong')
    number.textContent = value
    card.append(name, number)
    if (target) card.append(Object.assign(document.createElement('small'), { textContent: target }))
    return card
  }

  function historyItem(entry, date) {
    const item = document.createElement('article')
    item.className = 'nutrition-entry'
    item.dataset.nutritionEntry = entry.id
    item.dataset.entryTime = entry.loggedAt
    const body = document.createElement('div')
    if (entry.description) {
      const description = document.createElement('h4')
      description.className = 'nutrition-entry__description'
      description.textContent = entry.description
      body.append(description)
    }
    const time = document.createElement('strong')
    time.className = 'nutrition-entry__time'
    time.textContent = formattedTime(entry.loggedAt)
    const source = document.createElement('span')
    source.className = 'nutrition-entry__source'
    source.textContent = entry.source === 'ai' ? 'Estimate' : 'Manual entry'
    const nutrients = document.createElement('p')
    nutrients.className = 'nutrition-entry__nutrients'
    nutrients.textContent = nutrientLine(entry)
    body.append(time, source, nutrients)
    const remove = makeButton('nutrition-entry__delete', 'Delete', `Delete nutrition entry at ${formattedTime(entry.loggedAt)}`)
    remove.onclick = async () => {
      remove.disabled = true
      try {
        const result = await globalThis.tempered.daily.removeNutrition(date, entry.id)
        lastDeleted = result.removed ? { entry: result.removed, index: result.index, date } : null
        await renderNutritionData()
        await refreshUnderlyingSurfaces()
      } catch {
        setScreenStatus('Could not delete that entry; your saved data was not changed.', 'error')
      }
    }
    item.append(body, remove)
    return item
  }

  function carryoverItem(carryover) {
    const item = document.createElement('article')
    item.className = 'nutrition-entry nutrition-entry--carryover'
    item.dataset.nutritionCarryover = 'true'
    const body = document.createElement('div')
    const time = document.createElement('strong')
    time.className = 'nutrition-entry__time'
    time.textContent = 'Earlier total'
    const source = document.createElement('span')
    source.className = 'nutrition-entry__source'
    source.textContent = 'Logged before meal history'
    const nutrients = document.createElement('p')
    nutrients.className = 'nutrition-entry__nutrients'
    nutrients.textContent = nutrientLine(carryover) || 'Food logged'
    body.append(time, source, nutrients)
    item.append(body)
    return item
  }

  function renderUndo() {
    const target = host()?.querySelector('[data-nutrition-undo]')
    if (!target) return
    target.replaceChildren()
    target.hidden = !lastDeleted
    if (!lastDeleted) return
    const message = document.createElement('span')
    message.textContent = 'Meal deleted.'
    const undo = makeButton('nutrition-undo__button', 'Undo', 'Undo deleted nutrition entry')
    undo.onclick = async () => {
      undo.disabled = true
      const pending = lastDeleted
      try {
        await globalThis.tempered.daily.restoreNutrition(pending.date, pending.entry, pending.index)
        lastDeleted = null
        await renderNutritionData()
        await refreshUnderlyingSurfaces()
        setScreenStatus('Meal restored.', 'ready')
      } catch {
        setScreenStatus('Could not restore that entry.', 'error')
      }
    }
    target.append(message, undo)
  }

  function renderSuggestions(date, days) {
    const section = host()?.querySelector('[data-nutrition-suggestions-section]')
    const list = host()?.querySelector('[data-nutrition-suggestions]')
    if (!section || !list) return
    const suggestions = nutritionSuggestions(days, 4)
    section.hidden = suggestions.length === 0
    list.replaceChildren(...suggestions.map((suggestion) => {
      const button = makeButton('nutrition-suggestion', '', `Log ${suggestion.description} again`)
      button.dataset.nutritionSuggestion = suggestion.description
      const name = document.createElement('strong')
      name.textContent = suggestion.description
      const detail = document.createElement('span')
      detail.textContent = nutrientLine(suggestion)
      const use = document.createElement('small')
      use.textContent = suggestion.count > 1 ? `${suggestion.count}× logged · Add` : 'Recent · Add'
      button.append(name, detail, use)
      button.onclick = async () => {
        button.disabled = true
        try {
          await globalThis.tempered.daily.addNutrition(date, suggestion, {
            loggedAt: timestampFor(date, localTimeValue(globalThis.tempered.clock.now()), globalThis.tempered.clock.nowIso()),
            source: 'manual',
          })
          lastDeleted = null
          await renderNutritionData()
          await refreshUnderlyingSurfaces()
          setScreenStatus(`${suggestion.description} added.`, 'success')
        } catch {
          button.disabled = false
          setScreenStatus('Could not repeat that meal; your saved data was not changed.', 'error')
        }
      }
      return button
    }))
  }

  async function renderNutritionData() {
    const screen = host()
    if (!screen) return
    const context = globalThis.tempered
    const date = screen.dataset.date
    const [view, day, days] = await Promise.all([
      context.daily.forDate(date), context.daily.dayLog(date), context.storage.getAll('dayLogs'),
    ])
    if (host() !== screen || screen.dataset.date !== date) return
    const ledger = nutritionLedger(day)
    const dayStatus = screen.querySelector('[data-nutrition-day-status]')
    if (dayStatus) {
      const state = day?.nutritionStatus ?? (date === context.clock.today() ? 'partial' : 'unreviewed')
      dayStatus.dataset.state = state
      const copy = dayStatus.querySelector('[data-nutrition-day-status-copy]')
      if (copy) copy.textContent = state === 'complete'
        ? 'Complete day · included in calorie averages'
        : state === 'partial' ? 'Still logging · excluded from calorie averages' : 'Not reviewed · eligible totals may be included'
      dayStatus.querySelectorAll('[data-nutrition-day-state]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.nutritionDayState === state))
      })
    }
    const calories = activityById(view, 'calories_logged')
    const protein = activityById(view, 'protein_target')
    const caloriesGoal = Number(calories?.dailyCap)
    const proteinGoal = Number(protein?.dailyCap)
    const totals = screen.querySelector('[data-nutrition-totals]')
    totals?.replaceChildren(
      totalCard('Calories', `${shownNumber(ledger.totals.calories)} kcal`, Number.isFinite(caloriesGoal) && caloriesGoal > 0 ? `${shownNumber(caloriesGoal)} target` : '', 'calories'),
      totalCard('Protein', `${shownNumber(ledger.totals.protein)} g`, Number.isFinite(proteinGoal) && proteinGoal > 0 ? `${shownNumber(proteinGoal)} target` : '', 'protein'),
      totalCard('Carbs', `${shownNumber(ledger.totals.carbs)} g`, '', 'carbs'),
      totalCard('Fat', `${shownNumber(ledger.totals.fat)} g`, '', 'fat'),
      totalCard('Fiber', `${shownNumber(ledger.totals.fiber)} g`, '', 'fiber'),
    )

    const list = screen.querySelector('[data-nutrition-history]')
    const entries = [...ledger.entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    const rows = entries.map((entry) => historyItem(entry, date))
    if (ledger.hasCarryover) rows.push(carryoverItem(ledger.carryover))
    if (rows.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'nutrition-history__empty'
      empty.textContent = screen === panelScreen ? 'No meals yet today.' : 'No meals logged yet; add one above to start your history.'
      rows.push(empty)
    }
    list.replaceChildren(...rows)
    renderSuggestions(date, days)
    renderUndo()
    window.dispatchEvent(new CustomEvent('tempered:fuel-updated', { detail: { date } }))
  }

  async function pasteNutrition(form, inputs) {
    const first = inputs.get('calories')
    if (!navigator.clipboard?.readText) {
      first.focus()
      setScreenStatus('Clipboard access is blocked; paste or enter the five values manually.', 'manual')
      return
    }
    try {
      const parsed = parseTemperedNutrition(await navigator.clipboard.readText())
      if (!parsed) {
        first.focus()
        setScreenStatus('No Tempered nutrition values were found in the clipboard.', 'error')
        return
      }
      for (const input of inputs.values()) input.value = ''
      for (const field of FIELD_DEFINITIONS) {
        if (parsed[field.key] !== null) inputs.get(field.key).value = String(parsed[field.key])
      }
      const description = form.querySelector('[data-entry="nutrition_description"]')
      if (description && parsed.description) description.value = parsed.description
      form.dataset.source = 'ai'
      setScreenStatus('Nutrition values pasted; review them before adding the meal.', 'ready')
    } catch {
      first.focus()
      setScreenStatus('Clipboard access was blocked; paste or enter the values manually.', 'manual')
    }
  }

  async function switchNutritionDate(nextDate) {
    const context = globalThis.tempered
    if (!nutritionScreen?.isConnected || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)
      || nextDate > context.clock.today() || nextDate === nutritionScreen.dataset.date) return
    const replacement = buildNutritionScreen(nextDate, lastNutritionTrigger)
    nutritionScreen.replaceWith(replacement)
    nutritionScreen = replacement
    await renderNutritionData()
    requestAnimationFrame(() => nutritionScreen?.querySelector('[data-nutrition-date]')?.focus())
  }

  function buildNutritionScreen(date, trigger, { embedded = false } = {}) {
    if (!embedded) lastNutritionTrigger = trigger
    lastDeleted = null
    const overlay = document.createElement('div')
    overlay.className = 'nutrition-log-overlay'
    overlay.dataset.nutritionScreen = 'true'
    overlay.dataset.date = date
    const screen = document.createElement('section')
    screen.className = 'nutrition-log-screen'
    screen.setAttribute('role', 'dialog')
    screen.setAttribute('aria-modal', 'true')
    screen.setAttribute('aria-labelledby', 'nutrition-log-title')

    const header = document.createElement('header')
    header.className = 'nutrition-log-header'
    const back = makeButton('nutrition-log-header__back', '‹', 'Back to Today')
    const heading = document.createElement('div')
    const eyebrow = document.createElement('span')
    eyebrow.textContent = date === globalThis.tempered.clock.today() ? 'Today' : dateLabel(date)
    const title = document.createElement('h2')
    title.id = 'nutrition-log-title'
    title.textContent = 'Nutrition'
    heading.append(eyebrow, title)
    back.onclick = closeNutritionScreen
    header.append(back, heading, promptButton('nutrition-log-header__ai'))

    const datePicker = document.createElement('label')
    datePicker.className = 'nutrition-date-picker'
    const dateCaption = document.createElement('span')
    dateCaption.textContent = 'Logging date'
    const dateInput = document.createElement('input')
    dateInput.type = 'date'
    dateInput.value = date
    dateInput.max = globalThis.tempered.clock.today()
    dateInput.dataset.nutritionDate = 'true'
    dateInput.setAttribute('aria-label', 'Nutrition logging date')
    dateInput.onchange = () => switchNutritionDate(dateInput.value)
    datePicker.append(dateCaption, dateInput)

    const totals = document.createElement('div')
    totals.className = 'nutrition-totals'
    totals.dataset.nutritionTotals = 'true'

    const dayStatus = document.createElement('section')
    dayStatus.className = 'nutrition-day-status'
    dayStatus.dataset.nutritionDayStatus = 'true'
    const dayStatusHead = document.createElement('div')
    dayStatusHead.innerHTML = '<strong>Day status</strong><span data-nutrition-day-status-copy></span>'
    const dayStatusActions = document.createElement('div')
    for (const [state, label] of [['complete', 'Complete'], ['partial', 'Still logging']]) {
      const button = makeButton('nutrition-day-status__button', label, `Mark nutrition day ${state}`)
      button.dataset.nutritionDayState = state
      button.onclick = async () => {
        const context = globalThis.tempered
        const current = await context.daily.dayLog(date)
        await context.storage.put('dayLogs', { ...(current ?? { date }), date, nutritionStatus: state })
        await renderNutritionData()
      }
      dayStatusActions.append(button)
    }
    dayStatus.append(dayStatusHead, dayStatusActions)

    const suggestionSection = document.createElement('section')
    suggestionSection.className = 'nutrition-suggestions'
    suggestionSection.dataset.nutritionSuggestionsSection = 'true'
    suggestionSection.hidden = true
    const suggestionTitle = document.createElement('h3')
    suggestionTitle.textContent = 'Quick log · recent and frequent'
    const suggestions = document.createElement('div')
    suggestions.className = 'nutrition-suggestions__list'
    suggestions.dataset.nutritionSuggestions = 'true'
    suggestionSection.append(suggestionTitle, suggestions)

    const historySection = document.createElement('section')
    historySection.className = 'nutrition-history'
    const historyTitle = document.createElement('h3')
    historyTitle.textContent = 'Meals'
    const history = document.createElement('div')
    history.className = 'nutrition-history__list'
    history.dataset.nutritionHistory = 'true'
    historySection.append(historyTitle, history)

    const form = document.createElement('form')
    form.className = 'nutrition-meal-form'
    form.dataset.nutritionForm = 'true'
    form.dataset.source = 'manual'
    const formTitle = document.createElement('h3')
    formTitle.textContent = 'Add meal'
    const fields = document.createElement('div')
    fields.className = 'nutrition-meal-form__fields'
    const inputs = new Map()

    const descriptionLabel = document.createElement('label')
    descriptionLabel.className = 'nutrition-meal-field nutrition-meal-field--description'
    descriptionLabel.innerHTML = '<span>Meal</span>'
    const descriptionInput = document.createElement('input')
    descriptionInput.type = 'text'
    descriptionInput.maxLength = 120
    descriptionInput.placeholder = 'Protein shake, chicken bowl…'
    descriptionInput.dataset.entry = 'nutrition_description'
    descriptionInput.addEventListener('input', () => { form.dataset.source = 'manual' })
    descriptionLabel.append(descriptionInput)
    fields.append(descriptionLabel)

    const timeLabel = document.createElement('label')
    timeLabel.className = 'nutrition-meal-field nutrition-meal-field--time'
    timeLabel.innerHTML = '<span>Time</span>'
    const timeInput = document.createElement('input')
    timeInput.type = 'time'
    timeInput.value = localTimeValue(globalThis.tempered.clock.now())
    timeInput.dataset.entry = 'nutrition_time'
    timeInput.required = true
    timeLabel.append(timeInput)
    fields.append(timeLabel)

    for (const definition of FIELD_DEFINITIONS) {
      const label = document.createElement('label')
      label.className = `nutrition-meal-field nutrition-meal-field--${definition.key}`
      const caption = document.createElement('span')
      caption.textContent = definition.label
      const input = document.createElement('input')
      input.type = 'number'
      input.inputMode = 'decimal'
      input.min = '0'
      input.step = definition.step
      input.placeholder = definition.placeholder
      input.dataset.entry = `nutrition_${definition.key}`
      input.addEventListener('input', () => { form.dataset.source = 'manual' })
      label.append(caption, input)
      inputs.set(definition.key, input)
      fields.append(label)
    }

    const status = document.createElement('p')
    status.className = 'nutrition-meal-form__status'
    status.dataset.nutritionStatus = 'true'
    status.setAttribute('role', 'status')
    status.textContent = 'Enter any details you know; all nutrition fields are optional.'
    const actions = document.createElement('div')
    actions.className = 'nutrition-meal-form__actions'
    const paste = makeButton('nutrition-meal-form__paste', 'Import copied nutrition', 'Read copied nutrition result for review')
    paste.dataset.calorieAi = 'paste'
    paste.onclick = () => pasteNutrition(form, inputs)
    const add = makeButton('nutrition-meal-form__add', 'Add meal', 'Add meal to Nutrition history')
    add.type = 'submit'
    add.dataset.action = 'nutrition-log'
    if (embedded) actions.append(promptButton('nutrition-meal-form__photo'))
    actions.append(paste, add)
    form.append(formTitle, fields, status, actions)
    form.onsubmit = async (event) => {
      event.preventDefault()
      const values = {
        description: descriptionInput.value,
        ...Object.fromEntries(FIELD_DEFINITIONS.map(({ key }) => [key, inputs.get(key).value])),
      }
      if (!Object.values(values).some((value) => Number(value) > 0)) {
        inputs.get('calories').focus()
        setScreenStatus('Enter at least one amount before adding the meal.', 'error')
        return
      }
      add.disabled = true
      paste.disabled = true
      setScreenStatus('Adding meal…', 'ready')
      try {
        await globalThis.tempered.daily.addNutrition(date, values, {
          loggedAt: timestampFor(date, timeInput.value, globalThis.tempered.clock.nowIso()),
          source: form.dataset.source,
        })
        for (const input of inputs.values()) input.value = ''
        descriptionInput.value = ''
        timeInput.value = localTimeValue(globalThis.tempered.clock.now())
        form.dataset.source = 'manual'
        lastDeleted = null
        await renderNutritionData()
        await refreshUnderlyingSurfaces()
        setScreenStatus(embedded ? 'Meal added.' : 'Meal added to today’s history.', 'success')
      } catch {
        setScreenStatus('Could not add that meal; your saved data was not changed.', 'error')
      } finally {
        add.disabled = false
        paste.disabled = false
      }
    }

    const undo = document.createElement('div')
    undo.className = 'nutrition-undo'
    undo.dataset.nutritionUndo = 'true'
    undo.hidden = true
    if (embedded) {
      const panel = document.createElement('div')
      panel.className = 'nutrition-panel'
      panel.dataset.nutritionPanel = 'true'
      panel.dataset.date = date
      formTitle.textContent = 'Add a meal'
      historyTitle.textContent = 'Today’s meals'
      const earlier = makeButton('nutrition-panel__earlier', 'Log for an earlier day', 'Log or fix meals on an earlier day')
      earlier.dataset.nutritionEarlier = 'true'
      earlier.onclick = () => openNutritionScreen(earlier, shiftedDate(date, -1))
      const addCard = document.createElement('section')
      addCard.className = 'fuel-r4__card nutrition-panel__add'
      addCard.append(form)
      const mealsCard = document.createElement('section')
      mealsCard.className = 'fuel-r4__card nutrition-panel__meals'
      mealsCard.append(historySection, undo, dayStatus, earlier)
      panel.append(addCard, mealsCard)
      return panel
    }
    screen.append(header, datePicker, totals, dayStatus, suggestionSection, form, historySection, undo)
    overlay.append(screen)
    overlay.onclick = (event) => { if (event.target === overlay) closeNutritionScreen() }
    return overlay
  }

  function openNutritionScreen(trigger, dateOverride = null) {
    if (nutritionScreen?.isConnected) return
    const date = dateOverride ?? selectedDate()
    if (!date) return
    nutritionScreen = buildNutritionScreen(date, trigger)
    document.body.append(nutritionScreen)
    document.body.dataset.nutritionOpen = 'true'
    document.addEventListener('keydown', nutritionKeydown)
    renderNutritionData().catch(() => setScreenStatus('Nutrition history could not load; try again.', 'error'))
    requestAnimationFrame(() => nutritionScreen?.querySelector('.nutrition-log-header__back')?.focus())
  }

  function nutritionKeydown(event) {
    if (event.key === 'Escape') closeNutritionScreen()
  }

  function closeNutritionScreen() {
    if (!nutritionScreen) return
    nutritionScreen.remove()
    nutritionScreen = null
    delete document.body.dataset.nutritionOpen
    document.removeEventListener('keydown', nutritionKeydown)
    if (lastNutritionTrigger?.isConnected) lastNutritionTrigger.focus()
    lastNutritionTrigger = null
    lastDeleted = null
    if (panelScreen?.isConnected) renderNutritionData().catch(() => {})
  }

  /** Fuel asks for the inline panel; it is built once per date and reused across re-renders. */
  const mountPanel = (event) => {
    const slot = event?.detail?.slot, date = event?.detail?.date
    if (!slot || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return
    if (!(panelScreen && panelScreen.dataset.date === date && slot.contains(panelScreen))) {
      panelScreen = buildNutritionScreen(date, null, { embedded: true })
      slot.replaceChildren(panelScreen)
    }
    if (!nutritionScreen?.isConnected) renderNutritionData().catch(() => setScreenStatus('Meals could not load; try again.', 'error'))
  }
  const refreshPanel = () => {
    if (panelScreen?.isConnected && !nutritionScreen?.isConnected) renderNutritionData().catch(() => {})
  }

  const screenShown = (event) => {
    if (event?.detail?.tab !== 'today' && event?.detail?.tab !== 'fuel') closeNutritionScreen()
  }
  const nutritionRequested = (event) => openNutritionScreen(
    event?.detail?.trigger ?? null,
    event?.detail?.date ?? null,
  )
  window.addEventListener('tempered:screen-shown', screenShown)
  window.addEventListener('tempered:open-nutrition', nutritionRequested)
  window.addEventListener('tempered:mount-nutrition-panel', mountPanel)
  window.addEventListener('tempered:nutrition-refresh', refreshPanel)
  return () => {
    window.removeEventListener('tempered:screen-shown', screenShown)
    window.removeEventListener('tempered:open-nutrition', nutritionRequested)
    window.removeEventListener('tempered:mount-nutrition-panel', mountPanel)
    window.removeEventListener('tempered:nutrition-refresh', refreshPanel)
    closeNutritionScreen()
  }
}
