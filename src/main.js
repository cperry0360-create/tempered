import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'

const WATER_FIXED_PRESETS = [8, 12]

/**
 * Keep the original Water quick-entry interaction: three fast choices plus the
 * manual custom amount. The third quick choice is the user-owned bottle preset
 * already persisted by the daily service.
 *
 * This is deliberately a presentation enhancer around the existing Today
 * screen so it does not change additive logging semantics or storage.
 */
function installWaterQuickPresets() {
  const app = document.getElementById('app')
  if (!app) return

  function enhance() {
    // The single row-level quick button was the accidental replacement for the
    // old triple-preset layout. Hide it for Water; the row opens the familiar
    // quick choices instead.
    for (const wrap of app.querySelectorAll('.today-item-wrap[data-activity="water"]')) {
      wrap.querySelector('.today-item__quick')?.setAttribute('hidden', '')
    }

    for (const editor of app.querySelectorAll('.today-editor[data-editor="water"]')) {
      if (editor.querySelector('[data-water-presets="true"]')) continue

      const manual = editor.querySelector('.today-editor__manual')
      const manualInput = editor.querySelector('.today-editor__input')
      const addButton = editor.querySelector('.today-editor__save')
      const presetInput = editor.querySelector('.today-editor__preset-input')
      const unit = editor.querySelector('.today-editor__preset-unit')?.textContent?.trim() || 'oz'
      const bottleAmount = Number(presetInput?.value)
      if (!manual || !manualInput || !addButton || !presetInput || !Number.isFinite(bottleAmount) || bottleAmount <= 0) continue

      const quick = document.createElement('div')
      quick.className = 'today-editor__quick'
      quick.dataset.waterPresets = 'true'

      const amounts = [...WATER_FIXED_PRESETS, bottleAmount]
      for (const [index, amount] of amounts.entries()) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'today-editor__chip'
        button.dataset.quickadd = String(amount)
        if (index === 2) button.dataset.adjustable = 'true'
        button.setAttribute('aria-label', index === 2
          ? `Add ${amount} ${unit} bottle preset to Water`
          : `Add ${amount} ${unit} to Water`)
        button.textContent = `+${amount} ${unit}`
        if (index === 2) button.title = 'Bottle preset — editable below'
        button.addEventListener('click', () => {
          if (addButton.disabled) return
          manualInput.value = String(amount)
          addButton.click()
        })
        quick.append(button)
      }

      editor.insertBefore(quick, manual)

      const label = editor.querySelector('.today-editor__preset-label')
      if (label) label.textContent = 'Bottle preset'
      const hint = editor.querySelector('.today-editor__hint')
      if (hint) hint.textContent = 'Change this to make the third quick button match your bottle.'
    }
  }

  enhance()
  new MutationObserver(enhance).observe(app, { childList: true, subtree: true })
}

registerServiceWorker()
installWaterQuickPresets()

bootstrap()
  .then((context) => { installSessionGuard(context) })
  .catch((error) => {
    console.error('[tempered] failed to start', error)
    const app = document.getElementById('app')
    if (!app) return

    app.className = 'shell'
    app.replaceChildren(errorState({
      title: 'Tempered could not start',
      detail: 'Your saved data has not been changed. Reload the app and try again.',
      onRetry: () => window.location.reload(),
    }))
  })
