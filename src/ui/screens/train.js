/**
 * TRAIN — routines, the exercise library, and the two ways into a session.
 *
 * The ad-hoc path is deliberately as short as the routine path: from here, one
 * tap on an exercise starts logging it. `docs/05` calls that a first-class
 * feature, not a shortcut — some days are one exercise.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { lbs, since } from '../format.js'
import { trainingReadiness } from '../../domain/readiness.js'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {(options: object) => void} deps.onStart
 */
export function createTrainScreen({ workout, storage, clock, onStart }) {
  const root = el('div.screen.screen--train')
  let query = ''
  let libraryOpen = false
  /** @type {{program: any, week: number, deload: boolean}|null} */ let active = null
  /** @type {any} */ let guide = null
  /** @type {any} */ let weekView = null
  /** Today's prescribed day, for the FAB. */ /** @type {any} */ let todayDay = null
  let guideOpen = false
  /** @type {any[]} */ let routines = []
  /** @type {any[]} */ let exercises = []
  /** @type {Map<string, any>} */ let records = new Map()
  /** @type {Map<string, string>} */ const lastByExercise = new Map()
  /** @type {any} */ let rhythm = null
  /** @type {any[]} */ let dayLogs = []
  /** @type {any[]} */ let sessions = []
  /** @type {any[]} */ let setLogs = []

  function addUtcDays(date, count) {
    const at = new Date(`${date}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() + count)
    return at.toISOString().slice(0, 10)
  }

  function trainingCalendar() {
    if (!rhythm) return null
    const today = clock.today()
    const at = new Date(`${today}T00:00:00Z`)
    const currentWeekStart = addUtcDays(today, -((at.getUTCDay() + 6) % 7))
    const first = addUtcDays(currentWeekStart, -7)
    const dates = Array.from({ length: 14 }, (_, index) => addUtcDays(first, index))
    const trained = new Set(rhythm.trainedDates)
    const qualified = new Set(rhythm.qualifyingDates)
    const shortDate = (date) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
    const rangeLabel = `${shortDate(first)} – ${shortDate(dates.at(-1))}`
    const cells = dates.map((date) => {
      const dateAt = new Date(`${date}T00:00:00Z`)
      const minutes = Math.round(rhythm.minutesByDate?.[date] ?? 0)
      const hasTraining = trained.has(date)
      const qualifies = qualified.has(date)
      return el('span.training-calendar__day', {
        text: String(dateAt.getUTCDate()),
        title: hasTraining
          ? `${minutes} training minutes${qualifies ? ', strong-week day' : ''}`
          : undefined,
        'aria-label': `${shortDate(date)}${hasTraining ? `, ${minutes} training minutes${qualifies ? ', strong-week day' : ''}` : ''}`,
        dataset: {
          trained: String(hasTraining),
          qualified: String(qualifies),
          today: String(date === today),
        },
      })
    })

    const programWorkouts = weekView?.week?.days
      ?.filter((entry) => entry.tasks.some((task) => task.logged > 0)).length ?? 0
    const programWorkoutTotal = weekView?.week?.days?.length ?? 0

    return el('section.card.training-rhythm', { dataset: { trainingRhythm: 'calendar' } }, [
      el('div.training-rhythm__head', {}, [
        el('div', {}, [
          el('span.training-rhythm__eyebrow', { text: 'TRAINING RHYTHM' }),
          el('strong.training-rhythm__streak', {
            text: rhythm.streakWeeks === 1 ? '1 week strong' : `${rhythm.streakWeeks} weeks strong`,
          }),
        ]),
        el('span.training-rhythm__keeper', {
          dataset: { ready: String(rhythm.keepers > 0) },
          text: rhythm.keepers > 0
            ? `◆ ${rhythm.keepers} keeper${rhythm.keepers === 1 ? '' : 's'} ready`
            : `${rhythm.keeperProgress}/${rhythm.keeperEvery} to keeper`,
        }),
      ]),
      el('p.training-rhythm__week', {
        text: [
          programWorkoutTotal ? `${programWorkouts} of ${programWorkoutTotal} program workouts logged` : null,
          `${rhythm.currentWeekDays} of ${rhythm.weeklyDays} days at ${rhythm.minimumMinutes}+ min`,
        ].filter(Boolean).join(' · '),
      }),
      el('div.training-calendar__month', {}, [
        el('span', { text: 'PRIOR + CURRENT WEEK' }),
        el('strong', { text: rangeLabel }),
      ]),
      el('div.training-calendar', { role: 'group', 'aria-label': `${rangeLabel} training days` }, [
        ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => el('span.training-calendar__weekday', { text: day })),
        ...cells,
      ]),
    ])
  }

  function datesSince(date, count) {
    return Array.from({ length: count }, (_, index) => addUtcDays(date, index - count + 1))
  }

  function mean(values) {
    const valid = values.filter((value) => typeof value === 'number' && Number.isFinite(value))
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
  }

  function coachingPrompt(model) {
    const today = clock.today()
    const range = new Set(datesSince(today, 14))
    const recentDays = dayLogs.filter((day) => range.has(day.date))
    const recentSessions = sessions.filter((session) => session.endedAt && range.has(session.date))
    const recentSessionIds = new Set(recentSessions.map((session) => session.id))
    const recentWorkingSets = setLogs.filter((set) => recentSessionIds.has(set.sessionId) && !set.isWarmup)
    const sleepAverage = mean(recentDays.map((day) => day.sleepHours))
    const stepAverage = mean(recentDays.map((day) => day.steps))
    const weights = recentDays.filter((day) => typeof day.bodyMetrics?.weight === 'number').sort((a, b) => a.date.localeCompare(b.date))
    const weightChange = weights.length >= 2 ? weights.at(-1).bodyMetrics.weight - weights[0].bodyMetrics.weight : null
    const minutes = datesSince(today, 14).reduce((sum, date) => sum + Number(rhythm?.minutesByDate?.[date] ?? 0), 0)
    const latestHealth = [...recentDays].sort((a, b) => b.date.localeCompare(a.date)).find((day) => day.healthMetrics) ?? null
    const exerciseNames = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
    const sessionById = new Map(sessions.map((session) => [session.id, session]))
    const latestSession = [...recentSessions].sort((a, b) =>
      String(b.endedAt ?? b.date).localeCompare(String(a.endedAt ?? a.date)))[0] ?? null
    const latestSets = latestSession
      ? setLogs.filter((set) => set.sessionId === latestSession.id && !set.isWarmup)
      : []
    const grouped = new Map()
    for (const set of latestSets) {
      const key = `${set.exerciseId}|${set.method ?? ''}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(set)
    }
    const bestSets = [...grouped.values()].map((setsForExercise) => {
      const exerciseId = setsForExercise[0].exerciseId
      const loaded = setsForExercise.filter((set) => Number(set.weight) > 0 && Number(set.reps) > 0)
        .sort((a, b) => Number(b.weight) - Number(a.weight) || Number(b.reps) - Number(a.reps))[0]
      const representative = loaded ?? setsForExercise.find((set) => Number(set.reps) > 0)
      if (!representative) return null
      const load = Number(representative.weight) > 0 ? `${representative.weight} lb` : 'bodyweight'
      return `${exerciseNames.get(exerciseId) ?? exerciseId}: ${load} × ${representative.reps}`
    }).filter(Boolean)
    const confirmedPrs = []
    for (const [key, currentSets] of grouped) {
      const [exerciseId, method] = key.split('|')
      const previous = setLogs.filter((set) => {
        if (set.sessionId === latestSession?.id || set.isWarmup || set.exerciseId !== exerciseId
          || String(set.method ?? '') !== method) return false
        const session = sessionById.get(set.sessionId)
        return session?.endedAt && String(session.endedAt) < String(latestSession?.endedAt)
      })
      const currentWeight = Math.max(0, ...currentSets.map((set) => Number(set.weight) || 0))
      const previousWeight = Math.max(0, ...previous.map((set) => Number(set.weight) || 0))
      const name = exerciseNames.get(exerciseId) ?? exerciseId
      if (previousWeight > 0 && currentWeight > previousWeight) {
        confirmedPrs.push(`${name}: load PR ${currentWeight} lb (previous ${previousWeight} lb)`)
      }
      const currentVolume = currentSets.reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0)
      const priorVolumes = new Map()
      for (const set of previous) {
        priorVolumes.set(set.sessionId, (priorVolumes.get(set.sessionId) ?? 0)
          + (Number(set.weight) || 0) * (Number(set.reps) || 0))
      }
      const previousVolume = Math.max(0, ...priorVolumes.values())
      if (previousVolume > 0 && currentVolume > previousVolume) {
        confirmedPrs.push(`${name}: volume PR ${Math.round(currentVolume)} lb (previous ${Math.round(previousVolume)} lb)`)
      }
    }
    const latestRoutine = routines.find((routine) => routine.id === latestSession?.routineId)
    const latestTitle = latestRoutine?.name
      ?? (bestSets.length ? [...new Set(latestSets.map((set) => exerciseNames.get(set.exerciseId) ?? set.exerciseId))].slice(0, 3).join(' + ') : '')
    const latestVolume = latestSets.reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0)
    const latestMovements = new Set(latestSets.map((set) => set.exerciseId)).size

    return `Use this Tempered app data to give me a useful training review with special attention to the latest completed workout.

Return exactly these sections and nothing else:
PROGRESS
Two or three sentences, maximum 80 words, explaining the 14-day trend.

LATEST WORKOUT
Three to five bullets covering the session's strongest work, workload, and what it suggests.

RECORDS
List every confirmed PR supplied below. If none are supplied, say no confirmed PRs were detected.

COACHING
Exactly three bullets, each 12–28 words. Include one specific next-session progression recommendation grounded in the latest workout.

NEXT WORKOUT
One or two sentences, maximum 45 words, balancing progression with readiness.

Do not diagnose medical conditions. Call out unavailable data instead of guessing. Do not invent PRs. Treat a same-day import as current and prioritize the latest workout over generic advice.

TEMPERED_DATA
DATE=${today}
PROGRAM=${active?.program?.name ?? 'None'}
PROGRAM_WEEK=${active?.week ?? ''}
READINESS_SCORE=${model.score ?? ''}
READINESS_LABEL=${model.label}
TRAINING_MINUTES_14D=${Math.round(minutes)}
SESSIONS_14D=${recentSessions.length}
WORKING_SETS_14D=${recentWorkingSets.length}
SLEEP_AVG_14D=${sleepAverage === null ? '' : sleepAverage.toFixed(1)}
STEPS_AVG_14D=${stepAverage === null ? '' : Math.round(stepAverage)}
WEIGHT_CHANGE_LB_14D=${weightChange === null ? '' : weightChange.toFixed(1)}
LATEST_RHR=${latestHealth?.healthMetrics?.restingHr ?? ''}
LATEST_HRV_MS=${latestHealth?.healthMetrics?.hrvMs ?? ''}
LATEST_WORKOUT_DATE=${latestSession?.date ?? ''}
LATEST_WORKOUT_TITLE=${latestTitle}
LATEST_WORKOUT_MINUTES=${latestSession?.durationMinutes ?? ''}
LATEST_WORKOUT_WORKING_SETS=${latestSets.length}
LATEST_WORKOUT_MOVEMENTS=${latestMovements}
LATEST_WORKOUT_VOLUME_LB=${Math.round(latestVolume)}
LATEST_WORKOUT_BEST_SETS=${bestSets.join(' | ')}
LATEST_WORKOUT_CONFIRMED_PRS=${confirmedPrs.join(' | ')}`
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return true } catch { /* use fallback */ }
    }
    const input = document.createElement('textarea')
    input.value = text
    input.setAttribute('readonly', '')
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.append(input)
    input.select()
    const copied = document.execCommand?.('copy') === true
    input.remove()
    return copied
  }

  function controlCenter() {
    if (!rhythm) return null
    const today = clock.today()
    const sevenDates = new Set(datesSince(today, 7))
    const sevenSessions = sessions.filter((session) => session.endedAt && sevenDates.has(session.date))
    const sessionIds = new Set(sevenSessions.map((session) => session.id))
    const sets = setLogs.filter((set) => sessionIds.has(set.sessionId) && !set.isWarmup).length
    const minutes = [...sevenDates].reduce((sum, date) => sum + Number(rhythm.minutesByDate?.[date] ?? 0), 0)
    const model = trainingReadiness(dayLogs, today)
    const score = model.score === null ? '—' : String(model.score)
    const status = el('span.training-coach__status', { text: 'Copies a detailed 14-day and latest-workout report.' })
    const handoff = el('a.training-coach__action', {
      href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener',
      dataset: { trainingCoach: 'open' },
      onclick: async () => {
        const copied = await copyText(coachingPrompt(model))
        status.textContent = copied ? 'Report copied. Paste it into ChatGPT.' : 'Could not copy. Try again.'
      },
    }, ['COPY + OPEN CHATGPT'])

    const stat = (label, value) => el('div.training-control__stat', {}, [
      el('strong', { text: String(value) }), el('span', { text: label }),
    ])
    return el('section.card.training-control', { dataset: { trainingControl: 'true' } }, [
      el('div.training-control__head', {}, [
        el('div', {}, [
          el('span.training-control__eyebrow', { text: 'WORKOUT CONTROL CENTER' }),
          el('h2', { text: 'This week at a glance' }),
        ]),
        el('div.training-readiness', { dataset: { readiness: model.label.toLowerCase().replaceAll(' ', '-') } }, [
          el('strong', { text: score }),
          el('span', { text: model.label }),
        ]),
      ]),
      el('div.training-control__stats', {}, [
        stat('7D MIN', Math.round(minutes)),
        stat('WORK SETS', sets),
        stat('SESSIONS', sevenSessions.length),
        stat('SIGNALS', model.signals.length),
      ]),
      el('p.training-control__readiness-note', {
        text: model.score === null
          ? 'Readiness is a 0–100 recovery estimate. Add sleep or Health data to calculate it.'
          : `${model.action}. ${model.coverage === 'limited' ? 'Limited estimate' : 'Estimate'} from ${model.signals.map((signal) => signal.detail).join(' · ')}.`,
      }),
      model.score !== null ? el('p.training-control__readiness-explainer', {
        text: 'Higher means your sleep and recovery signals are near or better than your own recent baseline. It is guidance, not a medical score.',
      }) : null,
      el('div.training-coach', {}, [
        el('div', {}, [
          el('strong', { text: 'AI progress check' }),
          status,
        ]),
        handoff,
      ]),
    ])
  }

  function routineCard(routine) {
    const setCount = (routine.exercises ?? []).reduce((sum, e) => sum + (e.sets ?? 0), 0)
    const primary = (routine.exercises ?? [])[0]
    const primaryExercise = exercises.find((e) => e.id === primary?.id)
    return el('section.card.routine', { dataset: { routine: routine.id } }, [
      el('h2.routine__name', { text: routine.name }),
      el('p.routine__meta', {
        text: `${(routine.exercises ?? []).length} exercises · ${setCount} sets`,
      }),
      primaryExercise && el('p.routine__primary', {
        text: `${primaryExercise.name}${primary.weight ? ` · ${lbs(primary.weight)} lbs` : ''}`,
      }),
      el('button.button.button--wide', {
        type: 'button', dataset: { start: routine.id },
        onclick: () => onStart({ routine }),
      }, ['START']),
    ])
  }

  function exerciseRow(exercise) {
    const best = records.get(exercise.id)?.bestWeight
    const last = lastByExercise.get(exercise.id)
    return el('button.libraryrow', {
      type: 'button', dataset: { exercise: exercise.id },
      onclick: () => onStart({ routine: null, exerciseId: exercise.id }),
    }, [
      el('span.libraryrow__main', {}, [
        el('span.libraryrow__name', { text: exercise.name }),
        el('span.libraryrow__meta', {
          text: [exercise.group, exercise.class].filter(Boolean).join(' · '),
        }),
      ]),
      el('span.libraryrow__stats', {}, [
        best && el('span.libraryrow__pr', { text: `PR ${lbs(best.weight)} × ${best.reps}` }),
        el('span.libraryrow__last', { text: last ? since(last, clock.today()) : 'not yet worked' }),
      ]),
    ])
  }

  /** The active program: its days, the week it is on, and the derived guide. */
  function programBlock() {
    if (!active) return null
    const { program, week, deload } = active
    return el('section.block', { dataset: { program: program.id } }, [
      el('h2.block__title', { text: 'Active program' }),
      el('section.card.program', {}, [
        el('div.program__head', {}, [
          el('h3.program__name', { text: program.name }),
          el('span.program__week', { text: `Week ${week} / ${program.weeks}` }),
        ]),
        el('p.program__note', { text: program.note }),
        deload && el('p.deload', { text: 'Deload week. Hold the weight — recovery is half the process.' }),

        ...program.days.map((day) => el('button.programday', {
          type: 'button', dataset: { programday: day.id },
          onclick: () => onStart({ programDay: day }),
        }, [
          el('span.programday__main', {}, [
            el('span.programday__name', { text: day.name }),
            el('span.programday__focus', { text: day.focus }),
          ]),
          el('span.programday__count', { text: `${day.exercises.length}` }),
        ])),

        // The week: prescribed, worked, and what is still available. Nothing here
        // is late or missed — outstanding work is simply work still available.
        weekView && el('div.weekview', {}, [
          el('div.weekview__head', {}, [
            el('span.weekview__label', { text: 'THIS WEEK' }),
            el('span.weekview__count', { text: `${weekView.week.done} of ${weekView.week.total} slots worked` }),
          ]),
          ...weekView.week.days.map((entry) => el('div.weekday', { dataset: { weekday: entry.day.id } }, [
            el('span.weekday__name', { text: entry.day.name }),
            el('span.weekday__bar', {
              style: `--fill:${entry.total ? Math.round((entry.done / entry.total) * 100) : 0}%`,
            }),
            el('span.weekday__count', { text: `${entry.done}/${entry.total}` }),
          ])),
        ]),

        el('div.actions', {}, [
          el('button.actionpill', {
            type: 'button', dataset: { guide: 'toggle', open: String(guideOpen) },
            onclick: () => { guideOpen = !guideOpen; render() },
          }, [icon('sets'), guideOpen ? 'HIDE HARD SETS' : 'HARD SETS']),
        ]),

        guideOpen && weekView && el('div.panel', {}, [
          el('p.panel__note', {
            text: 'Hard sets worked this week per muscle group, counted from what you '
              + 'logged. This is the number that says whether the week worked.',
          }),
          el('div.guide', {}, weekView.hardSets.map((row) => {
            const ceiling = row.target ? row.target[1] : Math.max(1, weekView.hardSets[0].sets)
            return el('div.guide__row', { dataset: { group: row.group, met: String(row.met) } }, [
              el('span.guide__group', { text: row.group.replace(/_/g, ' ') }),
              el('span.guide__bar', { style: `--fill:${Math.min(100, Math.round((row.sets / ceiling) * 100))}%` }),
              el('span.guide__sets', {
                text: row.target ? `${row.sets} / ${row.target[0]}–${row.target[1]}` : `${row.sets}`,
              }),
            ])
          })),
          el('p.panel__note', {
            text: 'Anything below its range is still available this week. It clears at the '
              + 'week boundary rather than carrying over.',
          }),
        ]),
      ]),
    ])
  }

  function render() {
    const filtered = query
      ? exercises.filter((e) => `${e.name} ${e.group ?? ''} ${e.pattern ?? ''}`.toLowerCase().includes(query))
      : exercises

    if (libraryOpen) {
      replace(root, [
        el('header.train-library-header', {}, [
          el('button.train-library-header__back', {
            type: 'button', 'aria-label': 'Back to Train',
            onclick: () => { libraryOpen = false; query = ''; render() },
          }, ['‹']),
          el('div', {}, [
            el('span.train-library-header__eyebrow', { text: 'TRAIN' }),
            el('h1.screen__title', { text: 'Exercise library' }),
          ]),
        ]),
        el('section.block.train-library-screen', { dataset: { exerciseLibrary: 'screen' } }, [
          el('p.block__hint', { text: 'Search the library or tap any movement to log it on its own.' }),
          el('input.search', {
            type: 'search', placeholder: 'Search exercises', value: query,
            'aria-label': 'Search exercises', dataset: { search: 'library' },
            oninput: (event) => { query = event.target.value.trim().toLowerCase(); render() },
          }),
          el('div.library', {}, filtered.map(exerciseRow)),
          filtered.length === 0 && el('p.block__hint', { text: 'Nothing matches that yet.' }),
        ]),
      ])
      return
    }

    replace(root, [
      el('h1.screen__title', { text: 'Train' }),

      trainingCalendar(),

      controlCenter(),

      programBlock(),

      el('section.block', {}, [
        el('h2.block__title', { text: 'Routines' }),
        ...routines.map(routineCard),
      ]),

      el('section.block', {}, [
        el('button.train-library-link', {
          type: 'button', dataset: { exerciseLibrary: 'open' },
          onclick: () => { libraryOpen = true; query = ''; render() },
        }, [
          el('span.train-library-link__icon', {}, [icon('train')]),
          el('span.train-library-link__main', {}, [
            el('span.train-library-link__title', { text: 'Exercise library' }),
            el('span.train-library-link__meta', { text: `${exercises.length} movements · Search or start one exercise` }),
          ]),
          el('span.train-library-link__arrow', { 'aria-hidden': 'true', text: '›' }),
        ]),
      ]),
    ])
  }

  return {
    root,

    /**
     * The one primary action: start the day the program prescribes for today.
     *
     * Routines and the library are browsing — every row there is an equally
     * valid start, so none of them is the primary action and none of them is
     * acid. When no program is active there is no single obvious thing to do,
     * and the bar carries no FAB rather than an invented one.
     */
    primary() {
      if (!todayDay) return null
      return {
        label: `Run ${todayDay.name}`,
        icon: 'play',
        dataset: { startday: todayDay.id },
        run: () => onStart({ programDay: todayDay }),
      }
    },

    async refresh() {
      libraryOpen = false
      query = ''
      active = await workout.activeProgram()
      todayDay = (await workout.todayTasks())?.day ?? null
      guide = await workout.programGuide()
      weekView = await workout.weekStatus()
      ;[rhythm, routines, exercises, records, dayLogs, sessions, setLogs] = await Promise.all([
        workout.trainingRhythm(), storage.getAll('routines'), storage.getAll('exercises'), workout.recordMap(),
        storage.getAll('dayLogs'), storage.getAll('sessions'), storage.getAll('setLogs'),
      ])
      exercises.sort((a, b) => a.name.localeCompare(b.name))

      lastByExercise.clear()
      const sessionsById = new Map(sessions.map((s) => [s.id, s]))
      for (const log of setLogs) {
        const date = sessionsById.get(log.sessionId)?.date
        if (!date) continue
        if (!lastByExercise.has(log.exerciseId) || date > lastByExercise.get(log.exerciseId)) {
          lastByExercise.set(log.exerciseId, date)
        }
      }
      render()
    },
  }
}
