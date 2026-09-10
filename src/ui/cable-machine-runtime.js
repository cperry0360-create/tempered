import {
  cableLoadForPeg,
  cablePegEnabledForExercise,
  cableStacksForExercise,
  migrateLegacyCableFlySet,
  normalizeCableMachineProfile,
  pegForCableLoad,
  withCableExerciseSetting,
} from '../domain/cable-machine.js'
import { estimateOneRepMax } from '../domain/e1rm.js'
import { methodForSet, methodsForExercise } from '../domain/exercise-method.js'

const RUNTIME_KEY = Symbol.for('tempered.cableMachineRuntime')
const HISTORY_MIGRATION_VERSION = 2

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
    .cable-settings__grid,
    .cable-exercises {
      display: grid;
      gap: 10px;
    }
    .cable-settings__toggle,
    .cable-exercise {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .cable-exercises {
      padding-top: 4px;
    }
    .cable-exercise {
      min-height: 48px;
      padding: 8px 0;
      border-top: 1px solid var(--edge);
    }
    .cable-exercise__copy {
      min-width: 0;
      display: grid;
      gap: 2px;
    }
    .cable-exercise__name {
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
    }
    .cable-exercise__meta {
      color: var(--text-3);
      font-size: 10px;
    }
    .cable-exercise__controls {
      flex: none;
      display: flex;
      gap: 6px;
    }
    .cable-exercise__button {
      appearance: none;
      min-height: 44px;
      min-width: 52px;
      padding: 0 10px;
      border: 0;
      border-radius: 12px;
      background: var(--well);
      color: var(--text-2);
      font: inherit;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .04em;
    }
    .cable-exercise__button[data-selected='true'] {
      background: color-mix(in srgb, var(--acid) 12%, var(--well));
      color: var(--acid);
      outline: 1px solid color-mix(in srgb, var(--acid) 45%, transparent);
    }
    .cable-settings__example {
      margin: 0;
      padding: 12px;
      border-radius: 12px;
      background: var(--well);
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.45;
    }
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
 * Peg entry is a presentation adapter around the normal workout engine.
 * Stored weights remain nominal effective resistance so PRs, volume and XP stay
 * in pounds; cablePeg preserves what the user physically set on the machine.
 */
export async function installCableMachineRuntime(context) {
  if (!context?.storage || !context?.workout) return null
  if (context[RUNTIME_KEY]) return context[RUNTIME_KEY]

  ensureStyle()

  const { storage, workout } = context
  const app = document.getElementById('app')
  if (!app) return null

  const exerciseMap = await workout.exerciseMap()
  const cableExercises = [...exerciseMap.values()]
    .filter((exercise) => methodsForExercise(exercise).includes('Cable') && exercise.unit !== 'time')
    .sort((a, b) => a.name.localeCompare(b.name))
  const cableExerciseIds = new Set(cableExercises.map((exercise) => exercise.id))

  let profileRecord = (await storage.get('profile', 'profile')) ?? { id: 'profile' }
  let machine = normalizeCableMachineProfile(profileRecord.cableMachine)
  let currentSessionRoot = null
  const initialisedExercises = new Set()
  const pegState = new Map()
  let enhanceQueued = false

  async function persistMachine() {
    profileRecord = (await storage.get('profile', 'profile')) ?? profileRecord ?? { id: 'profile' }
    profileRecord = { ...profileRecord, cableMachine: { ...machine } }
    await storage.put('profile', profileRecord)
  }

  async function saveMachine(patch) {
    machine = normalizeCableMachineProfile({ ...machine, ...patch })
    await persistMachine()
    queueEnhance()
    return machine
  }

  async function saveExercise(exerciseId, patch) {
    machine = withCableExerciseSetting(machine, exerciseId, patch)
    await persistMachine()
    queueEnhance()
    return machine
  }

  /** Rebuild one cable record from canonical logs so migrated peg history fixes PR. */
  async function rebuildCableRecord(exerciseId) {
    const exercise = exerciseMap.get(exerciseId)
    const allLogs = (await storage.getAll('setLogs'))
      .filter((log) => log.exerciseId === exerciseId && log.isWarmup !== true
        && methodForSet(log, exercise) === 'Cable')
    if (allLogs.length === 0) return

    const sessions = new Map((await storage.getAll('sessions')).map((session) => [session.id, session]))
    const dated = allLogs
      .map((log) => ({ log, date: sessions.get(log.sessionId)?.date }))
      .filter((row) => row.date)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (dated.length === 0) return

    let bestWeight = null
    let bestVolume = null
    let bestE1RM = null
    let lastPerformance = null
    const byDate = new Map()

    for (const row of dated) {
      if (!byDate.has(row.date)) byDate.set(row.date, [])
      byDate.get(row.date).push(row.log)

      const weight = Number(row.log.weight)
      const reps = Number(row.log.reps)
      if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) {
        if (!bestWeight || weight > bestWeight.weight) {
          bestWeight = {
            weight,
            reps,
            date: row.date,
            ...(row.log.cablePeg != null ? {
              cablePeg: row.log.cablePeg,
              cablePerHandle: row.log.cablePerHandle,
              cableStacks: row.log.cableStacks,
            } : {}),
          }
        }
        const estimate = estimateOneRepMax(weight, reps)
        if (estimate > (bestE1RM?.value ?? 0)) bestE1RM = { value: estimate, date: row.date }
      }
    }

    for (const [date, logs] of byDate) {
      const volume = logs.reduce((sum, log) => {
        const weight = Number(log.weight)
        const reps = Number(log.reps)
        return sum + (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0 ? weight * reps : 0)
      }, 0)
      if (volume > (bestVolume?.volume ?? 0)) bestVolume = { volume, date }

      const top = logs
        .filter((log) => Number.isFinite(Number(log.weight)) && Number(log.weight) > 0 && Number(log.reps) > 0)
        .sort((a, b) => Number(b.weight) - Number(a.weight))[0]
      if (top) {
        lastPerformance = {
          weight: Number(top.weight),
          reps: Number(top.reps),
          date,
          ...(top.cablePeg != null ? {
            cablePeg: top.cablePeg,
            cablePerHandle: top.cablePerHandle,
            cableStacks: top.cableStacks,
          } : {}),
        }
      }
    }

    const record = {
      exerciseId,
      bestWeight,
      bestVolume,
      bestE1RM,
      lastPerformance,
    }
    // Single-method cable exercises still use the canonical record store.
    // Multi-method movements get their method PR directly from set history so
    // Cable cannot overwrite a Dumbbell or Barbell record.
    if (methodsForExercise(exercise).length < 2) await storage.put('records', record)
    return record
  }

  /**
   * Fix the known pre-peg Cable Fly history where selector numbers 1–15 were
   * stored as literal pounds. This is deliberately narrow: old rows/pulldowns
   * remain pounds because there is no evidence those were selector numbers.
   */
  async function migrateLegacyHistory() {
    const migrationVersion = Number(profileRecord?.cableMachineHistoryMigration ?? 0)
    if (migrationVersion >= HISTORY_MIGRATION_VERSION) return 0

    const logs = await storage.getAll('setLogs')
    let changed = 0
    for (const log of logs) {
      const migrated = migrateLegacyCableFlySet(log, machine)
      if (migrated === log) continue
      await storage.put('setLogs', migrated)
      changed += 1
    }

    if (changed > 0) await rebuildCableRecord('cable_fly')
    profileRecord = (await storage.get('profile', 'profile')) ?? profileRecord
    profileRecord = { ...profileRecord, cableMachineHistoryMigration: HISTORY_MIGRATION_VERSION }
    await storage.put('profile', profileRecord)
    return changed
  }

  await migrateLegacyHistory()
  // Persist the corrected FTX identity even if the prior prototype saved FT1.
  await persistMachine()

  const originalLogSet = workout.logSet.bind(workout)
  const originalFinishSession = workout.finishSession.bind(workout)

  workout.logSet = async (session, set) => {
    const exercise = exerciseMap.get(set?.exerciseId)
    if (!machine.enabled || methodForSet(set, exercise) !== 'Cable'
      || !cableExerciseIds.has(set?.exerciseId)
      || !cablePegEnabledForExercise(set.exerciseId, machine)) {
      return originalLogSet(session, set)
    }

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
      cableResistanceKind: 'nominal',
    }
    await storage.put('setLogs', enriched)
    // The core workout service may have just promoted this set to a record
    // before cable metadata was added. Rebuild immediately so the PR pill and
    // Progress page both retain the physical peg as well as nominal pounds.
    await rebuildCableRecord(set.exerciseId)
    return enriched
  }

  workout.finishSession = async (...args) => {
    const summary = await originalFinishSession(...args)
    const logs = await storage.getAll('setLogs')
    const withPegMetadata = new Set(logs.filter((log) => log.cablePeg != null).map((log) => log.exerciseId))
    for (const exerciseId of withPegMetadata) await rebuildCableRecord(exerciseId)
    return summary
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
    const exerciseId = card.dataset.exercise
    if (!machine.enabled || !cablePegEnabledForExercise(exerciseId, machine)) {
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
      readout.dataset.cableReadout = exerciseId
      row.append(readout)
    } else if (readout.parentElement !== row) {
      row.append(readout)
    }

    const stacks = cableStacksForExercise(exerciseId, machine)
    const load = cableLoadForPeg(input.value, { profile: machine, stacks })
    const next = load
      ? `Nominal ${fmt(load.perHandle)} lb / handle · ${fmt(load.total)} lb total · ${load.stacks} stack${load.stacks === 1 ? '' : 's'} @ ${fmt(load.ratio)}:1`
      : `Enter peg 1–${machine.selectorPositions}`
    if (readout.textContent !== next) readout.textContent = next
  }

  async function decorateRecord(card) {
    const exerciseId = card.dataset.exercise
    const record = methodsForExercise(exerciseMap.get(exerciseId)).length > 1
      ? (await workout.methodPerformance(exerciseId, 'Cable')).record
      : await storage.get('records', exerciseId)
    const best = record?.bestWeight
    if (!Number.isInteger(best?.cablePeg) || !Number.isFinite(Number(best?.weight)) || !card.isConnected) return

    const token = `${best.cablePeg}:${best.weight}:${best.reps ?? ''}`
    if (card.dataset.cableRecord === token) return
    const pill = card.querySelector('[data-kind="pr"]')
    const value = pill?.querySelector('.pill__value')
    const unit = pill?.querySelector('.pill__unit')
    if (value) value.textContent = `P${best.cablePeg} · ${fmt(Number(best.weight))}`
    if (unit) unit.textContent = 'lb nominal'
    card.dataset.cableRecord = token
  }

  function initialisePegInputs(card) {
    const exerciseId = card.dataset.exercise
    const firstPass = !initialisedExercises.has(exerciseId)
    const stacks = cableStacksForExercise(exerciseId, machine)

    for (const input of card.querySelectorAll('.setrow__num[data-field="weight"]')) {
      if (!(input instanceof HTMLInputElement)) continue
      const key = rowKey(exerciseId, input)

      if (!firstPass) {
        // Once this exercise has entered peg mode, the workout screen's set
        // draft already contains selector numbers. A set-1 change also
        // cascades into the later draft rows before the screen redraws. Treat
        // those freshly rendered values as canonical instead of restoring the
        // older per-row map (whose empty values would erase that cascade).
        pegState.set(key, validPeg(input.value, machine))
      } else if (pegState.has(key)) {
        const peg = pegState.get(key)
        const next = peg == null ? '' : String(peg)
        if (input.value !== next) {
          input.value = next
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } else {
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

  function clearCableCard(card) {
    if (!card.dataset.cableMachine && !card.querySelector('[data-cable-peg="true"]')) return
    const exerciseId = card.dataset.exercise
    delete card.dataset.cableMachine
    delete card.dataset.cableRecord
    card.querySelector('.cable-mode-note')?.remove()
    card.querySelector('.cable-readout')?.remove()
    const weightHead = card.querySelector('.setrow--head [data-col="weight"]')
    if (weightHead) weightHead.textContent = 'LBS'
    for (const input of card.querySelectorAll('.setrow__num[data-field="weight"]')) {
      delete input.dataset.cablePeg
      delete input.dataset.cableInvalid
      input.inputMode = 'decimal'
      input.setAttribute('aria-label', `LBS, set ${Number(input.dataset.set ?? 0) + 1}`)
    }
    initialisedExercises.delete(exerciseId)
    for (const key of [...pegState.keys()]) {
      if (key.startsWith(`${exerciseId}:`)) pegState.delete(key)
    }
  }

  function enhanceCableCard(card) {
    const exerciseId = card.dataset.exercise
    if (!machine.enabled || card.dataset.method !== 'Cable' || !cableExerciseIds.has(exerciseId)
      || !cablePegEnabledForExercise(exerciseId, machine)) {
      clearCableCard(card)
      return
    }

    card.dataset.cableMachine = machine.id
    const weightHead = card.querySelector('.setrow--head [data-col="weight"]')
    if (weightHead) weightHead.textContent = 'PEG'

    initialisePegInputs(card)

    if (!card.querySelector('.cable-mode-note')) {
      const note = document.createElement('p')
      note.className = 'cable-mode-note'
      note.dataset.cableMode = 'peg'
      const stacks = cableStacksForExercise(exerciseId, machine)
      note.textContent = `${machine.name.toUpperCase()} PEG MODE · ${stacks === 2 ? 'BOTH STACKS' : 'ONE STACK'} · NOMINAL`
      const actions = card.querySelector('.actions')
      actions?.insertAdjacentElement('afterend', note)
    }

    updateReadout(card)
    void decorateRecord(card)
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
    const load = cableLoadForPeg(6, {
      profile: machine,
      stacks: cableStacksForExercise('cable_fly', machine),
    })
    const next = load
      ? `Nominal example: Peg 6 → ${fmt(load.perHandle)} lb / handle · ${fmt(load.total)} lb Cable Fly total. Manufacturer spec: 165 lb per stack, 2:1 per pulley.`
      : 'Adjust the machine values to preview Peg 6.'
    if (example.textContent !== next) example.textContent = next
  }

  function exerciseSettingsList() {
    const list = document.createElement('div')
    list.className = 'cable-exercises'
    for (const exercise of cableExercises) {
      const enabled = cablePegEnabledForExercise(exercise.id, machine)
      const stacks = cableStacksForExercise(exercise.id, machine)
      const row = document.createElement('div')
      row.className = 'cable-exercise'
      row.dataset.cableExercise = exercise.id

      const copy = document.createElement('div')
      copy.className = 'cable-exercise__copy'
      const name = document.createElement('span')
      name.className = 'cable-exercise__name'
      name.textContent = exercise.name
      const meta = document.createElement('span')
      meta.className = 'cable-exercise__meta'
      meta.textContent = enabled ? `${stacks} stack${stacks === 1 ? '' : 's'} · peg entry` : 'normal lb entry'
      copy.append(name, meta)

      const controls = document.createElement('div')
      controls.className = 'cable-exercise__controls'
      const pegButton = document.createElement('button')
      pegButton.type = 'button'
      pegButton.className = 'cable-exercise__button'
      pegButton.dataset.selected = String(enabled)
      pegButton.setAttribute('aria-pressed', String(enabled))
      pegButton.setAttribute('aria-label', `${exercise.name} peg entry`)
      pegButton.textContent = enabled ? 'PEG' : 'LBS'
      pegButton.addEventListener('click', async () => {
        await saveExercise(exercise.id, { enabled: !cablePegEnabledForExercise(exercise.id, machine) })
        const nextEnabled = cablePegEnabledForExercise(exercise.id, machine)
        pegButton.dataset.selected = String(nextEnabled)
        pegButton.setAttribute('aria-pressed', String(nextEnabled))
        pegButton.textContent = nextEnabled ? 'PEG' : 'LBS'
        meta.textContent = nextEnabled
          ? `${cableStacksForExercise(exercise.id, machine)} stack${cableStacksForExercise(exercise.id, machine) === 1 ? '' : 's'} · peg entry`
          : 'normal lb entry'
      })

      const stackButton = document.createElement('button')
      stackButton.type = 'button'
      stackButton.className = 'cable-exercise__button'
      stackButton.dataset.selected = 'false'
      stackButton.setAttribute('aria-label', `${exercise.name} stacks used`)
      stackButton.textContent = `${stacks}×`
      stackButton.addEventListener('click', async () => {
        const current = cableStacksForExercise(exercise.id, machine)
        const next = current >= Math.min(2, machine.stackCount) ? 1 : Math.min(2, machine.stackCount)
        await saveExercise(exercise.id, { stacks: next })
        stackButton.textContent = `${cableStacksForExercise(exercise.id, machine)}×`
        if (cablePegEnabledForExercise(exercise.id, machine)) {
          const actual = cableStacksForExercise(exercise.id, machine)
          meta.textContent = `${actual} stack${actual === 1 ? '' : 's'} · peg entry`
        }
        renderSettingsExample(row.closest('[data-section="cable-machine"]'))
      })

      controls.append(pegButton, stackButton)
      row.append(copy, controls)
      list.append(row)
    }
    return list
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
    hint.textContent = 'Inspire FTX / Centr 2 preset. Peg mode stores nominal effective resistance for progression while keeping the physical selector number in history.'

    const toggleRow = document.createElement('div')
    toggleRow.className = 'cable-settings__toggle'
    const toggleLabel = document.createElement('span')
    toggleLabel.className = 'setting__label'
    toggleLabel.textContent = 'Cable peg entry'
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
      numberSetting('Selector/head assembly (lb)', 'headWeight', machine.headWeight),
      numberSetting('Each numbered plate (lb)', 'plateIncrement', machine.plateIncrement),
      numberSetting('Pulley ratio', 'ratio', machine.ratio),
      addonRow,
    )

    const example = document.createElement('p')
    example.className = 'cable-settings__example'
    section.append(title, hint, grid, example, exerciseSettingsList())
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
    if (sessionRoot) {
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
    if (!exerciseId || card?.dataset.method !== 'Cable' || !cableExerciseIds.has(exerciseId)
      || !cablePegEnabledForExercise(exerciseId, machine)) return
    const peg = validPeg(input.value, machine)
    pegState.set(rowKey(exerciseId, input), peg)
    input.dataset.cableInvalid = String(input.value.trim() !== '' && peg == null)

    // Cable peg entry is an adapter around the session draft, so it must keep
    // the logger's set-1 carry-forward promise too. Do this on input instead of
    // waiting for blur: iOS can move focus after a DOM redraw without emitting
    // the change sequence the core screen normally uses for decimal pounds.
    if (input.dataset.set === '0' && peg != null) {
      for (const other of card.querySelectorAll('.setrow__num[data-field="weight"]')) {
        if (!(other instanceof HTMLInputElement) || other === input || other.readOnly) continue
        const next = String(peg)
        pegState.set(rowKey(exerciseId, other), peg)
        if (other.value === next) continue
        other.value = next
        other.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    updateReadout(card)
  })

  app.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.setrow__check')
    const row = button?.closest?.('.setrow')
    const card = row?.closest?.('[data-exercise]')
    const exerciseId = card?.dataset.exercise
    if (!machine.enabled || !exerciseId || card?.dataset.method !== 'Cable' || !cableExerciseIds.has(exerciseId)
      || !cablePegEnabledForExercise(exerciseId, machine)) return
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
    saveExercise,
    rebuildCableRecord,
    destroy() {
      observer.disconnect()
      workout.logSet = originalLogSet
      workout.finishSession = originalFinishSession
      context[RUNTIME_KEY] = null
    },
  }
  context[RUNTIME_KEY] = runtime
  return runtime
}
