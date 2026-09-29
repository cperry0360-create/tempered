/**
 * SETUP — a short, guided first-use flow.
 *
 * The last step is the actual tracker contract: each lifestyle item is OFF,
 * DAILY, or WEEKLY with a target count. Training frequency comes from the
 * selected program and Today aggregates repeated exercises across that week.
 */

import { companionStyle } from '../../domain/companion-growth.js'
import { createProgramRevision } from '../../domain/program-schema.js'
import { el, replace } from '../dom.js'

const STEP_COUNT = 8
const SESSION_OPTIONS = [2, 3, 4, 5, 6]
const SESSION_LENGTH_OPTIONS = [30, 45, 60, 75]
const WEEKLY_OPTIONS = [1, 2, 3, 4, 5, 6, 7]
const GOALS = [
  ['strength', 'General strength'],
  ['muscle', 'Build muscle'],
  ['run-support', 'Run-support strength'],
  ['custom', 'Something custom'],
]
const EQUIPMENT = [
  ['full-gym', 'Full gym'],
  ['home-gym', 'Home gym'],
  ['dumbbells', 'Dumbbells only'],
  ['bodyweight', 'Bodyweight'],
]
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
      ...heading('STEP 1 OF 8', 'BUILD STRENGTH, KEEP YOUR LIFE', 'Tempered brings training, nutrition, sleep, and recovery into one clear plan.'),
      el('section.setup__card', {}, [
        el('p.setup__copy', { text: 'Follow a plan, record what actually happened, and see what compounds. A day off creates no downside, and recovery is part of the plan.' }),
        el('p.setup__copy', { text: 'Your data stays on this device. You can change these choices later without resetting history.' }),
        el('label.setup__label', { text: 'Name (optional)' }), name,
        el('span.setup__label', { text: 'Units' }),
        el('div.setup__choices', {}, [unitButton('imperial', 'LB / MI'), unitButton('metric', 'KG / KM')]),
      ]),
    ]
  }

  function stepTwo() {
    return [
      ...heading('STEP 2 OF 8', 'CHOOSE YOUR RHYTHM', 'Pick the goal and schedule you can actually repeat. A useful plan beats a heroic plan you abandon.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Primary goal' }),
        el('div.setup__choices', {}, GOALS.map(([value, label]) => el('button.setup__choice', {
          type: 'button', dataset: { selected: String(draft.goal === value) },
          onclick: () => { draft.goal = value; render() },
        }, [label]))),
        el('span.setup__label', { text: 'Training sessions per week' }),
        el('div.setup__numberchoices', {}, SESSION_OPTIONS.map((value) => el('button.setup__number', {
          type: 'button', dataset: { selected: String(draft.sessionsPerWeek === value) },
          onclick: () => { draft.sessionsPerWeek = value; render() },
        }, [String(value)]))),
        el('span.setup__label', { text: 'Typical session length' }),
        el('div.setup__choices', {}, SESSION_LENGTH_OPTIONS.map((value) => el('button.setup__choice', {
          type: 'button', dataset: { selected: String(draft.sessionLength === value) },
          onclick: () => { draft.sessionLength = value; render() },
        }, [`${value} min`]))),
      ]),
    ]
  }

  function stepThree() {
    return [
      ...heading('STEP 3 OF 8', 'USE WHAT YOU HAVE', 'This helps Tempered suggest a plan that fits your real setup. You can still substitute movements later.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Available equipment' }),
        el('div.setup__choices', {}, EQUIPMENT.map(([value, label]) => el('button.setup__choice', {
          type: 'button', dataset: { selected: String(draft.equipment === value) },
          onclick: () => { draft.equipment = value; render() },
        }, [label]))),
      ]),
    ]
  }

  function stepFour() {
    return [
      ...heading('STEP 4 OF 8', 'CHOOSE HOW TO BEGIN', 'Start with the current plan and adjust it as you learn, or explore Tempered first. Full plan creation is coming next.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Starting path' }),
        el('div.setup__choices', {}, [
          el('button.setup__choice', { type: 'button', dataset: { selected: String(draft.startPath === 'plan') }, onclick: () => { draft.startPath = 'plan'; render() } }, ['Use a plan']),
          el('button.setup__choice', { type: 'button', dataset: { selected: String(draft.startPath === 'explore') }, onclick: () => { draft.startPath = 'explore'; render() } }, ['Explore first']),
        ]),
      ]),
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

  function stepFive() {
    const slots = primarySlots(activeProgram())
    return [
      ...heading('STEP 5 OF 8', 'REVIEW YOUR START', 'This is a starting point, not a test. Add weights if you know them; blank means figure it out in the first session.'),
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

  function stepSix() {
    return [
      ...heading('STEP 6 OF 8', 'WHAT DO YOU WANT TO TRACK?', 'Daily resets each morning. Weekly can be done on any day. Nothing here creates a penalty.'),
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

  function stepSeven() {
    const styleButton = (value, label, copy) => el('button.setup__companionchoice', {
      type: 'button', dataset: { selected: String(draft.companionStyle === value), style: value },
      'aria-pressed': String(draft.companionStyle === value),
      onclick: () => { draft.companionStyle = value; render() },
    }, [
      el('span.setup__companionpreview', { 'aria-hidden': 'true' }),
      el('span', {}, [el('strong', { text: label }), el('small', { text: copy })]),
      el('i', { text: draft.companionStyle === value ? '✓' : '' }),
    ])
    return [
      ...heading('STEP 7 OF 8', 'CHOOSE YOUR COMPANION', 'Optional reflection, not a responsibility. It grows from work you already did and never loses progress.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Companion type' }),
        el('div.setup__companionchoices', {}, [
          styleButton('turtle', 'Trailback Turtle', 'Egg to hatchling to shredded'),
          styleButton('sprout', 'Ember Sprout', 'Warm, playful, and leafy'),
          styleButton('forge', 'Forge Guardian', 'Mature steel, bronze, and teal'),
        ]),
      ]),
    ]
  }

  function stepEight() {
    const chosen = activeProgram()
    const action = draft.startPath === 'explore'
      ? 'Explore Today and Train, then choose your first session when you are ready.'
      : chosen ? `Start with ${chosen.name} and run ${draft.sessionsPerWeek} realistic sessions this week.` : 'Explore Today and add your first workout when you are ready.'
    return [
      ...heading('STEP 8 OF 8', 'YOU HAVE A NEXT STEP', 'Tempered works best when the next action is obvious and the plan is forgiving.'),
      el('section.setup__card', {}, [
        el('span.setup__label', { text: 'Your starting point' }),
        el('p.setup__copy', { text: action }),
        el('p.setup__copy', { text: 'You can edit preferences later. Nothing here locks you into a perfect week.' }),
      ]),
    ]
  }

  const builders = [stepOne, stepTwo, stepThree, stepFour, stepFive, stepSix, stepSeven, stepEight]

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
      companionStyle: companionStyle(draft.companionStyle),
      planTargetSessionsPerWeek: draft.sessionsPerWeek,
      goal: draft.goal,
      sessionLength: draft.sessionLength,
      equipment: draft.equipment,
      setupPath: draft.startPath,
      activitySchedule: clone(draft.schedule),
      dailyActivityIds,
      setupComplete: true,
    })

    const chosen = draft.startPath === 'explore'
      ? null
      : programs.find((program) => program.id === draft.programId) ?? null
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
      if (updated.currentRevisionId) {
        const revision = await storage.get('programRevisions', updated.currentRevisionId)
        if (revision) {
          await storage.put('programRevisions', createProgramRevision(updated, {
            id: revision.id,
            version: revision.version,
            createdAt: revision.createdAt,
          }))
        }
      }

      const byId = new Map(states.map((state) => [state.programId, state]))
      for (const program of programs) {
        const prior = byId.get(program.id)
        const revisionId = prior?.revisionId ?? program.currentRevisionId
        await storage.put('programState', {
          ...prior,
          programId: program.id,
          startedOn: prior?.startedOn ?? clock.today(),
          active: program.id === chosen.id,
          ...(revisionId ? { revisionId } : {}),
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
      companionStyle: companionStyle(profile?.companionStyle),
      goal: profile?.goal ?? 'strength',
      sessionsPerWeek: profile?.planTargetSessionsPerWeek ?? 4,
      sessionLength: profile?.sessionLength ?? 45,
      equipment: profile?.equipment ?? 'full-gym',
      startPath: profile?.setupPath ?? 'plan',
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
