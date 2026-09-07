const WATER_FIXED_PRESETS = [8, 12]

let observer = null
let observedApp = null
let enhanceQueued = false

function ensureStyle() {
  if (document.getElementById('water-row-quickset-style')) return
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
      min-width: 44px;
      min-height: 44px;
      padding-inline: 8px;
      border-radius: 11px;
      font-size: 10.5px;
      white-space: nowrap;
    }
    @media (max-width: 430px) {
      .today-item-wrap[data-activity='water'] .today-item {
        gap: 5px;
        padding-inline: 8px;
      }
      .today-item-wrap[data-activity='water'] .today-item__main { min-width: 64px; }
      .water-row-quickset { gap: 2px; }
      .water-row-quickset .today-item__quick {
        min-width: 44px;
        min-height: 44px;
        padding-inline: 4px;
        font-size: 9px;
      }
    }
  `
  document.head.append(style)
}

function directChildWithClass(node, className) {
  return [...(node?.children ?? [])].find((child) => child.classList?.contains(className)) ?? null
}

function liveWaterWrap() {
  return document.querySelector('#app .today-item-wrap[data-activity="water"]')
}

/**
 * Use Today's own editor/record path, but do it synchronously from the user's
 * tap. The old implementation waited for MutationObserver callbacks and then
 * clicked controls from inside the observer. On iOS that could create a render
 * / mutation / click loop and freeze the PWA.
 */
function addFixedAmount(amount) {
  let wrap = liveWaterWrap()
  if (!wrap) return

  let editor = wrap.querySelector('.today-editor[data-editor="water"]')
  const wasOpen = Boolean(editor)

  if (!editor) {
    const expand = wrap.querySelector('.today-item__expand')
    if (!(expand instanceof HTMLButtonElement)) return
    expand.click()
    wrap = liveWaterWrap()
    editor = wrap?.querySelector('.today-editor[data-editor="water"]') ?? null
  }

  const input = editor?.querySelector('.today-editor__input')
  const addButton = editor?.querySelector('.today-editor__save')
  if (!(input instanceof HTMLInputElement) || !(addButton instanceof HTMLButtonElement) || addButton.disabled) return

  input.value = String(amount)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  addButton.click()

  // If this quick tap opened the editor only as an implementation detail,
  // close it immediately. The async record finishes safely and rerenders with
  // Water still collapsed. If the user already had Water open, leave it open.
  if (!wasOpen) {
    const currentWrap = liveWaterWrap()
    const currentExpand = currentWrap?.querySelector('.today-item__expand')
    if (currentExpand instanceof HTMLButtonElement
      && currentExpand.getAttribute('aria-expanded') === 'true') {
      currentExpand.click()
    }
  }
}

function enhanceRow(wrap) {
  const row = directChildWithClass(wrap, 'today-item')
  if (!row || row.querySelector('[data-water-row-presets="true"]')) return

  const customButton = directChildWithClass(row, 'today-item__quick')
  const expand = directChildWithClass(row, 'today-item__expand')
  if (!(customButton instanceof HTMLButtonElement) || !(expand instanceof HTMLButtonElement)) return

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
    button.addEventListener('click', () => addFixedAmount(amount))
    group.append(button)
  }

  group.append(customButton)
  row.insertBefore(group, expand)
}

function enhanceEditor(editor) {
  const label = editor.querySelector('.today-editor__preset-label')
  if (label) label.textContent = 'Third quick add'
  const hint = editor.querySelector('.today-editor__hint')
  if (hint) hint.textContent = 'Water always includes +8 oz and +12 oz. Change this amount to set the third row button.'
}

function enhance(app) {
  for (const wrap of app.querySelectorAll('.today-item-wrap[data-activity="water"]')) enhanceRow(wrap)
  for (const editor of app.querySelectorAll('.today-editor[data-editor="water"]')) enhanceEditor(editor)
}

function queueEnhance(app) {
  if (enhanceQueued) return
  enhanceQueued = true
  requestAnimationFrame(() => {
    enhanceQueued = false
    if (app.isConnected) enhance(app)
  })
}

/**
 * Water gets three one-tap choices in the collapsed row: 8 oz, 12 oz, and the
 * user's saved custom amount. Fixed presets travel through Today's canonical
 * record path; the custom button remains Today's native quick-add button.
 */
export function installWaterQuickPresets() {
  const app = document.getElementById('app')
  if (!app) return
  ensureStyle()

  enhance(app)
  queueEnhance(app)

  if (observer && observedApp === app) return
  observer?.disconnect()
  observedApp = app
  observer = new MutationObserver(() => queueEnhance(app))
  observer.observe(app, { childList: true, subtree: true })
}
