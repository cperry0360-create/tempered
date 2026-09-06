import { registerServiceWorker } from './pwa/register.js'
import { bootstrap } from './app/bootstrap.js'
import { installSessionGuard } from './ui/session-guard.js'
import { errorState } from './ui/states.js'

const WATER_FIXED_PRESETS = [8, 12]

/**
 * Water is the one additive tracker where three one-tap choices are useful in
 * the collapsed row: 8 oz, 12 oz, and the user's saved custom amount.
 *
 * Today already owns the custom quick-add button and its saved value. This
 * enhancement moves that real button into a compact three-button group, so its
 * existing click handler remains intact. The two fixed buttons submit through
 * Today's own Water editor, then close it again, preserving one-tap behavior
 * without duplicating any logging or persistence rules here.
 */
function installWaterQuickPresets() {
  const app = document.getElementById('app')
  if (!app) return

  const style = document.createElement('style')
  style.id = 'water-row-quickset-style'
  style.textContent = `
    .water-row-quickset {
      flex: none;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .water-row-quickset .today-item__quick {
      min-width: 0;
      min-height: 38px;
      padding-inline: 8px;
      border-radius: 11px;
      font-size: 10.5px;
      white-space: nowrap;
    }

    @media (max-width: 430px) {
      .today-item-wrap[data-activity='water'] .today-item {
        gap: 7px;
        padding-inline: 10px;
      }

      .today-item-wrap[data-activity='water'] .today-item__main {
        min-width: 70px;
      }

      .water-row-quickset {
        gap: 3px;
      }

      .water-row-quickset .today-item__quick {
        min-height: 36px;
        padding-inline: 5px;
        font-size: 9.5px;
      }
    }
  `
  document.head.append(style)

  /** @type {{ amount: number, stage: 'opening' | 'submitted', editor?: Element } | null} */
  let pendingWaterAdd = null

  function submitThroughEditor(editor, amount) {
    const input = editor.querySelector('.today-editor__input')
    const addButton = editor.querySelector('.today-editor__save')
    if (!(input instanceof HTMLInputElement) || !(addButton instanceof HTMLButtonElement) || addButton.disabled) {
      pendingWaterAdd = null
      return
    }

    pendingWaterAdd = { amount, stage: 'submitted', editor }
    input.value = String(amount)
    addButton.click()
  }

  function addFixedAmount(wrap, amount) {
    const openEditor = wrap.querySelector('.today-editor[data-editor="water"]')
    if (openEditor) {
      submitThroughEditor(openEditor, amount)
      return
    }

    const expand = wrap.querySelector('.today-item__expand')
    if (!(expand instanceof HTMLButtonElement)) return
    pendingWaterAdd = { amount, stage: 'opening' }
    expand.click()
  }

  function enhanceRow(wrap) {
    const row = wrap.querySelector(':scope > .today-item')
    if (!row || row.querySelector('[data-water-row-presets="true"]')) return

    const customButton = row.querySelector(':scope > .today-item__quick')
    const expand = row.querySelector(':scope > .today-item__expand')
    if (!(customButton instanceof HTMLButtonElement) || !(expand instanceof HTMLButtonElement)) return

    customButton.removeAttribute('hidden')
    customButton.dataset.adjustable = 'true'
    customButton.title = 'Custom Water quick add — change it with the chevron'

    const group = document.createElement('div')
    group.className = 'water-row-quickset'
    group.dataset.waterRowPresets = 'true'

    for (const amount of WATER_FIXED_PRESETS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'today-item__quick water-row-quickset__fixed'
      button.dataset.quickadd = String(amount)
      button.setAttribute('aria-label', `Add ${amount} oz to Water`)
      button.textContent = `+${amount} oz`
      button.addEventListener('click', () => addFixedAmount(wrap, amount))
      group.append(button)
    }

    // Moving the real custom button preserves Today's original one-tap handler.
    group.append(customButton)
    row.insertBefore(group, expand)
  }

  function enhanceEditor(editor) {
    const label = editor.querySelector('.today-editor__preset-label')
    if (label) label.textContent = 'Third quick add'
    const hint = editor.querySelector('.today-editor__hint')
    if (hint) hint.textContent = 'Water always includes +8 oz and +12 oz. Change this amount to set the third row button.'

    if (!pendingWaterAdd) return

    if (pendingWaterAdd.stage === 'opening') {
      submitThroughEditor(editor, pendingWaterAdd.amount)
      return
    }

    // record() re-renders Today after the add. When that replacement editor
    // appears, close it immediately so +8 / +12 remains a true one-tap action.
    if (pendingWaterAdd.stage === 'submitted' && editor !== pendingWaterAdd.editor) {
      const wrap = editor.closest('.today-item-wrap[data-activity="water"]')
      const expand = wrap?.querySelector('.today-item__expand')
      pendingWaterAdd = null
      if (expand instanceof HTMLButtonElement) expand.click()
    }
  }

  function enhance() {
    for (const wrap of app.querySelectorAll('.today-item-wrap[data-activity="water"]')) {
      enhanceRow(wrap)
    }
    for (const editor of app.querySelectorAll('.today-editor[data-editor="water"]')) {
      enhanceEditor(editor)
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
