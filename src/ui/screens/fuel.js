/**
 * FUEL — nutrition, hydration, and recovery without the retired companion layer.
 */
import { trainingReadiness } from '../../domain/readiness.js'
import { nutritionLedger } from '../../domain/nutrition.js'
import { el, replace } from '../dom.js'

export function createFuelScreen({ storage, daily, clock, onToday }) {
  const root = el('div.screen.screen--fuel')
  let model = null

  const onFuelUpdated = (event) => {
    if (root.isConnected && (!event?.detail?.date || event.detail.date === clock.today())) refresh().catch(() => {})
  }
  window.addEventListener('tempered:fuel-updated', onFuelUpdated)

  async function load() {
    const todayKey = clock.today()
    const [days, todayView] = await Promise.all([
      storage.getAll('dayLogs'),
      daily.forDate(todayKey),
    ])
    model = {
      day: days.find((day) => day.date === todayKey) ?? { date: todayKey },
      todayView,
      readiness: trainingReadiness(days, todayKey),
    }
  }

  async function addWater(amount) {
    await daily.logAt(clock.today(), 'water', amount)
    await refresh()
  }

  function dashboard(m) {
    const day = m.day ?? {}
    const number = (value) => typeof value === 'number' && Number.isFinite(value) ? value : 0
    const activities = [...(m.todayView?.logged ?? []), ...(m.todayView?.outstanding ?? [])]
    const goal = (id, fallback = 0) => number(activities.find((item) => item.id === id)?.dailyCap) || fallback
    const calorieGoal = goal('calories_logged', 2100)
    const proteinGoal = goal('protein_target')
    const waterGoal = goal('water', 100)
    const calories = number(day.calories)
    const protein = number(day.proteinGrams)
    const water = number(day.waterOz)
    const ledger = nutritionLedger(day)
    const percent = (value, target) => target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
    const openNutrition = (event) => window.dispatchEvent(new CustomEvent('tempered:open-nutrition', {
      detail: { date: clock.today(), trigger: event.currentTarget },
    }))
    const mealName = (entry) => {
      const hour = new Date(entry.loggedAt).getHours()
      return hour < 10 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 20 ? 'Dinner' : 'Snack'
    }
    const meals = ledger.entries.slice(-4).reverse()
    const health = day.healthMetrics ?? {}
    const healthMetric = (label, value, unit) => el('div.fuel-recovery__metric', {}, [
      el('span', { text: label }),
      el('strong', { text: Number.isFinite(value) ? `${Math.round(value)}${unit}` : '—' }),
    ])

    return el('div.fuel-stack', { dataset: { fuelDashboard: 'true' } }, [
      el('section.fuel-dashboard', {}, [
        el('div.fuel-dashboard__head', {}, [
          el('div', {}, [el('span', { text: 'TODAY' }), el('h2', { text: 'Fuel' })]),
          el('button.fuel-dashboard__today', { type: 'button', onclick: onToday }, ['OPEN TODAY']),
        ]),
        el('div.fuel-energy', {}, [
          el('div.fuel-energy__ring', { style: `--fuel-progress:${percent(calories, calorieGoal)}` }, [
            el('strong', { text: `${Math.max(0, Math.round(calorieGoal - calories))}` }),
            el('span', { text: 'KCAL LEFT' }),
          ]),
          el('div.fuel-energy__summary', {}, [
            el('strong', { text: `${Math.round(calories)} / ${Math.round(calorieGoal)} kcal` }),
            el('span', { text: proteinGoal ? `${Math.round(protein)} / ${Math.round(proteinGoal)} g protein` : `${Math.round(protein)} g protein` }),
            el('div.fuel-energy__bar', {}, [el('i', { style: `width:${percent(calories, calorieGoal)}%` })]),
          ]),
        ]),
        el('div.fuel-macros', {}, [
          ['PROTEIN', ledger.totals.protein], ['CARBS', ledger.totals.carbs],
          ['FAT', ledger.totals.fat], ['FIBER', ledger.totals.fiber],
        ].map(([label, value]) => el('span', {}, [el('b', { text: `${Math.round(value)}g` }), el('small', { text: label })]))),
        el('button.fuel-dashboard__nutrition', { type: 'button', onclick: openNutrition }, ['+ LOG A MEAL']),
        el('div.fuel-meals', {}, meals.length
          ? meals.map((entry) => el('button.fuel-meals__row', { type: 'button', onclick: openNutrition }, [
              el('span', {}, [el('strong', { text: mealName(entry) }), el('small', { text: entry.description || 'Logged meal' })]),
              el('b', { text: `${Math.round(entry.calories ?? 0)} kcal` }),
            ]))
          : [el('button.fuel-meals__empty', { type: 'button', onclick: openNutrition, text: 'No meals yet · tap to start today’s journal' })]),
      ]),
      el('section.fuel-water', {}, [
        el('div.fuel-water__head', {}, [
          el('div', {}, [el('span', { text: 'HYDRATION' }), el('h2', { text: `${Math.round(water)} / ${Math.round(waterGoal)} oz` })]),
          el('strong', { text: `${percent(water, waterGoal)}%` }),
        ]),
        el('div.fuel-water__bar', {}, [el('i', { style: `width:${percent(water, waterGoal)}%` })]),
        el('div.fuel-water__actions', {}, [8, 12, 25].map((amount) =>
          el('button', { type: 'button', onclick: () => addWater(amount), text: `+${amount} OZ` }))),
      ]),
      el('section.fuel-recovery', { dataset: { readiness: m.readiness.label.toLowerCase().replaceAll(' ', '-') } }, [
        el('div.fuel-recovery__head', {}, [
          el('div', {}, [
            el('span', { text: 'RECOVERY' }),
            el('h2', { text: m.readiness.score === null ? 'Not enough data' : `${m.readiness.score} · ${m.readiness.label}` }),
          ]),
          el('small', { text: m.readiness.action }),
        ]),
        el('div.fuel-recovery__grid', {}, [
          healthMetric('RESTING HR', health.restingHr, ' bpm'),
          healthMetric('HRV', health.hrvMs, ' ms'),
          healthMetric('RESPIRATION', health.respiratoryRate, '/min'),
          healthMetric('SPO₂', health.spo2, '%'),
        ]),
      ]),
    ])
  }

  function render() {
    if (!model) return
    replace(root, [
      el('header.fuel-header', {}, [
        el('span.fuel-header__eyebrow', { text: 'NUTRITION · HYDRATION · RECOVERY' }),
        el('h1.screen__title', { text: 'Fuel' }),
        el('p.fuel-header__copy', { text: 'Log what matters, fix yesterday when needed, and keep recovery data in context.' }),
      ]),
      dashboard(model),
    ])
  }

  async function refresh() { await load(); render() }
  function deactivate() {}
  return { root, refresh, deactivate }
}
