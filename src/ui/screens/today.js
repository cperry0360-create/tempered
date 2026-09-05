/**
 * TODAY — two concepts only:
 *
 *   DAILY      resets every morning
 *   THIS WEEK  can be completed on any day, with a visible frequency target
 *
 * Attribute colours still explain RPG meaning, but they no longer dictate the
 * task list's information architecture.
 */

import { el, replace } from '../dom.js'
import { icon, iconForActivity } from '../icons.js'
import { xp as formatXp } from '../format.js'
import { ATTRIBUTE_IDS } from '../../domain/tiers.js'
import { sortActivities } from '../../domain/activities.js'
import { totalsByAttributeFromSources } from '../../domain/xp-engine.js'

const QUICK_ADD = {
  water: [8, 12, 16],
  protein_target: [20, 30, 40],
  read: [10, 20, 30],
  study: [10, 20, 30],
  meditate: [5, 10, 20],
  instrument: [10, 20, 30],
  mobility: [5, 10, 15],
}

function quickAddFor(activity) {
  return activity.spec?.mode === 'add' ? QUICK_ADD[activity.id] ?? null : null
}

function unitLabel(activity) {
  if (activity.id === 'body_metrics') return 'lb'
  return { hours: 'h', min: 'min', oz: 'oz', steps: 'steps', g: 'g', kcal: 'kcal' }[activity.unit] ?? ''
}

function valueLabel(activity, value) {
  if (value === true || value === null || value === undefined) return 'logged'
  const unit = activity.unit === 'hours' ? 'h'
    : activity.unit === 'min' ? 'min'
      : activity.unit === 'oz' ? 'oz'
        : activity.unit === 'steps' ? 'steps'
          : activity.unit === 'g' ? 'g'
            : activity.unit === 'kcal' ? 'kcal'
              : activity.id === 'body_metrics' ? 'lb' : ''
  return `${value}${unit ? ` ${unit}` : ''}`
}

/** A daily target can be a finish line or context; calories are tracking-only. */
export function hasDailyGoal(activity) {
  return (Number.isFinite(activity?.dailyCap) && activity.dailyCap > 0)
    || (Number.isFinite(activity?.goalPerLb) && activity.goalPerLb > 0)
}

/** Goal-based rows remain outstanding until the target is actually reached. */
export function dailyGoalComplete(activity) {
  if (activity?.id === 'calories_logged') return activity?.logged === true
  if (!hasDailyGoal(activity)) return activity?.logged === true
  if (!(Number.isFinite(activity?.dailyCap) && activity.dailyCap > 0)) return false
  return typeof activity.value === 'number' && activity.value >= activity.dailyCap
}

function dailyGoalLabel(activity) {
  if (!hasDailyGoal(activity)) return null
  if (!(Number.isFinite(activity?.dailyCap) && activity.dailyCap > 0)) return 'log body weight to set goal'
  const value = typeof activity.value === 'number' ? activity.value : 0
  const unit = unitLabel(activity)
  return `${value} / ${activity.dailyCap}${unit ? ` ${unit}` : ''}`
}

function dailyFill(activity) {
  if (activity?.id === 'calories_logged') return activity.logged ? 1 : 0
  const target = activity.dailyCap ?? activity.band?.[0] ?? null
  const value = typeof activity.value === 'number' ? activity.value : null
  if (target && value !== null) return Math.max(0, Math.min(1, value / target))
  return activity.logged ? 1 : 0
}

/** Additive numeric trackers remain on Today after completion for more entries/corrections. */
export function staysEditableAfterComplete(activity) {
  return activity?.spec?.entry === 'number' && activity?.spec?.mode === 'add'
}

function ring(fill) {
  const R = 15
  const circumference = 2 * Math.PI * R
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'ring')
  svg.setAttribute('viewBox', '0 0 34 34')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  for (const cls of ['ring__track', 'ring__fill']) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    c.setAttribute('class', cls)
    c.setAttribute('cx', '17')
    c.setAttribute('cy', '17')
    c.setAttribute('r', String(R))
    if (cls === 'ring__fill') {
      c.setAttribute('stroke-dasharray', String(circumference))
      c.setAttribute('stroke-dashoffset', String(circumference * (1 - Math.max(0, Math.min(1, fill)))))
    }
    svg.append(c)
  }
  return svg
}

export function createTodayScreen({ workout, daily, clock, onStart, onOpenSlot }) {
  const root = el('div.screen.screen--today')
  let todayProgram = null
  let weekProgram = null
  let day = null
  let weekActivities = null
  let movedToday = {}
  let justEarned = null
  let workedOpen = false
  let otherOpen = false

  const tile = (attribute, glyph) => el('span.tile', { dataset: { attribute } }, [icon(glyph)])

  function floatFor(id) {
    if (!justEarned || justEarned.id !== id || justEarned.xp <= 0) return null
    return el('span.float', {
      dataset: { attribute: justEarned.attribute ?? 'grit' },
      text: `+${formatXp(justEarned.xp)}`,
    })
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
      group.programTarget = group.target
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

  function exerciseRow(group) {
    const ref = group.firstOpen ?? group.firstAny
    const fill = group.target > 0 ? group.done / group.target : 0
    const complete = group.done >= group.target
    return el('button.row.task.weekly-row', {
      type: 'button',
      dataset: { exerciseweek: group.id, done: String(complete), started: String(group.started) },
      onclick: () => {
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
      },
    }, [
      tile('might', 'train'),
      el('span.row__name', { text: group.name }),
      el('span.row__value.weekly-row__count', {
        text: `${group.prescription} · ${group.done} / ${group.target} this week${group.started && !complete ? ' · in progress' : ''}`,
      }),
      el('span.row__act', {}, [ring(fill), complete && icon('check')]),
    ])
  }

  function quickAdd(activity) {
    return el('span.quick', {}, quickAddFor(activity).map((amount) => el('button.quick__add', {
      type: 'button',
      'aria-label': `Add ${amount} ${activity.unit ?? ''} to ${activity.name}`,
      onclick: () => record(activity, String(amount)),
    }, [`+${amount}`])))
  }

  function markRow(activity, weekly = null) {
    const fill = weekly ? weekly.weeklyDone / weekly.weeklyTarget : (activity.logged ? 1 : 0)
    const alreadyToday = weekly?.loggedToday === true
    return el('div.row.mark', {
      dataset: { activity: activity.id, kind: 'mark', weekly: String(Boolean(weekly)) },
    }, [
      tile(activity.attribute, iconForActivity(activity.id)),
      el('span.row__name', { text: activity.name }),
      weekly && el('span.row__value.weekly-row__count', {
        text: `${weekly.weeklyDone} / ${weekly.weeklyTarget} this week${alreadyToday && !weekly.complete ? ' · done today' : ''}`,
      }),
      alreadyToday
        ? el('span.row__act', {}, [ring(fill), icon('check')])
        : el('button.row__act', {
            type: 'button', title: activity.help ?? activity.name,
            'aria-label': `Log ${activity.name}`,
            onclick: () => record(activity, null),
          }, [ring(fill), icon(activity.id === 'rest_day' ? 'rest' : 'check')]),
      floatFor(activity.id),
    ])
  }

  function entryRow(activity, weekly = null) {
    const goal = !weekly && hasDailyGoal(activity)
    const adding = activity.spec?.mode === 'add'
    const unit = unitLabel(activity)
    const correctionMode = adding ? { mode: 'replace' } : {}
    const input = el('input.entry__value', {
      type: 'text', inputmode: 'decimal',
      placeholder: adding ? `total ${unit || 'amount'}` : '',
      'aria-label': `${adding ? 'Set total for' : 'Log'} ${activity.name}${activity.unit ? `, ${activity.unit}` : ''}`,
      dataset: { entry: activity.id },
      onkeydown: (event) => {
        if (event.key === 'Enter') { event.preventDefault(); record(activity, input.value, correctionMode) }
      },
    })
    const fill = weekly
      ? weekly.weeklyDone / weekly.weeklyTarget
      : dailyFill(activity)

    const label = goal
      ? el('span.entry__label', {}, [
          el('span.row__name', { text: activity.short ?? activity.name }),
          el('span.entry__progress', { text: dailyGoalLabel(activity) }),
        ])
      : el('span.row__name', {}, [
          activity.short ?? activity.name,
          !quickAddFor(activity) && el('span.entry__unit', { text: unit }),
        ])

    return el('div.row.entry', {
      dataset: {
        activity: activity.id,
        kind: 'number',
        weekly: String(Boolean(weekly)),
        goal: String(goal),
      },
    }, [
      tile(activity.attribute, iconForActivity(activity.id)),
      label,
      weekly && el('span.row__value.weekly-row__count', {
        text: `${weekly.weeklyDone} / ${weekly.weeklyTarget} this week${weekly.loggedToday && !weekly.complete ? ' · done today' : ''}`,
      }),
      ...(quickAddFor(activity) ? [quickAdd(activity)] : []),
      el('span.entry__field', {}, [input]),
      el('button.row__act.entry__confirm', {
        type: 'button',
        'aria-label': `${adding ? 'Set total for' : 'Log'} ${activity.name}`,
        onclick: () => record(activity, input.value, correctionMode),
      }, [ring(fill), icon(goal ? 'plus' : 'check')]),
      floatFor(activity.id),
    ])
  }

  function workedActivityRow(activity, weekly = null) {
    const fill = weekly ? Math.min(1, weekly.weeklyDone / weekly.weeklyTarget) : 1
    return el('div.row.row--worked', { dataset: { worked: activity.id } }, [
      tile(activity.attribute, iconForActivity(activity.id)),
      el('span.row__name', { text: activity.name }),
      el('span.row__value', {
        text: weekly
          ? `${weekly.weeklyDone} / ${weekly.weeklyTarget} this week`
          : (hasDailyGoal(activity) ? dailyGoalLabel(activity) : valueLabel(activity, activity.value)),
      }),
      el('span.row__act', {}, [ring(fill), icon('check')]),
      floatFor(activity.id),
    ])
  }

  function activityRow(activity, weekly = null) {
    if (activity.spec?.entry === 'mark') return markRow(activity, weekly)
    return entryRow(activity, weekly)
  }

  async function record(activity, value, options = {}) {
    const result = await daily.log(activity.id, value, options)
    const earned = Object.values(result.xpByAttribute ?? {}).reduce((sum, n) => sum + n, 0)
    justEarned = {
      id: activity.id,
      xp: earned,
      attribute: activity.attribute,
      levelled: result.levelledUp?.[0]
        ? `${result.levelledUp[0].attribute} reached ${result.levelledUp[0].tier}`
        : null,
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(10) } catch { /* optional */ }
    }
    await reload()
  }

  function summaryStrip() {
    const total = Object.values(movedToday).reduce((sum, n) => sum + (n ?? 0), 0)
    const peak = Math.max(1, ...ATTRIBUTE_IDS.map((id) => movedToday[id] ?? 0))
    return el('section.strip', {}, [
      el('div.strip__head', {}, [
        el('span.strip__label', { text: 'TODAY' }),
        el('span.strip__xp', { dataset: { acid: 'value' }, text: total > 0 ? `+${formatXp(total)}` : '—' }),
      ]),
      el('div.strip__bars', {}, ATTRIBUTE_IDS.map((id) => el('span.strip__bar', {
        dataset: { attribute: id, moved: String((movedToday[id] ?? 0) > 0) },
        title: `${id}: ${formatXp(movedToday[id] ?? 0)} XP today`,
      }, [el('span.strip__fill', { style: `height:${Math.round(((movedToday[id] ?? 0) / peak) * 100)}%` })]))),
    ])
  }

  function render() {
    // `logged` means a value exists. For a goal-based tracker that is not the
    // same thing as complete: 8 oz of water is progress toward the day, not a
    // finished hydration task. Merge both halves back together, restore the
    // intended activity order, then split by actual completion.
    const allActivities = sortActivities([
      ...(day?.outstanding ?? []),
      ...(day?.logged ?? []),
    ])
    const dailyScheduled = allActivities.filter((a) => a.cadence === 'daily')
    const dailyComplete = dailyScheduled.filter((a) => dailyGoalComplete(a))
    const dailyVisible = dailyScheduled.filter((a) => !dailyGoalComplete(a) || staysEditableAfterComplete(a))
    const dailyLogged = dailyComplete.filter((a) => !staysEditableAfterComplete(a))
    const offScheduled = allActivities.filter((a) => a.cadence === 'off')
    const offLogged = offScheduled.filter((a) => a.logged)
    // Numeric OFF trackers remain editable after logging so piecewise values and
    // body metrics can be added/corrected. A just-logged mark holds its row for
    // one render so the completion ring and XP float have somewhere to happen.
    const offAvailable = offScheduled.filter((a) =>
      !a.logged || a.spec?.entry !== 'mark' || justEarned?.id === a.id)
    const weeklyLifestyle = weekActivities?.activities ?? []
    const weeklyExercises = weeklyExerciseGroups()

    const activeWeeklyLifestyle = weeklyLifestyle.filter((a) => !a.complete)
    const doneWeeklyLifestyle = weeklyLifestyle.filter((a) => a.complete)
    const activeExercises = weeklyExercises.filter((a) => a.done < a.target)
    const doneExercises = weeklyExercises.filter((a) => a.done >= a.target)

    const dailyDone = dailyComplete.length
    const dailyTotal = dailyScheduled.length
    const weeklyDone = weeklyLifestyle.reduce((sum, a) => sum + Math.min(a.weeklyDone, a.weeklyTarget), 0)
      + weeklyExercises.reduce((sum, a) => sum + Math.min(a.done, a.target), 0)
    const weeklyTotal = weeklyLifestyle.reduce((sum, a) => sum + a.weeklyTarget, 0)
      + weeklyExercises.reduce((sum, a) => sum + a.target, 0)

    const workedCount = dailyLogged.length + doneWeeklyLifestyle.length + doneExercises.length + offLogged.length

    replace(root, [
      el('h1.screen__title', { text: 'Today' }),
      summaryStrip(),

      justEarned && el('p.earned', { dataset: { earned: justEarned.id } }, [
        el('span.earned__xp', { dataset: { acid: 'value' }, text: `+${formatXp(justEarned.xp)}` }),
        el('span.earned__what', { text: justEarned.levelled ? `XP · ${justEarned.levelled}` : 'XP logged' }),
      ]),

      dailyTotal > 0 && el('section.block.sect', { dataset: { section: 'daily' } }, [
        el('h2.block__title.sect__title', {}, [
          'DAILY',
          el('span.sect__count', { text: `${dailyDone} of ${dailyTotal}` }),
        ]),
        dailyVisible.length > 0
          ? el('div.rows', {}, dailyVisible.map((a) => activityRow(a)))
          : el('p.block__hint', { text: 'All daily items worked through.' }),
      ]),

      weeklyTotal > 0 && el('section.block.sect', { dataset: { section: 'weekly' } }, [
        el('h2.block__title.sect__title', {}, [
          'THIS WEEK',
          el('span.sect__count', { text: `${weeklyDone} of ${weeklyTotal}` }),
        ]),
        (activeExercises.length > 0 || activeWeeklyLifestyle.length > 0)
          ? el('div.rows', {}, [
              ...activeExercises.map(exerciseRow),
              ...activeWeeklyLifestyle.map((a) => activityRow(a, a)),
            ])
          : el('p.block__hint', { text: 'Everything for this week is worked through.' }),
      ]),

      (offAvailable.length > 0 || workedCount > 0) && el('div.footers', {}, [
        offAvailable.length > 0 && el('button.elsewhere__toggle', {
          type: 'button', dataset: { other: 'toggle', open: String(otherOpen) },
          onclick: () => { otherOpen = !otherOpen; render() },
        }, [icon(otherOpen ? 'up' : 'down'), 'LOG SOMETHING ELSE']),
        workedCount > 0 && el('button.worked__toggle', {
          type: 'button', dataset: { worked: 'toggle', open: String(workedOpen) },
          onclick: () => { workedOpen = !workedOpen; render() },
        }, [icon('check'), `${workedCount} COMPLETED`]),
      ]),

      otherOpen && offAvailable.length > 0 && el('section.block', {}, [
        el('div.rows', {}, offAvailable.map((a) =>
          a.logged && a.spec?.entry === 'mark' ? workedActivityRow(a) : activityRow(a))),
      ]),

      workedOpen && workedCount > 0 && el('section.block', {}, [
        el('div.rows.worked', {}, [
          ...dailyLogged.map((a) => workedActivityRow(a)),
          ...doneExercises.map(exerciseRow),
          ...doneWeeklyLifestyle.map((a) => workedActivityRow(a, a)),
          ...offLogged.map((a) => workedActivityRow(a)),
        ]),
      ]),
    ])
  }

  async function reload() {
    ;[todayProgram, weekProgram, day, weekActivities] = await Promise.all([
      workout.todayTasks(),
      workout.weekStatus(),
      daily.today(),
      daily.week(),
    ])

    const fromDay = totalsByAttributeFromSources(day?.day?.awarded ?? {})
    const fromTraining = await workout.xpToday()
    movedToday = Object.fromEntries(ATTRIBUTE_IDS
      .map((id) => [id, (fromDay[id] ?? 0) + (fromTraining[id] ?? 0)]))
    render()
  }

  async function refresh() {
    justEarned = null
    await reload()
  }

  return {
    root,
    primary() {
      if (!todayProgram) return null
      return {
        label: `Run ${todayProgram.day.name}`,
        icon: 'play',
        dataset: { startday: todayProgram.day.id },
        run: () => onStart({ programDay: todayProgram.day }),
      }
    },
    refresh,
  }
}
