/**
 * FUEL — nutrition and hydration, optimized for fast logging.
 */
import { nutritionLedger, nutritionSuggestions } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'

export function createFuelScreen({ storage, daily, clock }) {
  const root = el('div.screen.screen--fuel.screen--fuel-r4')
  let model = null

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
      suggestions: nutritionSuggestions(days, 3),
    }
  }

  async function addWater(amount) {
    await daily.logAt(clock.today(), 'water', amount)
    await refresh()
  }

  async function quickLog(suggestion) {
    await daily.addNutrition(clock.today(), suggestion)
    await refresh()
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
    const openNutrition = (event) => window.dispatchEvent(new CustomEvent('tempered:open-nutrition', {
      detail: { date: clock.today(), trigger: event.currentTarget },
    }))

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
        el('button.fuel-r4__primary', { type: 'button', onclick: openNutrition }, ['Log a meal']),
      ]),
      el('section.fuel-r4__card.fuel-r4__recent', {}, [
        el('h2', { text: 'Recent' }),
        el('div.fuel-r4__rows', {}, model.suggestions.length
          ? model.suggestions.map((suggestion) => el('button.fuel-r4__recent-row', {
              type: 'button',
              onclick: () => quickLog(suggestion),
            }, [
              el('span', { text: `${suggestion.description} · ${Math.round(suggestion.calories ?? 0)} kcal` }),
              el('span.fuel-r4__plus', { 'aria-hidden': 'true', text: '+' }),
            ]))
          : [el('p.fuel-r4__empty', { text: 'Recent meals will appear here after you log them.' })]),
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
    ])
  }

  async function refresh() { await load(); render() }
  function deactivate() {}
  return { root, refresh, deactivate }
}
