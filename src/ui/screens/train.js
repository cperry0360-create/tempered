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

  function addUtcDays(date, count) {
    const at = new Date(`${date}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() + count)
    return at.toISOString().slice(0, 10)
  }

  function trainingCalendar() {
    if (!rhythm) return null
    const today = clock.today()
    const month = today.slice(0, 7)
    const first = `${month}-01`
    const firstAt = new Date(`${first}T00:00:00Z`)
    const leading = (firstAt.getUTCDay() + 6) % 7
    const nextMonth = new Date(Date.UTC(firstAt.getUTCFullYear(), firstAt.getUTCMonth() + 1, 1))
    const days = Math.round((nextMonth - firstAt) / 86400000)
    const trained = new Set(rhythm.qualifyingDates)
    const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(firstAt)
    const cells = Array.from({ length: leading }, () => el('span.training-calendar__blank', { 'aria-hidden': 'true' }))
    for (let index = 0; index < days; index += 1) {
      const date = addUtcDays(first, index)
      const minutes = Math.round(rhythm.minutesByDate?.[date] ?? 0)
      cells.push(el('span.training-calendar__day', {
        text: String(index + 1),
        title: trained.has(date) ? `${minutes} training minutes` : undefined,
        'aria-label': `${monthLabel.split(' ')[0]} ${index + 1}${trained.has(date) ? `, ${minutes} training minutes` : ''}`,
        dataset: { trained: String(trained.has(date)), today: String(date === today) },
      }))
    }

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
        text: `${rhythm.currentWeekDays} of ${rhythm.weeklyDays} days at ${rhythm.minimumMinutes}+ min this week`,
      }),
      el('div.training-calendar__month', { text: monthLabel }),
      el('div.training-calendar', { role: 'group', 'aria-label': `${monthLabel} training days` }, [
        ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => el('span.training-calendar__weekday', { text: day })),
        ...cells,
      ]),
      el('p.training-rhythm__note', {
        text: rhythm.keepers > 0
          ? 'Your keeper automatically protects one quiet completed week.'
          : 'Five strong weeks earns a keeper for a vacation or recovery week.',
      }),
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
      rhythm = await workout.trainingRhythm()
      routines = await storage.getAll('routines')
      exercises = (await storage.getAll('exercises')).sort((a, b) => a.name.localeCompare(b.name))
      records = await workout.recordMap()

      lastByExercise.clear()
      const sessions = new Map((await storage.getAll('sessions')).map((s) => [s.id, s]))
      for (const log of await storage.getAll('setLogs')) {
        const date = sessions.get(log.sessionId)?.date
        if (!date) continue
        if (!lastByExercise.has(log.exerciseId) || date > lastByExercise.get(log.exerciseId)) {
          lastByExercise.set(log.exerciseId, date)
        }
      }
      render()
    },
  }
}
