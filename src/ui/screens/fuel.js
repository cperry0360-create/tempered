/**
 * FUEL — nutrition and hydration, optimized for fast logging.
 */
import { nutritionLedger, foodLibrary, searchFoods } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { dayBefore, nutritionDayStatus, openNutritionDates } from '../../domain/nutrition-review.js'

export function createFuelScreen({ storage, daily, clock }) {
  const root = el('div.screen.screen--fuel.screen--fuel-r4')
  let model = null
  let foodQuery = ''
  let showAllFoods = false
  let justAdded = null
  let justAddedPortion = 1
  let portionFood = null
  let calendarWeeksBack = 0
  let backlogExpanded = false
  let dismissedReminderFor = ''
  let foodActionsOpen = false
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
      foods: foodLibrary(days, 3),
    }
  }

  async function addWater(amount) {
    await daily.logAt(clock.today(), 'water', amount)
    await refresh()
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
    const previous = document.createElement('button')
    previous.className = 'fuel-diary__nav'
    previous.textContent = '‹'
    previous.type = 'button'
    previous.setAttribute('aria-label', 'Previous week')
    previous.onclick = () => { calendarWeeksBack++; render() }
    const next = document.createElement('button')
    next.className = 'fuel-diary__nav'
    next.textContent = '›'
    next.type = 'button'
    next.disabled = calendarWeeksBack === 0
    next.setAttribute('aria-label', 'Next week')
    next.onclick = () => { calendarWeeksBack = Math.max(0, calendarWeeksBack - 1); render() }
    const days = Array.from({ length: 7 }, (_, index) => {
      const at = new Date(start)
      at.setUTCDate(at.getUTCDate() + index)
      const date = at.toISOString().slice(0, 10)
      const status = nutritionDayStatus(byDate.get(date), date, model.reviewStart, today)
      const isToday = date === today
      return el('button.fuel-diary__day', {
        type: 'button', disabled: date > today,
        dataset: { diaryDate: date, state: status, selected: String(isToday && calendarWeeksBack === 0) },
        'aria-label': date + ': ' + (isToday ? 'today' : status === 'closed' ? 'complete'
          : status === 'open' || status === 'unlogged' ? 'not closed' : 'not tracked'),
        onclick: () => date === today ? null : reviewDate(date),
      }, [
        el('span.fuel-diary__weekday', { text: ['M','T','W','T','F','S','S'][index] }),
        el('strong', { text: String(at.getUTCDate()) }),
        el('span.fuel-diary__marker', { 'aria-hidden': 'true',
          text: status === 'closed' ? '✓' : status === 'open' || (status === 'unlogged' && date < today) ? '•' : '·' }),
      ])
    })
    const left = start.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6)
    const right = end.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
    return el('section.fuel-diary', { dataset: { diaryCalendar: 'true' } }, [
      el('div.fuel-diary__heading', {}, [
        el('div', {}, [
          el('span.fuel-diary__eyebrow', { text: 'FOOD LOG' }),
          el('h2', { text: left === right ? left + ' · ' + start.getUTCFullYear()
            : left + ' — ' + right + ' · ' + end.getUTCFullYear() }),
        ]),
        el('div.fuel-diary__legend', {}, [
          el('span', { text: '✓ Closed' }),
          el('span', { text: '• Needs review' }),
          (() => {
            const count = openNutritionDates(model.days, today, model.reviewStart).length
            return count > 0 ? el('span.fuel-diary__open-count', { text: count + ' open' }) : null
          })(),
        ]),
      ]),
      el('div.fuel-diary__week', {}, [previous, ...days, next]),
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
      open.length > 0 && el('section.fuel-diary__backlog', { dataset: { openNutritionDays: String(open.length) } }, [
        el('div.fuel-diary__backlog-head', {}, [
          el('span', { text: open.length + (open.length === 1 ? ' earlier day needs review' : ' earlier days need review') }),
          el('button', { type: 'button', onclick: () => { backlogExpanded = !backlogExpanded; render() },
            'aria-expanded': String(backlogExpanded) }, [backlogExpanded ? 'Hide' : 'Show dates']),
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

  function focusMealEntry() {
    const input = mealPanel.querySelector('[data-entry="nutrition_description"]')
    if (!input) return
    input.scrollIntoView({ behavior: 'smooth', block: 'center' })
    input.focus()
  }

  function openFoodSearch() {
    const input = root.querySelector('.fuel-food__search')
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
      input.focus()
    } else focusMealEntry()
  }

  function actionButton(glyph, title, subtitle, callback, data) {
    return el('button.food-v2__action', {
      type: 'button', dataset: { foodAction: data }, onclick: callback,
    }, [
      el('span.food-v2__action-glyph', {}, [icon(glyph)]),
      el('span.food-v2__action-text', {}, [
        el('strong', { text: title }),
        el('small', { text: subtitle }),
      ]),
    ])
  }

  function quickActions() {
    const repeat = model.foods.top[0] ?? model.foods.all[0]
    return el('section.food-v2__quick', { 'aria-label': 'Quick food logging' }, [
      el('div.food-v2__section-title', {}, [
        el('div', {}, [el('small.food-v2__eyebrow', { text: 'QUICK ENTRY' }),
          el('h2', { text: 'Log something' })]),
        el('button.food-v2__more-toggle', {
          type: 'button', 'aria-expanded': String(foodActionsOpen),
          onclick: () => { foodActionsOpen = !foodActionsOpen; render() },
        }, [foodActionsOpen ? 'Less' : 'More']),
      ]),
      el('div.food-v2__quick-grid', {}, [
        actionButton('plus', 'Add meal', 'Enter food + macros', focusMealEntry, 'add'),
        actionButton('food', 'Meal photo', 'ChatGPT estimate', () => {
          mealPanel.querySelector('[data-calorie-ai="prompt"]')?.click()
        }, 'photo'),
        actionButton('down', 'Import AI', 'Paste nutrition', () => {
          mealPanel.querySelector('[data-calorie-ai="paste"]')?.click()
        }, 'import'),
        actionButton('history', repeat ? 'Repeat meal' : 'My foods',
          repeat ? repeat.description : 'Find past meals',
          () => repeat ? quickLog(repeat) : openFoodSearch(), 'repeat'),
        foodActionsOpen && actionButton('calendar', 'Earlier day', 'Correct a past diary',
          () => reviewDate(dayBefore(clock.today())), 'earlier'),
        foodActionsOpen && actionButton('history', 'Browse foods', 'Saved + recent meals',
          openFoodSearch, 'search'),
      ]),
      el('p.food-v2__quick-note', {
        text: 'Photo estimate opens ChatGPT; import brings the reviewed numbers back. No scanner or food database is connected.',
      }),
    ])
  }

  function recentFoodsStrip() {
    const foods = model.foods.top.slice(0, 4)
    if (foods.length === 0) return null
    return el('section.food-v2__recents', {}, [
      el('div.food-v2__section-title', {}, [
        el('h2', { text: 'Frequent foods' }),
        el('button.food-v2__more-toggle', { type: 'button', onclick: openFoodSearch }, ['See all']),
      ]),
      el('div.food-v2__recent-grid', {}, foods.map((food, index) =>
        el('button.food-v2__recent', {
          type: 'button', dataset: { recentFood: food.description },
          'aria-label': 'Log a serving of ' + food.description,
          onclick: () => quickLog(food),
        }, [
          el('span.food-v2__recent-graphic', { 'aria-hidden': 'true',
            text: ['◈', '✳', '◉', '❖'][index % 4] }),
          el('strong', { text: food.description }),
          el('small', { text: Math.round(food.calories ?? 0) + ' kcal · + Log' }),
        ]))),
    ])
  }

  function beachCutStrip() {
    const today = Date.parse(clock.today() + 'T12:00:00Z')
    const end = Date.parse('2026-11-26T12:00:00Z')
    const start = Date.parse('2026-11-02T12:00:00Z')
    const days = Math.max(0, Math.ceil((end - today) / 86400000))
    const progress = Math.max(0, Math.min(100, Math.round((today - start) / (end - start) * 100)))
    if (today > end + 86400000 || today < start - 14 * 86400000) return null
    return el('section.food-v2__beach', { 'aria-label': 'Thanksgiving Beach Cut' }, [
      el('div', {}, [
        el('span.food-v2__eyebrow', { text: 'THANKSGIVING BEACH CUT' }),
        el('strong', { text: days + (days === 1 ? ' day to go' : ' days to go') }),
        el('small', { text: 'Keep strength · steady nutrition' }),
      ]),
      el('div.food-v2__beach-progress', { role: 'progressbar',
        'aria-label': 'Days through Beach Cut',
        'aria-valuemin': '0', 'aria-valuemax': '100',
        'aria-valuenow': String(progress) }, [
        el('span', { style: 'width:' + progress + '%' }),
      ]),
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

  function foodResults() {
    const { top, rest, all } = model.foods
    if (all.length === 0) return [el('p.fuel-r4__empty', { text: 'Foods you log appear here, ready to log again in one tap.' })]
    if (foodQuery.trim()) {
      const matches = searchFoods(all, foodQuery)
      return matches.length
        ? [el('div.fuel-food__list', {}, matches.slice(0, 30).map(foodRow))]
        : [el('p.fuel-r4__empty', { text: `No saved food matches "${foodQuery.trim()}".` }),
            el('button.fuel-food__more', {
              type: 'button', dataset: { foodNew: foodQuery.trim() },
              onclick: () => startNewMeal(foodQuery.trim()),
            }, [`Add "${foodQuery.trim()}" as a new meal`])]
    }
    const visible = showAllFoods ? rest : rest.slice(0, 5)
    return [
      top.length > 0 && el('h3.fuel-food__heading', { text: 'Most logged' }),
      top.length > 0 && el('div.fuel-food__list', {}, top.map(foodRow)),
      rest.length > 0 && el('h3.fuel-food__heading', { text: top.length ? 'All foods' : 'Your foods' }),
      rest.length > 0 && el('div.fuel-food__list', {}, visible.map(foodRow)),
      rest.length > visible.length && el('button.fuel-food__more', {
        type: 'button', onclick: () => { showAllFoods = true; render() },
      }, [`Show all ${rest.length} foods`]),
    ].filter(Boolean)
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

  function foodsCard() {
    const results = el('div.fuel-food__results', {}, foodResults())
    return el('section.fuel-r4__card.fuel-r4__foods', {}, [
      el('h2', { text: 'My foods' }),
      model.foods.all.length > 0 && el('input.fuel-food__search', {
        type: 'search', placeholder: `Search ${model.foods.all.length} foods`, value: foodQuery,
        autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'search',
        'aria-label': 'Search your foods',
        oninput: (event) => { foodQuery = event.target.value; replace(results, foodResults()) },
      }),
      results,
    ].filter(Boolean))
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
        el('span', { text: 'kcal left' }),
      ]),
    ])
  }

  function render() {
    if (!model) return
    const day = model.day ?? {}
    const activities = [...(model.todayView?.logged ?? []), ...(model.todayView?.outstanding ?? [])]
    const goal = (id, fallback) => {
      const value = number(activities.find((item) => item.id === id)?.dailyCap)
      return value > 0 ? value : fallback
    }
    const calorieGoal = goal('calories_logged', 2100)
    const proteinGoal = goal('protein_target', 135)
    const waterGoal = goal('water', 120)
    const calories = number(day.calories)
    const protein = number(day.proteinGrams)
    const water = number(day.waterOz)
    const ledger = nutritionLedger(day)
    const energyProgress = percent(calories, calorieGoal)
    const proteinProgress = percent(protein, proteinGoal)
    const waterProgress = percent(water, waterGoal)
    const closed = day.nutritionStatus === 'complete'
    const remaining = Math.max(0, calorieGoal - calories)
    const dayStatus = closed ? '✓ Day closed' : '● Day open'
    const macroTile = (label, grams, glyph, progress, tone, detail) =>
      el('div.food-v2__macro', { dataset: { nutrient: label.toLowerCase() } }, [
        el('span.food-v2__macro-ring', { style: '--macro-progress:' + progress + '%;--macro-tone:' + tone }, [
          icon(glyph),
        ]),
        el('strong', { text: Math.round(grams).toLocaleString() + ' g' }),
        el('span', { text: label }),
        el('small', { text: detail }),
      ])
    const macroCalShare = (grams, factor) =>
      Math.min(100, calorieGoal > 0 ? Math.round(grams * factor / calorieGoal * 100) : 0)
    const top = el('div.food-v2__topline', {}, [
      el('div', {}, [
        el('span.food-v2__eyebrow', { text: 'TEMPERED / NUTRITION' }),
        el('h1.screen__title', { text: 'Food' }),
      ]),
      el('button.food-v2__date', {
        type: 'button', dataset: { foodDate: clock.today() },
        onclick: () => reviewDate(clock.today()),
      }, [icon('calendar'), dailyDateLabel()]),
    ])
    const energy = el('section.fuel-r4__card.fuel-r4__energy.food-v2__energy', {}, [
      el('div.food-v2__section-title', {}, [
        el('div', {}, [
          el('small.food-v2__eyebrow', { text: 'TODAY’S CALORIE BUDGET' }),
          el('h2', { text: 'Calories' }),
        ]),
        el('span.food-v2__energy-status', { dataset: { closed: String(closed) }, text: dayStatus }),
      ]),
      el('div.fuel-r4__budget-heading.food-v2__budget-heading', {}, [
        el('div', {}, [
          el('strong', { text: Math.round(calories).toLocaleString() }),
          el('span.food-v2__kcal', { text: 'kcal logged' }),
          el('small', { text: 'of ' + Math.round(calorieGoal).toLocaleString() + ' kcal target' }),
        ]),
        energyRing(energyProgress, remaining),
      ]),
      el('div.food-v2__energy-footer', {}, [
        el('div.fuel-r4__budget-track', { role: 'progressbar',
          'aria-label': 'Calories logged', 'aria-valuemin': '0',
          'aria-valuemax': String(calorieGoal), 'aria-valuenow': String(calories) }, [
          el('span', { style: 'width:' + energyProgress + '%' }),
        ]),
        el('span', { text: calories > calorieGoal
          ? Math.round(calories - calorieGoal) + ' kcal over target'
          : Math.round(remaining) + ' kcal remaining' }),
      ]),
    ])
    const macros = el('section.food-v2__macro-card', {}, [
      el('div.food-v2__section-title', {}, [
        el('h2', { text: 'Macros' }),
        el('span.food-v2__caption', { text: 'From logged food' }),
      ]),
      el('div.food-v2__macro-grid', {}, [
        macroTile('Protein', protein, 'protein', proteinProgress, 'var(--food-v2-protein)',
          Math.round(proteinGoal) + ' g goal'),
        macroTile('Carbs', ledger.totals.carbs, 'food',
          macroCalShare(ledger.totals.carbs, 4), 'var(--food-v2-carbs)', 'of calories'),
        macroTile('Fat', ledger.totals.fat, 'food',
          macroCalShare(ledger.totals.fat, 9), 'var(--food-v2-fat)', 'of calories'),
        macroTile('Fiber', ledger.totals.fiber, 'food',
          Math.min(100, ledger.totals.fiber / 30 * 100), 'var(--food-v2-fiber)', 'grams logged'),
      ]),
      el('p.food-v2__macro-note', { text: 'Protein ring tracks your goal; other rings are visual guides, not prescribed macro targets.' }),
    ])
    const waterCard = el('section.fuel-r4__card.fuel-r4__water.food-v2__water', {}, [
      el('div.food-v2__section-title', {}, [
        el('h2', {}, [icon('water'), ' Water']),
        el('span.food-v2__caption', { text: 'Quick add · oz' }),
      ]),
      el('div.food-v2__water-main', {}, [
        el('strong', { text: Math.round(water).toLocaleString() + ' oz' }),
        el('small', { text: 'of ' + Math.round(waterGoal) + ' oz' }),
      ]),
      el('div.fuel-r4__bar', {}, [el('i', { style: 'width:' + waterProgress + '%' })]),
      el('div.fuel-r4__water-actions', {}, [8, 12, 25].map(amount =>
        el('button.fuel-r4__secondary', {
          type: 'button', onclick: () => addWater(amount),
        }, ['+' + amount]))),
    ])
    const diary = diaryCalendar()
    const recents = recentFoodsStrip()
    const actions = quickActions()
    const finish = el('section.food-v2__day-finish', { dataset: { dayClosed: String(closed) } }, [
      el('div', {}, [
        el('strong', { text: closed ? 'Today is complete' : 'Your food diary is open' }),
        el('small', { text: closed ? 'Reopen to make corrections.' : 'Close it when you’ve recorded everything you ate.' }),
      ]),
      el('button.fuel-r4__finish', {
        type: 'button', dataset: { diaryFinishToday: 'true', closed: String(closed) },
        onclick: closeToday,
      }, [closed ? 'Reopen day' : 'Close day']),
    ])
    replace(root, [
      top,
      el('div.fuel-r4__dashboard.food-v2__layout', {}, [
        el('div.fuel-r4__overview.food-v2__overview', {}, [
          energy,
          macros,
          el('div.food-v2__small-row', {}, [waterCard, beachCutStrip()]),
          diary,
        ]),
        el('div.fuel-r4__details.food-v2__details', {}, [
          actions,
          recents,
          finish,
          mealPanel,
          foodsCard(),
          ...openDaysCard(),
        ]),
      ]),
    ])
    const today = clock.today()
    if (!mealPanel.firstChild || mealPanel.dataset.date !== today) {
      mealPanel.dataset.date = today
      window.dispatchEvent(new CustomEvent('tempered:mount-nutrition-panel', { detail: { slot: mealPanel, date: today } }))
    }
  }

  async function refresh() { await load(); render() }
  function deactivate() {}
  return { root, refresh, deactivate }
}
