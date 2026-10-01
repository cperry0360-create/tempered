/**
 * TODAY — Redesign V1.
 *
 * The screen is deliberately a compact dashboard: settings, next session,
 * recovery, current calendar-week training, fuel, and the canonical
 * habit log. Logging still flows through the daily service.
 */

import { el, replace } from '../dom.js'
import { icon, iconForActivity } from '../icons.js'
import { sortActivities } from '../../domain/activities.js'
import { trainingReadiness } from '../../domain/readiness.js'
import { buildDailyWorkoutQueue, remainingProgramDay } from '../today-workout.js'

const FUEL_ACTIVITY_IDS = new Set(['calories_logged', 'protein_target', 'nutrition_logged'])

const DEFAULT_QUICK_ADD = Object.freeze({
  water: 20,
  micro_cardio: 2,
  mobility: 5,
  read: 10,
  study: 10,
  meditate: 5,
  instrument: 10,
})

export const MOBILITY_ROUTINES = Object.freeze([
  Object.freeze({
    id: 'desk_reset', name: 'Desk reset', minutes: 5, focus: 'Neck · shoulders · upper back',
    copy: 'A fast reset after laptop time or between calls.',
    moves: ['Wall slides', 'Thoracic rotations', 'Neck glides'],
    steps: [
      { name: 'Wall slides', time: 120, cue: 'Keep ribs down. Slide only as high as the shoulders stay relaxed.' },
      { name: 'Thoracic rotations', time: 120, cue: 'Move through the upper back while keeping hips quiet.' },
      { name: 'Neck glides', time: 60, cue: 'Draw the chin straight back without tipping the head down.' },
    ],
  }),
  Object.freeze({
    id: 'hips_ankles', name: 'Hips + ankles', minutes: 8, focus: 'Hips · calves · ankles',
    copy: 'Good before squats, running, or a long day on your feet.',
    moves: ['90/90 switches', 'Hip-flexor reach', 'Knee-to-wall rocks'],
    steps: [
      { name: '90/90 switches', time: 180, cue: 'Rotate slowly between sides without forcing the end range.' },
      { name: 'Hip-flexor reach', time: 180, cue: 'Tuck the pelvis, squeeze the back glute, then reach.' },
      { name: 'Knee-to-wall rocks', time: 120, cue: 'Keep the heel down and track the knee over the toes.' },
    ],
  }),
  Object.freeze({
    id: 'full_body', name: 'Full-body flow', minutes: 10, focus: 'Spine · hips · shoulders',
    copy: 'The all-purpose option when everything feels a little stiff.',
    moves: ['Cat-cow', 'World’s greatest stretch', 'Deep-squat pry'],
    steps: [
      { name: 'Cat-cow', time: 120, cue: 'Move one segment at a time and pair each direction with your breath.' },
      { name: 'World’s greatest stretch', time: 240, cue: 'Long lunge, elbow toward the floor, then rotate the chest open.' },
      { name: 'Deep-squat pry', time: 240, cue: 'Hold a support if needed. Shift gently and keep both feet planted.' },
    ],
  }),
  Object.freeze({
    id: 'recovery', name: 'Recovery downshift', minutes: 12, focus: 'Quads · hamstrings · breathing',
    copy: 'A slower flow for the evening or after a demanding training day.',
    moves: ['Couch stretch', 'Hamstring floss', 'Child’s pose breathing'],
    steps: [
      { name: 'Couch stretch', time: 240, cue: 'Squeeze the back glute and stay tall. Switch halfway.' },
      { name: 'Hamstring floss', time: 240, cue: 'Alternate a soft bend and extension without forcing the stretch.' },
      { name: 'Child’s pose breathing', time: 240, cue: 'Take slow breaths into the sides and back of the rib cage.' },
    ],
  }),
])

function unitLabel(activity) {
  if (activity.id === 'body_metrics') return 'lb'
  return { hours: 'h', min: 'min', oz: 'oz', steps: 'steps', g: 'g', kcal: 'kcal' }[activity.unit] ?? ''
}

function valueLabel(activity, value) {
  if (value === true || value === null || value === undefined) return 'Logged'
  const shown = activity?.id === 'sleep' && typeof value === 'number'
    ? Number(value.toFixed(2))
    : value
  const unit = unitLabel(activity)
  return `${shown}${unit ? ` ${unit}` : ''}`
}

export function hasDailyGoal(activity) {
  return (Number.isFinite(activity?.dailyCap) && activity.dailyCap > 0)
    || (Number.isFinite(activity?.goalPerLb) && activity.goalPerLb > 0)
}

export function dailyGoalComplete(activity) {
  if (activity?.id === 'calories_logged') return activity?.logged === true
  if (!hasDailyGoal(activity)) return activity?.logged === true
  if (!(Number.isFinite(activity?.dailyCap) && activity.dailyCap > 0)) return false
  return typeof activity.value === 'number' && activity.value >= activity.dailyCap
}

function dailyGoalLabel(activity) {
  if (!hasDailyGoal(activity)) return null
  if (!(Number.isFinite(activity?.dailyCap) && activity.dailyCap > 0)) return 'Log body weight to set goal'
  const value = typeof activity.value === 'number' ? activity.value : 0
  const unit = unitLabel(activity)
  return `${value} / ${activity.dailyCap}${unit ? ` ${unit}` : ''}`
}

export function staysEditableAfterComplete(activity) {
  return activity?.id === 'sleep'
    || (activity?.spec?.entry === 'number' && activity?.spec?.mode === 'add')
}

function isAdditiveNumber(activity) {
  return activity?.spec?.entry === 'number' && activity?.spec?.mode === 'add'
}

function parseDate(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(dateKey, amount) {
  const date = parseDate(dateKey)
  date.setDate(date.getDate() + amount)
  return toDateKey(date)
}

function weekStart(dateKey) {
  const date = parseDate(dateKey)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return toDateKey(date)
}

function weekDates(dateKey) {
  const start = weekStart(dateKey)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function dateLabel(dateKey) {
  const date = parseDate(dateKey)
  if (Number.isNaN(date.getTime())) return dateKey
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)
  return `${weekday}, ${date.getDate()} ${month}`
}

function number(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function percent(value, target) {
  if (!(target > 0)) return 0
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)))
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function oneDecimal(value) {
  return Number(value.toFixed(1))
}

function estimateSessionMinutes(day) {
  const exercises = day?.exercises ?? []
  const sets = exercises.reduce((sum, exercise) => sum + (Number(exercise.sets) || 0), 0)
  const estimate = (sets * 2.3) + (exercises.length * 1.5)
  return Math.max(15, Math.round(estimate / 5) * 5)
}

function compactMetric(value, unit, digits = 0) {
  if (!Number.isFinite(value)) return '—'
  const shown = digits ? value.toFixed(digits) : Math.round(value)
  if (!unit) return String(shown)
  return unit === 'h' ? `${shown}h` : `${shown} ${unit}`
}

export function createTodayScreen({
  workout, daily, planner, storage, clock, onStart, onOpenSlot, onSettings, onViewSummary,
}) {
  const root = el('div.screen.screen--today.screen--today-calm')
  const realToday = clock.today()
  let selectedDate = realToday
  let todayProgram = null
  let weekProgram = null
  let day = null
  let weekActivities = null
  let quickPresets = {}
  let trainingStats = { minutes: 0, workingSets: 0, exercises: 0, sessions: 0 }
  let weekTraining = []
  let profile = { id: 'profile' }
  let dayLogs = []
  let openActivityId = null
  let otherOpen = false
  let readinessInfoOpen = false
  let dayDetailsOpen = false
  let plannerRows = []
  let plannerComposerOpen = false
  let plannerKind = 'personal'
  let plannerDetailId = null
  let justEarned = null
  let selectedMobilityRoutineId = null
  let mobilityOverlay = null
  let mobilityTimer = null
  let mobilityRemaining = 0
  let mobilityRunning = false
  let rolloverOpen = null
  let completedWorkoutOpen = false

  const canLogSelected = () => selectedDate <= realToday
  const isRealToday = () => selectedDate === realToday

  function quickPresetFor(activity) {
    if (!isAdditiveNumber(activity)) return null
    const stored = Number(quickPresets?.[activity.id])
    if (Number.isFinite(stored) && stored > 0) return stored
    return DEFAULT_QUICK_ADD[activity.id] ?? null
  }

  function statusFor(activity, weekly = null) {
    if (weekly) {
      const suffix = weekly.loggedToday && !weekly.complete ? ' · done today' : ''
      return `${weekly.weeklyDone} / ${weekly.weeklyTarget} this week${suffix}`
    }
    if (hasDailyGoal(activity)) return dailyGoalLabel(activity)
    if (activity.logged) return valueLabel(activity, activity.value)
    if (!canLogSelected()) return 'No entry'
    const unit = unitLabel(activity)
    return unit ? `Log ${unit}` : 'Not logged'
  }

  function compactGlyph(activity, complete = false) {
    const glyph = activity.id === 'micro_cardio' ? 'steps' : iconForActivity(activity.id)
    return el('span.today-item__icon', {
      dataset: { complete: String(complete), attribute: activity.attribute ?? '' },
    }, [icon(complete ? 'check' : glyph)])
  }

  async function savePreset(activity, raw) {
    await daily.setQuickAddPreset(activity.id, raw)
    quickPresets = await daily.quickAddPresets()
    render()
  }

  function timerText(seconds) {
    const value = Math.max(0, Math.round(seconds))
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  }

  function stopMobilityTimer() {
    if (mobilityTimer) clearInterval(mobilityTimer)
    mobilityTimer = null
    mobilityRunning = false
  }

  function updateMobilityTimer() {
    if (!mobilityOverlay) return
    const time = mobilityOverlay.querySelector('[data-mobility-time]')
    const control = mobilityOverlay.querySelector('[data-mobility-timer-toggle]')
    if (time) time.textContent = timerText(mobilityRemaining)
    if (control) control.textContent = mobilityRemaining <= 0 ? 'Flow complete' : mobilityRunning ? 'Pause' : 'Start timer'
  }

  function toggleMobilityTimer() {
    if (mobilityRemaining <= 0) return
    if (mobilityRunning) {
      stopMobilityTimer()
      updateMobilityTimer()
      return
    }
    mobilityRunning = true
    updateMobilityTimer()
    mobilityTimer = setInterval(() => {
      mobilityRemaining = Math.max(0, mobilityRemaining - 1)
      if (mobilityRemaining <= 0) stopMobilityTimer()
      updateMobilityTimer()
    }, 1000)
  }

  function closeMobilityScreen() {
    stopMobilityTimer()
    mobilityOverlay?.remove()
    mobilityOverlay = null
    selectedMobilityRoutineId = null
    mobilityRemaining = 0
  }

  function mobilityRoutineCard(routine) {
    const selected = selectedMobilityRoutineId === routine.id
    return el('button.mobility-screen__routine', {
      type: 'button', dataset: { mobilityRoutine: routine.id, selected: String(selected) },
      'aria-pressed': String(selected),
      onclick: () => {
        stopMobilityTimer()
        selectedMobilityRoutineId = routine.id
        mobilityRemaining = routine.minutes * 60
        renderMobilityScreen()
      },
    }, [
      el('span.mobility-screen__routine-mark', { 'aria-hidden': 'true', text: routine.id === 'desk_reset' ? '↟' : routine.id === 'hips_ankles' ? '◒' : routine.id === 'full_body' ? '◇' : '≈' }),
      el('span.mobility-screen__routine-copy', {}, [
        el('strong', { text: routine.name }),
        el('small', { text: routine.focus }),
      ]),
      el('span.mobility-screen__routine-time', { text: `${routine.minutes} min` }),
    ])
  }

  function renderMobilityScreen() {
    if (!mobilityOverlay) return
    const routine = MOBILITY_ROUTINES.find((item) => item.id === selectedMobilityRoutineId) ?? null
    replace(mobilityOverlay, [
      el('section.mobility-screen', {
        role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mobility-screen-title',
      }, [
        el('header.mobility-screen__head', {}, [
          el('button.mobility-screen__back', { type: 'button', 'aria-label': 'Back to Today', onclick: closeMobilityScreen }, ['‹']),
          el('div', {}, [
            el('span', { text: 'Move better today' }),
            el('h2', { id: 'mobility-screen-title', text: 'Mobility' }),
          ]),
          el('span.mobility-screen__minutes', { text: 'Guided flows' }),
        ]),
        el('div.mobility-screen__hero', {}, [
          el('span.mobility-screen__hero-art', { 'aria-hidden': 'true' }),
          el('div', {}, [
            el('strong', { text: 'Controlled range, easy reset.' }),
            el('p', { text: 'Pick the stiffness you want to solve, follow the cues, and log the time when you finish.' }),
          ]),
        ]),
        el('div.mobility-screen__routines', {}, MOBILITY_ROUTINES.map(mobilityRoutineCard)),
        routine && el('section.mobility-flow', { dataset: { routine: routine.id } }, [
          el('div.mobility-flow__head', {}, [
            el('div', {}, [
              el('span', { text: 'Selected flow' }),
              el('h3', { text: routine.name }),
              el('p', { text: routine.copy }),
            ]),
            el('strong.mobility-flow__clock', { dataset: { mobilityTime: 'true' }, text: timerText(mobilityRemaining) }),
          ]),
          el('ol.mobility-flow__steps', {}, routine.steps.map((step) => el('li', {}, [
            el('span.mobility-flow__step-time', { text: `${Math.round(step.time / 60)} min` }),
            el('div', {}, [el('strong', { text: step.name }), el('p', { text: step.cue })]),
          ]))),
          el('div.mobility-flow__actions', {}, [
            el('button.mobility-flow__timer', {
              type: 'button', dataset: { mobilityTimerToggle: 'true' }, onclick: toggleMobilityTimer,
            }, [mobilityRemaining <= 0 ? 'Flow complete' : mobilityRunning ? 'Pause' : 'Start timer']),
            el('button.mobility-flow__complete', {
              type: 'button', onclick: async () => {
                const minutes = routine.minutes
                closeMobilityScreen()
                await record({ id: 'mobility', name: 'Mobility work', unit: 'min', spec: { entry: 'number', mode: 'add' } }, String(minutes))
              },
            }, [`Complete + log ${routine.minutes} min`]),
          ]),
        ]),
      ]),
    ])
  }

  function openMobilityScreen() {
    closeMobilityScreen()
    mobilityOverlay = el('div.mobility-screen-overlay', {
      dataset: { mobilityScreen: 'true' },
      onclick: (event) => { if (event.target === event.currentTarget) closeMobilityScreen() },
    })
    document.body.append(mobilityOverlay)
    renderMobilityScreen()
  }

  function editor(activity, weekly = null) {
    const adding = isAdditiveNumber(activity)
    const unit = unitLabel(activity)
    const sleep = activity.id === 'sleep'
    const mobility = activity.id === 'mobility'
    const mobilityRoutine = mobility
      ? MOBILITY_ROUTINES.find((routine) => routine.id === selectedMobilityRoutineId) ?? null
      : null
    const input = el('input.today-editor__input', {
      type: sleep ? 'number' : 'text', inputmode: 'decimal',
      ...(sleep ? {
        min: '0', max: '24', step: '0.1',
        value: typeof activity.value === 'number' ? String(activity.value) : '',
      } : (mobilityRoutine ? { value: String(mobilityRoutine.minutes) } : {})),
      placeholder: sleep ? 'Hours, e.g. 7.5' : (adding ? `Add ${unit || 'amount'}` : (unit || 'Value')),
      'aria-label': `${adding ? 'Add to' : 'Log'} ${activity.name}${activity.unit ? `, ${activity.unit}` : ''}`,
      dataset: { entry: activity.id },
      disabled: !canLogSelected(),
      onkeydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          record(activity, input.value)
        }
      },
    })
    const preset = quickPresetFor(activity)
    const presetInput = adding ? el('input.today-editor__preset-input', {
      type: 'text', inputmode: 'decimal', value: preset === null ? '' : String(preset),
      placeholder: 'Set',
      'aria-label': `Quick add amount for ${activity.name}`,
    }) : null

    return el('div.today-editor', { dataset: { editor: activity.id } }, [
      sleep && el('div.today-editor__quick.today-editor__quick--sleep', { 'aria-label': 'Common sleep amounts' },
        [6.5, 7, 7.5, 8, 8.5].map((hours) => el('button.today-editor__chip', {
          type: 'button', dataset: { sleepquick: String(hours) },
          onclick: () => { input.value = String(hours); input.focus() },
        }, [`${hours} h`]))),
      mobility && el('div.mobility-routines', { role: 'group', 'aria-label': 'Mobility routines' },
        MOBILITY_ROUTINES.map((routine) => el('button.mobility-routine', {
          type: 'button',
          dataset: { mobilityRoutine: routine.id, selected: String(mobilityRoutine?.id === routine.id) },
          'aria-pressed': String(mobilityRoutine?.id === routine.id),
          onclick: () => { selectedMobilityRoutineId = routine.id; render() },
        }, [
          el('strong', { text: routine.name }),
          el('span', { text: `${routine.minutes} min` }),
        ]))),
      mobilityRoutine && el('div.mobility-routine__detail', { role: 'status' }, [
        el('span', { text: 'Flow' }),
        el('p', { text: mobilityRoutine.moves.join(' · ') }),
      ]),
      el('div.today-editor__manual', {}, [
        input,
        el('button.today-editor__save', {
          type: 'button', disabled: !canLogSelected(), dataset: { action: 'log' },
          onclick: () => record(activity, input.value),
        }, [mobilityRoutine ? 'Log routine' : (adding ? 'Add' : 'Save')]),
      ]),
      presetInput && el('div.today-editor__preset', {}, [
        el('span.today-editor__preset-label', { text: 'Quick add' }),
        presetInput,
        el('span.today-editor__preset-unit', { text: unit }),
        el('button.today-editor__preset-save', {
          type: 'button', onclick: () => savePreset(activity, presetInput.value),
        }, ['Save']),
      ]),
      sleep && el('span.today-editor__hint', {
        text: 'Decimals are hours: 7.5 = 7 h 30 m · 7.75 = 7 h 45 m.',
      }),
      presetInput && el('span.today-editor__hint', {
        text: preset === null
          ? 'Save an amount for the one-tap action.'
          : `The quick action adds ${preset}${unit ? ` ${unit}` : ''}.`,
      }),
      weekly && el('span.today-editor__hint', { text: statusFor(activity, weekly) }),
    ])
  }

  function rowComplete(activity, weekly = null) {
    return weekly ? weekly.loggedToday === true : dailyGoalComplete(activity)
  }

  function markItem(activity, weekly = null) {
    const complete = rowComplete(activity, weekly)
    const inactive = !canLogSelected() || complete
    return el('button.today-item.today-item--mark', {
      type: 'button', disabled: inactive,
      dataset: {
        activity: activity.id, action: 'mark', complete: String(complete), today: String(weekly?.loggedToday === true),
      },
      'aria-label': complete ? `${activity.name}, done` : `Log ${activity.name}`,
      onclick: inactive ? null : () => record(activity, null),
    }, [
      compactGlyph(activity, complete),
      el('span.today-item__main', {}, [
        el('span.today-item__name', { text: activity.short ?? activity.name }),
        el('span.today-item__meta', { text: complete ? (weekly ? statusFor(activity, weekly) : 'Done') : statusFor(activity, weekly) }),
      ]),
      !complete && el('span.today-item__quick.today-item__quick--mark', { text: 'Log' }),
    ])
  }

  function numberItem(activity, weekly = null) {
    const open = openActivityId === activity.id
    const complete = rowComplete(activity, weekly)
    const adding = isAdditiveNumber(activity)
    const preset = quickPresetFor(activity)
    const unit = unitLabel(activity)
    const quickText = adding && preset !== null ? `+${preset}${unit ? ` ${unit}` : ''}` : 'Log'

    return el('div.today-item-wrap', {
      dataset: { open: String(open), activity: activity.id, complete: String(complete) },
    }, [
      el('div.today-item.today-item--number', {
        dataset: { action: 'open-log', complete: String(complete) },
      }, [
        el('button.today-item__body', {
          type: 'button', disabled: !canLogSelected(), 'aria-expanded': String(open),
          onclick: (event) => {
            if (!canLogSelected()) return
            if (activity.id === 'mobility') { openMobilityScreen(); return }
            toggleNumberEditor(activity.id, open, event.currentTarget.closest('.today-item-wrap'))
          },
        }, [
          compactGlyph(activity, complete),
          el('span.today-item__main', {}, [
            el('span.today-item__name', { text: activity.short ?? activity.name }),
            el('span.today-item__meta', { text: statusFor(activity, weekly) }),
          ]),
        ]),
        canLogSelected() && el('button.today-item__quick', {
          type: 'button',
          dataset: adding && preset !== null ? { quickadd: String(preset) } : { quicksetup: 'true' },
          'aria-label': adding && preset !== null
            ? `Add ${preset} ${activity.unit ?? ''} to ${activity.name}`
            : `Log ${activity.name}`,
          onclick: () => {
            if (adding && preset !== null) {
              record(activity, String(preset))
              return
            }
            if (activity.id === 'mobility') { openMobilityScreen(); return }
            toggleNumberEditor(activity.id, open, root.querySelector(`[data-activity="${activity.id}"]`))
          },
        }, [quickText]),
      ]),
      open && editor(activity, weekly),
    ])
  }

  function activityItem(activity, weekly = null) {
    if (activity.spec?.entry === 'mark') return markItem(activity, weekly)
    return numberItem(activity, weekly)
  }

  function toggleNumberEditor(activityId, open, wrapper) {
    if (open) {
      openActivityId = null
      render()
      return
    }
    openActivityId = activityId
    render()
    queueMicrotask(() => root.querySelector(`[data-editor="${activityId}"] input`)?.focus())
  }

  async function record(activity, value, options = {}) {
    if (!canLogSelected()) return
    const result = await daily.logAt(selectedDate, activity.id, value, options)
    const earned = Object.values(result?.xpByAttribute ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0)
    justEarned = earned > 0 ? {
      id: activity.id,
      xp: earned,
      levelled: result?.levelledUp?.[0]
        ? `${result.levelledUp[0].attribute} reached ${result.levelledUp[0].tier}`
        : null,
    } : null
    openActivityId = null
    if (activity.id === 'mobility') selectedMobilityRoutineId = null
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(10) } catch { /* optional */ }
    }
    await reload()
  }

  function workoutSlotPayload(row) {
    return {
      dayId: row.programDay.id,
      slotIndex: row.task.index,
      exerciseId: row.task.slot.exerciseId,
      slot: row.task.slot,
      alreadyLogged: row.task.logged,
    }
  }

  function workoutMovement(row, rollover = false, completed = false) {
    const fromDay = String(row.programDay?.weekday ?? row.programDay?.id ?? 'earlier').slice(0, 3)
    const progress = `${row.logged} / ${row.prescribed} sets`
    return el('button.today-workout__movement', {
      type: 'button',
      disabled: completed,
      dataset: {
        ...(rollover ? { rolloverSlot: 'true' } : { workoutSlot: 'true' }),
        exerciseId: row.task.slot.exerciseId,
      },
      onclick: () => onStart({ slotTask: workoutSlotPayload(row) }),
    }, [
      el('span.today-workout__movement-copy', {}, [
        el('span.today-workout__name', { dataset: { slotName: 'true' }, text: row.name }),
        el('span.today-workout__meta', { text: `${rollover ? `From ${fromDay} · ` : ''}${progress}` }),
      ]),
      el('span.today-workout__action', { text: completed ? 'Done' : row.started ? 'Continue' : 'Log sets' }),
    ])
  }

  function sessionCard() {
    if (!isRealToday()) {
      return el('section.today-card.today-session-card', { dataset: { section: 'next-session' } }, [
        el('h2', { text: todayProgram?.day?.name ?? 'Workout' }),
        el('p', { text: 'Workout details are available for today.' }),
      ])
    }

    const queue = buildDailyWorkoutQueue(weekProgram, clock.today())
    const todayRows = queue.today.filter((row) => !row.done)
    const rolloverRows = queue.rollover
    const completedRows = queue.completed
    const programDay = queue.primaryDay ?? todayProgram?.day ?? queue.scheduledDay
    const name = todayProgram?.day?.name ?? queue.primaryDay?.name ?? queue.scheduledDay?.name ?? 'Workout'
    const expandRollover = rolloverOpen ?? rolloverRows.length < 6
    const week = weekProgram?.week ?? todayProgram?.week ?? 1
    const weeks = weekProgram?.program?.weeks ?? todayProgram?.program?.weeks ?? 1

    if (queue.active.length === 0 && completedRows.length > 0) {
      return el('section.today-card.today-session-card', { dataset: { section: 'next-session', complete: 'true' } }, [
        el('h2', { text: `${name} done · ${trainingStats.minutes} min · ${trainingStats.workingSets} sets` }),
        el('button.today-button.today-button--secondary', {
          type: 'button', onclick: onViewSummary,
        }, ['View summary']),
      ])
    }
    if (!programDay && rolloverRows.length === 0) {
      return el('section.today-card.today-session-card', { dataset: { section: 'next-session' } }, [
        el('h2', { text: 'No session scheduled' }),
        el('p', { text: 'Recovery is part of the plan.' }),
      ])
    }

    const exerciseCount = todayProgram?.day?.exercises?.length ?? queue.today.length
    const meta = rolloverRows.length > 0
      ? `${todayRows.length} today · ${rolloverRows.length} from earlier this week`
      : `Week ${week} of ${weeks} · ${exerciseCount} exercises · ~${estimateSessionMinutes(programDay)} min`
    return el('section.today-card.today-session-card.today-workout', {
      dataset: { section: 'next-session' },
    }, [
      el('h2', { text: name }),
      el('p.today-workout__summary', { text: meta }),
      todayRows.length > 0 && el('div.today-workout__rows', {}, todayRows.map((row) => workoutMovement(row))),
      rolloverRows.length > 0 && el('section.today-workout__rollover', { dataset: { rolloverGroup: 'true' } }, [
        el('button.today-workout__group-toggle', {
          type: 'button', 'aria-expanded': String(expandRollover),
          onclick: () => { rolloverOpen = !expandRollover; render() },
        }, [`${rolloverRows.length} movements from earlier this week`, icon(expandRollover ? 'up' : 'down')]),
        expandRollover && el('div.today-workout__rows', {}, rolloverRows.map((row) => workoutMovement(row, true))),
      ]),
      completedRows.length > 0 && el('section.today-workout__completed', {}, [
        el('button.today-workout__group-toggle', {
          type: 'button', 'aria-expanded': String(completedWorkoutOpen),
          onclick: () => { completedWorkoutOpen = !completedWorkoutOpen; render() },
        }, [`${completedRows.length} done`, icon(completedWorkoutOpen ? 'up' : 'check')]),
        completedWorkoutOpen && el('div.today-workout__rows', {}, completedRows.map((row) => workoutMovement(row, false, true))),
      ]),
      programDay && queue.active.length > 0 && el('button.today-button.today-button--primary.today-workout__start', {
        type: 'button', dataset: { startday: programDay.id },
        onclick: () => onStart({ programDay: remainingProgramDay(weekProgram, programDay) }),
      }, ['Start full session']),
      week === 1 && rolloverRows.length === 0 && el('p.today-session-card__guidance', {
        text: 'Start when you have a useful window; record what happened so the plan can meet you where you are.',
      }),
    ])
  }

  function sevenDayAverage(read) {
    const start = addDays(selectedDate, -7)
    const values = dayLogs
      .filter((row) => row.date >= start && row.date < selectedDate)
      .map(read)
      .filter((value) => Number.isFinite(value) && value > 0)
    return average(values)
  }

  function readinessMetrics() {
    const current = day?.day ?? {}
    const metrics = [
      {
        key: 'sleep', label: 'Sleep', value: number(current.sleepHours, NaN),
        unit: 'h', digits: 1, baseline: sevenDayAverage((row) => row.sleepHours),
        good: (delta) => delta > 0,
      },
      {
        key: 'restingHr', label: 'Resting HR', value: number(current.healthMetrics?.restingHr, NaN),
        unit: 'bpm', digits: 0, baseline: sevenDayAverage((row) => row.healthMetrics?.restingHr),
        good: (delta) => delta < 0,
      },
      {
        key: 'hrv', label: 'HRV', value: number(current.healthMetrics?.hrvMs, NaN),
        unit: 'ms', digits: 1, baseline: sevenDayAverage((row) => row.healthMetrics?.hrvMs),
        good: (delta) => delta > 0,
      },
    ]
    return metrics.map((metric) => {
      const delta = Number.isFinite(metric.value) && Number.isFinite(metric.baseline)
        ? metric.value - metric.baseline
        : null
      return { ...metric, delta }
    })
  }

  function deltaText(metric) {
    if (!Number.isFinite(metric.delta)) return ''
    const shown = metric.digits ? oneDecimal(metric.delta) : Math.round(metric.delta)
    return `${shown > 0 ? '+' : ''}${shown}`
  }

  function readinessCard() {
    const metrics = readinessMetrics()
    const hasAny = metrics.some((metric) => Number.isFinite(metric.value))
    if (!hasAny) {
      return el('section.today-card.today-readiness.today-readiness--empty', { dataset: { section: 'readiness' } }, [
        el('span', { text: 'No recovery data today' }),
        el('button.today-text-button', {
          type: 'button',
          onclick: (event) => window.dispatchEvent(new CustomEvent('tempered:open-health-import', {
            detail: { trigger: event.currentTarget },
          })),
        }, ['Import from Health']),
      ])
    }
    const readiness = trainingReadiness(dayLogs, selectedDate)
    return el('section.today-card.today-readiness', { dataset: { section: 'readiness' } }, [
      el('div.today-card__heading-row', {}, [
        el('h2', { text: 'Readiness' }),
        el('button.today-info-button', {
          type: 'button',
          'aria-label': readinessInfoOpen ? 'Hide readiness explanation' : 'Explain readiness',
          'aria-expanded': String(readinessInfoOpen),
          onclick: () => { readinessInfoOpen = !readinessInfoOpen; render() },
        }, ['i']),
      ]),
      el('div.today-readiness__grid', {}, metrics.map((metric) => el('div.today-readiness__metric', {
        dataset: {
          metric: metric.key,
          direction: Number.isFinite(metric.delta) && metric.good(metric.delta) ? 'good' : 'neutral',
        },
      }, [
        el('strong', { text: compactMetric(metric.value, metric.unit, metric.digits) }),
        el('span', { text: metric.label }),
        el('small', { text: deltaText(metric) }),
      ]))),
      readinessInfoOpen && el('p.today-readiness__info', {
        text: readiness.score === null
          ? 'Values compare with your previous seven days when enough history is available.'
          : `Values compare with your recent baseline; the score does not replace how you feel (${readiness.label.toLowerCase()}).`,
      }),
    ])
  }

  function weekCard() {
    const totals = weekTraining.reduce((sum, item) => ({
      sessions: sum.sessions + item.stats.sessions,
      sets: sum.sets + item.stats.workingSets,
      minutes: sum.minutes + item.stats.minutes,
    }), { sessions: 0, sets: 0, minutes: 0 })
    return el('section.today-card.today-week', { dataset: { section: 'week' } }, [
      el('h2', { text: 'This week' }),
      el('p.today-week__meta', { text: `${totals.sessions} sessions · ${totals.sets} sets · ${totals.minutes} min` }),
      el('div.today-week__days', { 'aria-label': 'Training this calendar week' }, weekTraining.map((item) => {
        const date = parseDate(item.date)
        const trained = item.stats.workingSets > 0 || item.stats.sessions > 0
        const today = item.date === realToday
        const future = item.date > realToday
        return el('div.today-week__day', {
          dataset: { trained: String(trained), today: String(today), future: String(future) },
        }, [
          el('span.today-week__dot', { 'aria-hidden': 'true' }),
          el('span.today-week__dow', {
            text: new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date),
          }),
        ])
      })),
    ])
  }

  function openNutrition(event) {
    window.dispatchEvent(new CustomEvent('tempered:open-nutrition', {
      detail: { date: selectedDate, trigger: event.currentTarget },
    }))
  }

  function goalFor(allActivities, id, fallback) {
    const found = allActivities.find((activity) => activity.id === id)
    return number(found?.dailyCap, fallback)
  }

  function fuelCard(allActivities) {
    const current = day?.day ?? {}
    const calories = number(current.calories)
    const protein = number(current.proteinGrams)
    const calorieGoal = goalFor(allActivities, 'calories_logged', 2100)
    const proteinGoal = goalFor(allActivities, 'protein_target', 135)
    return el('section.today-card.today-fuel-card', { dataset: { section: 'fuel' } }, [
      el('div.today-card__heading-row', {}, [
        el('h2', { text: 'Fuel' }),
        el('button.today-fuel-card__add', {
          type: 'button', 'aria-label': 'Log a meal', onclick: openNutrition,
        }, [icon('plus')]),
      ]),
      el('div.today-fuel-card__metric', {}, [
        el('span', { text: `${Math.round(calories).toLocaleString()} / ${Math.round(calorieGoal).toLocaleString()} kcal` }),
        el('div.today-fuel-card__bar', {
          role: 'progressbar', 'aria-label': 'Calories', 'aria-valuemin': '0',
          'aria-valuemax': String(calorieGoal), 'aria-valuenow': String(calories),
        }, [el('i', { style: `width:${percent(calories, calorieGoal)}%` })]),
      ]),
      el('div.today-fuel-card__metric', {}, [
        el('span', { text: `${Math.round(protein)} / ${Math.round(proteinGoal)} g protein` }),
        el('div.today-fuel-card__bar', {
          role: 'progressbar', 'aria-label': 'Protein', 'aria-valuemin': '0',
          'aria-valuemax': String(proteinGoal), 'aria-valuenow': String(protein),
        }, [el('i', { style: `width:${percent(protein, proteinGoal)}%` })]),
      ]),
    ])
  }

  function monthLabel(dateKey) {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(parseDate(dateKey))
  }

  async function addPlannerTask(input) {
    if (!planner) return
    const row = await planner.add({ date: selectedDate, title: input.value, kind: plannerKind })
    if (!row) return
    input.value = ''
    plannerComposerOpen = false
    plannerRows = await planner.list(selectedDate)
    render()
  }

  async function togglePlannerTask(id) {
    if (!planner) return
    await planner.toggle(id)
    plannerRows = await planner.list(selectedDate)
    render()
  }

  async function removePlannerTask(id) {
    if (!planner) return
    await planner.remove(id)
    if (plannerDetailId === id) plannerDetailId = null
    plannerRows = await planner.list(selectedDate)
    render()
  }

  async function updatePlannerTask(id, values) {
    if (!planner) return false
    const updated = await planner.update(id, values)
    if (!updated) return false
    plannerDetailId = null
    plannerRows = await planner.list(selectedDate)
    render()
    return true
  }

  function plannerComposer() {
    const input = el('input.today-plan-compose__input', {
      type: 'text', placeholder: plannerKind === 'work' ? 'Draft memo…' : 'Add a task…',
      'aria-label': `New ${plannerKind} task`,
      onkeydown: (event) => {
        if (event.key === 'Enter') { event.preventDefault(); addPlannerTask(input) }
      },
    })
    return el('div.today-plan-compose', {}, [
      input,
      el('div.today-plan-compose__foot', {}, [
        el('div.today-plan-kind', { role: 'group', 'aria-label': 'Task type' },
          ['personal', 'work'].map((kind) => el('button.today-plan-kind__button', {
            type: 'button', dataset: { active: String(plannerKind === kind) },
            onclick: () => { plannerKind = kind; render() },
          }, [kind === 'work' ? 'Work' : 'Personal']))),
        el('button.today-plan-compose__add', { type: 'button', onclick: () => addPlannerTask(input) }, ['Add task']),
      ]),
    ])
  }

  function plannerItem(row) {
    return el('div.today-plan-item', { dataset: { done: String(row.done), kind: row.kind } }, [
      el('button.today-plan-item__check', {
        type: 'button', 'aria-label': `${row.done ? 'Reopen' : 'Complete'} ${row.title}`,
        onclick: () => togglePlannerTask(row.id),
      }, [row.done ? icon('check') : '']),
      el('button.today-plan-item__main', {
        type: 'button', onclick: () => { plannerDetailId = row.id; render() },
      }, [
        el('span.today-plan-item__title', { text: row.title }),
        el('span.today-plan-item__meta', { text: [
          row.kind === 'work' ? 'Work' : 'Personal',
          row.rolloverFrom ? `Rolled from ${dateLabel(row.rolloverFrom)}` : null,
          row.dueDate ? `Due ${dateLabel(row.dueDate)}` : null,
        ].filter(Boolean).join(' · ') }),
      ]),
      el('button.today-plan-item__remove', {
        type: 'button', 'aria-label': `Delete ${row.title}`, onclick: () => removePlannerTask(row.id),
      }, ['×']),
    ])
  }

  function plannerDetail() {
    const row = plannerRows.find((item) => item.id === plannerDetailId)
    if (!row) return null
    const title = el('textarea.task-detail__title', { rows: 3, 'aria-label': 'Task title', value: row.title })
    const notes = el('textarea.task-detail__notes', {
      rows: 6, 'aria-label': 'Task notes', placeholder: 'Add notes or details…', value: row.notes ?? '',
    })
    const due = el('input.task-detail__due', { type: 'date', value: row.dueDate ?? '', 'aria-label': 'Optional due date' })
    let kind = row.kind === 'work' ? 'work' : 'personal'
    const kindButtons = ['personal', 'work'].map((value) => el('button.task-detail__kind', {
      type: 'button', dataset: { active: String(kind === value), kind: value },
      onclick: () => {
        kind = value
        for (const button of kindButtons) button.dataset.active = String(button.dataset.kind === kind)
      },
    }, [value === 'work' ? 'Work' : 'Personal']))
    const close = () => { plannerDetailId = null; render() }
    return el('div.task-detail-overlay', {
      dataset: { taskDetail: row.id }, onclick: (event) => { if (event.target === event.currentTarget) close() },
    }, [
      el('section.task-detail-card', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'task-detail-heading' }, [
        el('div.task-detail-card__head', {}, [
          el('h2.task-detail-card__heading', { id: 'task-detail-heading', text: 'Edit task' }),
          el('button.task-detail-card__close', { type: 'button', 'aria-label': 'Close task details', onclick: close }, ['×']),
        ]),
        el('label.task-detail__field', {}, [el('span', { text: 'Task' }), title]),
        el('label.task-detail__field', {}, [el('span', { text: 'Notes' }), notes]),
        el('label.task-detail__field', {}, [el('span', { text: 'Optional due date' }), due]),
        el('div.task-detail__field', {}, [el('span', { text: 'Type' }), el('div.task-detail__kinds', {}, kindButtons)]),
        el('div.task-detail__actions', {}, [
          el('button.button.task-detail__delete', { type: 'button', onclick: () => removePlannerTask(row.id) }, ['Delete']),
          el('button.button', { type: 'button', onclick: close }, ['Cancel']),
          el('button.button.task-detail__save', {
            type: 'button', onclick: () => updatePlannerTask(row.id, {
              title: title.value, notes: notes.value, dueDate: due.value, kind,
            }),
          }, ['Save']),
        ]),
      ]),
    ])
  }

  function calendarRail() {
    const dates = weekDates(selectedDate)
    return el('section.today-calendar', { 'aria-label': 'Choose day' }, [
      el('div.today-calendar__head', {}, [
        el('button.today-calendar__nav', {
          type: 'button', 'aria-label': 'Previous week', onclick: () => selectDate(addDays(selectedDate, -7)),
        }, ['‹']),
        el('span.today-calendar__month', { text: monthLabel(selectedDate) }),
        el('button.today-calendar__nav', {
          type: 'button', 'aria-label': 'Next week', onclick: () => selectDate(addDays(selectedDate, 7)),
        }, ['›']),
      ]),
      el('div.today-calendar__days', {}, dates.map((dateKey) => {
        const date = parseDate(dateKey)
        return el('button.today-calendar__day', {
          type: 'button',
          dataset: { selected: String(dateKey === selectedDate), today: String(dateKey === realToday) },
          onclick: () => selectDate(dateKey),
        }, [
          el('span.today-calendar__dow', { text: new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date) }),
          el('span.today-calendar__num', { text: String(date.getDate()) }),
        ])
      })),
      !isRealToday() && el('button.today-calendar__back', { type: 'button', onclick: () => selectDate(realToday) }, ['Back to today']),
    ])
  }

  function weeklyExerciseGroups() {
    if (!weekProgram?.week?.days) return []
    const byExercise = new Map()
    for (const dayEntry of weekProgram.week.days) {
      for (const task of dayEntry.tasks) {
        const id = task.slot.exerciseId
        const existing = byExercise.get(id) ?? {
          id, name: task.slot.name,
          prescription: `${task.slot.sets} × ${task.slot.repMin}–${task.slot.repMax}`,
          target: 0, done: 0, started: false, firstOpen: null, firstAny: null,
        }
        existing.target += 1
        if (task.done) existing.done += 1
        if (task.started) existing.started = true
        const ref = { task, programDay: dayEntry.day }
        if (!existing.firstAny) existing.firstAny = ref
        if (!task.done && !existing.firstOpen) existing.firstOpen = ref
        byExercise.set(id, existing)
      }
    }
    const overrides = weekProgram?.exerciseFrequencyTargets ?? {}
    const frequencyDone = weekProgram?.exerciseFrequencyDone ?? {}
    for (const group of byExercise.values()) {
      const override = Number(overrides[group.id])
      if (Number.isFinite(override) && override > 0) {
        group.target = override
        group.done = frequencyDone[group.id] ?? 0
        group.frequencyOverride = true
      }
    }
    return [...byExercise.values()].sort((a, b) =>
      Number(a.done >= a.target) - Number(b.done >= b.target) || a.name.localeCompare(b.name))
  }

  function openExerciseGroup(group) {
    if (!isRealToday() || !onOpenSlot) return
    const ref = group.firstOpen ?? group.firstAny
    if (group.frequencyOverride && !group.firstOpen && group.done < group.target) {
      onOpenSlot({ exerciseId: group.id, extra: true })
      return
    }
    if (!ref) return
    onOpenSlot({
      dayId: ref.programDay.id,
      slotIndex: ref.task.index,
      exerciseId: ref.task.slot.exerciseId,
      slot: ref.task.slot,
      alreadyLogged: ref.task.logged,
    })
  }

  function renderDayDetails() {
    const groups = weeklyExerciseGroups()
    replace(root, [
      el('header.train-r4__subheader', {}, [
        el('button.train-r4__back', {
          type: 'button', 'aria-label': 'Back to Today',
          onclick: () => { dayDetailsOpen = false; plannerDetailId = null; render() },
        }, ['‹']),
        el('h1.screen__title', { text: 'Day details' }),
      ]),
      calendarRail(),
      el('section.today-card', {}, [
        el('div.today-card__heading-row', {}, [
          el('h2', { text: 'Planner' }),
          el('button.today-text-button', {
            type: 'button', onclick: () => { plannerComposerOpen = !plannerComposerOpen; render() },
          }, [plannerComposerOpen ? 'Close' : '+ Add task']),
        ]),
        plannerComposerOpen && plannerComposer(),
        el('div.today-plan', {}, plannerRows.length
          ? plannerRows.map(plannerItem)
          : [el('p', { text: 'No tasks for this day.' })]),
      ]),
      isRealToday() && groups.length > 0 && el('section.today-card', {}, [
        el('h2', { text: 'Program exercises' }),
        el('div.today-list', {}, groups.map((group) => el('button.today-item.today-item--exercise', {
          type: 'button', onclick: () => openExerciseGroup(group),
        }, [
          el('span.today-item__main', {}, [
            el('span.today-item__name', { text: group.name }),
            el('span.today-item__meta', { text: `${group.prescription} · ${group.done} / ${group.target} this week` }),
          ]),
          el('span.today-item__cta', { text: group.done >= group.target ? 'Done' : 'Log sets' }),
        ]))),
      ]),
      el('section.today-card', {}, [
        el('h2', { text: 'Daily recap' }),
        el('p', { text: `${trainingStats.minutes} training min · ${trainingStats.workingSets} working sets · ${trainingStats.exercises} exercises · ${trainingStats.sessions} sessions` }),
        el('div.today-recap__lifestyle', { dataset: { lifestyleRecapHost: 'true' } }),
      ]),
      plannerDetail(),
    ])
  }

  function dailyLogCard(allActivities) {
    const dailyRows = allActivities
      .filter((activity) => activity.cadence === 'daily' && !FUEL_ACTIVITY_IDS.has(activity.id))
      .map((activity) => ({ activity, weekly: null }))
    const weeklyRows = (weekActivities?.activities ?? [])
      .filter((activity) => !FUEL_ACTIVITY_IDS.has(activity.id))
      .map((activity) => ({ activity, weekly: activity }))
    const rows = [...dailyRows, ...weeklyRows].sort((a, b) => {
      const aDone = rowComplete(a.activity, a.weekly)
      const bDone = rowComplete(b.activity, b.weekly)
      return Number(aDone) - Number(bDone)
        || (a.activity.name ?? '').localeCompare(b.activity.name ?? '')
    })
    const extras = allActivities
      .filter((activity) => activity.cadence === 'off' && !FUEL_ACTIVITY_IDS.has(activity.id))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

    return el('section.today-card.today-daily-log', { dataset: { section: 'daily' } }, [
      el('h2', { text: 'Daily log' }),
      justEarned && el('p.today-earned', { text: `+${justEarned.xp} points${justEarned.levelled ? ` · ${justEarned.levelled}` : ''}` }),
      el('div.today-list', {}, rows.length
        ? rows.map(({ activity, weekly }) => activityItem(activity, weekly))
        : [el('div.today-daily-log__empty', { text: 'No daily items scheduled.' })]),
      extras.length > 0 && el('button.today-daily-log__more', {
        type: 'button', dataset: { other: 'toggle', open: String(otherOpen) },
        'aria-expanded': String(otherOpen),
        onclick: () => { otherOpen = !otherOpen; render() },
      }, [otherOpen ? '− Close extra logging' : '+ Log something else']),
      otherOpen && extras.length > 0 && el('div.today-list.today-list--extras', {}, extras.map((activity) => activityItem(activity))),
      el('button.today-daily-log__more', {
        type: 'button', dataset: { dayDetails: 'open' },
        onclick: () => { dayDetailsOpen = true; render() },
      }, ['Day details · planner, dates, program exercises']),
    ])
  }

  function render() {
    root.dataset.date = selectedDate
    if (dayDetailsOpen) { renderDayDetails(); return }
    const allActivities = sortActivities([
      ...(day?.outstanding ?? []),
      ...(day?.logged ?? []),
    ])

    replace(root, [
      el('header.today-heading', {}, [
        el('div.today-heading__title-row', {}, [
          el('h1.screen__title', { text: isRealToday() ? 'Today' : 'Day review' }),
          el('button.today-settings', {
            type: 'button', 'aria-label': 'Settings', title: 'Settings', onclick: onSettings,
          }, [icon('gear')]),
        ]),
        el('p.today-heading__date', { text: dateLabel(selectedDate) }),
      ]),
      sessionCard(),
      readinessCard(),
      weekCard(),
      fuelCard(allActivities),
      dailyLogCard(allActivities),
    ])

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tempered:today-rendered', {
        detail: { date: selectedDate },
      }))
    }
  }

  async function reload() {
    const dates = weekDates(selectedDate)
    ;[todayProgram, weekProgram, day, weekActivities, quickPresets, trainingStats, profile, dayLogs, weekTraining, plannerRows] = await Promise.all([
      isRealToday() ? workout.todayTasks() : Promise.resolve(null),
      isRealToday() ? workout.weekStatus() : Promise.resolve(null),
      daily.forDate(selectedDate),
      daily.week(selectedDate),
      daily.quickAddPresets(),
      workout.dayTrainingStats(selectedDate),
      storage.get('profile', 'profile').then((value) => value ?? { id: 'profile' }),
      storage.getAll('dayLogs'),
      Promise.all(dates.map(async (date) => ({ date, stats: await workout.dayTrainingStats(date) }))),
      planner ? planner.list(selectedDate) : Promise.resolve([]),
    ])
    render()
  }

  async function selectDate(dateKey) {
    closeMobilityScreen()
    selectedDate = dateKey
    openActivityId = null
    selectedMobilityRoutineId = null
    readinessInfoOpen = false
    otherOpen = false
    plannerComposerOpen = false
    plannerDetailId = null
    await reload()
  }

  async function refresh() {
    closeMobilityScreen()
    selectedDate = clock.today()
    openActivityId = null
    selectedMobilityRoutineId = null
    readinessInfoOpen = false
    otherOpen = false
    dayDetailsOpen = false
    plannerComposerOpen = false
    plannerDetailId = null
    justEarned = null
    await reload()
  }

  return {
    root,
    primary() { return null },
    refresh,
    showDate: selectDate,
    deactivate() { closeMobilityScreen() },
  }
}
