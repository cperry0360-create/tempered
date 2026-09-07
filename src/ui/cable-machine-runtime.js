import {
  cableLoadForPeg,
  cableStacksForExercise,
  normalizeCableMachineProfile,
  pegForCableLoad,
} from '../domain/cable-machine.js'

const RUNTIME_KEY = Symbol.for('tempered.cableMachineRuntime')
const PEG_EXERCISES = new Set(['cable_fly'])

const fmt = (value) => Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10)

function validPeg(value, machine) {
  const peg = Number(value)
  return Number.isInteger(peg) && peg >= 1 && peg <= machine.selectorPositions ? peg : null
}

function ensureStyle() {
  if (document.getElementById('cable-machine-style')) return
  const style = document.createElement('style')
  style.id = 'cable-machine-style'
  style.textContent = `
    .cable-mode-note {
      margin: -4px 0 0;
      color: var(--blue);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
    }
    .cable-readout {
      grid-column: 3 / -1;
      grid-row: 2;
      display: flex;
      align-items: center;
      min-height: 26px;
      color: var(--blue);
      font-size: 11px;
      font-weight: 750;
    }
    .setrow__num[data-cable-invalid='true'] {
      border-color: var(--acid) !important;
      outline: 1px solid var(--acid);
    }
    .cable-settings__grid {
      display: grid;
      gap: 10px;
    }
    .cable-settings__toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .cable-settings__example {
      margin: 0;
      padding: 12px;
      border-radius: 12px;
      background: var(--well);
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.4;
    }
    .cable-settings__example strong { color: var(--blue); }
    .cable-settings__number {
      width: 88px;
      min-height: 44px;
      background: var(--well);
      border: 1px solid var(--edge);
      border-radius: 10px;
      color: var(--text);
      font: inherit;
      font-variant-numeric: tabular-nums;
      padding: 0 10px;
      text-align: right;
    }
  `
  document.head.append(style)
}

/**
 * Adds Inspire FT1 peg entry without changing the workout engine's units.
 *
 * The session screen continues to own set state and logging. While Peg Mode is
 * on, Cable Fly's visible weight field contains the physical selector peg. The
 * workout service is wrapped only at the write boundary so the stored set keeps
 * effective resistance for volume, PRs and XP, plus explicit cable metadata for
 * history. That keeps the rest of the app in pounds and makes this adapter
 * removable rather than contaminating the domain with UI units.
 */
export async function installCableMachineRuntime(context) {
  if (!context?.storage || !context?.workout) return null
  if (context[RUNTIME_KEY]) return context[RUNTIME_KEY]

  ensureStyle()

  const { storage, workout } = context
  const app = document.getElementById('app')
  if (!app) return null

  let profileRecord = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
  let machine = normalizeCableMachineProfile(profileRecord.cableMachine)
  let currentSessionRoot = null
  const initialisedExercises = new Set()
  const pegState = new Map()
  let enhanceQueued = false

  async function saveMachine(patch) {
    machine = normalizeCableMachineProfile({ ...machine, ...patch })
    profileRecord = (await storage.get('profile', 'profile')) ?? profileRecord ?? { id: 'profile' }
    profileRecord = { ...profileRecord, cableMachine: { ...machine } }
    await storage.put('profile', profileRecord)
    queueEnhance()
    return machine
  }

  const originalLogSet = workout.logSet.bind(workout)
  workout.logSet = async (session, set) => {
    if (!machine.enabled || !PEG_EXERCISES.has(set?.exerciseId)) return originalLogSet(session, set)

    const stacks = cableStacksForExercise(set.exerciseId, machine)
    const load = cableLoadForPeg(set.weight, { profile: machine, stacks })
    if (!load) return originalLogSet(session, set)

    const stored = await originalLogSet(session, { ...set, weight: load.total })
    const enriched = {
      ...stored,
      cableMachineId: machine.id,
      cableMachineName: machine.name,
      cablePeg: load.peg,
      cableStacks: load.stacks,
      cableStackWeight: load.stackWeight,
      cablePerHandle: load.perHandle,
      cableEffectiveTotal: load.total,
      cableRatio: load.ratio,
      cableAddOn: load.addOnEnabled,
    }
    await storage.put('setLogs', enriched)
    return enriched
  }

  function syncSessionBoundary() {
    const root = app.querySelector('.screen--session')
    if (root === currentSessionRoot) return root
    currentSessionRoot = root
    initialisedExercises.clear()
    pegState.clear()
    return root
  }

  function rowKey(exerciseId, input) {
    return `${exerciseId}:${input.dataset.set ?? '0'}`
  }

  function updateReadout(card) {
    let readout = card.querySelector('.cable-readout')
    if (!machine.enabled) {
      readout?.remove()
      return
    }

    const row = card.querySelector('.setrow[data-active="true"]')
      ?? [...card.querySelectorAll('.setrow')].find((candidate) => candidate.querySelector('.setrow__num[data-field="weight"]:not([readonly])'))
    const input = row?.querySelector('.setrow__num[data-field="weight"]')
    if (!(input instanceof HTMLInputElement)) {
      readout?.remove()
      return
    }

    if (!readout) {
      readout = document.createElement('div')
      readout.className = 'cable-readout'
      readout.dataset.cableReadout = card.dataset.exercise
      row.append(readout)
    } else if (readout.parentElement !== row) {
      row.append(readout)
    }

    const stacks = cableStacksForExercise(card.dataset.exercise, machine)
    const load = cableLoadForPeg(input.value, { profile: machine, stacks })
    const next = load
      ? `${fmt(load.perHandle)} lb / handle · ${fmt(load.total)} lb total · ${load.stacks} stack${load.stacks === 1 ? '' : 's'} @ ${fmt(load.ratio)}:1`
      : `Enter peg 1–${machine.selectorPositions}`
    if (readout.textContent !== next) readout.textContent = next
  }

  function initialisePegInputs(card) {
    const exerciseId = card.dataset.exercise
    const firstPass = !initialisedExercises.has(exerciseId)
    const stacks = cableStacksForExercise(exerciseId, machine)

    for (const input of card.querySelectorAll('.setrow__num[data-field="weight"]')) {
      if (!(input instanceof HTMLInputElement)) continue
      const key = rowKey(exerciseId, input)

      if (pegState.has(key)) {
        const peg = pegState.get(key)
        const next = peg == null ? '' : String(peg)
        if (input.value !== next) {
          input.value = next
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } else if (firstPass) {
        const previousWeight = Number(input.value)
        const peg = pegForCableLoad(previousWeight, { profile: machine, stacks })
        pegState.set(key, peg)
        const next = peg == null ? '' : String(peg)
        if (input.value !== next) {
          input.value = next
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }

      input.inputMode = 'numeric'
      input.setAttribute('aria-label', `Peg, set ${Number(input.dataset.set ?? 0) + 1}`)
      input.dataset.cablePeg = 'true'
      delete input.dataset.cableInvalid
    }

    initialisedExercises.add(exerciseId)
  }

  function enhanceCableCard(card) {
    const exerciseId = card.dataset.exercise
    if (!machine.enabled || !PEG_EXERCISES.has(exerciseId)) return

    card.dataset.cableMachine = machine.id
    const weightHead = card.querySelector('.setrow--head [data-col="weight"]')
    if (weightHead) weightHead.textContent = 'PEG'

    initialisePegInputs(card)

    if (!card.querySelector('.cable-mode-note')) {
      const note = document.createElement('p')
      note.className = 'cable-mode-note'
      note.dataset.cableMode = 'peg'
      const stacks = cableStacksForExercise(exerciseId, machine)
      note.textContent = `${machine.name.toUpperCase()} PEG MODE · ${stacks === 2 ? 'BOTH STACKS' : 'ONE STACK'}`
      const actions = card.querySelector('.actions')
      actions?.insertAdjacentElement('afterend', note)
    }

    updateReadout(card)
  }

  function numberSetting(label, key, value, inputMode = 'decimal') {
    const row = document.createElement('div')
    row.className = 'setting'
    const name = document.createElement('span')
    name.className = 'setting__label'
    name.textContent = label
    const input = document.createElement('input')
    input.className = 'cable-settings__number'
    input.type = 'text'
    input.inputMode = inputMode
    input.value = String(value)
    input.setAttribute('aria-label', label)
    input.addEventListener('change', async () => {
      await saveMachine({ [key]: input.value })
      input.value = String(machine[key])
      renderSettingsExample(row.closest('[data-section="cable-machine"]'))
    })
    row.append(name, input)
    return row
  }

  function renderSettingsExample(section) {
    const example = section?.querySelector('.cable-settings__example')
    if (!example) return
    const load = cableLoadForPeg(6, { profile: machine, stacks: Math.min(2, machine.stackCount) })
    const next = load
      ? `Peg 6 → ${fmt(load.perHandle)} lb / handle · ${fmt(load.total)} lb Cable Fly total`
      : 'Adjust the machine values to preview Peg 6.'
    if (example.textContent !== next) example.textContent = next
  }

  function enhanceSettings(screen) {
    if (screen.querySelector('[data-section="cable-machine"]')) return

    const section = document.createElement('section')
    section.className = 'card cable-settings'
    section.dataset.section = 'cable-machine'

    const title = document.createElement('h2')
    title.className = 'block__title'
    title.textContent = 'Cable machine'

    const hint = document.createElement('p')
    hint.className = 'block__hint'
    hint.textContent = 'Inspire FT1 preset. Enter the selector peg for Cable Fly; Tempered stores the calculated effective resistance for progression and history.'

    const toggleRow = document.createElement('div')
    toggleRow.className = 'cable-settings__toggle'
    const toggleLabel = document.createElement('span')
    toggleLabel.className = 'setting__label'
    toggleLabel.textContent = 'FT1 peg entry'
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'setup__cadence'
    toggle.dataset.selected = String(machine.enabled)
    toggle.setAttribute('aria-pressed', String(machine.enabled))
    toggle.textContent = machine.enabled ? 'ON' : 'OFF'
    toggle.addEventListener('click', async () => {
      await saveMachine({ enabled: !machine.enabled })
      toggle.dataset.selected = String(machine.enabled)
      toggle.setAttribute('aria-pressed', String(machine.enabled))
      toggle.textContent = machine.enabled ? 'ON' : 'OFF'
    })
    toggleRow.append(toggleLabel, toggle)

    const addonRow = document.createElement('div')
    addonRow.className = 'cable-settings__toggle'
    const addonLabel = document.createElement('span')
    addonLabel.className = 'setting__label'
    addonLabel.textContent = `${fmt(machine.addOnWeight)} lb add-on weights installed`
    const addon = document.createElement('button')
    addon.type = 'button'
    addon.className = 'setup__cadence'
    addon.dataset.selected = String(machine.addOnEnabled)
    addon.setAttribute('aria-pressed', String(machine.addOnEnabled))
    addon.textContent = machine.addOnEnabled ? 'YES' : 'NO'
    addon.addEventListener('click', async () => {
      await saveMachine({ addOnEnabled: !machine.addOnEnabled })
      addon.dataset.selected = String(machine.addOnEnabled)
      addon.setAttribute('aria-pressed', String(machine.addOnEnabled))
      addon.textContent = machine.addOnEnabled ? 'YES' : 'NO'
      renderSettingsExample(section)
    })
    addonRow.append(addonLabel, addon)

    const grid = document.createElement('div')
    grid.className = 'cable-settings__grid'
    grid.append(
      toggleRow,
      numberSetting('Selector positions', 'selectorPositions', machine.selectorPositions, 'numeric'),
      numberSetting('Top / head weight (lb)', 'headWeight', machine.headWeight),
      numberSetting('Each numbered plate (lb)', 'plateIncrement', machine.plateIncrement),
      numberSetting('Pulley ratio', 'ratio', machine.ratio),
      addonRow,
    )

    const example = document.createElement('p')
    example.className = 'cable-settings__example'
    section.append(title, hint, grid, example)
    renderSettingsExample(section)

    const credits = screen.querySelector('[data-section="credits"]')
    if (credits) screen.insertBefore(section, credits)
    else screen.append(section)
  }

  function enhance() {
    syncSessionBoundary()
    const settings = app.querySelector('.screen--settings')
    if (settings) enhanceSettings(settings)
    const sessionRoot = currentSessionRoot
    if (sessionRoot && machine.enabled) {
      for (const card of sessionRoot.querySelectorAll('[data-exercise]')) enhanceCableCard(card)
    }
  }

  function queueEnhance() {
    if (enhanceQueued) return
    enhanceQueued = true
    requestAnimationFrame(() => {
      enhanceQueued = false
      if (app.isConnected) enhance()
    })
  }

  app.addEventListener('input', (event) => {
    const input = event.target?.closest?.('.setrow__num[data-cable-peg="true"]')
    if (!(input instanceof HTMLInputElement)) return
    const card = input.closest('[data-exercise]')
    const exerciseId = card?.dataset.exercise
    if (!exerciseId || !PEG_EXERCISES.has(exerciseId)) return
    const peg = validPeg(input.value, machine)
    pegState.set(rowKey(exerciseId, input), peg)
    input.dataset.cableInvalid = String(input.value.trim() !== '' && peg == null)
    updateReadout(card)
  })

  // Invalid pegs must never silently become pounds. Capture the log tap before
  // session.js sees it and keep the user in the field with a useful range cue.
  app.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.setrow__check')
    const row = button?.closest?.('.setrow')
    const card = row?.closest?.('[data-exercise]')
    const exerciseId = card?.dataset.exercise
    if (!machine.enabled || !exerciseId || !PEG_EXERCISES.has(exerciseId)) return
    const input = row.querySelector('.setrow__num[data-field="weight"]')
    if (!(input instanceof HTMLInputElement) || input.readOnly) return
    if (validPeg(input.value, machine) != null) return

    event.preventDefault()
    event.stopImmediatePropagation()
    input.dataset.cableInvalid = 'true'
    input.focus()
    updateReadout(card)
  }, true)

  const observer = new MutationObserver(queueEnhance)
  observer.observe(app, { childList: true, subtree: true })
  queueEnhance()

  const runtime = {
    get profile() { return { ...machine } },
    saveMachine,
    destroy() {
      observer.disconnect()
      workout.logSet = originalLogSet
      context[RUNTIME_KEY] = null
    },
  }
  context[RUNTIME_KEY] = runtime
  return runtime
}
