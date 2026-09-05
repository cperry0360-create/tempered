/**
 * SETUP — five fast, skippable steps.
 *
 * The last step is the actual tracker contract: each lifestyle item is OFF,
 * DAILY, or WEEKLY with a target count. Training frequency comes from the
 * selected program and Today aggregates repeated exercises across that week.
 */

import { el, replace } from '../dom.js'

const STEP_COUNT = 5
const SESSION_OPTIONS = [2, 3, 4, 5, 6]
const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 6, 7]
const clone = (value) => JSON.parse(JSON.stringify(value))

function defaultSchedule(activities, profile) {
  const legacy = new Set(profile?.dailyActivityIds ?? activities.filter((a) => a.daily === true).map((a) => a.id))
  const stored = profile?.activitySchedule ?? {}
  return Object.fromEntries(activities.map((activity) => {
    const raw = stored[activity.id]
    if (raw?.cadence === 'daily') return [activity.id, { cadence: 'daily', target: 1 }]
    if (raw?.cadence === 'weekly') return [activity.id, {
      cadence: 'weekly', target: Math.max(1, Math.min(7, Number(raw.target) || 1)),
    }]
    if (raw?.cadence === 'off') return [activity.id, { cadence: 'off', target: 1 }]
    return [activity.id, legacy.has(activity.id)
      ? { cadence: 'daily', target: 1 }
      : { cadence: 'off', target: 1 }]
  }))
}

function primarySlots(program) {
  const seen = new Set()
  const slots = []
  for (const day of program?.days ?? []) {
    const slot = day.exercises?.[0]
    if (!slot || seen.has(slot.exerciseId)) continue
    seen.add(slot.exerciseId)
    slots.push(slot)
  }
  return slots
}

function exerciseFrequency(program) {
  const counts = new Map()
  for (const day of program?.days ?? []) {
    for (const slot of day.exercises ?? []) {
      counts.set(slot.exerciseId, {
        name: slot.name,
        count: (counts.get(slot.exerciseId)?.count ?? 0) + 1,
      })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function storedWeight(program, exerciseId) {
  for (const day of program?.days ?? []) {
    for (const slot of day.exercises ?? []) {
      if (slot.exerciseId === exerciseId && typeof slot.weight === 'number') return slot.weight
    }
  }
  return ''
}

export function createSetupScreen({ mount, storage, clock, activities, onDone, onCancel = null }) {
  const root = el('main.setup')
  let step = 0
  let rerun = false
  let profile = null
  let programs = []
  let states = []
  let draft = null

  function activeProgram() {
    return programs.find((program) => program.id === draft.programId) ?? programs[0] ?? null
  }

  function progress() {
    return el('div.setup__progress', {}, Array.from({ length: STEP_COUNT }, (_, index) =>
      el('span.setup__dot', { dataset: { active: String(index <= step) } })))
  }

  function heading(kicker, title, copy) {
    return [
      el('p.setup__kicker', { text: kicker }),
      el('h1.setup__title', { text: title }),
      el('p.setup__copy', { text: copy }),
    ]
  }

  function stepOne() {
    const name = el('input.setup__input', {
      type: 'text', value: draft.name, placeholder: 'Your name', autocomplete: 'name',
      'aria-label': 'Name', oninput: (event) => { draft.name = event.target.value },
    })
    const unitButton = (value, label) => el('button.setup__choice', {
      type: 'button', dataset: { selected: String(draft.units === value) },
      onclick: () => { draft.units = value; render() },
    }, [label])

    return [
      ...heading('STEP 1 OF 5', 'MAKE IT YOURS', 'Name is optional. Pick the units you want everywhere else.'),
      el('section.setup__card', {}, [
        el('label.setup__label', { text: 'Name' }), name,
        el('span.setup__label', { text: 'Units' }),
        el('div.setup__choices', {}, [unitButton('imperial', 'LB / MI'), unitButton('metric', 'KG / KM')]),
      ]),
    ]
  }

  function stepTwo() {
    return [
      ...heading('STEP 2 OF 5', 'SET THE RHYTHM', 'This is a target, not a streak. It helps the RPG judge a training week.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Training sessions per week' }),
        el('div.setup__numberchoices', {}, SESSION_OPTIONS.map((value) => el('button.setup__number', {
          type: 'button', dataset: { selected: String(draft.sessionsPerWeek === value) },
          onclick: () => { draft.sessionsPerWeek = value; render() },
        }, [String(value)]))),
      ]),
    ]
  }

  function stepThree() {
    return [
      ...heading('STEP 3 OF 5', 'PICK THE PLAN', 'Your program defines which exercises belong to This Week. Repeated exercises automatically become 2×, 3×, and so on.'),
      el('div.setup__stack', {}, programs.length
        ? programs.map((program) => el('button.setup__program', {
            type: 'button', dataset: { selected: String(draft.programId === program.id) },
            onclick: () => {
              draft.programId = program.id
              for (const slot of primarySlots(program)) {
                if (!(slot.exerciseId in draft.weights)) draft.weights[slot.exerciseId] = storedWeight(program, slot.exerciseId)
              }
              render()
            },
          }, [
            el('span.setup__programname', { text: program.name }),
            el('span.setup__programmeta', { text: `${program.days?.length ?? 0} training days · ${program.weeks ?? 1} weeks` }),
            el('span.setup__programnote', {
              text: exerciseFrequency(program).slice(0, 5).map((item) => `${item.name} ${item.count}×`).join(' · '),
            }),
          ]))
        : [el('section.setup__card', {}, [el('p.setup__copy', { text: 'No program is installed yet. You can skip this step.' })])]),
    ]
  }

  function stepFour() {
    const slots = primarySlots(activeProgram())
    return [
      ...heading('STEP 4 OF 5', 'STARTING WEIGHTS', 'Optional. Add the working weight you would use today. Blank means figure it out in the first session.'),
      el('section.setup__card.setup__weights', {}, slots.length
        ? slots.map((slot) => el('label.setup__weightrow', {}, [
            el('span.setup__weightname', { text: slot.name }),
            el('span.setup__weightfield', {}, [
              el('input.setup__weightinput', {
                type: 'number', inputmode: 'decimal', min: '0', step: draft.units === 'metric' ? '1' : '5',
                value: draft.weights[slot.exerciseId] ?? '',
                'aria-label': `${slot.name} starting weight`,
                oninput: (event) => { draft.weights[slot.exerciseId] = event.target.value },
              }),
              el('span.setup__unit', { text: draft.units === 'metric' ? 'kg' : 'lb' }),
            ]),
          ]))
        : [el('p.setup__copy', { text: 'No primary lifts to set for this program.' })]),
    ]
  }

  function cadenceButton(activity, cadence, label) {
    const current = draft.schedule[activity.id]
    return el('button.setup__cadence', {
      type: 'button',
      dataset: { selected: String(current.cadence === cadence) },
      onclick: () => {
        current.cadence = cadence
        if (cadence !== 'weekly') current.target = 1
        render()
      },
    }, [label])
  }

  function stepFive() {
    return [
      ...heading('STEP 5 OF 5', 'WHAT DO YOU WANT TO TRACK?', 'Daily resets each morning. Weekly can be done on any day; choose how many times you want it to count this week.'),
      el('div.setup__cadencelist', {}, activities.map((activity) => {
        const current = draft.schedule[activity.id]
        return el('section.setup__cadencerow', { dataset: { attribute: activity.attribute } }, [
          el('div.setup__cadencehead', {}, [
            el('span.setup__activityname', { text: activity.name }),
            current.cadence === 'weekly' && el('select.setup__weeklyselect', {
              value: String(current.target),
              'aria-label': `${activity.name} times per week`,
              onchange: (event) => { current.target = Number(event.target.value); render() },
            }, WEEKLY_OPTIONS.map((value) => el('option', { value: String(value) }, [`${value}×/wk`]))),
          ]),
          el('div.setup__cadencechoices', {}, [
            cadenceButton(activity, 'off', 'OFF'),
            cadenceButton(activity, 'daily', 'DAILY'),
            cadenceButton(activity, 'weekly', current.cadence === 'weekly' ? `${current.target}× / WK` : 'WEEKLY'),
          ]),
        ])
      })),
    ]
  }

  const builders = [stepOne, stepTwo, stepThree, stepFour, stepFive]

  function next() {
    if (step < STEP_COUNT - 1) { step += 1; render() }
    else finish()
  }
  function back() { if (step > 0) { step -= 1; render() } }

  async function finish() {
    const dailyActivityIds = activities.map((a) => a.id)
      .filter((id) => draft.schedule[id]?.cadence === 'daily')
    await storage.put('profile', {
      ...profile,
      name: String(draft.name ?? '').trim(),
      units: draft.units,
      planTargetSessionsPerWeek: draft.sessionsPerWeek,
      activitySchedule: clone(draft.schedule),
      dailyActivityIds,
      setupComplete: true,
    })

    const chosen = programs.find((program) => program.id === draft.programId) ?? null
    if (chosen) {
      const updated = clone(chosen)
      for (const day of updated.days ?? []) {
        for (const slot of day.exercises ?? []) {
          const raw = draft.weights[slot.exerciseId]
          if (raw === '' || raw === null || raw === undefined) continue
          const weight = Number(raw)
          if (Number.isFinite(weight) && weight > 0) slot.weight = weight
        }
      }
      await storage.put('programs', updated)

      const byId = new Map(states.map((state) => [state.programId, state]))
      for (const program of programs) {
        const prior = byId.get(program.id)
        await storage.put('programState', {
          programId: program.id,
          startedOn: prior?.startedOn ?? clock.today(),
          active: program.id === chosen.id,
        })
      }
    }
    await onDone()
  }

  function footer() {
    const left = step > 0
      ? el('button.setup__quiet', { type: 'button', onclick: back }, ['BACK'])
      : rerun && onCancel
        ? el('button.setup__quiet', { type: 'button', onclick: () => onCancel() }, ['CANCEL'])
        : el('span')
    return el('div.setup__footer', {}, [
      left,
      step < STEP_COUNT - 1 && el('button.setup__quiet', { type: 'button', onclick: next }, ['SKIP']),
      el('button.setup__next', { type: 'button', dataset: { acid: 'primary' }, onclick: next }, [
        step === STEP_COUNT - 1 ? (rerun ? 'SAVE' : 'START TEMPERING') : 'NEXT',
      ]),
    ])
  }

  function render() {
    replace(root, [el('div.setup__inner', {}, [progress(), ...builders[step](), footer()])])
    root.scrollTop = 0
  }

  async function start(options = {}) {
    rerun = options.rerun === true
    profile = await storage.get('profile', 'profile')
    programs = await storage.getAll('programs')
    states = await storage.getAll('programState')
    const current = states.find((state) => state.active)
    const programId = current?.programId ?? programs[0]?.id ?? null
    const program = programs.find((entry) => entry.id === programId) ?? programs[0] ?? null

    const weights = {}
    for (const slot of primarySlots(program)) weights[slot.exerciseId] = storedWeight(program, slot.exerciseId)

    draft = {
      name: profile?.name ?? '',
      units: profile?.units ?? 'imperial',
      sessionsPerWeek: profile?.planTargetSessionsPerWeek ?? 4,
      programId,
      weights,
      schedule: defaultSchedule(activities, profile),
    }
    step = 0
    replace(mount, [root])
    render()
  }

  return { root, start }
}
