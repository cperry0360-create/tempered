/**
 * TODAY — calm tracker surface.
 *
 * The home screen answers three questions in order:
 *   1. How is today going?
 *   2. What still needs attention?
 *   3. What is left this week?
 *
 * Logging power remains available, but numeric controls are one tap deeper so
 * the default view reads like a tracker rather than an instrument panel.
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
  if (value === true || value === null || value === undefined) return 'Logged'
  const unit = unitLabel(activity)
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
  if (!(Number.isFinite(activity?.dailyCap) && activity.dailyCap > 0)) return 'Log body weight to set goal'
  const value = typeof activity.value === 'number' ? activity.value : 0
  const unit = unitLabel(activity)
  return `${value} / ${activity.dailyCap}${unit ? ` ${unit}` : ''}`
}

/** Additive numeric trackers remain on Today after completion for more entries/corrections. */
export function staysEditableAfterComplete(activity) {
  return activity?.spec?.entry === 'number' && activity?.spec?.mode === 'add'
}

function dateLabel(dateKey) {
  if (!dateKey) return ''
  const [year, month, day] = dateKey.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return dateKey
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function clampedPercent(done, total) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

export function createTodayScreen({ workout, daily, clock, onStart, onOpenSlot }) {
  const root = el('div.screen.screen--today.screen--today-calm')
  let todayProgram = null
  let weekProgram = null
  let day = null
  let weekActivities = null
  let movedToday = {}
  let justEarned = null
  let openActivityId = null
  let weekOpen = false
  let workedOpen = false
  let otherOpen = false

  function todayXp() {
    return Object.values(movedToday).reduce((sum, n) => sum + (n ?? 0), 0)
  }

  function statusFor(activity, weekly = null) {
    if (weekly) {
      const suffix = weekly.loggedToday && !weekly.complete ? ' · done today' : ''
      return `${weekly.weeklyDone} / ${weekly.weeklyTarget} this week${suffix}`
    }
    if (hasDailyGoal(activity)) return dailyGoalLabel(activity)
    if (activity.logged) return valueLabel(activity, activity.value)
    const unit = unitLabel(activity)
    return unit ? `Tap to log ${unit}` : 'Tap to log'
  }

  function compactGlyph(activity, complete = false) {
    return el('span.today-item__icon', {
      dataset: { complete: String(complete) },
    }, [icon(complete ? 'check' : iconForActivity(activity.id))])
  }

  function earnedBanner() {
    if (!justEarned || justEarned.xp <= 0) return null
    return el('div.today-earned', { dataset: { earned: justEarned.id } }, [
      el('span.today-earned__xp', { text: `+${formatXp(justEarned.xp)} XP` }),
      el('span.today-earned__copy', {
        text: justEarned.levelled ? justEarned.levelled : 'Added to today',
      }),
    ])
  }

  function editor(activity, weekly = null) {
    const adding = activity.spec?.mode === 'add'
    const unit = unitLabel(activity)
    const input = el('input.today-editor__input', {
      type: 'text',
      inputmode: 'decimal',
      placeholder: adding ? `Add ${unit || 'amount'}` : (unit || 'Value'),
      'aria-label': `${adding ? 'Add to' : 'Log'} ${activity.name}${activity.unit ? `, ${activity.unit}` : ''}`,
      onkeydown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          record(activity, input.value)
        }
      },
    })

    const quick = quickAddFor(activity)
    return el('div.today-editor', { dataset: { editor: activity.id } }, [
      quick && el('div.today-editor__quick', {}, quick.map((amount) => el('button.today-editor__chip', {
        type: 'button',
        'aria-label': `Add ${amount} ${activity.unit ?? ''} to ${activity.name}`,
        onclick: () => record(activity, String(amount)),
      }, [`+${amount}${unit ? ` ${unit}` : ''}`]))),
      el('div.today-editor__manual', {}, [
        input,
        el('button.today-editor__save', {
          type: 'button',
          onclick: () => record(activity, input.value),
        }, [adding ? 'Add' : 'Save']),
      ]),
      weekly && el('span.today-editor__hint', { text: statusFor(activity, weekly) }),
    ])
  }

  function markItem(activity, weekly = null) {
    const complete = weekly ? weekly.complete : dailyGoalComplete(activity)
    const alreadyToday = weekly?.loggedToday === true
    const inactive = Boolean(weekly && alreadyToday)
    return el('button.today-item.today-item--mark', {
      type: 'button',
      disabled: inactive,
      dataset: {
        activity: activity.id,
        complete: String(complete),
        today: String(alreadyToday),
      },
      'aria-label': inactive ? `${activity.name} already logged today` : `Log ${activity.name}`,
      onclick: inactive ? null : () => record(activity, null),
    }, [
      compactGlyph(activity, complete || alreadyToday),
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
    const goal = hasDailyGoal(activity)
    const affordance = open ? icon('up') : icon(goal ? 'plus' : 'check')
    return el('div.today-item-wrap', {
      dataset: { open: String(open), activity: activity.id },
    }, [
      el('button.today-item.today-item--number', {
        type: 'button',
        dataset: { complete: String(complete) },
        'aria-expanded': String(open),
        onclick: () => {
          openActivityId = open ? null : activity.id
          render()
        },
      }, [
        compactGlyph(activity, complete),
        el('span.today-item__main', {}, [
          el('span.today-item__name', { text: activity.short ?? activity.name }),
          el('span.today-item__meta', { text: statusFor(activity, weekly) }),
        ]),
        el('span.today-item__chevron', {}, [affordance]),
      ]),
      open && editor(activity, weekly),
    ])
  }

  function activityItem(activity, weekly = null) {
    if (activity.spec?.entry === 'mark') return markItem(activity, weekly)
    return numberItem(activity, weekly)
  }

  function workedItem(activity, weekly = null) {
    return el('div.today-item.today-item--worked', {}, [
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

  function trainingSummary() {
    const days = weekProgram?.week?.days ?? []
    if (days.length === 0) return null
    const done = days.filter((entry) => entry.tasks.length > 0 && entry.tasks.every((task) => task.done)).length
    const started = days.some((entry) => entry.tasks.some((task) => task.started && !task.done))
    return { done, total: days.length, started, complete: done >= days.length }
  }

  function trainingItem(summary) {
    const todayDone = todayProgram?.tasks?.length > 0 && todayProgram.tasks.every((task) => task.done)
    const canStart = Boolean(todayProgram?.day) && !todayDone
    const label = todayProgram?.day?.name ?? 'Strength training'
    return el(canStart ? 'button.today-item.today-item--training' : 'div.today-item.today-item--training', {
      ...(canStart ? { type: 'button', onclick: () => onStart({ programDay: todayProgram.day }) } : {}),
      dataset: { complete: String(summary.complete) },
    }, [
      el('span.today-item__icon', { dataset: { complete: String(summary.complete) } }, [icon(summary.complete ? 'check' : 'train')]),
      el('span.today-item__main', {}, [
        el('span.today-item__name', { text: 'Strength training' }),
        el('span.today-item__meta', {
          text: `${summary.done} / ${summary.total} workouts${summary.started ? ' · in progress' : ''}`,
        }),
      ]),
      canStart && el('span.today-item__cta', { text: `Start ${label}` }),
    ])
  }

  async function record(activity, value, options = {}) {
    const result = await daily.log(activity.id, value, options)
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

  function summaryCard(done, total) {
    const percent = clampedPercent(done, total)
    const remaining = Math.max(0, total - done)
    const xp = todayXp()
    return el('section.today-summary', {}, [
      el('div.today-summary__top', {}, [
        el('div', {}, [
          el('span.today-summary__eyebrow', { text: 'DAILY PROGRESS' }),
          el('p.today-summary__headline', {
            text: total > 0
              ? `${done} of ${total} complete`
              : 'Your day is clear',
          }),
        ]),
        xp > 0 && el('span.today-summary__xp', { text: `+${formatXp(xp)} XP` }),
      ]),
      total > 0 && el('div.today-summary__bar', {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': String(total),
        'aria-valuenow': String(done),
        'aria-label': `${done} of ${total} daily items complete`,
      }, [el('span.today-summary__fill', { style: `width:${percent}%` })]),
      total > 0 && el('div.today-summary__foot', {}, [
        el('span', { text: remaining === 0 ? 'Daily list complete' : `${remaining} left today` }),
        el('span', { text: percent === 100 ? 'Tempered.' : `${percent}%` }),
      ]),
    ])
  }

  function sectionHeader(title, detail, action = null) {
    return el('div.today-section__head', {}, [
      el('div', {}, [
        el('h2.today-section__title', { text: title }),
        detail && el('span.today-section__detail', { text: detail }),
      ]),
      action,
    ])
  }

  function render() {
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
    const offAvailable = offScheduled.filter((a) =>
      !a.logged || a.spec?.entry !== 'mark' || justEarned?.id === a.id)

    const weeklyLifestyle = weekActivities?.activities ?? []
    const activeWeeklyLifestyle = weeklyLifestyle.filter((a) => !a.complete)
    const doneWeeklyLifestyle = weeklyLifestyle.filter((a) => a.complete)
    const training = trainingSummary()

    const dailyDone = dailyComplete.length
    const dailyTotal = dailyScheduled.length

    const trainingDone = training?.done ?? 0
    const trainingTotal = training?.total ?? 0
    const lifestyleDone = weeklyLifestyle.reduce((sum, a) => sum + Math.min(a.weeklyDone, a.weeklyTarget), 0)
    const lifestyleTotal = weeklyLifestyle.reduce((sum, a) => sum + a.weeklyTarget, 0)
    const weeklyDone = trainingDone + lifestyleDone
    const weeklyTotal = trainingTotal + lifestyleTotal

    const weeklyPreview = weekOpen ? activeWeeklyLifestyle : activeWeeklyLifestyle.slice(0, training ? 2 : 3)
    const hiddenWeekly = Math.max(0, activeWeeklyLifestyle.length - weeklyPreview.length)
    const workedCount = dailyWorked.length + doneWeeklyLifestyle.length + offLogged.length

    replace(root, [
      el('header.today-header', {}, [
        el('h1.screen__title.today-header__title', { text: 'Today' }),
        el('p.today-header__date', { text: dateLabel(clock.today()) }),
      ]),

      summaryCard(dailyDone, dailyTotal),
      earnedBanner(),

      dailyTotal > 0 && el('section.today-section', { dataset: { section: 'daily' } }, [
        sectionHeader('Today', dailyDone > 0 ? `${dailyDone} completed` : 'Your daily list'),
        dailyActive.length > 0
          ? el('div.today-list', {}, dailyActive.map((a) => activityItem(a)))
          : el('div.today-empty', {}, [
              el('span.today-empty__check', {}, [icon('check')]),
              el('span', { text: 'Everything on today’s list is complete.' }),
            ]),
      ]),

      weeklyTotal > 0 && el('section.today-section', { dataset: { section: 'weekly' } }, [
        sectionHeader(
          'This week',
          `${weeklyDone} of ${weeklyTotal}`,
          activeWeeklyLifestyle.length > (training ? 2 : 3)
            ? el('button.today-section__link', {
                type: 'button',
                onclick: () => { weekOpen = !weekOpen; render() },
              }, [weekOpen ? 'Show less' : 'See all'])
            : null,
        ),
        el('div.today-list', {}, [
          training && trainingItem(training),
          ...weeklyPreview.map((a) => activityItem(a, a)),
        ]),
        hiddenWeekly > 0 && el('button.today-more', {
          type: 'button',
          onclick: () => { weekOpen = true; render() },
        }, [`${hiddenWeekly} more weekly goal${hiddenWeekly === 1 ? '' : 's'}`]),
      ]),

      (offAvailable.length > 0 || workedCount > 0) && el('div.today-secondary', {}, [
        offAvailable.length > 0 && el('button.today-secondary__button', {
          type: 'button',
          onclick: () => { otherOpen = !otherOpen; render() },
        }, [icon(otherOpen ? 'up' : 'plus'), otherOpen ? 'Close extra logging' : 'Log something else']),
        workedCount > 0 && el('button.today-secondary__button', {
          type: 'button',
          onclick: () => { workedOpen = !workedOpen; render() },
        }, [icon(workedOpen ? 'up' : 'check'), `${workedCount} completed`]),
      ]),

      otherOpen && offAvailable.length > 0 && el('section.today-section.today-section--quiet', {}, [
        sectionHeader('Extra logging', 'Optional'),
        el('div.today-list', {}, offAvailable.map((a) =>
          a.logged && a.spec?.entry === 'mark' ? workedItem(a) : activityItem(a))),
      ]),

      workedOpen && workedCount > 0 && el('section.today-section.today-section--quiet', {}, [
        sectionHeader('Completed', 'Evidence from today and this week'),
        el('div.today-list.today-list--worked', {}, [
          ...dailyWorked.map((a) => workedItem(a)),
          ...doneWeeklyLifestyle.map((a) => workedItem(a, a)),
          ...offLogged.map((a) => workedItem(a)),
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
    openActivityId = null
    await reload()
  }

  return {
    root,
    // Today no longer needs a persistent neon FAB. Training stays directly
    // available inside the weekly card where its context is visible.
    primary() { return null },
    refresh,
  }
}