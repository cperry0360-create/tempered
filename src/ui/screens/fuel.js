/**
 * FUEL — nutrition and hydration, optimized for fast logging.
 */
import { nutritionLedger, nutritionMacroTargets, foodLibrary, searchFoods } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { dayBefore, nutritionDayStatus, openNutritionDates } from '../../domain/nutrition-review.js'

export function createFuelScreen({ storage, daily, clock }) {
  const root = el('div.screen.screen--fuel.screen--fuel-r4')
  let model = null
  let logSheetOpen = false
  let logSheetMode = 'quick'
  let secondaryOpen = false
  let screenView = 'home'
  let selectedEntry = null
  let libraryQuery = ''
  let libraryFilter = 'all'
  let cart = []
  let cartSaving = false
  let cartError = ''

  function foodIllustration(label = '') {
    const name = String(label).toLowerCase()
    if (/egg/.test(name)) return '🥚'
    if (/yogurt|oat|granola|cereal/.test(name)) return '🥣'
    if (/shake|smoothie|milk|coffee/.test(name)) return '🥤'
    if (/chicken|turkey|steak|beef|pork/.test(name)) return '🍗'
    if (/salad|vegetable/.test(name)) return '🥗'
    if (/rice|bowl|pasta|chili/.test(name)) return '🍲'
    if (/sandwich|wrap|bread/.test(name)) return '🥪'
    if (/fruit|banana|apple|berry/.test(name)) return '🍎'
    if (/pizza/.test(name)) return '🍕'
    return '🍽️'
  }
  function showHome() {
    screenView = 'home'
    selectedEntry = null
    render()
  }
  function showLibrary(filter = 'all') {
    screenView = 'library'
    libraryFilter = filter
    render()
  }
  function showEntryDetail(entry) {
    selectedEntry = entry
    screenView = 'detail'
    render()
  }
  function addToCart(food) {
    const existing = cart.find(item => item.food.description === food.description)
    if (existing) existing.quantity += 1
    else cart.push({ id: String(food.description), food, quantity: 1 })
    cartError = ''
    render()
  }
  function changeCartQuantity(id, delta) {
    cart = cart.map(item => item.id === id ? {...item, quantity: item.quantity + delta} : item)
      .filter(item => item.quantity > 0)
    cartError = ''
    render()
  }
  async function saveCart() {
    if (cartSaving || !cart.length) return
    cartSaving = true
    cartError = ''
    try {
      // Each completed write immediately leaves the cart. A later failed
      // write cannot make the next tap double-log successful items.
      while (cart.length) {
        const item = cart[0]
        const { count, lastLoggedAt, ...values } = item.food
        await daily.addNutrition(clock.today(), { ...values, portion: item.quantity })
        cart.shift()
      }
      screenView = 'home'
      await refresh()
      window.dispatchEvent(new CustomEvent('tempered:nutrition-refresh'))
    } catch {
      cartError = 'Some foods could not be logged. Saved foods were removed from this cart.'
      render()
    } finally { cartSaving = false }
  }
  let foodQuery = ''
  let showAllFoods = false
  let justAdded = null
  let justAddedPortion = 1
  let portionFood = null
  let calendarWeeksBack = 0
  let backlogExpanded = false
  let dismissedReminderFor = ''
  let customWaterOpen = false
  let customWaterAmount = ''
  let customWaterError = ''
  let customWaterBusy = false
  // The add-meal form and today's meals live here, built once by the nutrition
  // runtime and reused across re-renders so half-typed entries survive.
  const mealPanel = el('div.fuel-r4__meal-panel')

  const onFuelUpdated = (event) => {
    if (root.isConnected && (!event?.detail?.date || event.detail.date === clock.today())) refresh().catch(() => {})
  }
  const onReviewUpdated = () => { if (root.isConnected) refresh().catch(() => {}) }
  window.addEventListener('tempered:fuel-updated', onFuelUpdated)
  window.addEventListener('tempered:nutrition-review-changed', onReviewUpdated)

  async function load() {
    const todayKey = clock.today()
    const [days, todayView, profile] = await Promise.all([
      storage.getAll('dayLogs'), daily.forDate(todayKey), storage.get('profile', 'profile'),
    ])
    // Start tracking explicit closeouts from first use. Do not turn years of
    // blank historic dates into retroactive "missed" days.
    const reviewStart = profile?.nutritionReviewStartOn ?? todayKey
    if (!profile?.nutritionReviewStartOn) {
      await storage.put('profile', { ...(profile ?? { id: 'profile' }), nutritionReviewStartOn: todayKey })
    }
    model = {
      day: days.find((day) => day.date === todayKey) ?? { date: todayKey },
      todayView,
      days,
      reviewStart,
      reminderDismissed: profile?.nutritionReminderDismissedOn === todayKey,
      foods: foodLibrary(days, 4),
    }
  }

  async function addWater(amount) {
    await daily.logAt(clock.today(), 'water', amount)
    await refresh()
  }

  function toggleCustomWater() {
    customWaterOpen = !customWaterOpen
    customWaterError = ''
    render()
    if (customWaterOpen) root.querySelector('[data-water-custom-input]')?.focus()
  }

  async function logCustomWater(event) {
    event.preventDefault()
    if (customWaterBusy) return
    const amount = Number(customWaterAmount)
    if (!Number.isFinite(amount) || amount < 0.1 || amount > 200) {
      customWaterError = 'Enter 0.1–200 oz.'
      const error = root.querySelector('[data-water-custom-error]')
      if (error) error.textContent = customWaterError
      return
    }
    customWaterBusy = true
    const save = root.querySelector('[data-water-custom-save]')
    if (save) save.disabled = true
    try {
      await daily.logAt(clock.today(), 'water', amount)
      customWaterOpen = false
      customWaterAmount = ''
      customWaterError = ''
      await refresh()
    } catch (error) {
      customWaterError = 'Could not save water. Try again.'
      const status = root.querySelector('[data-water-custom-error]')
      if (status) status.textContent = customWaterError
      if (save) save.disabled = false
    } finally {
      customWaterBusy = false
    }
  }

  async function quickLog(food, portion = 1) {
    const { count, lastLoggedAt, ...values } = food
    await daily.addNutrition(clock.today(), portion === 1 ? values : { ...values, portion })
    justAdded = food.description
    justAddedPortion = portion
    portionFood = null
    await refresh()
    window.dispatchEvent(new CustomEvent('tempered:nutrition-refresh'))
    setTimeout(() => { if (justAdded === food.description) { justAdded = null; if (root.isConnected) render() } }, 2000)
  }

  function reviewDate(date) {
    window.dispatchEvent(new CustomEvent('tempered:open-nutrition', { detail: { date } }))
  }

  async function closeToday() {
    const state = model.day?.nutritionStatus === 'complete' ? 'partial' : 'complete'
    await daily.setNutritionStatus(clock.today(), state)
    await refresh()
    window.dispatchEvent(new CustomEvent('tempered:nutrition-refresh'))
  }

  async function dismissReminder() {
    const profile = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
    await storage.put('profile', { ...profile, nutritionReminderDismissedOn: clock.today() })
    dismissedReminderFor = clock.today()
    await refresh()
  }

  function dateOfWeek(offset) {
    const today = new Date(clock.today() + 'T12:00:00Z')
    const weekday = (today.getUTCDay() + 6) % 7
    today.setUTCDate(today.getUTCDate() - weekday - offset * 7)
    return today
  }

  function diaryCalendar() {
    const today = clock.today()
    const byDate = new Map(model.days.map((day) => [day.date, day]))
    const start = dateOfWeek(calendarWeeksBack)
    const previous = el('button.fuel-diary__nav', {
      type: 'button', 'aria-label': 'Previous week',
      onclick: () => { calendarWeeksBack++; render() },
    }, ['‹'])
    const next = el('button.fuel-diary__nav', {
      type: 'button', disabled: calendarWeeksBack === 0,
      'aria-label': 'Next week',
      onclick: () => { calendarWeeksBack = Math.max(0, calendarWeeksBack - 1); render() },
    }, ['›'])
    const week = Array.from({ length: 7 }, (_, index) => {
      const at = new Date(start)
      at.setUTCDate(at.getUTCDate() + index)
      const date = at.toISOString().slice(0, 10)
      const day = byDate.get(date)
      const status = nutritionDayStatus(day, date, model.reviewStart, today)
      const todayItem = date === today
      // Closed is a checked diary, not a day under its calorie target.
      // Amber means entered but unfinished; red X means the day passed
      // without entries. Never label a future day as missed.
      const visual = status === 'closed' ? 'closed'
        : (status === 'open' || (todayItem && status === 'unlogged')) ? 'partial'
          : status === 'unlogged' && date < today ? 'missed' : 'neutral'
      const symbol = visual === 'closed' ? '✓'
        : visual === 'partial' ? '◐' : visual === 'missed' ? '×' : '·'
      const amount = Number(day?.calories)
      const hasCalories = Number.isFinite(amount) &&
        (day?.caloriesLogged || day?.nutritionLogged || (day?.nutritionEntries?.length ?? 0) > 0)
      return el('button.fuel-diary__day.food-v3__day', {
        type: 'button', disabled: date > today,
        dataset: {
          diaryDate: date, state: status, visual,
          selected: String(todayItem && calendarWeeksBack === 0),
        },
        'aria-label': date + ': ' + (visual === 'closed' ? 'food diary complete'
          : visual === 'partial' ? 'food diary still open'
            : visual === 'missed' ? 'no food entered; needs review' : 'no diary status') +
          (hasCalories ? ', ' + Math.round(amount) + ' calories' : ''),
        onclick: () => reviewDate(date),
      }, [
        el('span.fuel-diary__weekday', { text: ['M','T','W','T','F','S','S'][index] }),
        el('strong', { text: String(at.getUTCDate()) }),
        el('span.fuel-diary__marker.food-v3__day-icon', { 'aria-hidden': 'true', text: symbol }),
        el('small.food-v3__day-cal', { text: hasCalories ? Math.round(amount).toLocaleString() : '—' }),
      ])
    })
    const left = start.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6)
    const right = end.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
    return el('section.fuel-diary.food-v3__diary', { dataset: { diaryCalendar: 'true' } }, [
      el('div.fuel-diary__heading', {}, [
        el('div', {}, [
          el('span.fuel-diary__eyebrow', { text: 'DAILY CHECK-IN' }),
          el('h2', { text: '7-day food diary' }),
        ]),
        el('span.food-v3__week-label', { text: left === right
          ? left + ' ' + start.getUTCFullYear() : left + ' – ' + right }),
      ]),
      el('div.fuel-diary__week', {}, [previous, ...week, next]),
    ])
  }

  function openDaysCard() {
    const today = clock.today()
    const open = openNutritionDates(model.days, today, model.reviewStart)
    const yesterday = dayBefore(today)
    const lastDay = open.find((row) => row.date === yesterday)
    const notice = lastDay && !model.reminderDismissed && dismissedReminderFor !== today
      ? el('section.fuel-diary__reminder', { dataset: { nutritionReminder: 'true' } }, [
        el('div', {}, [
          el('strong', { text: 'Yesterday’s food diary is not closed' }),
          el('p', { text: 'Add anything you have not logged, then mark the day complete. Your totals are not judged against your budget.' }),
        ]),
        el('div.fuel-diary__reminder-actions', {}, [
          el('button', { type: 'button', dataset: { reviewYesterday: yesterday },
            onclick: () => reviewDate(yesterday) }, ['Review yesterday']),
          el('button', { type: 'button', onclick: dismissReminder }, ['Later']),
        ]),
      ]) : null
    return [
      notice,
      open.length > 0 && el('section.fuel-diary__backlog.food-v3__backlog', {
        dataset: { openNutritionDays: String(open.length) },
      }, [
        el('div.fuel-diary__backlog-head', {}, [
          el('button.food-v3__review-older', {
            type: 'button', onclick: () => { backlogExpanded = !backlogExpanded; render() },
            'aria-expanded': String(backlogExpanded),
          }, [backlogExpanded ? 'Hide earlier diaries' : 'Review earlier diaries']),
        ]),
        backlogExpanded && el('div.fuel-diary__backlog-days', {}, open.map((row) =>
          el('button', { type: 'button', dataset: { backlogDate: row.date },
            onclick: () => reviewDate(row.date) },
          [row.date, row.status === 'unlogged' ? ' · No entries' : ' · Not closed']))),
      ]),
    ].filter(Boolean)
  }

  function dailyDateLabel() {
    const [year, month, day] = clock.today().split('-').map(Number)
    return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric',
    })
  }

  // The data-entry runtime is retained; only its presentation becomes a sheet.
  // It stays mounted across refreshes, so unsaved inputs survive updates.
  function openLogSheet(mode = 'quick') {
    logSheetOpen = true
    logSheetMode = mode
    render()
    requestAnimationFrame(() => {
      const selector = mode === 'search' ? '.fuel-food__search'
        : mode === 'manual' ? '[data-entry="nutrition_description"]'
          : '.food-next__sheet-close'
      root.querySelector(selector)?.focus({ preventScroll: true })
      if (mode === 'journal') root.querySelector('.food-next__sheet [data-nutrition-history]')?.scrollIntoView({
        behavior: 'auto', block: 'start',
      })
    })
  }

  function closeLogSheet() {
    if (!logSheetOpen) return
    logSheetOpen = false
    render()
    root.querySelector('[data-food-open-log]')?.focus({ preventScroll: true })
  }

  function focusMealEntry() { openLogSheet('manual') }
  function openFoodSearch() { openLogSheet('search') }

  function recentFoodsStrip() {
    const foods = model.foods.top.slice(0, 4)
    if (foods.length === 0) return null
    return el('section.food-v2__recents', {}, [
      el('div.food-v2__section-title', {}, [
        el('h2', { text: 'Frequent meals' }),
        el('button.food-v2__more-toggle', { type: 'button', onclick: openFoodSearch }, ['See all']),
      ]),
      el('div.food-v2__recent-grid', {}, foods.map((food, index) =>
        el('button.food-v2__recent', {
          type: 'button', dataset: { recentFood: food.description },
          'aria-label': 'Log a serving of ' + food.description,
          onclick: () => quickLog(food),
        }, [
          el('span.food-v2__recent-graphic', { 'aria-hidden': 'true' }, [icon('food')]),
          el('strong', { text: food.description }),
          el('small', { text: Math.round(food.calories ?? 0) + ' kcal · + Log' }),
        ]))),
    ])
  }

  function beachCutStrip() {
    const today = Date.parse(clock.today() + 'T12:00:00Z')
    const end = Date.parse('2026-11-26T12:00:00Z')
    const start = Date.parse('2026-11-02T12:00:00Z')
    if (today > end + 86400000 || today < start - 14 * 86400000) return null
    const days = Math.max(0, Math.ceil((end - today) / 86400000))
    const progress = Math.max(0, Math.min(100, Math.round((today - start) / (end - start) * 100)))
    const windowStart = new Date(today)
    windowStart.setUTCDate(windowStart.getUTCDate() - 14)
    const weightStart = windowStart.toISOString().slice(0, 10)
    const weights = model.days
      .filter(day => day.date <= clock.today() && day.date >= weightStart
        && Number.isFinite(day.bodyMetrics?.weight) && day.bodyMetrics.weight > 0)
      .sort((left, right) => left.date.localeCompare(right.date))
    let pace = 'Trend pending'
    let detail = 'Log weight to see your trend'
    if (weights.length >= 4) {
      const first = weights.slice(0, 2), last = weights.slice(-2)
      const span = (Date.parse(last.at(-1).date + 'T12:00:00Z')
        - Date.parse(first[0].date + 'T12:00:00Z')) / 86400000
      if (span >= 7) {
        const firstMean = first.reduce((sum, row) => sum + row.bodyMetrics.weight, 0) / first.length
        const lastMean = last.reduce((sum, row) => sum + row.bodyMetrics.weight, 0) / last.length
        const lossPerWeek = (firstMean - lastMean) * 7 / span
        pace = lossPerWeek >= 0.4 && lossPerWeek <= 1.4 ? 'On track'
          : lossPerWeek > 1.4 ? 'Losing too quickly' : 'Review pace'
        detail = 'About ' + Math.abs(lossPerWeek).toFixed(1)
          + ' lb/week ' + (lossPerWeek >= 0 ? 'down' : 'up')
      }
    }
    return el('section.food-v2__beach.food-v3__beach', {
      'aria-label': 'Thanksgiving beach-cut countdown',
    }, [
      el('div.food-v3__beach-content', {}, [
        el('span.food-v3__beach-eyebrow', { text: 'CANCÚN · BEACH CUT' }),
        el('strong', { text: String(days) }),
        el('span.food-v3__beach-days', { text: days === 1 ? 'day to go' : 'days to go' }),
        el('span.food-v3__beach-status', { dataset: { pace: pace.toLowerCase().replace(/[^a-z]+/g, '-') }, text: pace }),
        el('small.food-v3__beach-detail', { text: detail }),
      ]),
      el('div.food-v2__beach-progress', {
        role: 'progressbar', 'aria-label': 'Beach Cut time elapsed',
        'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(progress),
      }, [el('span', { style: 'width:' + progress + '%' })]),
    ])
  }

  function foodMeta(food) {
    const parts = [`${Math.round(food.calories ?? 0)} kcal`]
    if (Number.isFinite(food.proteinGrams)) parts.push(`${Math.round(food.proteinGrams)} g protein`)
    if (food.count > 1) parts.push(`${food.count}×`)
    return parts.join(' · ')
  }

  const PORTIONS = [[0.5, '½'], [1.5, '1½'], [2, '2'], [3, '3']]

  function foodRow(food) {
    const added = justAdded === food.description
    const open = portionFood === food.description
    return el('div.fuel-food', { dataset: { food: food.description, added: String(added), open: String(open) } }, [
      el('button.fuel-food__copy', {
        type: 'button', 'aria-expanded': String(open), dataset: { foodToggle: food.description },
        'aria-label': `${food.description}, choose a portion`,
        onclick: () => { portionFood = open ? null : food.description; render() },
      }, [
        el('span.fuel-food__name', { text: food.description }),
        el('span.fuel-food__meta', { text: added ? (justAddedPortion === 1 ? 'Added to today' : `Added ${PORTIONS.find(([n]) => n === justAddedPortion)?.[1] ?? justAddedPortion}× to today`) : foodMeta(food) }),
      ]),
      el('button.fuel-food__add', {
        type: 'button', 'aria-label': `Log one serving of ${food.description}`, dataset: { foodAdd: food.description },
        onclick: () => quickLog(food),
      }, [added ? '✓' : '+']),
      open && el('div.fuel-food__portions', { role: 'group', 'aria-label': 'Portion' }, PORTIONS.map(([portion, label]) =>
        el('button.fuel-food__portion', {
          type: 'button', dataset: { portion: String(portion) },
          'aria-label': `Log ${label} of ${food.description}, ${Math.round((food.calories ?? 0) * portion)} kcal`,
          onclick: () => quickLog(food, portion),
        }, [label]))),
    ].filter(Boolean))
  }

  function startNewMeal(name) {
    const description = mealPanel.querySelector('[data-entry="nutrition_description"]')
    if (!description) return
    description.value = name
    description.dispatchEvent(new Event('input', { bubbles: true }))
    const calories = mealPanel.querySelector('[data-entry="nutrition_calories"]')
    calories?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    calories?.focus()
  }

  function foodResults() {
    const all = model.foods.all
    if (all.length === 0) return [
      el('p.food-v3__search-empty', { text: 'Foods you log appear here when you search or browse.' }),
    ]
    if (!foodQuery.trim() && !showAllFoods) return []
    const matches = foodQuery.trim() ? searchFoods(all, foodQuery) : all
    if (!matches.length) return [
      el('p.food-v3__search-empty', { text: foodQuery.trim()
        ? 'No previously logged food found.' : 'Your logged foods will appear here.' }),
      foodQuery.trim() && el('button.fuel-food__more', {
        type: 'button', dataset: { foodNew: foodQuery.trim() },
        onclick: () => startNewMeal(foodQuery.trim()),
      }, ['Add "' + foodQuery.trim() + '" as a new food']),
    ].filter(Boolean)
    return [
      el('div.fuel-food__list.food-v3__search-results', {},
        matches.slice(0, showAllFoods ? 50 : 8).map(foodRow)),
      matches.length > (showAllFoods ? 50 : 8) && el('button.fuel-food__more', {
        type: 'button', onclick: () => { showAllFoods = true; render() },
      }, ['More matching foods']),
    ].filter(Boolean)
  }

  function foodsCard() {
    const results = el('div.fuel-food__results', {}, foodResults())
    const input = el('input.fuel-food__search.food-v3__search-input', {
      type: 'search', placeholder: 'Search anything you have logged…',
      value: foodQuery, autocomplete: 'off', autocapitalize: 'off',
      spellcheck: false, enterkeyhint: 'search',
      'aria-label': 'Find a previously logged food',
      oninput: event => {
        foodQuery = event.target.value
        replace(results, foodResults())
      },
    })
    return el('section.food-v3__search', { dataset: { foodSearch: 'true' } }, [
      el('div.food-v3__search-line', {}, [
        icon('search'),
        input,
        el('button.food-v3__browse', {
          type: 'button', 'aria-expanded': String(showAllFoods),
          onclick: () => { showAllFoods = !showAllFoods; render() },
        }, [showAllFoods ? 'Hide' : 'Browse']),
      ]),
      results,
    ])
  }

  function number(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  function percent(value, target) {
    return target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0
  }

  function energyRing(progress, remaining) {
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('class', 'fuel-r4__ring-svg')
    svg.setAttribute('viewBox', '0 0 120 120')
    svg.setAttribute('aria-hidden', 'true')
    for (const className of ['fuel-r4__ring-track', 'fuel-r4__ring-arc']) {
      const circle = document.createElementNS(ns, 'circle')
      circle.setAttribute('class', className)
      circle.setAttribute('cx', '60')
      circle.setAttribute('cy', '60')
      circle.setAttribute('r', '50')
      circle.setAttribute('pathLength', '100')
      if (className.endsWith('arc')) {
        circle.setAttribute('stroke-dasharray', '100')
        circle.setAttribute('stroke-dashoffset', String(100 - progress))
      }
      svg.append(circle)
    }
    return el('div.fuel-r4__ring', { dataset: { progress: String(Math.round(progress)) } }, [
      svg,
      el('div.fuel-r4__ring-copy', {}, [
        el('strong', { text: Math.round(remaining).toLocaleString() }),
        el('span', { text: 'kcal consumed' }),
      ]),
    ])
  }

  function render() {
    if (!model) return
    const day = model.day ?? {}
    const activities = [...(model.todayView?.logged ?? []), ...(model.todayView?.outstanding ?? [])]
    const goal = (id, fallback) => {
      const value = number(activities.find(item => item.id === id)?.dailyCap)
      return value > 0 ? value : fallback
    }
    const calorieGoal = goal('calories_logged', 2100)
    const proteinGoal = goal('protein_target', 135)
    const waterGoal = goal('water', 120)
    const calories = number(day.calories)
    const protein = number(day.proteinGrams)
    const water = number(day.waterOz)
    const ledger = nutritionLedger(day)
    const macroTargets = nutritionMacroTargets(calorieGoal, proteinGoal)
    const energyProgress = percent(calories, calorieGoal)
    const closed = day.nutritionStatus === 'complete'
    const waterProgress = percent(water, waterGoal)
    const allFoods = model.foods.all

    const emoji = name => el('span.forge-food__thumb', {
      'aria-hidden': 'true', text: foodIllustration(name),
    })
    const shortNumber = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
    const macroBar = (name, value, target) => el('div.forge-food__macro', {}, [
      el('div.forge-food__macro-copy', {}, [
        el('span', { text: name }),
        el('strong', { text: Math.round(value) + ' / ' + Math.round(target) + 'g' }),
      ]),
      el('div.forge-food__bar', {
        role:'progressbar', 'aria-label': name + ' progress',
        'aria-valuemin':'0','aria-valuemax':String(Math.round(target)),
        'aria-valuenow':String(Math.round(Math.min(value,target))),
      }, [el('i', { style:'width:' + percent(value,target) + '%' })]),
    ])
    const title = (label, description, action = null) => el('div.forge-food__section-heading', {}, [
      el('div', {}, [
        el('span.forge-food__overline', { text: label }),
        el('h2', { text: description }),
      ]),
      action,
    ])
    const back = (label, fn = showHome) => el('button.forge-food__back', {
      type:'button', onclick:fn,
    }, [icon('chevron-right'), label])
    const localTime = (iso) => {
      const date = new Date(iso)
      return Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(date)
        : ''
    }
    const lastWeight = [...model.days]
      .filter(item => item.date <= clock.today() && Number(item.bodyMetrics?.weight) > 0)
      .sort((a,b) => b.date.localeCompare(a.date))[0]?.bodyMetrics?.weight
    const statCard = (label, value, suffix, sub, glyph, action = null) =>
      el(action ? 'button.forge-food__stat' : 'div.forge-food__stat', action
        ? {type:'button', onclick:action} : {}, [
        el('span.forge-food__stat-label', {}, [icon(glyph), ' ', label]),
        el('strong', {}, [value, el('small', {text:suffix})]),
        el('span.forge-food__stat-sub', {text:sub}),
      ])
    const meat = ledger.entries.slice().sort((a,b) => b.loggedAt.localeCompare(a.loggedAt))
    const groups = [
      { label:'Breakfast', id:0, entries:[] },
      { label:'Lunch', id:1, entries:[] },
      { label:'Dinner', id:2, entries:[] },
      { label:'Snacks', id:3, entries:[] },
    ]
    for (const entry of meat) {
      const hour = new Date(entry.loggedAt).getHours()
      const group = hour >= 5 && hour < 11 ? groups[0]
        : hour >= 11 && hour < 16 ? groups[1] : hour >= 16 && hour < 21 ? groups[2] : groups[3]
      group.entries.push(entry)
    }

    const nav = el('nav.forge-food__nav', {'aria-label':'Food shortcuts'}, [
      el('button', {type:'button',onclick:()=>reviewDate(clock.today())}, [icon('history'), ' History']),
      el('button', {type:'button',onclick:()=>showLibrary()}, [icon('search'), ' Food Library']),
      el('button', {type:'button',onclick:()=>globalThis.tempered?.app?.show?.('settings')}, [icon('gear'), ' Edit Goals']),
      el('button', {type:'button',onclick:()=>openLogSheet('manual')}, [icon('plus'), ' Quick Calories']),
    ])
    const titleBar = el('header.forge-food__header', {}, [
      el('div.forge-food__brand', {}, [
        el('span.forge-food__brandmark', {'aria-hidden':'true'}, ['ᛟ']),
        el('div',{}, [
          el('span.forge-food__brand-label',{text:'TEMPERED'}),
          el('h1',{text:'Fuel'}),
        ]),
      ]),
      el('button.forge-food__date', {
        type:'button',dataset:{foodDate:clock.today()},onclick:()=>reviewDate(clock.today()),
      }, [icon('calendar'),dailyDateLabel()]),
    ])
    const hero = el('section.forge-food__hero',{'aria-label':'Daily calories and nutrients'},[
      el('div.forge-food__hero-top', {}, [
        el('span.forge-food__overline',{text:'TODAY / NUTRITION'}),
        el('span.forge-food__hero-pct',{text:Math.round(energyProgress)+'% of goal'}),
      ]),
      el('div.forge-food__hero-grid', {}, [
        el('div.forge-food__hero-numbers',{},[
          el('div.forge-food__hero-number',{},[
            el('small',{text:'Calories consumed'}),
            el('strong',{text:Math.round(calories).toLocaleString()}),
            el('span',{text:'of '+Math.round(calorieGoal).toLocaleString()+' kcal target'}),
          ]),
          el('div.forge-food__hero-number',{},[
            el('small',{text:'Protein consumed'}),
            el('strong',{text:Math.round(protein).toLocaleString()+' g'}),
            el('span',{text:'of '+Math.round(proteinGoal).toLocaleString()+' g target'}),
          ]),
        ]),
        el('div.forge-food__hero-ring',{},[energyRing(energyProgress,calories)]),
        el('div.forge-food__hero-macros',{},[
          macroBar('Carbs',ledger.totals.carbs,macroTargets.carbs),
          macroBar('Fat',ledger.totals.fat,macroTargets.fat),
          macroBar('Fiber',ledger.totals.fiber,macroTargets.fiber),
        ]),
      ]),
    ])
    const stats = el('div.forge-food__stats',{'aria-label':'Daily health signals'},[
      statCard('Weight',Number(lastWeight)>0?shortNumber(lastWeight):'—',
        Number(lastWeight)>0?' lbs':'','Latest logged', 'body'),
      statCard('Water',shortNumber(water),' oz',
        'of '+Math.round(waterGoal)+' oz','water',
        ()=>{secondaryOpen=true;render();requestAnimationFrame(()=>root.querySelector('.forge-food__secondary')?.scrollIntoView({block:'center',behavior:'smooth'}))}),
      statCard('Steps',Number.isFinite(day.steps)?Math.round(day.steps).toLocaleString():'—','',
        Number.isFinite(day.steps)?'Today':'Not logged','steps'),
    ])
    const mealRows = groups.filter(group=>group.entries.length).flatMap(group=>[
      el('div.forge-food__meal-header',{},[
        el('span',{text:group.label}),
        el('small',{text:Math.round(group.entries.reduce((n,row)=>n+Number(row.calories||0),0)).toLocaleString()+' kcal'}),
      ]),
      ...group.entries.map(entry => el('button.forge-food__meal', {
        type:'button',onclick:()=>showEntryDetail(entry),
        'aria-label':'View '+(entry.description||'Food')+' details',
      },[
        emoji(entry.description),
        el('span.forge-food__meal-info',{},[
          el('strong',{text:entry.description||'Food entry'}),
          el('small',{text:localTime(entry.loggedAt)+' · '+shortNumber(entry.proteinGrams)+'g protein'}),
        ]),
        el('span.forge-food__meal-kcal',{text:Math.round(entry.calories||0).toLocaleString()+' kcal'}),
        icon('chevron-right'),
      ])),
    ])
    const journal = el('section.forge-food__journal',{},[
      title('FOOD JOURNAL','Today’s Meals',el('button.forge-food__text-action',{
        type:'button',onclick:()=>openLogSheet('journal'),
      },['View all ',icon('chevron-right')])),
      el('div.forge-food__meal-list',{},[
        ...mealRows,
        !meat.length && el('div.forge-food__empty',{},[
          el('strong',{text:'Your first meal goes here'}),
          el('span',{text:'Log a meal to start today’s journal.'}),
        ]),
        ledger.hasCarryover && el('button.forge-food__carryover',{
          type:'button',onclick:()=>openLogSheet('journal'),
        },['Earlier logged totals are included',icon('chevron-right')]),
      ]),
    ])
    const heroActions = el('div.forge-food__cta-bar',{},[
      el('button.forge-food__primary', {
        type:'button',dataset:{foodOpenLog:'true'},onclick:()=>showLibrary(),
      },[icon('plus'),' Log Food']),
      el('button.forge-food__small-cta',{
        type:'button',onclick:()=>openLogSheet('manual'),
        'aria-label':'Manual food entry',
      },[icon('plus')]),
    ])
    const recentFoodCard = el('div.forge-food__frequent',{},[
      title('ONE-TAP REPEAT','Frequent meals',el('button.forge-food__text-action',{
        type:'button',onclick:()=>showLibrary('frequent'),
      },['See all ',icon('chevron-right')])),
      el('div.forge-food__frequent-grid',{},model.foods.top.slice(0,4).map(food=>
        el('button.forge-food__frequent-item',{type:'button',
          onclick:()=>addToCart(food), 'aria-label':'Add '+food.description+' to food cart',
        },[
          emoji(food.description),
          el('strong',{text:food.description}),
          el('small',{text:Math.round(food.calories||0)+' kcal · '+Math.round(food.proteinGrams||0)+'g protein'}),
          el('span.forge-food__frequent-add',{'aria-hidden':'true'},[icon('plus')]),
        ])
      )),
    ])
    const waterCard = el('section.fuel-r4__card.fuel-r4__water.food-v2__water', {}, [
      el('div.food-v2__section-title', {}, [
        el('h2', {}, [icon('water'), ' Water']),
      ]),
      el('div.food-v2__water-main', {}, [
        el('strong', { text: Number(water.toFixed(2)).toLocaleString() + ' oz' }),
        el('small', { text: 'of ' + Math.round(waterGoal) + ' oz' }),
      ]),
      el('div.fuel-r4__bar', {}, [el('i', { style: 'width:' + waterProgress + '%' })]),
      el('div.fuel-r4__water-actions', {}, [
        ...[8, 12, 25].map(amount => el('button.fuel-r4__secondary', {
          type: 'button', onclick: () => addWater(amount),
        }, ['+' + amount])),
        el('button.fuel-r4__secondary.fuel-r4__water-custom-toggle', {
          type: 'button',
          dataset: { waterCustomToggle: 'true' },
          'aria-expanded': String(customWaterOpen),
          'aria-controls': 'fuel-water-custom-entry',
          onclick: toggleCustomWater,
        }, [customWaterOpen ? 'Close' : 'Custom']),
      ]),
      customWaterOpen && el('form.fuel-r4__water-custom-form', {
        id: 'fuel-water-custom-entry',
        noValidate: true,
        dataset: { waterCustomForm: 'true' },
        onsubmit: logCustomWater,
      }, [
        el('label.fuel-r4__water-custom-label', { htmlFor: 'fuel-water-custom-oz', text: 'Add water (oz)' }),
        el('div.fuel-r4__water-custom-fields', {}, [
          el('input.fuel-r4__water-custom-input', {
            id: 'fuel-water-custom-oz',
            type: 'number', inputMode: 'decimal', min: '0.1', max: '200', step: 'any',
            value: customWaterAmount, placeholder: 'e.g. 16.9',
            dataset: { waterCustomInput: 'true' },
            'aria-label': 'Custom water amount in ounces',
            oninput: (event) => {
              customWaterAmount = event.target.value
              customWaterError = ''
              const error = root.querySelector('[data-water-custom-error]')
              if (error) error.textContent = ''
            },
          }),
          el('button.fuel-r4__water-custom-save', {
            type: 'submit', disabled: customWaterBusy,
            dataset: { waterCustomSave: 'true' },
          }, ['Add water']),
        ]),
        el('small.fuel-r4__water-custom-error', {
          dataset: { waterCustomError: 'true' },
          role: 'status', text: customWaterError,
        }),
      ]),
    ])

    const secondary = el('details.forge-food__secondary',{
      open:secondaryOpen,ontoggle:event=>{secondaryOpen=event.target.open},
    },[
      el('summary',{},['Water, beach-cut plan & food diary review',icon('chevron-down')]),
      el('div.forge-food__secondary-body',{},[waterCard,beachCutStrip(),...openDaysCard()]),
    ])
    const renderHome = () => [
      titleBar,nav,
      el('div.forge-food__week-rail',{},[diaryCalendar()]),
      el('div.forge-food__canvas',{},[
        el('div.forge-food__main',{},[hero,stats,secondary]),
        el('div.forge-food__aside',{},[journal,recentFoodCard]),
      ]),
      heroActions,
    ]

    const libraryRows = () => {
      const base = libraryFilter === 'frequent' ? model.foods.top
        : libraryFilter === 'recent' ? [...allFoods].sort((a,b)=>b.lastLoggedAt.localeCompare(a.lastLoggedAt))
          : allFoods
      const matching = searchFoods(base,libraryQuery)
      return matching.length
        ? matching.slice(0,100).map(food=>el('div.forge-food__library-row',{},[
            emoji(food.description),
            el('div.forge-food__library-copy',{},[
              el('strong',{text:food.description}),
              el('span',{text:Math.round(food.calories||0)+' kcal · '+Math.round(food.proteinGrams||0)+'g protein'}),
            ]),
            el('button.forge-food__library-add',{type:'button',
              'aria-label':'Add '+food.description+' to log cart',
              onclick:()=>addToCart(food),
            },[icon('plus')]),
          ]))
        : [el('div.forge-food__empty',{},[
          el('strong',{text:libraryQuery?'No matching foods yet':'No saved foods yet'}),
          el('span',{text:'Foods you log are saved here automatically.'}),
          el('button.forge-food__text-action',{type:'button',onclick:()=>openLogSheet('manual')},['Add manually']),
        ])]
    }
    const libraryList = el('div.forge-food__library-list',{},libraryRows())
    const cartItems = el('div.forge-food__cart-items',{},cart.map(item=>
      el('div.forge-food__cart-row',{},[
        emoji(item.food.description),
        el('div.forge-food__cart-copy',{},[
          el('strong',{text:item.food.description}),
          el('small',{text:Math.round(item.food.calories||0)*item.quantity+' kcal'}),
        ]),
        el('div.forge-food__cart-quantity',{},[
          el('button',{type:'button',onclick:()=>changeCartQuantity(item.id,-1),'aria-label':'Remove one serving'},[icon('minus')]),
          el('span',{text:String(item.quantity)}),
          el('button',{type:'button',onclick:()=>changeCartQuantity(item.id,1),'aria-label':'Add one serving'},[icon('plus')]),
        ]),
      ])
    ))
    const cartCalories = cart.reduce((sum,item)=>sum+Number(item.food.calories||0)*item.quantity,0)
    const cartCount = cart.reduce((sum,item)=>sum+item.quantity,0)
    const cartPanel = el('section.forge-food__cart',{},[
      el('div.forge-food__cart-head',{},[
        el('h2',{},[icon('food'),' Log Cart']),
        el('strong',{text:Math.round(cartCalories).toLocaleString()+' kcal'}),
      ]),
      cartItems,
      cartError && el('p.forge-food__cart-error',{role:'status',text:cartError}),
      el('button.forge-food__primary',{type:'button',disabled:cartSaving || !cartCount,
        onclick:saveCart,
        dataset:{cartLog:'true'},
      },[cartCount?'Log '+cartCount+' item'+(cartCount===1?'':'s')+' ('+Math.round(cartCalories)+' kcal)':'Choose foods to log']),
    ])
    const renderLibrary = () => [
      el('header.forge-food__inner-header',{},[
        back('Back to Fuel'),
        el('span.forge-food__brand-label',{text:'TEMPERED / FOOD'}),
        el('h1',{text:'Food Library'}),
      ]),
      el('nav.forge-food__filters',{'aria-label':'Browse saved foods'},[
        ...[['all','All Foods'],['frequent','Frequent'],['recent','Recent']].map(([filter,label])=>
          el('button',{type:'button','aria-pressed':String(libraryFilter===filter),
            onclick:()=>{libraryFilter=filter;render()},
          },[label])),
      ]),
      el('label.forge-food__search',{},[
        icon('search'),
        el('input',{type:'search',value:libraryQuery,
          placeholder:'Search foods you’ve logged…','aria-label':'Search saved foods',
          oninput:event=>{libraryQuery=event.target.value;replace(libraryList,libraryRows())},
        }),
      ]),
      el('div.forge-food__library-layout',{},[
        el('div.forge-food__library-col',{},[
          libraryList,
          recentFoodCard,
          el('section.forge-food__quick-log',{},[
            title('QUICK LOG','Other ways to log'),
            el('div.forge-food__quick-grid',{},[
              el('button',{type:'button',onclick:()=>openLogSheet('manual')},[icon('food'),' Manual entry']),
              el('button',{type:'button',onclick:()=>openLogSheet('manual')},[icon('plus'),' Meal photo or import']),
            ]),
          ]),
        ]),
        cartPanel,
      ]),
    ]
    const detail = selectedEntry
    const renderDetail = () => [
      el('header.forge-food__inner-header',{},[
        back('Back to Fuel'),
        el('span.forge-food__brand-label',{text:'TEMPERED / MEAL'}),
        el('h1',{text:'Meal Details'}),
      ]),
      detail && el('div.forge-food__detail-layout',{},[
        el('section.forge-food__detail-card',{},[
          el('div.forge-food__detail-thumb',{'aria-hidden':'true',text:foodIllustration(detail.description)}),
          el('span.forge-food__overline',{text:localTime(detail.loggedAt)+' · Today'}),
          el('h2',{text:detail.description||'Food entry'}),
          el('div.forge-food__detail-calories',{},[
            el('strong',{text:shortNumber(detail.calories)}),
            el('span',{text:'kcal'}),
          ]),
          el('div.forge-food__detail-macros',{},[
            ...[['Protein',detail.proteinGrams],['Carbs',detail.carbsGrams],['Fat',detail.fatGrams],['Fiber',detail.fiberGrams]].map(([label,value])=>
              el('div',{},[el('strong',{text:shortNumber(value)+' g'}),el('span',{text:label})])),
          ]),
          el('div.forge-food__detail-actions',{},[
            el('button',{type:'button',onclick:()=>openLogSheet('journal')},[icon('history'),' View saved history']),
            el('button',{type:'button',onclick:()=>{showLibrary();libraryQuery=detail.description}},[icon('plus'),' Log again']),
          ]),
        ]),
        cartPanel,
      ]),
    ]

    // Runtime remains mounted even when its parent is not visible. This keeps
    // typed forms intact across refreshes, and preserves the original AI tools.
    const foodSearch = foodsCard()
    const recents = recentFoodsStrip()
    const sheet = el('div.forge-food__sheet-shell',{
      hidden:!logSheetOpen,dataset:{foodLogSheet:String(logSheetOpen)},
      onkeydown:event=>{if(event.key==='Escape')closeLogSheet()},
    },[
      el('button.forge-food__shade',{type:'button',onclick:closeLogSheet,
        'aria-label':'Close food logging'}),
      el('section.forge-food__sheet',{role:'dialog','aria-modal':'true',
        'aria-label':'Food entry',dataset:{mode:logSheetMode},
      },[
        el('div.forge-food__sheet-heading',{},[
          el('div',{},[
            el('span.forge-food__overline',{text:'TEMPERED / QUICK LOG'}),
            el('h2',{text:logSheetMode==='journal'?'Meal history':'Log Food'}),
          ]),
          el('button.forge-food__sheet-close',{type:'button',
            onclick:closeLogSheet,'aria-label':'Close food entry'},[icon('x')]),
        ]),
        el('div.forge-food__sheet-scroll',{},[foodSearch,mealPanel,recents]),
      ]),
    ])
    replace(root,[
      ...(screenView==='library'?renderLibrary()
        :screenView==='detail'?renderDetail():renderHome()),
      sheet,
    ])
    mealPanel.dataset.date = clock.today()
    window.dispatchEvent(new CustomEvent('tempered:mount-nutrition-panel',{
      detail:{slot:mealPanel,date:clock.today(),foodSearch,recents},
    }))
  }

  async function refresh() { await load(); render() }
  function deactivate() { logSheetOpen = false; screenView = 'home'; selectedEntry = null }
  return { root, refresh, deactivate }
}
