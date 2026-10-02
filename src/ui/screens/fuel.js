/**
 * FUEL — nutrition and hydration, optimized for fast logging.
 */
import { nutritionLedger, foodLibrary, searchFoods } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'

export function createFuelScreen({ storage, daily, clock }) {
  const root = el('div.screen.screen--fuel.screen--fuel-r4')
  let model = null
  let foodQuery = ''
  let showAllFoods = false
  let justAdded = null
  let justAddedPortion = 1
  let portionFood = null
  // The add-meal form and today's meals live here, built once by the nutrition
  // runtime and reused across re-renders so half-typed entries survive.
  const mealPanel = el('div.fuel-r4__meal-panel')

  const onFuelUpdated = (event) => {
    if (root.isConnected && (!event?.detail?.date || event.detail.date === clock.today())) refresh().catch(() => {})
  }
  window.addEventListener('tempered:fuel-updated', onFuelUpdated)

  async function load() {
    const todayKey = clock.today()
    const [days, todayView] = await Promise.all([storage.getAll('dayLogs'), daily.forDate(todayKey)])
    model = {
      day: days.find((day) => day.date === todayKey) ?? { date: todayKey },
      todayView,
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
      el('h1.screen__title', { text: 'Fuel' }),
      el('section.fuel-r4__card.fuel-r4__energy', {}, [
        energyRing(energyProgress, Math.max(0, calorieGoal - calories)),
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
      foodsCard(),
      mealPanel,
      el('section.fuel-r4__card.fuel-r4__water', {}, [
        el('h2', { text: 'Water' }),
        el('span.fuel-r4__water-total', { text: `${Math.round(water)} / ${Math.round(waterGoal)} oz` }),
        el('div.fuel-r4__bar', {}, [el('i', { style: `width:${waterProgress}%` })]),
        el('div.fuel-r4__water-actions', {}, [8, 12, 25].map((amount) =>
          el('button.fuel-r4__secondary', {
            type: 'button', onclick: () => addWater(amount),
          }, [`+${amount}`]))),
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
