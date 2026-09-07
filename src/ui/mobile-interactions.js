/**
 * Small mobile interaction fixes that should apply no matter which screen owns
 * the control. Keep these delegated so re-rendered inputs inherit the behavior.
 */

let installed = false

function selectExistingNumber(input) {
  if (!(input instanceof HTMLInputElement)) return
  if (input.readOnly || input.disabled || !input.value) return

  // iOS Safari can place the caret after the focus handler runs. Selecting on
  // the next frame makes a tap into an existing weight/reps field mean
  // "replace this value", not "insert before/after it".
  requestAnimationFrame(() => {
    if (document.activeElement !== input) return
    input.select()
    try { input.setSelectionRange(0, input.value.length) } catch {}
  })
}

export function installMobileInteractions() {
  if (installed) return
  installed = true

  document.addEventListener('focusin', (event) => {
    const input = event.target?.closest?.('.setrow__num')
    selectExistingNumber(input)
  })
}
