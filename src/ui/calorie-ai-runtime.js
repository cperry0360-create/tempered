export const NUTRITION_PHOTO_PROMPT = `Estimate the total calories and protein in the food and drink visible in the attached meal photo or photos for my Tempered food log.

Use any readable nutrition labels or menu information in the image. Otherwise estimate realistic portion sizes from what is visible. Include sauces, dressings, cooking oil, drinks, and sides when they appear. Do not ask follow-up questions. If there is uncertainty, choose one reasonable midpoint estimate rather than returning a range.

Return exactly ONE fenced code block and nothing else. The code block must contain exactly these two lines so I get a one-tap Copy button in the AI app:
\`\`\`text
TEMPERED_CALORIES=<whole-number calories>
TEMPERED_PROTEIN=<whole-number grams of protein>
\`\`\``

// Kept as an alias so old callers/tests/backups that imported the calorie name
// continue to work while the feature grows into one Nutrition tracker.
export const CALORIE_PHOTO_PROMPT = NUTRITION_PHOTO_PROMPT

function taggedNumber(raw, tag) {
  const match = raw.match(new RegExp(`${tag}\\s*[:=]\\s*([0-9]{1,5})`, 'i'))
  return match ? Number(match[1]) : null
}

export function parseTemperedNutrition(text) {
  const raw = String(text ?? '').trim()
  const calories = taggedNumber(raw, 'TEMPERED_CALORIES')
  const protein = taggedNumber(raw, 'TEMPERED_PROTEIN')
  if (calories !== null || protein !== null) return { calories, protein }

  // Backwards compatibility with the first calorie-only handoff.
  if (/^[0-9]{1,5}(?:\s*(?:kcal|calories?))?$/i.test(raw)) {
    return { calories: Number(raw.match(/[0-9]{1,5}/)?.[0]), protein: null }
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

function progressText(activity, unit) {
  if (!activity) return `— ${unit}`
  const value = amount(activity.value)
  const goal = Number(activity.dailyCap)
  if (Number.isFinite(goal) && goal > 0) return `${value} / ${goal} ${unit}`
  return `${value} ${unit}`
}

function nutritionText(calories, protein) {
  const calorieValue = amount(calories?.value)
  const calorieGoal = Number(calories?.dailyCap)
  const proteinValue = amount(protein?.value)
  const proteinGoal = Number(protein?.dailyCap)
  const c = Number.isFinite(calorieGoal) && calorieGoal > 0
    ? `${calorieValue} / ${calorieGoal} kcal`
    : `${calorieValue} kcal`
  const p = Number.isFinite(proteinGoal) && proteinGoal > 0
    ? `${proteinValue} / ${proteinGoal} g protein`
    : `${proteinValue} g protein`
  return `${c} · ${p}`
}

/**
 * Provider-neutral Nutrition handoff plus the compact Lifestyle dashboard that
 * lives directly on Today. Tempered never uploads a photo or embeds a provider
 * key. The existing daily service remains the only writer, so Calories,
 * Protein, food-logging XP and every historical day stay canonical.
 */
export function installCalorieAiRuntime() {
  const mount = document.getElementById('app')
  if (!mount) return () => {}
  let scheduled = false
  let enhancing = false
  let nutritionOpen = false

  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      enhance().catch((error) => console.warn('[tempered] Nutrition Today enhancement unavailable', error))
    })
  }

  function isTodayScreen() {
    return mount.querySelector('.screen--today .today-header__title')?.textContent?.trim() === 'Today'
  }

  function setStatus(editor, message, state = '') {
    let node = editor.querySelector('[data-calorie-ai="status"]')
    if (!node) {
      node = document.createElement('span')
      node.className = 'today-editor__hint calorie-ai__status'
      node.dataset.calorieAi = 'status'
      editor.append(node)
    }
    node.dataset.state = state
    node.textContent = message
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
    node.innerHTML = `<span class="today-lifestyle__label"></span><strong class="today-lifestyle__value"></strong><span class="today-lifestyle__detail"></span>`
    node.querySelector('.today-lifestyle__label').textContent = label
    node.querySelector('.today-lifestyle__value').textContent = value
    node.querySelector('.today-lifestyle__detail').textContent = detail
    return node
  }

  function buildLifestyle(view, weight) {
    const sleep = activityById(view, 'sleep')
    const steps = activityById(view, 'steps')
    const water = activityById(view, 'water')
    const calories = activityById(view, 'calories_logged')
    const protein = activityById(view, 'protein_target')

    const grid = document.createElement('div')
    grid.className = 'today-lifestyle'
    grid.dataset.lifestyle = 'snapshot'
    const sleepValue = typeof sleep?.value === 'number' ? `${Number(sleep.value.toFixed(2))} h` : '— h'
    const stepValue = typeof steps?.value === 'number' ? steps.value.toLocaleString() : '0'
    const stepGoal = Number(steps?.dailyCap)
    const waterValue = typeof water?.value === 'number' ? `${water.value} oz` : '0 oz'
    const waterGoal = Number(water?.dailyCap)

    grid.append(
      metric('SLEEP', sleepValue, '7–9 h target', 'sleep'),
      metric('STEPS', stepValue, Number.isFinite(stepGoal) ? `${stepGoal.toLocaleString()} target` : 'daily movement', 'steps'),
      metric('NUTRITION', nutritionText(calories, protein), 'calories + protein together', 'nutrition', true),
      metric('WATER', waterValue, Number.isFinite(waterGoal) ? `${waterGoal} oz target` : 'hydration', 'water'),
      metric('WEIGHT', typeof weight === 'number' ? `${weight} lb` : '— lb', 'latest weigh-in', 'weight'),
    )
    return grid
  }

  async function logNutrition({ calories = null, protein = null } = {}, editor = null) {
    const context = globalThis.tempered
    if (!context?.daily || !context?.clock) return false
    const date = context.clock.today()
    const c = calories === null || calories === '' ? null : Number(calories)
    const p = protein === null || protein === '' ? null : Number(protein)
    const validCalories = Number.isFinite(c) && c >= 0 ? c : null
    const validProtein = Number.isFinite(p) && p >= 0 ? p : null

    if (validCalories === null && validProtein === null) {
      if (editor) setStatus(editor, 'Enter calories, protein, or paste an AI result.', 'error')
      return false
    }

    if (editor) setStatus(editor, 'Adding this meal…', 'ready')
    if (validCalories !== null) await context.daily.logAt(date, 'calories_logged', validCalories, { mode: 'add' })
    if (validProtein !== null) await context.daily.logAt(date, 'protein_target', validProtein, { mode: 'add' })
    // Logging a meal is, by definition, the existing "Logged your food" habit.
    await context.daily.logAt(date, 'nutrition_logged')
    nutritionOpen = false
    await context.app?.show('today')
    return true
  }

  async function pasteResult(editor, calorieInput, proteinInput) {
    if (!navigator.clipboard?.readText) {
      calorieInput.focus()
      setStatus(editor, 'Clipboard access is blocked. Paste the two TEMPERED lines here manually.', 'manual')
      return
    }
    try {
      const parsed = parseTemperedNutrition(await navigator.clipboard.readText())
      if (!parsed) {
        calorieInput.focus()
        setStatus(editor, 'Could not find TEMPERED_CALORIES or TEMPERED_PROTEIN in the clipboard.', 'error')
        return
      }
      if (parsed.calories !== null) calorieInput.value = String(parsed.calories)
      if (parsed.protein !== null) proteinInput.value = String(parsed.protein)
      await logNutrition(parsed, editor)
    } catch {
      calorieInput.focus()
      setStatus(editor, 'Clipboard access was blocked. Paste the AI values manually.', 'manual')
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

  function buildNutrition(view) {
    const calories = activityById(view, 'calories_logged')
    const protein = activityById(view, 'protein_target')
    const wrap = document.createElement('div')
    wrap.className = 'today-item-wrap nutrition-combined'
    wrap.dataset.activity = 'nutrition_combined'
    wrap.dataset.open = String(nutritionOpen)

    const row = document.createElement('div')
    row.className = 'today-item today-item--number today-item--nutrition'
    row.dataset.action = 'open-log'

    const body = makeButton('today-item__body', '', 'Open Nutrition details')
    body.setAttribute('aria-expanded', String(nutritionOpen))
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
    body.onclick = () => { nutritionOpen = !nutritionOpen; schedule() }

    const prompt = makeButton('today-item__ai-prompt', 'AI PHOTO', 'Copy AI meal-photo nutrition prompt')
    prompt.dataset.calorieAi = 'prompt'
    prompt.onclick = async (event) => {
      event.stopPropagation()
      const copied = await copyText(NUTRITION_PHOTO_PROMPT)
      prompt.textContent = copied ? 'COPIED' : 'FAILED'
      prompt.dataset.copied = String(copied)
      window.setTimeout(() => {
        if (!prompt.isConnected) return
        prompt.textContent = 'AI PHOTO'
        delete prompt.dataset.copied
      }, 1600)
    }

    const expand = makeButton('today-item__expand', '', `${nutritionOpen ? 'Close' : 'Open'} Nutrition details`)
    expand.setAttribute('aria-expanded', String(nutritionOpen))
    expand.innerHTML = nutritionOpen ? '⌃' : '⌄'
    expand.onclick = () => { nutritionOpen = !nutritionOpen; schedule() }
    row.append(body, prompt, expand)
    wrap.append(row)

    if (nutritionOpen) {
      const editor = document.createElement('div')
      editor.className = 'today-editor nutrition-editor'
      editor.dataset.editor = 'nutrition_combined'

      const fields = document.createElement('div')
      fields.className = 'nutrition-editor__fields'
      const calorieLabel = document.createElement('label')
      calorieLabel.className = 'nutrition-editor__field'
      calorieLabel.innerHTML = '<span>Calories</span>'
      const calorieInput = document.createElement('input')
      calorieInput.className = 'today-editor__input'
      calorieInput.type = 'number'
      calorieInput.inputMode = 'numeric'
      calorieInput.min = '0'
      calorieInput.step = '1'
      calorieInput.placeholder = 'kcal'
      calorieInput.dataset.entry = 'nutrition_calories'
      calorieLabel.append(calorieInput)

      const proteinLabel = document.createElement('label')
      proteinLabel.className = 'nutrition-editor__field'
      proteinLabel.innerHTML = '<span>Protein</span>'
      const proteinInput = document.createElement('input')
      proteinInput.className = 'today-editor__input'
      proteinInput.type = 'number'
      proteinInput.inputMode = 'numeric'
      proteinInput.min = '0'
      proteinInput.step = '1'
      proteinInput.placeholder = 'grams'
      proteinInput.dataset.entry = 'nutrition_protein'
      proteinLabel.append(proteinInput)
      fields.append(calorieLabel, proteinLabel)

      const actions = document.createElement('div')
      actions.className = 'nutrition-editor__actions'
      const add = makeButton('today-editor__save nutrition-editor__add', 'ADD MEAL', 'Add calories and protein')
      add.dataset.action = 'nutrition-log'
      add.onclick = () => logNutrition({ calories: calorieInput.value, protein: proteinInput.value }, editor)
      const paste = makeButton('today-editor__ai-paste', 'PASTE AI RESULT', 'Paste AI calories and protein result')
      paste.dataset.calorieAi = 'paste'
      paste.onclick = () => pasteResult(editor, calorieInput, proteinInput)
      actions.append(add, paste)
      editor.append(fields, actions)
      setStatus(editor, 'One tracker, two goals. AI PHOTO copies a prompt that asks for a copy-button code block; Paste AI Result logs both values.', 'ready')
      wrap.append(editor)
    }
    return wrap
  }

  function hideLegacyNutritionRows() {
    for (const id of ['calories_logged', 'protein_target', 'nutrition_logged']) {
      mount.querySelectorAll(`[data-activity="${id}"]`).forEach((node) => { node.hidden = true })
    }
  }

  async function enhance() {
    if (enhancing || !isTodayScreen()) return
    const context = globalThis.tempered
    if (!context?.daily || !context?.clock) return
    enhancing = true
    try {
      const screen = mount.querySelector('.screen--today')
      const section = screen?.querySelector('[data-section="daily"]')
      if (!section) return

      const view = await context.daily.forDate(context.clock.today())
      const weight = await latestWeight(context.clock.today())
      hideLegacyNutritionRows()

      const title = section.querySelector('.today-section__title')
      const detail = section.querySelector('.today-section__detail')
      if (title) title.textContent = 'Lifestyle'
      if (detail) detail.textContent = 'Sleep · movement · nutrition · hydration · recovery'

      let snapshot = section.querySelector('[data-lifestyle="snapshot"]')
      const nextSnapshot = buildLifestyle(view, weight)
      if (snapshot) snapshot.replaceWith(nextSnapshot)
      else section.querySelector('.today-section__head')?.after(nextSnapshot)

      const list = section.querySelector('.today-list')
      if (list) {
        list.querySelector('[data-activity="nutrition_combined"]')?.remove()
        const nutrition = buildNutrition(view)
        const steps = list.querySelector('[data-activity="steps"]')
        const stepsHost = steps?.classList?.contains('today-item-wrap') ? steps : steps?.closest('.today-item-wrap') ?? steps
        if (stepsHost?.parentNode === list) stepsHost.after(nutrition)
        else list.prepend(nutrition)
      }
    } finally {
      enhancing = false
    }
  }

  const observer = new MutationObserver(schedule)
  observer.observe(mount, { childList: true, subtree: true })
  schedule()
  return () => observer.disconnect()
}
