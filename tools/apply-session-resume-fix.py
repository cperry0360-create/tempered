from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file = ROOT / path
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"anchor not unique in {path}: {text.count(old)} matches")
    file.write_text(text.replace(old, new, 1))


def write(path, content):
    file = ROOT / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content)


# Durable, synchronous checkpoint for the ephemeral active-workout UI state.
write('src/ui/session-draft.js', r'''/**
 * Short-lived checkpoint for an active workout.
 *
 * Checked sets remain canonical in IndexedDB. This localStorage record only
 * preserves the screen state that would otherwise disappear if iOS evicts the
 * installed PWA while it is backgrounded between sets.
 */
const KEY = 'tempered.activeWorkout.v1'
const DRAFT_VERSION = 1

function targetStorage(storage) {
  if (storage) return storage
  try { return globalThis.localStorage ?? null } catch { return null }
}

function validDraft(value) {
  return value?.version === DRAFT_VERSION
    && typeof value?.session?.id === 'string'
    && value.session.id.length > 0
    && Array.isArray(value.plan)
}

export function saveActiveSessionDraft(draft, storage = null) {
  const target = targetStorage(storage)
  if (!target || !validDraft(draft)) return false
  try {
    target.setItem(KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function loadActiveSessionDraft(storage = null) {
  const target = targetStorage(storage)
  if (!target) return null
  try {
    const raw = target.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (validDraft(parsed)) return parsed
    target.removeItem(KEY)
    return null
  } catch {
    try { target.removeItem(KEY) } catch {}
    return null
  }
}

export function clearActiveSessionDraft(storage = null) {
  const target = targetStorage(storage)
  if (!target) return false
  try {
    target.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

export const ACTIVE_SESSION_DRAFT_KEY = KEY
''')

write('src/ui/session-draft.test.js', r'''import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTIVE_SESSION_DRAFT_KEY,
  clearActiveSessionDraft,
  loadActiveSessionDraft,
  saveActiveSessionDraft,
} from './session-draft.js'

function fakeStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

const draft = {
  version: 1,
  session: { id: 's_active', title: 'Upper A', returnTab: 'train' },
  plan: [{ exercise: { id: 'incline_bench_db' }, sets: [{ weight: 135, reps: 8, logged: true }] }],
  loggedHereIds: ['sl_1'],
  isFirstOfDay: true,
  rest: { exerciseId: 'incline_bench_db', endsAt: 123456 },
  openPanel: null,
}

test('active workout draft round-trips exactly', () => {
  const storage = fakeStorage()
  assert.equal(saveActiveSessionDraft(draft, storage), true)
  assert.deepEqual(loadActiveSessionDraft(storage), draft)
})

test('invalid or corrupt drafts are ignored and removed', () => {
  const storage = fakeStorage()
  storage.setItem(ACTIVE_SESSION_DRAFT_KEY, '{not json')
  assert.equal(loadActiveSessionDraft(storage), null)
  assert.equal(storage.getItem(ACTIVE_SESSION_DRAFT_KEY), null)
  storage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify({ version: 1, plan: [] }))
  assert.equal(loadActiveSessionDraft(storage), null)
  assert.equal(storage.getItem(ACTIVE_SESSION_DRAFT_KEY), null)
})

test('clear removes a resumable workout', () => {
  const storage = fakeStorage()
  saveActiveSessionDraft(draft, storage)
  assert.equal(clearActiveSessionDraft(storage), true)
  assert.equal(loadActiveSessionDraft(storage), null)
})

test('unavailable storage never makes workout logging throw', () => {
  const broken = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
    removeItem() { throw new Error('blocked') },
  }
  assert.equal(saveActiveSessionDraft(draft, broken), false)
  assert.equal(loadActiveSessionDraft(broken), null)
  assert.equal(clearActiveSessionDraft(broken), false)
})
''')

# Session screen: import/checkpoint lifecycle.
replace_once('src/ui/screens/session.js',
"import { solvePlates } from '../../domain/plates.js'\n",
"import { solvePlates } from '../../domain/plates.js'\nimport { clearActiveSessionDraft, saveActiveSessionDraft } from '../session-draft.js'\n")

replace_once('src/ui/screens/session.js',
"  let confirmingFinish = false\n  let ticker\n\n  const panelKey",
"""  let confirmingFinish = false
  let ticker

  function persistDraft() {
    if (!session) return
    saveActiveSessionDraft({
      version: 1,
      session: { ...session },
      plan,
      loggedHereIds: loggedHere.map((log) => log.id),
      isFirstOfDay,
      rest,
      openPanel,
    })
  }

  function checkpointWhenHidden() {
    if (document.visibilityState === 'hidden') persistDraft()
  }
  function checkpointOnPageHide() { persistDraft() }
  document.addEventListener('visibilitychange', checkpointWhenHidden)
  window.addEventListener('pagehide', checkpointOnPageHide)

  const panelKey""")

replace_once('src/ui/screens/session.js',
"    openPanel = isOpen(entry, name) ? null : panelKey(entry, name)\n    render()",
"    openPanel = isOpen(entry, name) ? null : panelKey(entry, name)\n    persistDraft()\n    render()")

replace_once('src/ui/screens/session.js',
"    rest = { exerciseId: entry.exercise.id, endsAt: timeSource.now() + entry.restSec * 1000 }\n    tick()",
"    rest = { exerciseId: entry.exercise.id, endsAt: timeSource.now() + entry.restSec * 1000 }\n    persistDraft()\n    tick()")

replace_once('src/ui/screens/session.js',
"    if (remaining <= 0) rest = null\n",
"    if (remaining <= 0) { rest = null; persistDraft() }\n")

replace_once('src/ui/screens/session.js',
"        oninput: (event) => { set[field.key] = numberOrNull(event.target.value) },",
"        oninput: (event) => { set[field.key] = numberOrNull(event.target.value); persistDraft() },")

replace_once('src/ui/screens/session.js',
"          if (index === 0) cascade(entry, field.key, set[field.key])\n          render()",
"          if (index === 0) cascade(entry, field.key, set[field.key])\n          persistDraft()\n          render()")

replace_once('src/ui/screens/session.js',
"          if (set.logId) await workout.removeSet(set.logId)\n          entry.sets.splice(index, 1)\n          render()",
"""          if (set.logId) {
            await workout.removeSet(set.logId)
            loggedHere = loggedHere.filter((log) => log.id !== set.logId)
          }
          entry.sets.splice(index, 1)
          persistDraft()
          render()""")

replace_once('src/ui/screens/session.js',
"            onchange: (event) => { entry.barWeight = numberOrNull(event.target.value) ?? 45; render() },",
"            onchange: (event) => { entry.barWeight = numberOrNull(event.target.value) ?? 45; persistDraft(); render() },")

replace_once('src/ui/screens/session.js',
"              render()\n            },\n          }, [String(plate)])),",
"              persistDraft()\n              render()\n            },\n          }, [String(plate)])),")

replace_once('src/ui/screens/session.js',
"            openPanel = null\n            render()",
"            openPanel = null\n            persistDraft()\n            render()")

replace_once('src/ui/screens/session.js',
"        onclick: () => { entry.editing = entry.editing !== true; render() },",
"        onclick: () => { entry.editing = entry.editing !== true; persistDraft(); render() },")

replace_once('src/ui/screens/session.js',
"          onclick: () => { entry.restSec = seconds; openPanel = null; render() },",
"          onclick: () => { entry.restSec = seconds; openPanel = null; persistDraft(); render() },")

replace_once('src/ui/screens/session.js',
"    plan.splice(target, 0, moved)\n    render()",
"    plan.splice(target, 0, moved)\n    persistDraft()\n    render()")

replace_once('src/ui/screens/session.js',
"          entry.sets.push({ weight: previous?.weight ?? null, reps: previous?.reps ?? null, logged: false })\n          render()",
"          entry.sets.push({ weight: previous?.weight ?? null, reps: previous?.reps ?? null, logged: false })\n          persistDraft()\n          render()")

replace_once('src/ui/screens/session.js',
"    // `null` means nothing was logged. There is nothing to summarise, so the\n    // screen closes without one rather than reporting an empty session back.\n    onFinish(summary)",
"    // Clear only after settlement succeeds. If finishing throws, the checkpoint\n    // remains so an iOS process eviction cannot turn a recoverable workout into\n    // lost UI state.\n    clearActiveSessionDraft()\n    // `null` means nothing was logged. There is nothing to summarise, so the\n    // screen closes without one rather than reporting an empty session back.\n    onFinish(summary)")

replace_once('src/ui/screens/session.js',
"    async start({ routine = null, programDay = null, exerciseId = null, slotTask = null }) {",
"    async start({ routine = null, programDay = null, exerciseId = null, slotTask = null, returnTab = 'today' }) {")

# Persist session metadata and plan before both render paths.
replace_once('src/ui/screens/session.js',
"        render()\n        return\n      }\n\n      if (programDay)",
"        session.returnTab = returnTab\n        persistDraft()\n        render()\n        return\n      }\n\n      if (programDay)")

replace_once('src/ui/screens/session.js',
"      }\n      render()\n    },\n\n    destroy() { clearInterval(ticker); ticker = undefined },",
"""      }
      session.returnTab = returnTab
      persistDraft()
      render()
    },

    async resume(draft) {
      library = [...(await workout.exerciseMap()).values()].sort((a, b) => a.name.localeCompare(b.name))
      session = { ...draft.session }
      plan = Array.isArray(draft.plan) ? draft.plan : []
      isFirstOfDay = draft.isFirstOfDay !== false
      openPanel = draft.openPanel ?? null
      confirmingFinish = false
      rest = draft.rest && Number(draft.rest.endsAt) > timeSource.now() ? { ...draft.rest } : null

      const logs = await workout.setsFor(session.id)
      const liveLogIds = new Set(logs.map((log) => log.id))
      const loggedHereIds = new Set(draft.loggedHereIds ?? [])
      loggedHere = logs.filter((log) => loggedHereIds.has(log.id))

      // IndexedDB is canonical for checked sets. Reconcile the checkpoint in
      // case the app was killed after the set write but before its next paint.
      for (const entry of plan) {
        for (const [index, set] of entry.sets.entries()) {
          const stored = logs.find((log) => log.exerciseId === entry.exercise.id
            && (entry.programDayId == null || log.programDayId === entry.programDayId)
            && (entry.slotIndex == null || log.slotIndex === entry.slotIndex)
            && (log.setIndex ?? 0) === index)
          if (stored) {
            set.logged = true
            set.logId = stored.id
            for (const key of ['weight', 'reps', 'timeSec', 'distance', 'perSide']) {
              if (stored[key] !== undefined) set[key] = stored[key]
            }
          } else if (set.logId && !liveLogIds.has(set.logId)) {
            set.logged = false
            set.logId = null
          }
        }
      }

      persistDraft()
      render()
    },

    destroy() {
      clearInterval(ticker)
      ticker = undefined
      document.removeEventListener('visibilitychange', checkpointWhenHidden)
      window.removeEventListener('pagehide', checkpointOnPageHide)
    },""")

# App shell can construct the same session screen for a fresh start or a resume.
replace_once('src/ui/app.js',
"import { createBattleScreen } from './screens/battle.js'\n",
"import { createBattleScreen } from './screens/battle.js'\nimport { clearActiveSessionDraft } from './session-draft.js'\n")

start_old = r'''  async function startSession(options) {
    returnTab = active === 'settings' ? 'character' : active
    session?.destroy()
    session = createSessionScreen({
      workout, clock,
      onFinish: async (result) => {
        session?.destroy()
        session = null
        if (!result) { await show(returnTab); return }
        summary.show(result)
        replace(body, [summary.root])
        tabBar.hidden = true
        settingsAccess.hidden = true
        body.scrollTop = 0
        announce('Workout summary')
      },
    })

    body.setAttribute('aria-busy', 'true')
    try {
      await session.start(options)
      replace(body, [session.root])
      tabBar.hidden = true
      settingsAccess.hidden = true
      body.scrollTop = 0
      announce('Workout session')
    } catch (error) {
      console.error('[tempered] session failed to start', error)
      session?.destroy()
      session = null
      showFailure({
        title: 'Workout could not open',
        detail: 'Nothing was logged or removed. Try again, or return to where you were.',
        retry: () => startSession(options),
        back: () => show(returnTab),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }
'''
start_new = r'''  function makeSessionScreen() {
    return createSessionScreen({
      workout, clock,
      onFinish: async (result) => {
        session?.destroy()
        session = null
        if (!result) { await show(returnTab); return }
        summary.show(result)
        replace(body, [summary.root])
        tabBar.hidden = true
        settingsAccess.hidden = true
        body.scrollTop = 0
        announce('Workout summary')
      },
    })
  }

  async function startSession(options) {
    returnTab = active === 'settings' ? 'character' : active
    session?.destroy()
    session = makeSessionScreen()

    body.setAttribute('aria-busy', 'true')
    try {
      await session.start({ ...(options ?? {}), returnTab })
      replace(body, [session.root])
      tabBar.hidden = true
      settingsAccess.hidden = true
      body.scrollTop = 0
      announce('Workout session')
    } catch (error) {
      console.error('[tempered] session failed to start', error)
      session?.destroy()
      session = null
      showFailure({
        title: 'Workout could not open',
        detail: 'Nothing was logged or removed. Try again, or return to where you were.',
        retry: () => startSession(options),
        back: () => show(returnTab),
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }

  async function resumeSession(draft) {
    returnTab = ['today', 'train', 'character', 'history'].includes(draft?.session?.returnTab)
      ? draft.session.returnTab
      : 'today'
    session?.destroy()
    session = makeSessionScreen()

    body.setAttribute('aria-busy', 'true')
    try {
      await session.resume(draft)
      replace(body, [session.root])
      tabBar.hidden = true
      settingsAccess.hidden = true
      body.scrollTop = 0
      announce('Workout session resumed')
    } catch (error) {
      console.error('[tempered] workout resume failed', error)
      session?.destroy()
      session = null
      showFailure({
        title: 'Workout could not resume',
        detail: 'Your checked sets are still saved. Retry, or discard the screen checkpoint and return to Today.',
        retry: () => resumeSession(draft),
        back: () => { clearActiveSessionDraft(); show('today') },
      })
    } finally {
      body.setAttribute('aria-busy', 'false')
    }
  }
'''
replace_once('src/ui/app.js', start_old, start_new)
replace_once('src/ui/app.js',
"  return { show, startSession }\n",
"  return { show, startSession, resumeSession }\n")

# Startup resumes an active workout before routing to Today.
replace_once('src/app/bootstrap.js',
"import { createSetupScreen } from '../ui/screens/setup.js'\n",
"import { createSetupScreen } from '../ui/screens/setup.js'\nimport { loadActiveSessionDraft } from '../ui/session-draft.js'\n")
replace_once('src/app/bootstrap.js',
"    // Today is the product's landing screen. Phase 7 ends here, populated and usable.\n    await app.show('today')",
"    const activeWorkout = loadActiveSessionDraft()\n    if (activeWorkout) await app.resumeSession(activeWorkout)\n    else {\n      // Today is the product's landing screen when no workout is in progress.\n      await app.show('today')\n    }")

# PWA cache and visible version.
replace_once('sw.js',
"  './src/ui/session-guard.js',\n",
"  './src/ui/session-guard.js',\n  './src/ui/session-draft.js',\n")
replace_once('src/version.js',
"export const VERSION = '0.11.7 (8)'",
"export const VERSION = '0.11.8 (8)'")

# Product contract.
replace_once('docs/05-workout-system.md',
"- Rest timer counts down inline on the exercise, not as a modal.\n",
"- Rest timer counts down inline on the exercise, not as a modal.\n- An active workout is continuously checkpointed. Locking the phone, backgrounding the installed app, or an iOS process restart must reopen the same workout with checked sets and in-progress fields intact instead of routing to Today.\n")

# Browser acceptance harness reconstructs the entire app, which mirrors an iOS
# process eviction much more closely than merely hiding the same DOM.
write('test/browser/session-resume.html', r'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Tempered — active workout resume harness</title>
    <style>
      body { font: 14px system-ui; background: #0a0c10; color: #e6eaf2; padding: 20px; }
      .check[data-ok="true"]::before { content: "PASS  "; color: #4fc9a0; }
      .check[data-ok="false"]::before { content: "FAIL  "; color: #e05a6a; }
    </style>
  </head>
  <body>
    <h1>active workout resume</h1>
    <div id="fixture"></div>
    <div id="results"></div>
    <script type="module">
      import { bootstrap } from '../../src/app/bootstrap.js'
      import { createMemoryStorage } from '../../src/adapters/storage/memory-storage.js'
      import { fixedClock } from '../../src/adapters/clock/clock.js'
      import { clearActiveSessionDraft, loadActiveSessionDraft } from '../../src/ui/session-draft.js'

      const mount = document.getElementById('fixture')
      const results = document.getElementById('results')
      const checks = []
      function check(name, ok, detail = '') {
        checks.push({ name, ok: Boolean(ok), detail })
        const row = document.createElement('div')
        row.className = 'check'
        row.dataset.ok = String(Boolean(ok))
        row.textContent = `${name}${detail ? ` — ${detail}` : ''}`
        results.append(row)
      }
      const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

      try {
        clearActiveSessionDraft()
        const storage = createMemoryStorage()
        await storage.open()
        await storage.put('profile', {
          id: 'profile', name: 'Cory', units: 'imperial', setupComplete: true,
          planTargetSessionsPerWeek: 4,
        })
        const clock = fixedClock('2026-09-05T18:00:00')

        const first = await bootstrap({ mount, storage, clock })
        await first.app.startSession({ exerciseId: 'incline_bench_db' })
        const weight1 = mount.querySelector('[data-exercise="incline_bench_db"][data-set="0"][data-field="weight"]')
        const reps1 = mount.querySelector('[data-exercise="incline_bench_db"][data-set="0"][data-field="reps"]')
        weight1.value = '135'
        weight1.dispatchEvent(new Event('input', { bubbles: true }))
        reps1.value = '8'
        reps1.dispatchEvent(new Event('input', { bubbles: true }))
        mount.querySelector('[data-log="incline_bench_db:0"]').click()
        await settle()

        const weight2 = mount.querySelector('[data-exercise="incline_bench_db"][data-set="1"][data-field="weight"]')
        weight2.value = '140'
        weight2.dispatchEvent(new Event('input', { bubbles: true }))
        check('a live checkpoint exists before the restart', Boolean(loadActiveSessionDraft()))

        // New shell + services, same durable stores. This is the important part:
        // no call back into the first app instance is used to restore the UI.
        const second = await bootstrap({ mount, storage, clock })
        await settle()
        check('relaunch opens the workout instead of Today', Boolean(mount.querySelector('.screen--session')))
        check('navigation remains hidden in the resumed immersive workout', mount.querySelector('.tabbar')?.hidden === true)
        check('checked-set count survives relaunch', mount.querySelector('.sessionbar__meta')?.textContent.includes('1 sets logged') === true,
          mount.querySelector('.sessionbar__meta')?.textContent ?? '')
        check('the checked set remains checked and locked', mount.querySelector('[data-log="incline_bench_db:0"]')?.disabled === true)
        check('an unsubmitted next-set edit also survives', mount.querySelector('[data-exercise="incline_bench_db"][data-set="1"][data-field="weight"]')?.value === '140',
          mount.querySelector('[data-exercise="incline_bench_db"][data-set="1"][data-field="weight"]')?.value ?? 'missing')
        check('the canonical set log is still present', (await second.workout.setsFor(loadActiveSessionDraft().session.id)).length === 1)

        clearActiveSessionDraft()
        const passed = checks.every((entry) => entry.ok)
        await fetch('/__report', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label: 'session-resume', passed, checks }),
        })
      } catch (error) {
        check('harness threw', false, String(error?.stack ?? error))
        clearActiveSessionDraft()
        await fetch('/__report', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label: 'session-resume', passed: false, checks }),
        })
      }
    </script>
  </body>
</html>
''')

print('session resume patch applied')
