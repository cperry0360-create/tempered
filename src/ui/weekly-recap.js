import { el } from './dom.js'

const number = (value, digits = 0) => new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)
const date = value => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))

/** A read-only report, separate from the live week and the workout screen. */
export function showWeeklyRecap(report, { onProgress, onClose = () => {} } = {}) {
  const returnFocus = document.activeElement
  const closeButton = el('button.button.weekly-recap__done', { type: 'button', dataset: { weeklyRecapClose: 'true' }, onclick: () => dialog.close() }, ['Done'])
  const signalLabels = {
    sleepHours: ['Sleep', ' h', 'average'], steps: ['Steps', '', 'average'], waterOz: ['Water', ' oz', 'average'],
    calories: ['Calories', ' kcal', 'average'], proteinGrams: ['Protein', ' g', 'average'],
    restingHr: ['Resting heart rate', ' bpm', 'average'], hrvMs: ['HRV', ' ms', 'average'],
    mobilityMinutes: ['Mobility', ' min', 'total'], readingMinutes: ['Reading', ' min', 'total'],
    meditationMinutes: ['Meditation', ' min', 'total'], studyMinutes: ['Study', ' min', 'total'],
    instrumentMinutes: ['Instrument', ' min', 'total'], microCardioMinutes: ['Micro cardio', ' min', 'total'],
    cardioMinutes: ['Cardio', ' min', 'total'], cardioMiles: ['Cardio distance', ' mi', 'total'],
  }
  const signals = Object.entries(report.signals).map(([key, value]) => {
    const [label, unit, calculation] = signalLabels[key]
    return el('div.weekly-recap__row', {}, [
      el('span', { text: label }),
      el('div', {}, [el('strong', { text: `${number(value[calculation], key === 'steps' || key === 'calories' ? 0 : 1)}${unit}${calculation === 'average' ? ' avg' : ''}` }), el('small', { text: `${value.days} of 7 days logged` })]),
    ])
  })
  if (report.weight) signals.push(el('div.weekly-recap__row', {}, [
    el('span', { text: 'Weight' }), el('div', {}, [
      el('strong', { text: `${number(report.weight.last.value, 1)} lb${report.weight.change !== null ? ` · ${report.weight.change > 0 ? '+' : ''}${number(report.weight.change, 1)} lb` : ''}` }),
      el('small', { text: `${report.weight.days} of 7 days logged${report.weight.change !== null ? ' · first to last' : ''}` }),
    ]),
  ]))
  const stats = [
    [report.training.sessions, report.training.sessions === 1 ? 'workout' : 'workouts'], [report.training.sets, report.training.sets === 1 ? 'working set' : 'working sets'],
    [report.training.sessions && !report.durationSamples ? null : report.training.minutes, 'training min'], [report.training.days, report.training.days === 1 ? 'day with training' : 'days with training'],
  ]
  const dialog = el('dialog.weekly-recap', { 'aria-labelledby': 'weekly-recap-title', dataset: { weeklyRecap: report.start } }, [
    el('header.weekly-recap__header', {}, [
      el('div.weekly-recap__brand', {}, [
        el('img.weekly-recap__mark', { src: new URL('../../branding/lfms/logo-mark.svg', import.meta.url).href, alt: '', width: '40', height: '40' }),
        el('div.weekly-recap__heading', {}, [
          el('p.weekly-recap__eyebrow', { text: 'LFMS / WEEKLY REVIEW' }),
          el('h1', { id: 'weekly-recap-title', text: `${date(report.start)} – ${date(report.end)}` }),
        ]),
      ]),
      closeButton,
    ]),
    el('div.weekly-recap__body', {}, [
      el('section.weekly-recap__card.weekly-recap__card--score', {}, [
        el('p.weekly-recap__kicker', { text: 'TRAINING HIGHLIGHT' }),
        el('h2', { text: 'Training score' }),
        el('div.weekly-recap__scoreline', {}, [
          el('strong.weekly-recap__score', { text: report.score.score !== null ? String(report.score.score) : '—' }),
          el('span.weekly-recap__grade', { text: report.score.score !== null ? report.score.grade : report.score.away ? 'Away week' : 'Building history' }),
        ]),
        report.score.score !== null && el('div.weekly-recap__score-track',
          { role: 'progressbar', 'aria-label': 'Training score', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(report.score.score) },
          [el('span', { style: `width:${Math.max(0, Math.min(100, report.score.score))}%` })]),
        report.change !== null && el('p.weekly-recap__delta', { text: report.change === 0 ? 'Level with your prior four-week average' : `${report.change > 0 ? '+' : ''}${report.change} points vs your prior four-week average` }),
        el('p', { text: report.explanation[1] ?? report.explanation[0] }),
        report.score.components.length > 0 && el('details.weekly-recap__breakdown', {}, [el('summary', { text: 'Score breakdown & explanation' }),
        ...report.explanation.map(sentence => el('p', { text: sentence })),
        ...report.score.components.map(component => el('div.weekly-recap__component', {}, [
          el('div.weekly-recap__component-label', {}, [el('strong', { text: component.label }), el('span', { text: component.value === null ? 'Not scored' : `${Math.round(component.value * 100)}%` })]),
          el('p.weekly-recap__muted', { text: component.reason }),
        ])),
        ]),
      ]),
      el('section.weekly-recap__card.weekly-recap__card--training', {}, [
        el('p.weekly-recap__kicker', { text: 'TRAINING VOLUME' }),
        el('h2', { text: 'The work you recorded' }),
        el('div.weekly-recap__stats', {}, stats.map(([value, label]) => el('div', {}, [el('strong', { text: value === null ? '—' : number(value) }), el('span', { text: label })]))),
        report.durationSamples < report.training.sessions && el('p.weekly-recap__muted', { text: `Duration recorded for ${report.durationSamples} of ${report.training.sessions} workouts.` }),
        report.training.volume > 0 && el('p.weekly-recap__muted', { text: `${number(report.training.volume)} lb lifting volume` }),
        report.restDays > 0 && el('p', { text: `${report.restDays} rest ${report.restDays === 1 ? 'day' : 'days'} logged. Recovery is part of the process.` }),
        report.training.sessions === 0 && el('p.weekly-recap__muted', { text: 'No completed workouts were recorded for this week.' }),
      ]),
      el('section.weekly-recap__card.weekly-recap__card--recovery', {}, [
        el('p.weekly-recap__kicker', { text: 'BEYOND THE GYM' }),
        el('h2', { text: 'Recovery & daily life' }), ...signals,
        !signals.length && el('p.weekly-recap__muted', { text: 'No daily measurements were recorded for this week.' }),
        el('p.weekly-recap__muted', { text: 'Averages use logged days only. Blank days are not counted as zero.' }),
      ]),
      el('button.button.weekly-recap__progress', { type: 'button', onclick: () => { dialog.close(); onProgress?.() } }, ['View Progress', '  ›']),
    ]),
  ])
  dialog.addEventListener('close', () => { dialog.remove(); onClose(); if (returnFocus?.isConnected) returnFocus.focus() })
  document.body.append(dialog)
  dialog.showModal()
  closeButton.focus()
  return dialog
}
