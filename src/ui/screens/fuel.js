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
  let foodQuery = ''
  let showAllFoods = false
  let justAdded = null
  let justAddedPortion = 1
  let portionFood = null
  let calendarWeeksBack = 0
  let backlogExpanded = false
  let dismissedReminderFor = ''
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
    const waterProgress = percent(water, waterGoal)
    const closed = day.nutritionStatus === 'complete'
    const remaining = Math.max(0, calorieGoal - calories)
    const dayStatus = closed ? '✓ Day closed' : '● Day open'
    const macroTargets = nutritionMacroTargets(calorieGoal, proteinGoal)
    const macroTile = (label, grams, glyph, target, tone) =>
      el('div.food-v2__macro', {
        dataset: { nutrient: label.toLowerCase() },
        'aria-label': label + ': ' + Math.round(grams) + ' of ' + Math.round(target) + ' grams',
      }, [
        el('span.food-v2__macro-ring', { style: '--macro-progress:' + percent(grams, target) + '%;--macro-tone:' + tone }, [
          icon(glyph),
        ]),
        el('strong', { text: Math.round(grams).toLocaleString() + ' g' }),
        el('span', { text: label }),
        el('small', { text: Math.round(target).toLocaleString() + ' g goal' }),
      ])
    const top = el('div.food-v2__topline', {}, [
      el('div', {}, [
        el('h1.screen__title', { text: 'Food' }),
      ]),
      el('div.food-v2__header-actions', {}, [
        el('button.food-v2__date', {
          type: 'button', dataset: { foodDate: clock.today() },
          onclick: () => reviewDate(clock.today()),
        }, [icon('calendar'), dailyDateLabel()]),
        el('button.food-v2__header-add', {
          type: 'button', dataset: { foodHeaderAdd: 'true' },
          onclick: focusMealEntry,
        }, [icon('plus'), ' Add food']),
      ]),
    ])
    const energy = el('section.fuel-r4__card.fuel-r4__energy.food-v2__energy', {}, [
      el('div.food-v2__section-title', {}, [
        el('div', {}, [
          el('h2', { text: 'Today’s calorie budget' }),
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
      ]),
    ])
    const macros = el('section.food-v2__macro-card', {}, [
      el('div.food-v2__section-title', {}, [
        el('h2', { text: 'Macros' }),
      ]),
      el('div.food-v2__macro-grid', {}, [
        macroTile('Protein', protein, 'protein', macroTargets.protein, 'var(--food-v2-protein)'),
        macroTile('Carbs', ledger.totals.carbs, 'food', macroTargets.carbs, 'var(--food-v2-carbs)'),
        macroTile('Fat', ledger.totals.fat, 'food', macroTargets.fat, 'var(--food-v2-fat)'),
        macroTile('Fiber', ledger.totals.fiber, 'food', macroTargets.fiber, 'var(--food-v2-fiber)'),
      ]),
    ])
    const waterCard = el('section.fuel-r4__card.fuel-r4__water.food-v2__water', {}, [
      el('div.food-v2__section-title', {}, [
        el('h2', {}, [icon('water'), ' Water']),
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
          // The actual entry form is the primary action.
          mealPanel,
          recents,
          foodsCard(),
          finish,
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
