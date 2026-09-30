/**
 * TRAIN — the active program, next useful session, sessions, routines, and rhythm.
 */

import { el, replace } from '../dom.js'
import { icon } from '../icons.js'
import { since } from '../format.js'

/**
 * @param {object} deps
 * @param {ReturnType<import('../../app/workout.js').createWorkoutService>} deps.workout
 * @param {import('../../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../../adapters/clock/clock.js').Clock} deps.clock
 * @param {(options: object) => void} deps.onStart
 * @param {() => void} [deps.onProgramBuilder]
 */
export function createTrainScreen({ workout, storage, clock, onStart, onProgramBuilder }) {
  const root = el('div.screen.screen--train.screen--train-r4')
  let query = ''
  let libraryOpen = false
  let rhythmOpen = false
  let programDetailsOpen = false
  let selectedRoutine = null
  /** @type {{program: any, week: number, deload: boolean}|null} */ let active = null
  /** @type {any} */ let todayDay = null
  /** @type {any[]} */ let routines = []
  /** @type {any[]} */ let exercises = []
  /** @type {Map<string, string>} */ const lastByExercise = new Map()
  /** @type {Map<string, string>} */ const lastByProgramDay = new Map()
  /** @type {any} */ let rhythm = null
  /** @type {any[]} */ let sessions = []
  /** @type {any[]} */ let setLogs = []

  function addUtcDays(date, count) {
    const at = new Date(`${date}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() + count)
    return at.toISOString().slice(0, 10)
  }

  function estimateSessionMinutes(day) {
    const movements = day?.exercises ?? []
    const sets = movements.reduce((sum, exercise) => sum + (Number(exercise.sets) || 0), 0)
    return Math.max(15, Math.round(((sets * 2.3) + (movements.length * 1.5)) / 5) * 5)
  }

  function shortDate(date) {
    if (!date) return 'Not yet worked'
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${date}T00:00:00Z`))
  }

  function deloadWeek(program) {
    const match = String(program?.note ?? '').match(/deload.*?week\s+(\d+)/i)
    return match ? Number(match[1]) : program?.weeks ?? null
  }

  function chevron() {
    return el('span.train-r4__chevron', { 'aria-hidden': 'true', text: '›' })
  }

  function backButton(label = 'Train') {
    return el('button.train-r4__back', {
      type: 'button', 'aria-label': `Back to ${label}`,
      onclick: () => {
        libraryOpen = false
        rhythmOpen = false
        selectedRoutine = null
        query = ''
        render()
      },
    }, ['‹'])
  }

  function trainingCalendar() {
    if (!rhythm) return el('section.train-r4__card', {}, [el('p', { text: 'No training rhythm yet.' })])
    const today = clock.today()
    const mondayOf = (date) => {
      const at = new Date(`${date}T00:00:00Z`)
      return addUtcDays(date, -((at.getUTCDay() + 6) % 7))
    }
    const currentWeekStart = mondayOf(today)
    const recordedDates = [...(rhythm.trainedDates ?? [])]
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today)
      .sort()
    const firstWeekStart = recordedDates.length ? mondayOf(recordedDates[0]) : currentWeekStart
    const elapsedWeeks = Math.floor(
      (Date.parse(`${currentWeekStart}T00:00:00Z`) - Date.parse(`${firstWeekStart}T00:00:00Z`))
      / (7 * 24 * 60 * 60 * 1000),
    )
    const weekStarts = Array.from({ length: Math.max(1, elapsedWeeks + 1) },
      (_, index) => addUtcDays(firstWeekStart, index * 7))
    const trained = new Set(rhythm.trainedDates)
    const qualified = new Set(rhythm.qualifyingDates)
    const panels = weekStarts.map((weekStart) => {
      const dates = Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index))
      return el('section.train-r4__rhythm-week', { dataset: { current: String(weekStart === currentWeekStart) } }, [
        el('strong', { text: weekStart === currentWeekStart ? 'Current week' : shortDate(weekStart) }),
        el('div.train-r4__calendar', {}, [
          ...['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => el('span.train-r4__weekday', { text: day })),
          ...dates.map((date) => el('span.train-r4__day', {
            text: String(new Date(`${date}T00:00:00Z`).getUTCDate()),
            dataset: {
              trained: String(trained.has(date)),
              qualified: String(qualified.has(date)),
              today: String(date === today),
            },
          })),
        ]),
      ])
    })
    const scroller = el('div.train-r4__rhythm-scroll', {}, panels)
    queueMicrotask(() => { scroller.scrollLeft = scroller.scrollWidth })
    return el('section.train-r4__card.train-r4__rhythm-card', {}, [
      el('div.train-r4__card-heading', {}, [
        el('h2', { text: rhythm.streakWeeks === 1 ? '1 week strong' : `${rhythm.streakWeeks} weeks strong` }),
        el('span', { text: `${rhythm.currentWeekDays} / ${rhythm.weeklyDays} days` }),
      ]),
      el('p', { text: rhythm.currentWeekAway ? 'Away week · rhythm protected' : `${rhythm.minimumMinutes}+ minutes counts as a training day` }),
      scroller,
    ])
  }

  function programHeaderCard() {
    if (!active) return null
    const { program, week } = active
    const segments = Array.from({ length: program.weeks ?? 1 }, (_, index) =>
      el('span.train-r4__segment', { dataset: { filled: String(index < week) } }))
    return el('section.train-r4__card.train-r4__program', { dataset: { program: program.id } }, [
      el('h2', { text: program.name }),
      el('p', { text: `Week ${week} of ${program.weeks} · Deload week ${deloadWeek(program)}` }),
      el('div.train-r4__segments', { 'aria-label': `Week ${week} of ${program.weeks}` }, segments),
      el('button.train-r4__row', {
        type: 'button',
        dataset: { programDetails: 'toggle' },
        onclick: () => { programDetailsOpen = !programDetailsOpen; render() },
      }, [el('span', { text: 'Program details' }), chevron()]),
      programDetailsOpen && el('div.train-r4__details', {}, [
        el('p', { text: program.note || 'Your active training plan.' }),
        onProgramBuilder && el('button.train-r4__secondary', {
          type: 'button', onclick: onProgramBuilder,
        }, ['Open Program Builder']),
      ]),
    ])
  }

  function nextSessionCard() {
    if (!todayDay || !active) return null
    return el('section.train-r4__card.train-r4__next', { dataset: { section: 'next-session' } }, [
      el('h2', { text: todayDay.name }),
      el('p', { text: `${todayDay.exercises?.length ?? 0} exercises · ~${estimateSessionMinutes(todayDay)} min` }),
      el('button.train-r4__secondary', {
        type: 'button', dataset: { startday: todayDay.id },
        onclick: () => onStart({ programDay: todayDay }),
      }, ['Start session']),
    ])
  }

  function sessionsCard() {
    if (!active?.program?.days?.length) return null
    return el('section.train-r4__card.train-r4__list-card', {}, [
      el('h2', { text: 'Sessions' }),
      el('div.train-r4__rows', {}, active.program.days.map((day) =>
        el('button.train-r4__row.train-r4__session-row', {
          type: 'button', dataset: { programday: day.id },
          onclick: () => onStart({ programDay: day }),
        }, [
          el('span.train-r4__row-copy', {}, [
            el('strong', { text: day.name }),
            el('small', { text: `${day.exercises?.length ?? 0} exercises · Last ${shortDate(lastByProgramDay.get(day.id))}` }),
          ]),
          chevron(),
        ]))),
    ])
  }

  function routinesCard() {
    return el('section.train-r4__card.train-r4__list-card', {}, [
      el('h2', { text: 'Routines' }),
      el('div.train-r4__rows', {}, routines.map((routine) => {
        const setCount = (routine.exercises ?? []).reduce((sum, exercise) => sum + (exercise.sets ?? 0), 0)
        return el('button.train-r4__row', {
          type: 'button', dataset: { routine: routine.id },
          onclick: () => { selectedRoutine = routine; render() },
        }, [
          el('span.train-r4__row-copy', {}, [
            el('strong', { text: routine.name }),
            el('small', { text: `${routine.exercises?.length ?? 0} exercises · ${setCount} sets` }),
          ]),
          chevron(),
        ])
      })),
    ])
  }

  function utilityRows() {
    return el('section.train-r4__card.train-r4__list-card.train-r4__utilities', {}, [
      el('button.train-r4__row', {
        type: 'button', dataset: { exerciseLibrary: 'open' },
        onclick: () => { libraryOpen = true; query = ''; render() },
      }, [el('span', { text: 'Exercise library' }), chevron()]),
      el('button.train-r4__row', {
        type: 'button', dataset: { trainingRhythm: 'open' },
        onclick: () => { rhythmOpen = true; render() },
      }, [el('span', { text: 'Training rhythm' }), chevron()]),
    ])
  }

  function exerciseRow(exercise) {
    const last = lastByExercise.get(exercise.id)
    return el('button.libraryrow', {
      type: 'button', dataset: { exercise: exercise.id },
      onclick: () => onStart({ routine: null, exerciseId: exercise.id }),
    }, [
      el('span.libraryrow__main', {}, [
        el('span.libraryrow__name', { text: exercise.name }),
        el('span.libraryrow__meta', { text: [exercise.group, exercise.class].filter(Boolean).join(' · ') }),
      ]),
      el('span.libraryrow__last', { text: last ? since(last, clock.today()) : 'Not yet worked' }),
    ])
  }

  function renderLibrary() {
    const filtered = query
      ? exercises.filter((exercise) => `${exercise.name} ${exercise.group ?? ''} ${exercise.pattern ?? ''}`.toLowerCase().includes(query))
      : exercises
    replace(root, [
      el('header.train-r4__subheader', {}, [backButton(), el('h1.screen__title', { text: 'Exercise library' })]),
      el('input.search', {
        type: 'search', placeholder: 'Search exercises', value: query,
        'aria-label': 'Search exercises',
        oninput: (event) => { query = event.target.value.trim().toLowerCase(); render() },
      }),
      el('div.library', {}, filtered.map(exerciseRow)),
    ])
  }

  function renderRoutine() {
    const routine = selectedRoutine
    const names = (routine?.exercises ?? []).map((item) => {
      const exercise = exercises.find((candidate) => candidate.id === item.id)
      return exercise?.name ?? item.name ?? item.id
    })
    replace(root, [
      el('header.train-r4__subheader', {}, [backButton(), el('h1.screen__title', { text: routine?.name ?? 'Routine' })]),
      el('section.train-r4__card.train-r4__routine-detail', {}, [
        el('div.train-r4__routine-exercises', {}, names.map((name) => el('p', { text: name }))),
        el('button.train-r4__secondary', {
          type: 'button', onclick: () => onStart({ routine }),
        }, ['Start session']),
      ]),
    ])
  }

  function renderRhythm() {
    replace(root, [
      el('header.train-r4__subheader', {}, [backButton(), el('h1.screen__title', { text: 'Training rhythm' })]),
      trainingCalendar(),
    ])
  }

  function render() {
    if (libraryOpen) { renderLibrary(); return }
    if (selectedRoutine) { renderRoutine(); return }
    if (rhythmOpen) { renderRhythm(); return }
    replace(root, [
      el('h1.screen__title', { text: 'Train' }),
      programHeaderCard(),
      nextSessionCard(),
      sessionsCard(),
      routinesCard(),
      utilityRows(),
    ])
  }

  return {
    root,
    primary() { return null },
    async refresh() {
      libraryOpen = false
      rhythmOpen = false
      selectedRoutine = null
      query = ''
      active = await workout.activeProgram()
      todayDay = (await workout.todayTasks())?.day ?? null
      ;[rhythm, routines, exercises, sessions, setLogs] = await Promise.all([
        workout.trainingRhythm(), storage.getAll('routines'), storage.getAll('exercises'),
        storage.getAll('sessions'), storage.getAll('setLogs'),
      ])
      exercises.sort((a, b) => a.name.localeCompare(b.name))
      lastByExercise.clear()
      lastByProgramDay.clear()
      const sessionsById = new Map(sessions.map((session) => [session.id, session]))
      for (const log of setLogs) {
        const date = sessionsById.get(log.sessionId)?.date
        if (!date) continue
        if (!lastByExercise.has(log.exerciseId) || date > lastByExercise.get(log.exerciseId)) {
          lastByExercise.set(log.exerciseId, date)
        }
        if (log.programDayId && (!lastByProgramDay.has(log.programDayId) || date > lastByProgramDay.get(log.programDayId))) {
          lastByProgramDay.set(log.programDayId, date)
        }
      }
      render()
    },
  }
}
