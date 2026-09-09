/**
 * TODAY — day planner + calm tracker + flexible training surface.
 *
 * Health habits, dated todos and program exercise slots are different kinds of
 * work, so they stay visually distinct while sharing one calendar day. A
 * workout session is a convenience path through exercise slots, never the only
 * way to complete them.
 */

import { el, replace } from '../dom.js'
import { icon, iconForActivity } from '../icons.js'
import { xp as formatXp } from '../format.js'
import { ATTRIBUTE_IDS } from '../../domain/tiers.js'
import { sortActivities } from '../../domain/activities.js'
import { totalsByAttributeFromSources } from '../../domain/xp-engine.js'

const DEFAULT_QUICK_ADD = Object.freeze({
  water: 20,
  protein_target: 25,
  micro_cardio: 2,
  mobility: 5,
  read: 10,
  study: 10,
  meditate: 5,
  instrument: 10,
})

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

function sameCalendarWeek(a, b) {
  return weekStart(a) === weekStart(b)
}

function weekDates(dateKey) {
  const start = weekStart(dateKey)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function dateLabel(dateKey) {
  const date = parseDate(dateKey)
  if (Number.isNaN(date.getTime())) return dateKey
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(date)
}

function monthLabel(dateKey) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(parseDate(dateKey))
}

function clampedPercent(done, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

export function createTodayScreen({ workout, daily, planner, clock, onStart, onOpenSlot }) {
  const root = el('div.screen.screen--today.screen--today-calm')
  const realToday = clock.today()
  let selectedDate = realToday
  let todayProgram = null
  let weekProgram = null
  let day = null
  let weekActivities = null
  let plannerRows = []
  let quickPresets = {}
  let movedToday = {}
  let justEarned = null
  let openActivityId = null
  let habitsOpen = true
  let plannerOpen = true
  let plannerComposerOpen = false
  let plannerKind = 'personal'
  let plannerDetailId = null
  let trainingOpen = false
  let trainingDoneOpen = false
  let weeklyOpen = false
  let workedOpen = false
  let otherOpen = false
  let dailyRecapOpen = false
  let trainingStats = { minutes: 0, workingSets: 0, exercises: 0, sessions: 0 }

  const canLogSelected = () => selectedDate <= realToday
  const isRealToday = () => selectedDate === realToday

  function todayXp() {
    return Object.values(movedToday).reduce((sum, n) => sum + (n ?? 0), 0)
  }

  function quickPresetFor(activity) {
    if (!isAdditiveNumber(activity)) return null
    const stored = Number(quickPresets?.[activity.id])
    if (Number.isFinite(stored) && stored > 0) return stored
    return DEFAULT_QUICK_ADD[activity.id] ?? null
  }

  function statusFor(activity, weekly = null) {
    if (weekly) {
      const suffix = weekly.loggedToday && !weekly.complete ? ' · done this day' : ''
      return `${weekly.weeklyDone} / ${weekly.weeklyTarget} this week${suffix}`
    }
    if (hasDailyGoal(activity)) return dailyGoalLabel(activity)
    if (activity.logged) return valueLabel(activity, activity.value)
    if (!canLogSelected()) return 'Planned for this day'
    const unit = unitLabel(activity)
    return unit ? `Tap to log ${unit}` : 'Tap to log'
  }

  function compactGlyph(activity, complete = false) {
    const glyph = activity.id === 'micro_cardio' ? 'steps' : iconForActivity(activity.id)
    return el('span.today-item__icon', {
      dataset: { complete: String(complete), attribute: activity.attribute ?? '' },
    }, [icon(complete ? 'check' : glyph)])
  }

  function earnedBanner() {
    if (!justEarned || justEarned.xp <= 0) return null
    return el('div.today-earned', { dataset: { earned: justEarned.id } }, [
      el('span.today-earned__xp', { text: `+${formatXp(justEarned.xp)} XP` }),
      el('span.today-earned__copy', {
        text: justEarned.levelled ? justEarned.levelled : 'Added to this day',
      }),
    ])
  }

  async function savePreset(activity, raw) {
    await daily.setQuickAddPreset(activity.id, raw)
    quickPresets = await daily.quickAddPresets()
    render()
  }

  function editor(activity, weekly = null) {
    const adding = isAdditiveNumber(activity)
    const unit = unitLabel(activity)
    const sleep = activity.id === 'sleep'
    const input = el('input.today-editor__input', {
      type: sleep ? 'number' : 'text', inputmode: 'decimal',
      ...(sleep ? {
        min: '0', max: '24', step: '0.1',
        value: typeof activity.value === 'number' ? String(activity.value) : '',
      } : {}),
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
          type: 'button',
          dataset: { sleepquick: String(hours) },
          onclick: () => { input.value = String(hours); input.focus() },
        }, [`${hours} h`]))),
      el('div.today-editor__manual', {}, [
        input,
        el('button.today-editor__save', {
          type: 'button', disabled: !canLogSelected(), dataset: { action: 'log' },
          onclick: () => record(activity, input.value),
        }, [adding ? 'Add' : 'Save']),
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
          ? 'Save an amount to turn SET + into a one-tap add.'
          : `The green button adds ${preset}${unit ? ` ${unit}` : ''} in one tap.`,
      }),
      weekly && el('span.today-editor__hint', { text: statusFor(activity, weekly) }),
    ])
  }

  function markItem(activity, weekly = null) {
    const complete = weekly ? weekly.complete : dailyGoalComplete(activity)
    const alreadyThisDay = weekly?.loggedToday === true
    const inactive = !canLogSelected() || Boolean(weekly && alreadyThisDay)
    return el('button.today-item.today-item--mark', {
      type: 'button', disabled: inactive,
      dataset: {
        activity: activity.id, action: 'mark', complete: String(complete), today: String(alreadyThisDay),
      },
      'aria-label': inactive ? activity.name : `Log ${activity.name}`,
      onclick: inactive ? null : () => record(activity, null),
    }, [
      compactGlyph(activity, complete || alreadyThisDay),
      el('span.today-item__main', {}, [
        el('span.today-item__name', { text: activity.name }),
        weekly && el('span.today-item__meta', { text: statusFor(activity, weekly) }),
      ]),
      !weekly && complete && el('span.today-item__meta', { text: 'Done' }),
      !inactive && !complete && el('span.today-item__action', { text: '○' }),
    ])
  }

  function numberItem(activity, weekly = null) {
    const open = openActivityId === activity.id
    const complete = weekly ? weekly.complete : dailyGoalComplete(activity)
    const adding = isAdditiveNumber(activity)
    const preset = quickPresetFor(activity)
    const unit = unitLabel(activity)
    return el('div.today-item-wrap', {
      dataset: { open: String(open), activity: activity.id },
    }, [
      el('div.today-item.today-item--number', {
        dataset: { action: 'open-log', complete: String(complete) },
      }, [
        el('button.today-item__body', {
          type: 'button', disabled: !canLogSelected(), 'aria-expanded': String(open),
          onclick: () => {
            if (!canLogSelected()) return
            openActivityId = open ? null : activity.id
            render()
          },
        }, [
          compactGlyph(activity, complete),
          el('span.today-item__main', {}, [
            el('span.today-item__name', { text: activity.short ?? activity.name }),
            el('span.today-item__meta', { text: statusFor(activity, weekly) }),
          ]),
        ]),
        adding && canLogSelected() && el('button.today-item__quick', {
          type: 'button',
          dataset: preset !== null ? { quickadd: String(preset) } : { quicksetup: 'true' },
          'aria-label': preset !== null
            ? `Add ${preset} ${activity.unit ?? ''} to ${activity.name}`
            : `Set one-tap amount for ${activity.name}`,
          onclick: () => {
            if (preset !== null) {
              record(activity, String(preset))
              return
            }
            openActivityId = activity.id
            render()
          },
        }, [preset !== null ? `+${preset}${unit ? ` ${unit}` : ''}` : 'SET +']),
        canLogSelected() && el('button.today-item__expand', {
          type: 'button', 'aria-label': `${open ? 'Close' : 'Open'} ${activity.name} details`,
          'aria-expanded': String(open),
          onclick: () => { openActivityId = open ? null : activity.id; render() },
        }, [icon(open ? 'up' : 'down')]),
      ]),
      open && editor(activity, weekly),
    ])
  }

  function activityItem(activity, weekly = null) {
    if (activity.spec?.entry === 'mark') return markItem(activity, weekly)
    return numberItem(activity, weekly)
  }

  function workedItem(activity, weekly = null) {
    return el('div.today-item.today-item--worked', { dataset: { worked: activity.id } }, [
      compactGlyph(activity, true),
      el('span.today-item__main', {}, [
        el('span.today-item__name', { text: activity.name }),
        el('span.today-item__meta', {
          text: weekly
            ? `${weekly.weeklyDone} / ${weekly.weeklyTarget} this week`
            : (hasDailyGoal(activity) ? dailyGoalLabel(activity) : valueLabel(activity, activity.value)),
        }),
      ]),
    ])
  }

  function weeklyExerciseGroups() {
    if (!weekProgram?.week?.days) return []
    const byExercise = new Map()
    for (const dayEntry of weekProgram.week.days) {
      for (const task of dayEntry.tasks) {
        const id = task.slot.exerciseId
        const existing = byExercise.get(id) ?? {
          id,
          name: task.slot.name,
          prescription: `${task.slot.sets} × ${task.slot.repMin}–${task.slot.repMax}`,
          target: 0,
          done: 0,
          started: false,
          firstOpen: null,
          firstAny: null,
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
    return [...byExercise.values()].sort((a, b) => {
      const aComplete = a.done >= a.target
      const bComplete = b.done >= b.target
      return Number(aComplete) - Number(bComplete) || a.name.localeCompare(b.name)
    })
  }

  function openExerciseGroup(group) {
    if (!isRealToday()) return
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

  function exerciseItem(group) {
    const complete = group.done >= group.target
    return el('button.today-item.today-item--exercise', {
      type: 'button', disabled: !isRealToday(),
      dataset: { exerciseweek: group.id, done: String(complete), started: String(group.started) },
      onclick: () => openExerciseGroup(group),
    }, [
      el('span.today-item__icon', { dataset: { complete: String(complete), attribute: 'might' } }, [
        icon(complete ? 'check' : 'train'),
      ]),
      el('span.today-item__main', {}, [
        el('span.today-item__name', { text: group.name }),
        el('span.today-item__meta', {
          text: `${group.prescription} · ${group.done} / ${group.target} this week${group.started && !complete ? ' · in progress' : ''}`,
        }),
      ]),
      !complete && isRealToday() && el('span.today-item__cta', { text: 'Log sets' }),
    ])
  }

  function trainingSummary(groups) {
    const active = groups.filter((group) => group.done < group.target)
    const complete = groups.filter((group) => group.done >= group.target)
    const todayDone = todayProgram?.tasks?.length > 0 && todayProgram.tasks.every((task) => task.done)
    return {
      active, complete, todayDone,
      label: todayProgram?.day?.name ?? 'Strength training',
      canStart: isRealToday() && Boolean(todayProgram?.day) && !todayDone,
    }
  }

  async function addPlannerTask(input) {
    const row = await planner.add({ date: selectedDate, title: input.value, kind: plannerKind })
    if (!row) return
    input.value = ''
    plannerComposerOpen = false
    plannerRows = await planner.list(selectedDate)
    render()
  }

  async function togglePlannerTask(id) {
    await planner.toggle(id)
    plannerRows = await planner.list(selectedDate)
    render()
  }

  async function removePlannerTask(id) {
    await planner.remove(id)
    if (plannerDetailId === id) plannerDetailId = null
    plannerRows = await planner.list(selectedDate)
    render()
  }

  async function updatePlannerTask(id, values) {
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
        el('div.today-plan-kind', { role: 'group', 'aria-label': 'Task type' }, [
          ...['personal', 'work'].map((kind) => el('button.today-plan-kind__button', {
            type: 'button', dataset: { active: String(plannerKind === kind) },
            onclick: () => { plannerKind = kind; render() },
          }, [kind === 'work' ? 'Work' : 'Personal'])),
        ]),
        el('button.today-plan-compose__add', {
          type: 'button', onclick: () => addPlannerTask(input),
        }, ['Add task']),
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
        type: 'button', 'aria-label': `Open details for ${row.title}`,
        onclick: () => { plannerDetailId = row.id; render() },
      }, [
        el('span.today-plan-item__title', { text: row.title }),
        el('span.today-plan-item__meta', {}, [
          el('span.today-plan-item__kind', { text: row.kind === 'work' ? 'WORK' : 'PERSONAL' }),
          row.rolloverFrom && el('span.today-plan-item__rolled', {
            text: `Rolled from ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseDate(row.rolloverFrom))}`,
          }),
          row.dueDate && el('span.today-plan-item__due', {
            text: `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseDate(row.dueDate))}`,
          }),
        ]),
      ]),
      el('button.today-plan-item__remove', {
        type: 'button', 'aria-label': `Delete ${row.title}`, onclick: () => removePlannerTask(row.id),
      }, ['×']),
    ])
  }

  function plannerDetail() {
    const row = plannerRows.find((item) => item.id === plannerDetailId)
    if (!row) return null
    const title = el('textarea.task-detail__title', {
      rows: 3, 'aria-label': 'Task title', value: row.title,
    })
    const notes = el('textarea.task-detail__notes', {
      rows: 6, 'aria-label': 'Task notes', placeholder: 'Add notes or details…', value: row.notes ?? '',
    })
    const due = el('input.task-detail__due', {
      type: 'date', value: row.dueDate ?? '', 'aria-label': 'Optional due date',
    })
    let kind = row.kind === 'work' ? 'work' : 'personal'
    const kindButtons = ['personal', 'work'].map((value) => el('button.task-detail__kind', {
      type: 'button', dataset: { active: String(kind === value), kind: value },
      onclick: () => {
        kind = value
        for (const button of kindButtons) button.dataset.active = String(button.dataset.kind === kind)
      },
    }, [value === 'work' ? 'WORK' : 'PERSONAL']))
    const close = () => { plannerDetailId = null; render() }
    return el('div.task-detail-overlay', {
      dataset: { taskDetail: row.id }, onclick: (event) => { if (event.target === event.currentTarget) close() },
    }, [
      el('section.task-detail-card', {
        role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'task-detail-heading',
      }, [
        el('div.task-detail-card__head', {}, [
          el('div', {}, [
            el('span.task-detail-card__eyebrow', { text: row.rolloverFrom ? 'ROLLED TASK' : 'TASK DETAILS' }),
            el('h2.task-detail-card__heading', { id: 'task-detail-heading', text: 'Edit task' }),
          ]),
          el('button.task-detail-card__close', {
            type: 'button', 'aria-label': 'Close task details', onclick: close,
          }, ['×']),
        ]),
        el('label.task-detail__field', {}, [el('span', { text: 'Task' }), title]),
        el('label.task-detail__field', {}, [el('span', { text: 'Notes' }), notes]),
        el('label.task-detail__field', {}, [el('span', { text: 'Optional due date' }), due]),
        el('div.task-detail__field', {}, [
          el('span', { text: 'Type' }),
          el('div.task-detail__kinds', { role: 'group', 'aria-label': 'Task type' }, kindButtons),
        ]),
        row.rolloverFrom && el('p.task-detail__rollover', {
          text: `Created ${dateLabel(row.rolloverFrom)}. It will keep rolling forward until you check it off.`,
        }),
        el('div.task-detail__actions', {}, [
          el('button.button.task-detail__delete', {
            type: 'button', onclick: () => removePlannerTask(row.id),
          }, ['DELETE']),
          el('button.button', { type: 'button', onclick: close }, ['CANCEL']),
          el('button.button.task-detail__save', {
            type: 'button', onclick: async () => {
              const saved = await updatePlannerTask(row.id, {
                title: title.value, notes: notes.value, dueDate: due.value, kind,
              })
              if (!saved) {
                title.setAttribute('aria-invalid', 'true')
                title.focus()
              }
            },
          }, ['SAVE']),
        ]),
      ]),
    ])
  }

  function foldHeader({ title, detail, open, onToggle, action = null, dataset = {} }) {
    return el('div.today-section__head.today-section__head--fold', { dataset }, [
      el('button.today-section__fold', {
        type: 'button', 'aria-expanded': String(open), onclick: onToggle,
      }, [
        el('span.today-section__fold-copy', {}, [
          el('span.today-section__title', { text: title }),
          detail && el('span.today-section__detail', { text: detail }),
        ]),
        el('span.today-section__fold-chevron', {}, [icon(open ? 'up' : 'down')]),
      ]),
      action,
    ])
  }

  function summaryCard(done, total) {
    const percent = clampedPercent(done, total)
    const xp = todayXp()
    return el('section.today-summary', { dataset: { summary: 'daily' } }, [
      el('div.today-summary__top', {}, [
        el('div.today-summary__copy', {}, [
          el('span.today-summary__eyebrow', { text: isRealToday() ? 'DAILY PROGRESS' : 'DAY PROGRESS' }),
          el('strong.today-summary__headline', { text: total > 0 ? `${done}/${total}` : 'CLEAR' }),
          total > 0 && el('span.today-summary__percent', { text: `${percent}%` }),
        ]),
        xp > 0 && el('span.today-summary__xp', { text: `+${formatXp(xp)} XP` }),
        el('button.today-summary__recap', {
          type: 'button', dataset: { dailyRecap: 'open' }, onclick: () => openDailyRecap(done, total),
        }, ['DAILY RECAP']),
      ]),
      total > 0 && el('div.today-summary__bar', {
        role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total),
        'aria-valuenow': String(done), 'aria-label': `${done} of ${total} daily items complete`,
      }, [el('span.today-summary__fill', { style: `width:${percent}%` })]),
    ])
  }

  function openDailyRecap(done, total) {
    if (dailyRecapOpen) return
    dailyRecapOpen = true
    const overlay = dailyRecap(done, total)
    if (overlay) root.append(overlay)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tempered:today-rendered', {
        detail: { date: selectedDate },
      }))
    }
    queueMicrotask(() => root.querySelector('[data-daily-recap="close"]')?.focus())
  }

  function closeDailyRecap() {
    root.querySelector('[data-daily-recap="overlay"]')?.remove()
    dailyRecapOpen = false
    queueMicrotask(() => root.querySelector('[data-daily-recap="open"]')?.focus())
  }

  function dailyRecap(done, total) {
    if (!dailyRecapOpen) return null
    const stat = (label, value) => el('div.today-recap__stat', {}, [
      el('strong', { text: String(value) }),
      el('span', { text: label }),
    ])
    return el('div.today-recap-overlay', {
      dataset: { dailyRecap: 'overlay' },
      onclick: (event) => { if (event.target === event.currentTarget) closeDailyRecap() },
      onkeydown: (event) => { if (event.key === 'Escape') closeDailyRecap() },
    }, [
      el('section.today-recap', {
        role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'daily-recap-title',
        dataset: { dailyRecap: 'card' },
      }, [
        el('header.today-recap__head', {}, [
          el('div', {}, [
            el('span.today-recap__eyebrow', { text: dateLabel(selectedDate) }),
            el('h2.today-recap__title', { id: 'daily-recap-title', text: 'Daily recap' }),
            el('p.today-recap__detail', {
              text: total > 0 ? `${done} of ${total} daily trackers complete` : 'No daily trackers scheduled',
            }),
          ]),
          el('button.today-recap__close', {
            type: 'button', 'aria-label': 'Close daily recap', dataset: { dailyRecap: 'close' },
            onclick: closeDailyRecap,
          }, ['×']),
        ]),
        el('div.today-recap__training', { 'aria-label': 'Exercise summary' }, [
          stat('MINUTES', trainingStats.minutes),
          stat('WORK SETS', trainingStats.workingSets),
          stat('MOVEMENTS', trainingStats.exercises),
          stat('SESSIONS', trainingStats.sessions),
        ]),
        el('div.today-recap__lifestyle', { dataset: { lifestyleRecapHost: 'true' } }),
      ]),
    ])
  }

  async function record(activity, value, options = {}) {
    if (!canLogSelected()) return
    const result = await daily.logAt(selectedDate, activity.id, value, options)
    const earned = Object.values(result.xpByAttribute ?? {}).reduce((sum, n) => sum + n, 0)
    justEarned = {
      id: activity.id,
      xp: earned,
      levelled: result.levelledUp?.[0]
        ? `${result.levelledUp[0].attribute} reached ${result.levelledUp[0].tier}`
        : null,
    }
    openActivityId = null
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(10) } catch { /* optional */ }
    }
    await reload()
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
        const isToday = dateKey === realToday
        return el('button.today-calendar__day', {
          type: 'button',
          dataset: { selected: String(dateKey === selectedDate), today: String(isToday) },
          'aria-current': dateKey === selectedDate ? 'date' : null,
          onclick: () => selectDate(dateKey),
        }, [
          el('span.today-calendar__dow', { text: new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date) }),
          el('span.today-calendar__num', { text: String(date.getDate()) }),
          isToday && el('span.today-calendar__dot'),
        ])
      })),
      !isRealToday() && el('button.today-calendar__back', {
        type: 'button', onclick: () => selectDate(realToday),
      }, ['Back to today']),
    ])
  }

  function render() {
    root.dataset.date = selectedDate
    const allActivities = sortActivities([
      ...(day?.outstanding ?? []),
      ...(day?.logged ?? []),
    ])
    const dailyScheduled = allActivities.filter((a) => a.cadence === 'daily')
    const dailyComplete = dailyScheduled.filter((a) => dailyGoalComplete(a))
    const dailyActive = dailyScheduled.filter((a) => !dailyGoalComplete(a) || staysEditableAfterComplete(a))
    const dailyWorked = dailyComplete.filter((a) => !staysEditableAfterComplete(a))

    const offScheduled = allActivities.filter((a) => a.cadence === 'off')
    const offLogged = offScheduled.filter((a) => a.logged)
    const offAvailable = offScheduled.filter((a) => !a.logged || a.spec?.entry !== 'mark' || justEarned?.id === a.id)

    const weeklyLifestyle = weekActivities?.activities ?? []
    const activeWeeklyLifestyle = weeklyLifestyle.filter((a) => !a.complete)
    const doneWeeklyLifestyle = weeklyLifestyle.filter((a) => a.complete)
    const exerciseGroups = weeklyExerciseGroups()
    const training = trainingSummary(exerciseGroups)

    const dailyDone = dailyComplete.length
    const dailyTotal = dailyScheduled.length
    const plannerDone = plannerRows.filter((row) => row.done).length
    const plannerOpenCount = plannerRows.length - plannerDone
    const weeklyDone = weeklyLifestyle.reduce((sum, a) => sum + Math.min(a.weeklyDone, a.weeklyTarget), 0)
    const weeklyTotal = weeklyLifestyle.reduce((sum, a) => sum + a.weeklyTarget, 0)
    const workedCount = dailyWorked.length + doneWeeklyLifestyle.length + offLogged.length

    replace(root, [
      el('h1.sr-only', { text: isRealToday() ? 'Today' : dateLabel(selectedDate) }),

      calendarRail(),
      summaryCard(dailyDone, dailyTotal),
      earnedBanner(),

      el('section.today-section.today-section--planner', { dataset: { section: 'planner' } }, [
        foldHeader({
          title: 'Plan',
          detail: plannerRows.length === 0
            ? 'Personal + work tasks'
            : `${plannerDone} of ${plannerRows.length} done${plannerOpenCount ? ` · ${plannerOpenCount} left` : ''}`,
          open: plannerOpen,
          onToggle: () => { plannerOpen = !plannerOpen; render() },
          dataset: { fold: 'planner' },
          action: el('button.today-section__add', {
            type: 'button', 'aria-label': 'Add task',
            onclick: () => { plannerOpen = true; plannerComposerOpen = !plannerComposerOpen; render() },
          }, [icon('plus'), 'Task']),
        }),
        plannerOpen && el('div.today-plan', {}, [
          plannerComposerOpen && plannerComposer(),
          plannerRows.length > 0
            ? el('div.today-plan-list', {}, plannerRows.map(plannerItem))
            : !plannerComposerOpen && el('button.today-plan-empty', {
                type: 'button', onclick: () => { plannerComposerOpen = true; render() },
              }, ['Add a task to this day']),
        ]),
      ]),

      dailyTotal > 0 && el('section.today-section', { dataset: { section: 'daily' } }, [
        foldHeader({
          title: 'Habits', detail: dailyDone > 0 ? `${dailyDone} of ${dailyTotal} complete` : 'Daily trackers',
          open: habitsOpen,
          onToggle: () => { habitsOpen = !habitsOpen; render() },
          dataset: { fold: 'habits' },
        }),
        habitsOpen && (dailyActive.length > 0
          ? el('div.today-list', {}, dailyActive.map((a) => activityItem(a)))
          : el('div.today-empty', {}, [
              el('span.today-empty__check', {}, [icon('check')]),
              el('span', { text: 'Everything on this day’s habit list is complete.' }),
            ])),
      ]),

      isRealToday() && exerciseGroups.length > 0 && el('section.today-section.today-section--training', {
        dataset: { section: 'training' },
      }, [
        foldHeader({
          title: 'Training',
          detail: training.active.length === 0
            ? 'All current-week movements complete'
            : `${training.active.length} movement${training.active.length === 1 ? '' : 's'} still available this week`,
          open: trainingOpen,
          onToggle: () => { trainingOpen = !trainingOpen; render() },
          dataset: { fold: 'training' },
          action: training.canStart ? el('button.today-section__start', {
            type: 'button', dataset: { startday: todayProgram.day.id },
            onclick: () => onStart({ programDay: todayProgram.day }),
          }, [icon('play'), training.label]) : null,
        }),
        trainingOpen && el('div.today-training', {}, [
          training.active.length > 0
            ? el('div.today-list', {}, training.active.map(exerciseItem))
            : el('div.today-empty', {}, [
                el('span.today-empty__check', {}, [icon('check')]),
                el('span', { text: 'Current program work is complete.' }),
              ]),
          training.complete.length > 0 && el('button.today-secondary__button.today-training__completed-toggle', {
            type: 'button', onclick: () => { trainingDoneOpen = !trainingDoneOpen; render() },
          }, [icon(trainingDoneOpen ? 'up' : 'check'), `${training.complete.length} completed movement${training.complete.length === 1 ? '' : 's'}`]),
          trainingDoneOpen && training.complete.length > 0
            ? el('div.today-list.today-list--worked', {}, training.complete.map(exerciseItem))
            : null,
          el('p.today-training__hint', {
            text: 'Do these one at a time during the day, or start the full session. Both update the same workout plan.',
          }),
        ]),
      ]),

      weeklyTotal > 0 && el('section.today-section', { dataset: { section: 'weekly' } }, [
        foldHeader({
          title: 'Weekly goals', detail: `${weeklyDone} of ${weeklyTotal}`,
          open: weeklyOpen,
          onToggle: () => { weeklyOpen = !weeklyOpen; render() },
          dataset: { fold: 'weekly' },
        }),
        weeklyOpen && el('div.today-list', {}, [
          ...activeWeeklyLifestyle.map((a) => activityItem(a, a)),
          ...doneWeeklyLifestyle.map((a) => workedItem(a, a)),
        ]),
      ]),

      isRealToday() && (offAvailable.length > 0 || workedCount > 0) && el('div.today-secondary', {}, [
        offAvailable.length > 0 && el('button.today-secondary__button', {
          type: 'button', dataset: { other: 'toggle', open: String(otherOpen) },
          onclick: () => { otherOpen = !otherOpen; render() },
        }, [icon(otherOpen ? 'up' : 'plus'), otherOpen ? 'Close extra logging' : 'Log something else']),
        workedCount > 0 && el('button.today-secondary__button', {
          type: 'button', dataset: { worked: 'toggle', open: String(workedOpen) },
          onclick: () => { workedOpen = !workedOpen; render() },
        }, [icon(workedOpen ? 'up' : 'check'), `${workedCount} completed`]),
      ]),

      isRealToday() && otherOpen && offAvailable.length > 0 && el('section.today-section.today-section--quiet', {}, [
        el('div.today-list', {}, offAvailable.map((a) =>
          a.logged && a.spec?.entry === 'mark' ? workedItem(a) : activityItem(a))),
      ]),

      workedOpen && workedCount > 0 && el('section.today-section.today-section--quiet', {}, [
        el('div.today-list.today-list--worked', {}, [
          ...dailyWorked.map((a) => workedItem(a)),
          ...doneWeeklyLifestyle.map((a) => workedItem(a, a)),
          ...offLogged.map((a) => workedItem(a)),
        ]),
      ]),

      plannerDetail(),
    ])
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tempered:today-rendered', {
        detail: { date: selectedDate },
      }))
    }
  }

  async function selectDate(dateKey) {
    selectedDate = dateKey
    justEarned = null
    openActivityId = null
    plannerComposerOpen = false
    plannerDetailId = null
    dailyRecapOpen = false
    await reload()
  }

  async function reload() {
    ;[todayProgram, weekProgram, day, weekActivities, plannerRows, quickPresets, trainingStats] = await Promise.all([
      workout.todayTasks(),
      workout.weekStatus(),
      daily.forDate(selectedDate),
      daily.week(selectedDate),
      planner.list(selectedDate),
      daily.quickAddPresets(),
      workout.dayTrainingStats(selectedDate),
    ])

    const fromDay = totalsByAttributeFromSources(day?.day?.awarded ?? {})
    const fromTraining = isRealToday() ? await workout.xpToday() : {}
    movedToday = Object.fromEntries(ATTRIBUTE_IDS
      .map((id) => [id, (fromDay[id] ?? 0) + (fromTraining[id] ?? 0)]))
    render()
  }

  async function refresh() {
    selectedDate = clock.today()
    justEarned = null
    openActivityId = null
    plannerComposerOpen = false
    plannerDetailId = null
    dailyRecapOpen = false
    await reload()
  }

  return {
    root,
    primary() { return null },
    refresh,
  }
}
