import { ACTIVITY_FIELDS, isLogged } from '../domain/activities.js'

const DEFAULT_WIDGETS = ['training', 'sleep', 'steps', 'nutrition', 'water', 'weight', 'body', 'consistency']
const CATALOG = {
  training: { title: 'Training load', size: 'wide' },
  sleep: { title: 'Sleep', size: 'small' },
  steps: { title: 'Steps', size: 'small' },
  nutrition: { title: 'Nutrition', size: 'wide' },
  water: { title: 'Water', size: 'small' },
  weight: { title: 'Weight', size: 'small' },
  body: { title: 'Body metrics', size: 'wide' },
  consistency: { title: 'Consistency', size: 'wide' },
  cardio: { title: 'Micro cardio', size: 'small' },
}

function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function addDays(key, amount) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  date.setDate(date.getDate() + amount)
  return dateKey(date)
}
function rangeDates(today, count) {
  const start = addDays(today, -(count - 1))
  const dates = []
  for (let key = start; key <= today; key = addDays(key, 1)) dates.push(key)
  return dates
}
function mean(values) {
  const clean = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null
}
function compact(value) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(undefined, { notation: Math.abs(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value)
}
function spark(values) {
  const clean = values.map((v) => typeof v === 'number' && Number.isFinite(v) ? v : null)
  if (clean.filter((v) => v !== null).length < 2) return null
  const numeric = clean.filter((v) => v !== null)
  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const span = max - min || 1
  const points = clean.map((value, index) => {
    const v = value ?? min
    const x = (index / Math.max(1, clean.length - 1)) * 100
    const y = 38 - ((v - min) / span) * 32
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 100 42')
  svg.setAttribute('class', 'progress-widget__spark')
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  line.setAttribute('points', points)
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', 'currentColor')
  line.setAttribute('stroke-width', '3')
  line.setAttribute('stroke-linecap', 'round')
  line.setAttribute('stroke-linejoin', 'round')
  svg.append(line)
  return svg
}
function completion(activity, day) {
  const spec = ACTIVITY_FIELDS[activity.id]
  if (!spec) return false
  if (activity.id === 'protein_target') return day.proteinTargetMet === true
  if (activity.id === 'calories_logged') return day.caloriesLogged === true
  if (Number.isFinite(activity.dailyCap) && activity.dailyCap > 0) {
    const value = spec.stores === 'bodyMetrics' ? day.bodyMetrics?.weight : day[spec.field]
    return typeof value === 'number' && value >= activity.dailyCap
  }
  return isLogged(activity, day)
}

export function installProgressDashboardRuntime(context) {
  const mount = document.getElementById('app')
  if (!mount) return () => {}
  let scheduled = false
  let busy = false
  let rerenderRequested = false
  let editing = false
  let galleryOpen = false
  let pendingSave = Promise.resolve()

  async function widgetOrder() {
    await pendingSave
    const profile = await context.storage.get('profile', 'profile')
    const saved = Array.isArray(profile?.progressWidgets) ? profile.progressWidgets.filter((id) => CATALOG[id]) : null
    return saved ? [...new Set(saved)] : [...DEFAULT_WIDGETS]
  }
  async function saveOrder(order) {
    const profile = (await context.storage.get('profile', 'profile')) ?? { id: 'profile' }
    await context.storage.put('profile', { ...profile, progressWidgets: [...order] })
  }
  function persistOrder(order) {
    const snapshot = [...order]
    pendingSave = pendingSave
      .then(() => saveOrder(snapshot))
      .catch((error) => console.warn('[tempered] dashboard order could not be saved', error))
    return pendingSave
  }

  async function model(range) {
    const today = context.clock.today()
    const dates = rangeDates(today, range)
    const dateSet = new Set(dates)
    const [daysRaw, sessionsRaw, sets, schedule, exercises, todayView, profile] = await Promise.all([
      context.storage.getAll('dayLogs'),
      context.storage.getAll('sessions'),
      context.storage.getAll('setLogs'),
      context.daily.activitySchedule(),
      context.workout.exerciseMap(),
      context.daily.forDate(today),
      context.storage.get('profile', 'profile'),
    ])
    const byDate = new Map(daysRaw.map((day) => [day.date, day]))
    const days = dates.map((date) => byDate.get(date) ?? { date })
    const sessions = sessionsRaw.filter((s) => s.endedAt && dateSet.has(s.date))
    const sessionIds = new Set(sessions.map((s) => s.id))
    const working = sets.filter((set) => !set.isWarmup && sessionIds.has(set.sessionId))
    const bySession = new Map(sessionsRaw.map((s) => [s.id, s]))
    const volumeByDate = new Map(dates.map((date) => [date, 0]))
    for (const set of working) {
      const exercise = exercises.get(set.exerciseId)
      const load = (typeof exercise?.notionalLoad === 'number' ? exercise.notionalLoad : 0) + (set.weight ?? 0)
      const date = bySession.get(set.sessionId)?.date
      if (date && load > 0 && set.reps > 0) volumeByDate.set(date, (volumeByDate.get(date) ?? 0) + load * set.reps)
    }
    const dailyActivities = (context.daily.activities ?? []).filter((activity) => schedule[activity.id]?.cadence === 'daily')
    const opportunities = days.length * dailyActivities.length
    const done = days.reduce((sum, day) => sum + dailyActivities.filter((activity) => completion(activity, day)).length, 0)
    const latestHealth = [...days].reverse().find((day) => day.healthMetrics)?.healthMetrics ?? {}
    const latestWeight = [...days].reverse().find((day) => typeof day.bodyMetrics?.weight === 'number')?.bodyMetrics?.weight ?? null
    const firstWeight = days.find((day) => typeof day.bodyMetrics?.weight === 'number')?.bodyMetrics?.weight ?? null
    const caloriesGoal = todayView.outstanding.concat(todayView.logged).find((a) => a.id === 'calories_logged')?.dailyCap ?? profile?.calorieTarget ?? null
    const proteinGoal = todayView.outstanding.concat(todayView.logged).find((a) => a.id === 'protein_target')?.dailyCap ?? null
    const waterGoal = todayView.outstanding.concat(todayView.logged).find((a) => a.id === 'water')?.dailyCap ?? null
    return {
      range, days, sessions, working,
      volume: dates.map((date) => volumeByDate.get(date) ?? 0),
      steps: days.map((d) => d.steps), sleep: days.map((d) => d.sleepHours),
      water: days.map((d) => d.waterOz), calories: days.map((d) => d.calories), protein: days.map((d) => d.proteinGrams),
      weights: days.map((d) => d.bodyMetrics?.weight), cardio: days.map((d) => d.microCardioMinutes ?? 0),
      latestHealth, latestWeight, weightChange: latestWeight !== null && firstWeight !== null ? latestWeight - firstWeight : null,
      habitRate: opportunities ? Math.round((done / opportunities) * 100) : 0,
      calorieGoal: Number(caloriesGoal) || null, proteinGoal: Number(proteinGoal) || null, waterGoal: Number(waterGoal) || null,
    }
  }

  function cardBase(id, data) {
    const card = document.createElement('article')
    card.className = `progress-widget progress-widget--${CATALOG[id].size}`
    card.dataset.widget = id
    if (editing) card.dataset.editing = 'true'
    const title = document.createElement('span')
    title.className = 'progress-widget__title'
    title.textContent = CATALOG[id].title
    card.append(title)
    return card
  }
  function headline(card, value, detail = '') {
    const strong = document.createElement('strong')
    strong.className = 'progress-widget__value'
    strong.textContent = value
    card.append(strong)
    if (detail) {
      const span = document.createElement('span')
      span.className = 'progress-widget__detail'
      span.textContent = detail
      card.append(span)
    }
  }
  function chart(card, values) {
    const line = spark(values)
    if (line) card.append(line)
  }

  function buildCard(id, data) {
    const card = cardBase(id, data)
    if (id === 'training') {
      const total = data.volume.reduce((a, b) => a + b, 0)
      headline(card, `${data.sessions.length} sessions`, `${data.working.length} working sets · ${compact(total)} lb nominal`)
      chart(card, data.volume)
    } else if (id === 'sleep') {
      const avg = mean(data.sleep)
      headline(card, avg === null ? '—' : `${avg.toFixed(1)} h`, `${data.range}-day average`)
      chart(card, data.sleep)
    } else if (id === 'steps') {
      const avg = mean(data.steps)
      headline(card, avg === null ? '—' : compact(Math.round(avg)), 'average steps')
      chart(card, data.steps)
    } else if (id === 'nutrition') {
      const c = mean(data.calories)
      const p = mean(data.protein)
      headline(card, c === null ? '— kcal' : `${Math.round(c)} kcal`, data.calorieGoal ? `${data.calorieGoal} target` : 'average calories')
      const pair = document.createElement('div')
      pair.className = 'progress-widget__pair'
      pair.innerHTML = `<span><b>${p === null ? '—' : Math.round(p)}g</b><small>protein avg</small></span><span><b>${data.proteinGoal ?? '—'}g</b><small>current target</small></span>`
      card.append(pair)
    } else if (id === 'water') {
      const avg = mean(data.water)
      headline(card, avg === null ? '—' : `${Math.round(avg)} oz`, data.waterGoal ? `${data.waterGoal} oz target` : 'average')
      chart(card, data.water)
    } else if (id === 'weight') {
      headline(card, data.latestWeight === null ? '—' : `${data.latestWeight.toFixed(1)} lb`, data.weightChange === null ? 'latest weigh-in' : `${data.weightChange >= 0 ? '+' : ''}${data.weightChange.toFixed(1)} lb in range`)
      chart(card, data.weights)
    } else if (id === 'body') {
      const h = data.latestHealth
      const metrics = [
        ['♥', h.restingHr, 'bpm', 'Resting HR'], ['⌁', h.hrvMs, 'ms', 'HRV'], ['◌', h.respiratoryRate, '/min', 'Respiration'], ['◉', h.spo2, '%', 'SpO₂'], ['°', h.bodyTempC, '°C', 'Temp'],
      ]
      const grid = document.createElement('div')
      grid.className = 'progress-widget__bodymetrics'
      for (const [icon, value, unit, label] of metrics) {
        const item = document.createElement('span')
        item.innerHTML = `<i>${icon}</i><b>${Number.isFinite(value) ? value : '—'}</b><small>${unit}<br>${label}</small>`
        grid.append(item)
      }
      card.append(grid)
    } else if (id === 'consistency') {
      headline(card, `${data.habitRate}%`, `${data.range}-day configured lifestyle completion`)
      const bar = document.createElement('div')
      bar.className = 'progress-widget__bar'
      bar.innerHTML = `<span style="width:${data.habitRate}%"></span>`
      card.append(bar)
    } else if (id === 'cardio') {
      const total = data.cardio.reduce((a, b) => a + b, 0)
      headline(card, `${Math.round(total)} min`, `${data.range}-day total`)
      chart(card, data.cardio)
    }
    return card
  }

  function editControls(card, id, order, dashboard) {
    const index = order.indexOf(id)
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'progress-widget__remove'
    remove.setAttribute('aria-label', `Remove ${CATALOG[id].title} widget`)
    remove.textContent = '−'
    remove.onclick = () => {
      const current = order.indexOf(id)
      if (current < 0) return
      order.splice(current, 1)
      card.remove()
      syncEditMode(dashboard, order)
      persistOrder(order)
    }
    const move = document.createElement('div')
    move.className = 'progress-widget__move'
    const up = document.createElement('button')
    up.type = 'button'; up.textContent = '↑'; up.disabled = index === 0; up.dataset.widgetMove = 'up'
    up.setAttribute('aria-label', `Move ${CATALOG[id].title} widget up`)
    up.onclick = () => moveWidget(dashboard, order, id, -1)
    const down = document.createElement('button')
    down.type = 'button'; down.textContent = '↓'; down.disabled = index === order.length - 1; down.dataset.widgetMove = 'down'
    down.setAttribute('aria-label', `Move ${CATALOG[id].title} widget down`)
    down.onclick = () => moveWidget(dashboard, order, id, 1)
    move.append(up, down)
    card.append(remove, move)
  }

  function syncEditMode(dashboard, order) {
    const cards = [...dashboard.querySelectorAll('[data-widget]')]
    for (const card of cards) {
      if (!editing) {
        card.querySelector('.progress-widget__remove')?.remove()
        card.querySelector('.progress-widget__move')?.remove()
        delete card.dataset.editing
        continue
      }
      card.dataset.editing = 'true'
      if (!card.querySelector('.progress-widget__remove')) {
        editControls(card, card.dataset.widget, order, dashboard)
      }
      const index = order.indexOf(card.dataset.widget)
      const up = card.querySelector('[data-widget-move="up"]')
      const down = card.querySelector('[data-widget-move="down"]')
      if (up) up.disabled = index === 0
      if (down) down.disabled = index === order.length - 1
    }
    const edit = dashboard.querySelector('.progress-dashboard__edit')
    if (edit) edit.textContent = editing ? 'DONE' : 'EDIT'
  }

  function moveWidget(dashboard, order, id, offset) {
    const index = order.indexOf(id)
    const next = index + offset
    if (index < 0 || next < 0 || next >= order.length) return
    ;[order[index], order[next]] = [order[next], order[index]]
    const grid = dashboard.querySelector('.progress-dashboard__grid')
    if (!grid) return
    const cards = new Map([...grid.querySelectorAll('[data-widget]')].map((card) => [card.dataset.widget, card]))
    for (const widgetId of order) {
      const card = cards.get(widgetId)
      if (card) grid.append(card)
    }
    syncEditMode(dashboard, order)
    persistOrder(order)
  }

  function syncGallery(dashboard, data, order) {
    dashboard.querySelector('.progress-widget-gallery')?.remove()
    if (!galleryOpen) return
    const gallery = document.createElement('div')
    gallery.className = 'progress-widget-gallery'
    gallery.innerHTML = '<div class="progress-widget-gallery__head"><strong>Add widget</strong><span>Tap one to add it below the recap.</span></div>'
    const choices = document.createElement('div')
    choices.className = 'progress-widget-gallery__choices'
    for (const [id, spec] of Object.entries(CATALOG)) {
      if (order.includes(id)) continue
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = `+ ${spec.title}`
      button.onclick = () => {
        order.push(id)
        const grid = dashboard.querySelector('.progress-dashboard__grid')
        if (grid) grid.append(buildCard(id, data))
        galleryOpen = false
        syncGallery(dashboard, data, order)
        syncEditMode(dashboard, order)
        persistOrder(order)
      }
      choices.append(button)
    }
    if (!choices.children.length) choices.textContent = 'All widgets are already on your dashboard.'
    gallery.append(choices)
    dashboard.querySelector('.progress-dashboard__toolbar')?.after(gallery)
  }

  async function renderDashboard(screen, range) {
    const recap = screen.querySelector('.progress-recap')
    if (!recap) return
    screen.querySelectorAll('.progress-panel').forEach((node) => { node.hidden = true })
    const [data, order] = await Promise.all([model(range), widgetOrder()])

    // Data reads are asynchronous. The user may have changed view or left
    // Progress while they were in flight, so never attach a stale dashboard.
    if (!screen.isConnected
      || !screen.querySelector('[data-view="overview"][data-active="true"]')
      || screen.querySelector('.progress-recap') !== recap) return

    const dashboard = document.createElement('section')
    dashboard.className = 'progress-dashboard'
    dashboard.dataset.progressDashboard = 'true'
    const toolbar = document.createElement('div')
    toolbar.className = 'progress-dashboard__toolbar'
    const copy = document.createElement('div')
    copy.innerHTML = '<strong>Your dashboard</strong><span>Add only the signals you actually care about.</span>'
    const actions = document.createElement('div')
    actions.className = 'progress-dashboard__actions'
    const plus = document.createElement('button')
    plus.type = 'button'; plus.className = 'progress-dashboard__plus'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Add dashboard widget')
    plus.onclick = () => { galleryOpen = !galleryOpen; syncGallery(dashboard, data, order) }
    const edit = document.createElement('button')
    edit.type = 'button'; edit.className = 'progress-dashboard__edit'; edit.textContent = editing ? 'DONE' : 'EDIT'
    edit.onclick = () => {
      editing = !editing
      galleryOpen = false
      syncGallery(dashboard, data, order)
      syncEditMode(dashboard, order)
    }
    actions.append(plus, edit); toolbar.append(copy, actions); dashboard.append(toolbar)

    const grid = document.createElement('div')
    grid.className = 'progress-dashboard__grid'
    for (let index = 0; index < order.length; index += 1) {
      const id = order[index]
      const card = buildCard(id, data)
      grid.append(card)
    }
    dashboard.append(grid)
    syncGallery(dashboard, data, order)
    syncEditMode(dashboard, order)
    const existing = screen.querySelector('[data-progress-dashboard]')
    if (existing) existing.replaceWith(dashboard)
    else recap.after(dashboard)
  }

  async function enhance() {
    scheduled = false
    if (busy) {
      rerenderRequested = true
      return
    }
    const screen = mount.querySelector('.screen--history')
    if (!screen) return
    const overview = screen.querySelector('[data-view="overview"][data-active="true"]')
    const recap = screen.querySelector('.progress-recap')
    if (!overview || !recap) return
    busy = true
    try {
      const range = Number(recap.dataset.recap) || 30
      await renderDashboard(screen, range)
    } finally {
      busy = false
      if (rerenderRequested) {
        rerenderRequested = false
        schedule()
      }
    }
  }
  function schedule() {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => enhance().catch((error) => console.warn('[tempered] dashboard enhancement unavailable', error)))
  }

  const screenShown = (event) => {
    if (event?.detail?.tab === 'history') schedule()
  }
  const progressControlClicked = (event) => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.progress-range__button, .progress-views .segmented__option')) schedule()
  }
  window.addEventListener('tempered:screen-shown', screenShown)
  mount.addEventListener('click', progressControlClicked)
  schedule()
  return () => {
    window.removeEventListener('tempered:screen-shown', screenShown)
    mount.removeEventListener('click', progressControlClicked)
  }
}
