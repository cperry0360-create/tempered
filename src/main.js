import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'

const WATER_FIXED_PRESETS = [8, 12]

/**
 * Water keeps two everyday drink sizes plus a third user-owned preset.
 * The third amount comes from the same saved quick-add setting used by Today,
 * so changing it here persists across launches without changing Water's
 * additive logging semantics.
 */
function installWaterQuickPresets() {
  const app = document.getElementById('app')
  if (!app) return

  function enhance() {
    // Water intentionally uses its three-choice strip instead of the generic
    // single row-level quick-add button used by other additive trackers.
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
      const customAmount = Number(presetInput?.value)
      if (!manual || !manualInput || !addButton || !presetInput || !Number.isFinite(customAmount) || customAmount <= 0) continue

      const quick = document.createElement('div')
      quick.className = 'today-editor__quick'
      quick.dataset.waterPresets = 'true'

      const amounts = [...WATER_FIXED_PRESETS, customAmount]
      for (const [index, amount] of amounts.entries()) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'today-editor__chip'
        button.dataset.quickadd = String(amount)
        if (index === 2) button.dataset.adjustable = 'true'
        button.setAttribute('aria-label', index === 2
          ? `Add custom ${amount} ${unit} preset to Water`
          : `Add ${amount} ${unit} to Water`)
        button.textContent = `+${amount} ${unit}`
        if (index === 2) button.title = 'Custom Water preset — editable below'
        button.addEventListener('click', () => {
          if (addButton.disabled) return
          manualInput.value = String(amount)
          addButton.click()
        })
        quick.append(button)
      }

      editor.insertBefore(quick, manual)

      const label = editor.querySelector('.today-editor__preset-label')
      if (label) label.textContent = 'Custom quick add'
      const hint = editor.querySelector('.today-editor__hint')
      if (hint) hint.textContent = 'Water always includes +8 oz and +12 oz. Change this to set the third quick-add button.'
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
