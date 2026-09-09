import { nutritionLedger } from '../domain/nutrition.js'

export const NUTRITION_PHOTO_PROMPT = `Estimate the total calories and macros in the food and drink visible in the attached meal photo or photos for my Tempered food log.

Use any readable nutrition labels or menu information in the image. Otherwise estimate realistic portion sizes from what is visible. Include sauces, dressings, cooking oil, drinks, and sides when they appear. Do not ask follow-up questions. If there is uncertainty, choose one reasonable midpoint estimate rather than returning a range.

Return exactly ONE fenced code block and nothing else. The code block must contain exactly these five lines so I get a one-tap Copy button in the AI app:
\`\`\`text
TEMPERED_CALORIES=<whole-number calories>
TEMPERED_PROTEIN=<grams of protein>
TEMPERED_CARBS=<grams of carbohydrates>
TEMPERED_FAT=<grams of fat>
TEMPERED_FIBER=<grams of fiber>
\`\`\``

// Kept as an alias so old callers/tests/backups that imported the calorie name
// continue to work while the feature grows into one Nutrition tracker.
export const CALORIE_PHOTO_PROMPT = NUTRITION_PHOTO_PROMPT

const nutritionAiIcon = new URL('../../art/tempered/icon-nutrition-ai.png', import.meta.url).href

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

export function parseTemperedNutrition(text) {
  const raw = String(text ?? '').trim()
  const parsed = {
    calories: taggedNumber(raw, 'TEMPERED_CALORIES'),
    protein: taggedNumber(raw, 'TEMPERED_PROTEIN'),
    carbs: taggedNumber(raw, 'TEMPERED_CARBS'),
    fat: taggedNumber(raw, 'TEMPERED_FAT'),
    fiber: taggedNumber(raw, 'TEMPERED_FIBER'),
  }
  if (Object.values(parsed).some((value) => value !== null)) return parsed

  // Backwards compatibility with the first calorie-only handoff.
  if (/^[0-9]{1,5}(?:\s*(?:kcal|calories?))?$/i.test(raw)) {
    return { calories: Number(raw.match(/[0-9]{1,5}/)?.[0]), protein: null, carbs: null, fat: null, fiber: null }
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

function allActivities(view) {
  return [...(view?.outstanding ?? []), ...(view?.logged ?? [])]
}

function activityById(view, id) {
  return allActivities(view).find((activity) => activity.id === id) ?? null
}

function amount(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function shownNumber(value) {
  const numeric = amount(value)
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1).replace(/\.0$/, '')
}

function nutritionText(calories, protein) {
  const calorieValue = amount(calories?.value)
  const calorieGoal = Number(calories?.dailyCap)
  const proteinValue = amount(protein?.value)
  const proteinGoal = Number(protein?.dailyCap)
  const c = Number.isFinite(calorieGoal) && calorieGoal > 0
    ? `${shownNumber(calorieValue)} / ${shownNumber(calorieGoal)} kcal`
    : `${shownNumber(calorieValue)} kcal`
  const p = Number.isFinite(proteinGoal) && proteinGoal > 0
    ? `${shownNumber(proteinValue)} / ${shownNumber(proteinGoal)} g protein`
    : `${shownNumber(proteinValue)} g protein`
  return `${c} · ${p}`
}

function dateLabel(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  const value = new Date(year, month - 1, day, 12)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(value)
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
  let scheduled = false
  let enhancing = false
  let rerenderRequested = false
  let nutritionScreen = null
  let lastNutritionTrigger = null
  let lastDeleted = null

  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      enhance().catch((error) => console.warn('[tempered] Nutrition Today enhancement unavailable', error))
    })
  }

  function todayRoot() {
    return mount.querySelector('.screen--today')
  }

  function selectedDate() {
    return todayRoot()?.dataset?.date ?? globalThis.tempered?.clock?.today?.()
  }

  async function latestWeight(today) {
    const storage = globalThis.tempered?.storage
    if (!storage) return null
    const days = (await storage.getAll('dayLogs'))
      .filter((row) => row.date <= today && typeof row.bodyMetrics?.weight === 'number')
      .sort((a, b) => b.date.localeCompare(a.date))
    return days[0]?.bodyMetrics?.weight ?? null
  }

  function metric(label, value, detail, name, wide = false) {
    const node = document.createElement('div')
    node.className = `today-lifestyle__metric${wide ? ' today-lifestyle__metric--wide' : ''}`
    node.dataset.metric = name
    node.innerHTML = '<span class="today-lifestyle__label"></span><strong class="today-lifestyle__value"></strong><span class="today-lifestyle__detail"></span>'
    node.querySelector('.today-lifestyle__label').textContent = label
    node.querySelector('.today-lifestyle__value').textContent = value
    node.querySelector('.today-lifestyle__detail').textContent = detail
    return node
  }

  function lifestyleMetrics(view, weight) {
    const sleep = activityById(view, 'sleep')
    const steps = activityById(view, 'steps')
    const water = activityById(view, 'water')
    const calories = activityById(view, 'calories_logged')
    const protein = activityById(view, 'protein_target')
    const sleepValue = typeof sleep?.value === 'number' ? `${shownNumber(Number(sleep.value.toFixed(2)))} h` : '— h'
    const stepValue = typeof steps?.value === 'number' ? steps.value.toLocaleString() : '0'
    const stepGoal = Number(steps?.dailyCap)
    const waterValue = typeof water?.value === 'number' ? `${shownNumber(water.value)} oz` : '0 oz'
    const waterGoal = Number(water?.dailyCap)
    return [
      ['SLEEP', sleepValue, '7–9 h target', 'sleep', false],
      ['STEPS', stepValue, Number.isFinite(stepGoal) ? `${stepGoal.toLocaleString()} target` : 'daily movement', 'steps', false],
      ['NUTRITION', nutritionText(calories, protein), 'tap below for meals + macros', 'nutrition', true],
      ['WATER', waterValue, Number.isFinite(waterGoal) ? `${waterGoal} oz target` : 'hydration', 'water', false],
      ['WEIGHT', typeof weight === 'number' ? `${weight} lb` : '— lb', 'latest weigh-in', 'weight', false],
    ]
  }

  function syncLifestyle(host, view, weight) {
    let grid = host.querySelector('[data-lifestyle="snapshot"]')
    if (!grid) {
      grid = document.createElement('div')
      grid.className = 'today-lifestyle'
      grid.dataset.lifestyle = 'snapshot'
      host.append(grid)
    }
    for (const definition of lifestyleMetrics(view, weight)) {
      const [, value, detail, name] = definition
      let node = grid.querySelector(`[data-metric="${name}"]`)
      if (!node) {
        node = metric(...definition)
        const health = grid.querySelector('.health-bridge__today')
        health ? grid.insertBefore(node, health) : grid.append(node)
      } else {
        node.querySelector('.today-lifestyle__value').textContent = value
        node.querySelector('.today-lifestyle__detail').textContent = detail
      }
    }
    return grid
  }

  function hideLegacyNutritionRows() {
    for (const id of ['calories_logged', 'protein_target', 'nutrition_logged']) {
      mount.querySelectorAll(`[data-activity="${id}"]`).forEach((node) => { node.hidden = true })
    }
  }

  function cloneFoodIcon() {
    const source = mount.querySelector('[data-activity="calories_logged"] .today-item__icon')
      ?? mount.querySelector('[data-activity="nutrition_logged"] .today-item__icon')
    if (source) return source.cloneNode(true)
    const icon = document.createElement('span')
    icon.className = 'today-item__icon'
    icon.textContent = 'N'
    return icon
  }

  function promptButton(className = 'today-item__ai-prompt') {
    const button = makeButton(className, '', 'Copy AI meal-photo nutrition prompt')
    button.replaceChildren(
      Object.assign(document.createElement('img'), { src: nutritionAiIcon, alt: '' }),
      Object.assign(document.createElement('span'), { textContent: 'AI PHOTO' }),
    )
    button.dataset.calorieAi = 'prompt'
    button.onclick = async (event) => {
      event.stopPropagation()
      const copied = await copyText(NUTRITION_PHOTO_PROMPT)
      button.querySelector('span').textContent = copied ? 'COPIED' : 'FAILED'
      button.dataset.copied = String(copied)
      window.setTimeout(() => {
        if (!button.isConnected) return
        button.querySelector('span').textContent = 'AI PHOTO'
        delete button.dataset.copied
      }, 1600)
    }
    return button
  }

  function buildNutritionRow(view) {
    const calories = activityById(view, 'calories_logged')
    const protein = activityById(view, 'protein_target')
    const wrap = document.createElement('div')
    wrap.className = 'today-item-wrap nutrition-combined'
    wrap.dataset.activity = 'nutrition_combined'
    const row = document.createElement('div')
    row.className = 'today-item today-item--number today-item--nutrition'
    const body = makeButton('today-item__body', '', 'Open Nutrition log')
    const main = document.createElement('span')
    main.className = 'today-item__main'
    const name = document.createElement('span')
    name.className = 'today-item__name'
    name.textContent = 'Nutrition'
    const meta = document.createElement('span')
    meta.className = 'today-item__meta'
    meta.textContent = nutritionText(calories, protein)
    main.append(name, meta)
    body.append(cloneFoodIcon(), main)
    body.onclick = () => openNutritionScreen(body)
    const open = makeButton('today-item__expand', '›', 'Open Nutrition log')
    open.onclick = () => openNutritionScreen(open)
    row.append(body, promptButton(), open)
    wrap.append(row)
    return wrap
  }

  function syncNutritionRow(list, view) {
    let wrap = list.querySelector('[data-activity="nutrition_combined"]')
    if (!wrap) {
      wrap = buildNutritionRow(view)
      const steps = list.querySelector('[data-activity="steps"]')
      const stepsHost = steps?.classList?.contains('today-item-wrap') ? steps : steps?.closest('.today-item-wrap') ?? steps
      if (stepsHost?.parentNode === list) stepsHost.after(wrap)
      else list.prepend(wrap)
      return
    }
    const calories = activityById(view, 'calories_logged')
    const protein = activityById(view, 'protein_target')
    const meta = wrap.querySelector('.today-item__meta')
    if (meta) meta.textContent = nutritionText(calories, protein)
  }

  function setScreenStatus(message, state = '') {
    const status = nutritionScreen?.querySelector('[data-nutrition-status]')
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
    const time = document.createElement('strong')
    time.className = 'nutrition-entry__time'
    time.textContent = formattedTime(entry.loggedAt)
    const source = document.createElement('span')
    source.className = 'nutrition-entry__source'
    source.textContent = entry.source === 'ai' ? 'AI estimate' : 'Manual entry'
    const nutrients = document.createElement('p')
    nutrients.className = 'nutrition-entry__nutrients'
    nutrients.textContent = nutrientLine(entry)
    body.append(time, source, nutrients)
    const remove = makeButton('nutrition-entry__delete', 'DELETE', `Delete nutrition entry at ${formattedTime(entry.loggedAt)}`)
    remove.onclick = async () => {
      remove.disabled = true
      try {
        const result = await globalThis.tempered.daily.removeNutrition(date, entry.id)
        lastDeleted = result.removed ? { entry: result.removed, index: result.index, date } : null
        await renderNutritionData()
        await enhance()
      } catch {
        setScreenStatus('Could not delete that entry. Your saved data was not changed.', 'error')
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
    const host = nutritionScreen?.querySelector('[data-nutrition-undo]')
    if (!host) return
    host.replaceChildren()
    host.hidden = !lastDeleted
    if (!lastDeleted) return
    const message = document.createElement('span')
    message.textContent = 'Meal deleted.'
    const undo = makeButton('nutrition-undo__button', 'UNDO', 'Undo deleted nutrition entry')
    undo.onclick = async () => {
      undo.disabled = true
      const pending = lastDeleted
      try {
        await globalThis.tempered.daily.restoreNutrition(pending.date, pending.entry, pending.index)
        lastDeleted = null
        await renderNutritionData()
        await enhance()
        setScreenStatus('Meal restored.', 'ready')
      } catch {
        setScreenStatus('Could not restore that entry.', 'error')
      }
    }
    host.append(message, undo)
  }

  async function renderNutritionData() {
    if (!nutritionScreen?.isConnected) return
    const context = globalThis.tempered
    const date = nutritionScreen.dataset.date
    const [view, day] = await Promise.all([context.daily.forDate(date), context.daily.dayLog(date)])
    if (!nutritionScreen?.isConnected || nutritionScreen.dataset.date !== date) return
    const ledger = nutritionLedger(day)
    const calories = activityById(view, 'calories_logged')
    const protein = activityById(view, 'protein_target')
    const caloriesGoal = Number(calories?.dailyCap)
    const proteinGoal = Number(protein?.dailyCap)
    const totals = nutritionScreen.querySelector('[data-nutrition-totals]')
    totals.replaceChildren(
      totalCard('CALORIES', `${shownNumber(ledger.totals.calories)} kcal`, Number.isFinite(caloriesGoal) && caloriesGoal > 0 ? `${shownNumber(caloriesGoal)} target` : '', 'calories'),
      totalCard('PROTEIN', `${shownNumber(ledger.totals.protein)} g`, Number.isFinite(proteinGoal) && proteinGoal > 0 ? `${shownNumber(proteinGoal)} target` : '', 'protein'),
      totalCard('CARBS', `${shownNumber(ledger.totals.carbs)} g`, '', 'carbs'),
      totalCard('FAT', `${shownNumber(ledger.totals.fat)} g`, '', 'fat'),
      totalCard('FIBER', `${shownNumber(ledger.totals.fiber)} g`, '', 'fiber'),
    )

    const list = nutritionScreen.querySelector('[data-nutrition-history]')
    const entries = [...ledger.entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    const rows = entries.map((entry) => historyItem(entry, date))
    if (ledger.hasCarryover) rows.push(carryoverItem(ledger.carryover))
    if (rows.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'nutrition-history__empty'
      empty.textContent = 'No meals logged yet. Add one below and it will stay visible here.'
      rows.push(empty)
    }
    list.replaceChildren(...rows)
    renderUndo()
  }

  async function pasteNutrition(form, inputs) {
    const first = inputs.get('calories')
    if (!navigator.clipboard?.readText) {
      first.focus()
      setScreenStatus('Clipboard access is blocked. Paste or enter the five values manually.', 'manual')
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
      form.dataset.source = 'ai'
      setScreenStatus('AI values pasted. Review them, then tap Add Meal.', 'ready')
    } catch {
      first.focus()
      setScreenStatus('Clipboard access was blocked. Paste or enter the values manually.', 'manual')
    }
  }

  function buildNutritionScreen(date, trigger) {
    lastNutritionTrigger = trigger
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
    eyebrow.textContent = date === globalThis.tempered.clock.today() ? 'TODAY' : dateLabel(date).toUpperCase()
    const title = document.createElement('h2')
    title.id = 'nutrition-log-title'
    title.textContent = 'NUTRITION'
    heading.append(eyebrow, title)
    back.onclick = closeNutritionScreen
    header.append(back, heading, promptButton('nutrition-log-header__ai'))

    const totals = document.createElement('div')
    totals.className = 'nutrition-totals'
    totals.dataset.nutritionTotals = 'true'

    const historySection = document.createElement('section')
    historySection.className = 'nutrition-history'
    const historyTitle = document.createElement('h3')
    historyTitle.textContent = 'MEALS'
    const history = document.createElement('div')
    history.className = 'nutrition-history__list'
    history.dataset.nutritionHistory = 'true'
    historySection.append(historyTitle, history)

    const form = document.createElement('form')
    form.className = 'nutrition-meal-form'
    form.dataset.nutritionForm = 'true'
    form.dataset.source = 'manual'
    const formTitle = document.createElement('h3')
    formTitle.textContent = 'ADD MEAL'
    const fields = document.createElement('div')
    fields.className = 'nutrition-meal-form__fields'
    const inputs = new Map()

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
    status.textContent = 'Enter what you know. Every macro is optional.'
    const actions = document.createElement('div')
    actions.className = 'nutrition-meal-form__actions'
    const paste = makeButton('nutrition-meal-form__paste', 'PASTE AI RESULT', 'Paste AI nutrition result for review')
    paste.dataset.calorieAi = 'paste'
    paste.onclick = () => pasteNutrition(form, inputs)
    const add = makeButton('nutrition-meal-form__add', 'ADD MEAL', 'Add meal to Nutrition history')
    add.type = 'submit'
    add.dataset.action = 'nutrition-log'
    actions.append(paste, add)
    form.append(formTitle, fields, status, actions)
    form.onsubmit = async (event) => {
      event.preventDefault()
      const values = Object.fromEntries(FIELD_DEFINITIONS.map(({ key }) => [key, inputs.get(key).value]))
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
        timeInput.value = localTimeValue(globalThis.tempered.clock.now())
        form.dataset.source = 'manual'
        lastDeleted = null
        await renderNutritionData()
        await enhance()
        setScreenStatus('Meal added. It is saved in today’s history.', 'success')
      } catch {
        setScreenStatus('Could not add that meal. Your saved data was not changed.', 'error')
      } finally {
        add.disabled = false
        paste.disabled = false
      }
    }

    const undo = document.createElement('div')
    undo.className = 'nutrition-undo'
    undo.dataset.nutritionUndo = 'true'
    undo.hidden = true
    screen.append(header, totals, form, historySection, undo)
    overlay.append(screen)
    overlay.onclick = (event) => { if (event.target === overlay) closeNutritionScreen() }
    return overlay
  }

  function openNutritionScreen(trigger) {
    if (nutritionScreen?.isConnected) return
    const date = selectedDate()
    if (!date) return
    nutritionScreen = buildNutritionScreen(date, trigger)
    document.body.append(nutritionScreen)
    document.body.dataset.nutritionOpen = 'true'
    document.addEventListener('keydown', nutritionKeydown)
    renderNutritionData().catch(() => setScreenStatus('Nutrition history could not load. Try again.', 'error'))
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
  }

  async function enhance() {
    if (enhancing) {
      rerenderRequested = true
      return
    }
    const screen = todayRoot()
    const context = globalThis.tempered
    const date = selectedDate()
    if (!screen || !context?.daily || !date) return
    enhancing = true
    try {
      const section = screen.querySelector('[data-section="daily"]')
      const list = section?.querySelector('.today-list')
      const recapHost = screen.querySelector('[data-lifestyle-recap-host]')
      if (!list && !recapHost) return
      const [view, weight] = await Promise.all([
        context.daily.forDate(date), latestWeight(date),
      ])
      if (screen !== todayRoot() || date !== selectedDate()) return
      if (date === context.clock.today() && section && list) {
        hideLegacyNutritionRows()
        const title = section.querySelector('.today-section__title')
        const detail = section.querySelector('.today-section__detail')
        if (title) title.textContent = 'Lifestyle'
        if (detail) detail.textContent = 'Sleep · movement · nutrition · hydration · recovery'
        syncNutritionRow(list, view)
      }
      if (recapHost) {
        syncLifestyle(recapHost, view, weight)
        window.dispatchEvent(new CustomEvent('tempered:lifestyle-ready', {
          detail: { date },
        }))
      }
    } finally {
      enhancing = false
      if (rerenderRequested) {
        rerenderRequested = false
        schedule()
      }
    }
  }

  const screenShown = (event) => {
    if (event?.detail?.tab === 'today') schedule()
    else closeNutritionScreen()
  }
  const todayRendered = () => schedule()
  window.addEventListener('tempered:screen-shown', screenShown)
  window.addEventListener('tempered:today-rendered', todayRendered)
  schedule()
  return () => {
    window.removeEventListener('tempered:screen-shown', screenShown)
    window.removeEventListener('tempered:today-rendered', todayRendered)
    closeNutritionScreen()
  }
}
