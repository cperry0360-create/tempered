/**
 * Small mobile interaction fixes that should apply no matter which screen owns
 * the control. Keep these delegated so re-rendered inputs inherit the behavior.
 */

let installed = false

function attemptPortraitLock() {
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches
    || navigator.standalone === true
  if (!standalone || typeof screen?.orientation?.lock !== 'function') return
  try {
    const request = screen.orientation.lock('portrait')
    request?.catch?.(() => {})
  } catch { /* The CSS rotation guard remains the iPhone fallback. */ }
}

function selectExistingNumber(input) {
  if (!(input instanceof HTMLInputElement)) return
  if (input.readOnly || input.disabled || !input.value) return

  // iOS Safari can place the caret after the focus handler runs. Select once on
  // the next frame and once again shortly after so tapping an existing weight or
  // rep reliably means "replace this value", not "insert beside it".
  const selectAll = () => {
    if (document.activeElement !== input) return
    input.select()
    try { input.setSelectionRange(0, input.value.length) } catch {}
  }
  requestAnimationFrame(selectAll)
  setTimeout(selectAll, 35)
}

function inputFor(card, setIndex, field) {
  return card?.querySelector?.(`.setrow__num[data-set="${setIndex}"][data-field="${field}"]`) ?? null
}

/**
 * If a working set changes, carry that set's current prescription into every
 * later UNLOGGED set. This makes an adjustment on set 2 behave the same way a
 * lifter expects an adjustment on set 1 to behave: the new load/reps become the
 * plan for the sets that have not happened yet.
 *
 * Logged rows are read-only and are deliberately never rewritten.
 */
function cascadeWorkingSetForward(source) {
  if (!(source instanceof HTMLInputElement)) return
  if (source.readOnly || source.disabled) return

  const exerciseId = source.dataset.exercise
  const startIndex = Number.parseInt(source.dataset.set ?? '', 10)
  const changedField = source.dataset.field
  if (!exerciseId || !Number.isInteger(startIndex) || !changedField) return

  // session.js re-renders on change, so resolve the CURRENT card on the next
  // frame rather than holding onto the input node that generated the event.
  requestAnimationFrame(() => {
    const card = [...document.querySelectorAll('[data-exercise]')]
      .find((node) => node.dataset.exercise === exerciseId)
    if (!card) return

    const pairFields = ['weight', 'reps']
    const fields = pairFields.includes(changedField)
      ? pairFields.filter((field) => inputFor(card, startIndex, field))
      : [changedField]

    const values = Object.fromEntries(fields.map((field) => {
      const input = inputFor(card, startIndex, field)
      return [field, input?.value?.trim?.() ?? '']
    }))

    for (let index = startIndex + 1; ; index += 1) {
      const rowProbe = card.querySelector(`.setrow__num[data-set="${index}"]`)
      if (!rowProbe) break

      for (const field of fields) {
        const target = inputFor(card, index, field)
        const value = values[field]
        if (!target || target.readOnly || value === '') continue
        if (target.value === value) continue
        target.value = value
        // The session owns canonical state. Its delegated input handler updates
        // that state and the active-session checkpoint without creating another
        // cascade/render cycle.
        target.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
  })
}

export function installMobileInteractions() {
  if (installed) return
  installed = true

  document.addEventListener('focusin', (event) => {
    const input = event.target?.closest?.('.setrow__num')
    selectExistingNumber(input)
  })

  document.addEventListener('change', (event) => {
    const input = event.target?.closest?.('.setrow__num[data-field][data-set][data-exercise]')
    cascadeWorkingSetForward(input)
  })

  attemptPortraitLock()
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') attemptPortraitLock()
  })
  document.addEventListener('pointerdown', attemptPortraitLock, { once: true, passive: true })
}
