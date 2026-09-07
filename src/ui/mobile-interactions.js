/**
 * Small mobile interaction fixes that should apply no matter which screen owns
 * the control. Keep these delegated so re-rendered inputs inherit the behavior.
 */

let installed = false

function selectExistingNumber(input) {
  if (!(input instanceof HTMLInputElement)) return
  if (input.readOnly || input.disabled || !input.value) return

  // iOS Safari can place the caret after the focus handler runs. Selecting on
  // the next frame makes a tap into an existing numeric field mean
  // "replace this value", not "insert before/after it".
  requestAnimationFrame(() => {
    if (document.activeElement !== input) return
    input.select()
    try { input.setSelectionRange(0, input.value.length) } catch {}
  })
}

function numericInputFrom(target) {
  const input = target?.closest?.('input')
  if (!(input instanceof HTMLInputElement)) return null
  if (input.matches('.setrow__num, .equipment__bar, .today-editor__preset-input')) return input
  return ['decimal', 'numeric'].includes(input.inputMode) ? input : null
}

export function installMobileInteractions() {
  if (installed) return
  installed = true

  document.addEventListener('focusin', (event) => {
    selectExistingNumber(numericInputFrom(event.target))
  })

  // A second pass after the completed tap is intentional. Mobile Safari may
  // move the caret after focusin while processing the touch. Running the same
  // safe selection after click makes the replace behavior deterministic.
  document.addEventListener('click', (event) => {
    selectExistingNumber(numericInputFrom(event.target))
  })
}
