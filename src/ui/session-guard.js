/**
 * Session safety around the hand-written workout screen.
 *
 * Three rules live here because they are UI/session-lifecycle rules, not scoring:
 *  - a blank set is not work and can never reach storage
 *  - cancel means discard this attempt and award nothing
 *  - finishing with zero newly logged sets is just an exit, never a scored session
 */

/**
 * A working set must contain actual work. Weight alone is not work: a bar can be
 * loaded without a rep happening. Bodyweight work is valid because reps alone
 * are enough; timed work and carries use their own positive measure.
 *
 * @param {Record<string, unknown>} values
 */
export function hasMeaningfulSetValues(values = {}) {
  const positive = (key) => {
    const number = Number.parseFloat(String(values[key] ?? '').trim())
    return Number.isFinite(number) && number > 0
  }
  return positive('reps') || positive('timeSec') || positive('distance')
}

/**
 * Discard only the set logs created by the screen being cancelled. A Today slot
 * can share a day-session with work completed earlier, so those older logs must
 * survive. If nothing remains on the session, the empty session record goes too.
 *
 * @param {object} options
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} options.storage
 * @param {any} options.session
 * @param {string[]} options.logIds
 */
export async function discardSessionWork({ storage, session, logIds = [] }) {
  const ids = [...new Set(logIds.filter(Boolean))]
  for (const id of ids) await storage.delete('setLogs', id)

  if (!session?.id) return { discardedSets: ids.length, deletedSession: false }
  const remaining = await storage.getAllByIndex('setLogs', 'sessionId', session.id)
  if (remaining.length === 0) {
    await storage.delete('sessions', session.id)
    return { discardedSets: ids.length, deletedSession: true }
  }
  return { discardedSets: ids.length, deletedSession: false }
}

/** @param {Event} event */
function elementTarget(event) {
  return event.target instanceof Element ? event.target : null
}

/** Read the numeric work fields in one set row. */
function valuesFromRow(row) {
  const values = {}
  for (const input of row?.querySelectorAll?.('[data-field]') ?? []) {
    values[input.dataset.field] = input.value
  }
  return values
}

/** A quiet inline correction instead of an alert dialog. */
function showBlankSetNotice(row) {
  row?.parentElement?.querySelector?.('[data-session-guard-notice]')?.remove()
  const note = document.createElement('p')
  note.className = 'block__hint'
  note.dataset.sessionGuardNotice = ''
  note.textContent = 'Enter reps, time, or distance before logging the set.'
  row?.insertAdjacentElement?.('afterend', note)
  setTimeout(() => note.remove(), 2600)
}

/** The tab the person was on before the session took over the shell. */
function returnTab() {
  return document.querySelector('.tabbar__tab[aria-current="page"]')?.dataset.tab ?? 'today'
}

/**
 * Tempered-owned confirmation UI. Native browser confirms look like a different
 * app, especially in an installed PWA, so cancellation stays inside the visual
 * and accessibility system used everywhere else.
 */
export function confirmDiscardExercise(count) {
  if (typeof document === 'undefined') return Promise.resolve(false)

  return new Promise((resolve) => {
    const previousFocus = document.activeElement
    const overlay = document.createElement('div')
    overlay.className = 'confirm-overlay'
    overlay.dataset.confirm = 'discard-exercise'

    const sheet = document.createElement('section')
    sheet.className = 'confirm-sheet'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-labelledby', 'discard-exercise-title')
    sheet.setAttribute('aria-describedby', 'discard-exercise-copy')

    const eyebrow = document.createElement('p')
    eyebrow.className = 'confirm-sheet__eyebrow'
    eyebrow.textContent = 'WORKOUT'

    const title = document.createElement('h2')
    title.id = 'discard-exercise-title'
    title.className = 'confirm-sheet__title'
    title.textContent = 'DISCARD EXERCISE?'

    const copy = document.createElement('p')
    copy.id = 'discard-exercise-copy'
    copy.className = 'confirm-sheet__copy'
    copy.textContent = count > 0
      ? `${count} logged set${count === 1 ? '' : 's'} from this exercise will be discarded. No XP will be awarded for them.`
      : 'Nothing has been logged yet. Leaving will discard this exercise and award no XP.'

    const actions = document.createElement('div')
    actions.className = 'confirm-sheet__actions'

    const keep = document.createElement('button')
    keep.type = 'button'
    keep.className = 'button confirm-sheet__keep'
    keep.dataset.confirmAction = 'keep'
    keep.textContent = 'KEEP WORKING'

    const discard = document.createElement('button')
    discard.type = 'button'
    discard.className = 'button confirm-sheet__discard'
    discard.dataset.confirmAction = 'discard'
    discard.textContent = count > 0 ? 'DISCARD SETS' : 'DISCARD'

    actions.append(keep, discard)
    sheet.append(eyebrow, title, copy, actions)
    overlay.append(sheet)
    document.body.append(overlay)

    let settled = false
    const close = (answer) => {
      if (settled) return
      settled = true
      document.removeEventListener('keydown', onKeyDown)
      overlay.remove()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
      resolve(answer)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(false)
      }
      if (event.key === 'Tab') {
        const focusables = [keep, discard]
        const current = focusables.indexOf(document.activeElement)
        if (event.shiftKey && current <= 0) {
          event.preventDefault()
          discard.focus()
        } else if (!event.shiftKey && current === focusables.length - 1) {
          event.preventDefault()
          keep.focus()
        }
      }
    }

    keep.addEventListener('click', () => close(false))
    discard.addEventListener('click', () => close(true))
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false)
    })
    document.addEventListener('keydown', onKeyDown)
    requestAnimationFrame(() => keep.focus())
  })
}

/**
 * Installs the guard after bootstrap. The screen keeps its existing implementation;
 * we wrap the workout service only to know which session/logs belong to this visit.
 *
 * @param {object} context bootstrap() result
 */
export function installSessionGuard({ app, workout, storage }) {
  if (!app || !workout || !storage || typeof document === 'undefined') return null

  let currentSession = null
  const currentLogIds = new Set()

  const originalStartSession = workout.startSession.bind(workout)
  workout.startSession = async (...args) => {
    const session = await originalStartSession(...args)
    currentSession = session
    currentLogIds.clear()
    return session
  }

  const originalOpenDaySession = workout.openDaySession.bind(workout)
  workout.openDaySession = async (...args) => {
    const opened = await originalOpenDaySession(...args)
    currentSession = opened.session
    currentLogIds.clear()
    return opened
  }

  const originalLogSet = workout.logSet.bind(workout)
  workout.logSet = async (...args) => {
    const log = await originalLogSet(...args)
    if (currentSession?.id && log?.sessionId === currentSession.id) currentLogIds.add(log.id)
    return log
  }

  const originalRemoveSet = workout.removeSet?.bind(workout)
  if (originalRemoveSet) {
    workout.removeSet = async (logId) => {
      currentLogIds.delete(logId)
      return originalRemoveSet(logId)
    }
  }

  const originalFinishSession = workout.finishSession.bind(workout)
  workout.finishSession = async (...args) => {
    const result = await originalFinishSession(...args)
    currentSession = null
    currentLogIds.clear()
    return result
  }

  async function discardAndExit({ confirm = true } = {}) {
    const count = currentLogIds.size
    if (confirm && !(await confirmDiscardExercise(count))) return

    await discardSessionWork({
      storage,
      session: currentSession,
      logIds: [...currentLogIds],
    })
    currentSession = null
    currentLogIds.clear()
    await app.show(returnTab())
  }

  function ensureCancelButton() {
    const bar = document.querySelector('.screen--session .sessionbar')
    if (!bar || bar.querySelector('[data-action="cancel-session"]')) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'actionpill'
    button.dataset.action = 'cancel-session'
    button.textContent = 'CANCEL'
    button.setAttribute('aria-label', 'Cancel exercise without awarding XP')
    button.addEventListener('click', () => discardAndExit({ confirm: true }))
    bar.append(button)
  }

  const observer = new MutationObserver(ensureCancelButton)
  observer.observe(document.getElementById('app') ?? document.body, { childList: true, subtree: true })
  ensureCancelButton()

  /**
   * Capture before the session screen's own click handler. That guarantees a
   * blank checkmark never calls workout.logSet in the first place.
   */
  const onClick = async (event) => {
    const target = elementTarget(event)
    if (!target) return

    const logButton = target.closest('[data-log]')
    if (logButton && !logButton.disabled) {
      const row = logButton.closest('.setrow')
      if (!hasMeaningfulSetValues(valuesFromRow(row))) {
        event.preventDefault()
        event.stopImmediatePropagation()
        showBlankSetNotice(row)
        return
      }
    }

    // "Finish" with literally no work is an exit, not a training event. Do not
    // even enter the scoring path; discard the empty session and return quietly.
    const finish = target.closest('[data-action="confirm-finish"]')
    if (finish && currentLogIds.size === 0) {
      event.preventDefault()
      event.stopImmediatePropagation()
      await discardAndExit({ confirm: false })
    }
  }
  document.addEventListener('click', onClick, true)

  return {
    destroy() {
      observer.disconnect()
      document.removeEventListener('click', onClick, true)
    },
  }
}
