/**
 * FUEL — nutrition and hydration, optimized for fast logging.
 */
import { nutritionLedger, foodLibrary, searchFoods } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'
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

    replace(root, [
      el('div.fuel-r4__topline', {}, [
        el('h1.screen__title', { text: 'Fuel' }),
        el('span.fuel-r4__today-tag', { text: day.nutritionStatus === 'complete' ? '✓ DAY CLOSED' : '● DAY OPEN' }),
      ]),
      diaryCalendar(),
      el('div.fuel-r4__dashboard', {}, [
        // One persistent overview pane on an unfolded Duo; ordinary phones
        // still show a single natural scrolling column.
        el('div.fuel-r4__overview', {}, [
          el('section.fuel-r4__card.fuel-r4__energy', {}, [
            el('div.fuel-r4__budget-heading', {}, [
              el('div', {}, [
                el('span', { text: 'DAILY CALORIE BUDGET' }),
                el('strong', { text: Math.round(calories).toLocaleString() + ' kcal' }),
                el('small', { text: 'of ' + Math.round(calorieGoal).toLocaleString() + ' logged target' }),
              ]),
              energyRing(energyProgress, Math.max(0, calorieGoal - calories)),
            ]),
            el('div.fuel-r4__budget-track', { role: 'progressbar',
              'aria-label': 'Calories logged', 'aria-valuemin': '0',
              'aria-valuemax': String(calorieGoal), 'aria-valuenow': String(calories) }, [
              el('span', { style: 'width:' + energyProgress + '%' }),
            ]),
            el('button.fuel-r4__finish', {
              type: 'button', dataset: { diaryFinishToday: 'true', closed: String(day.nutritionStatus === 'complete') },
              onclick: closeToday,
            }, [day.nutritionStatus === 'complete' ? 'Reopen today’s diary' : 'Mark today’s food diary complete']),
            el('p.fuel-r4__finish-note', {
              text: 'Closing confirms your meals are logged. It is not a calorie goal or weight-loss score.',
            }),
            el('div.fuel-r4__protein', {}, [
              el('span', { text: `Protein ${Math.round(protein)} / ${Math.round(proteinGoal)} g` }),
              el('div.fuel-r4__bar', {}, [el('i', { style: `width:${proteinProgress}%` })]),
            ]),
            el('div.fuel-r4__macros', {}, [
              ['Carbs', ledger.totals.carbs],
              ['Fat', ledger.totals.fat],
              ['Fiber', ledger.totals.fiber],
            ].map(([label, value]) => el('div', {}, [
              el('span', { text: label }),
              el('strong', { text: `${Math.round(value)} g` }),
            ]))),
          ]),
          el('section.fuel-r4__card.fuel-r4__water', {}, [
            el('h2', { text: 'Water' }),
            el('span.fuel-r4__water-total', { text: `${Math.round(water)} / ${Math.round(waterGoal)} oz` }),
            el('div.fuel-r4__bar', {}, [el('i', { style: `width:${waterProgress}%` })]),
            el('div.fuel-r4__water-actions', {}, [8, 12, 25].map((amount) =>
              el('button.fuel-r4__secondary', {
                type: 'button', onclick: () => addWater(amount),
              }, [`+${amount}`]))),
          ]),
        ]),
        el('div.fuel-r4__details', {}, [
          foodsCard(),
          mealPanel,
        ]),
      ]),
      ...openDaysCard(),
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
