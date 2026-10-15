import { el, replace } from './dom.js'
import { icon } from './icons.js'
import { solvePlates, loadedBarWeight } from '../domain/plates.js'

const PLATES = [45, 35, 25, 10, 5, 2.5, 1.25]
// Scratch calculation only. Opening this tool never changes a workout or logs.
const state = { mode: 'target', bar: '45', target: '145', perSide: [] }
let activeDialog = null

export function plateCalculatorButton() {
  return el('button.plate-calculator-link', {
    type: 'button', 'aria-label': 'Plate calculator', title: 'Plate calculator',
    dataset: { openPlateCalculator: 'true' }, onclick: (event) => openPlateCalculator(event.currentTarget),
  }, [icon('calculator')])
}

export function openPlateCalculator(returnFocus) {
  if (activeDialog) return
  const dialog = el('dialog.plate-calculator', { 'aria-labelledby': 'plate-calculator-title' })
  activeDialog = dialog
  const output = el('section.plate-calculator__result', { 'aria-live': 'polite', 'aria-atomic': 'true' })
  const controls = el('div.plate-calculator__controls')
  const targetControls = el('div.plate-calculator__controls')
  const total = el('strong.plate-calculator__total', { 'aria-live': 'polite', dataset: { plateTotal: 'true' } })
  const close = () => dialog.close()
  dialog.addEventListener('close', () => { dialog.remove(); activeDialog = null; returnFocus?.focus() })

  function validBar() {
    const bar = state.bar.trim() === '' ? NaN : Number(state.bar)
    return Number.isFinite(bar) && bar >= 0 && bar <= 1000 ? bar : null
  }

  function result() {
    const bar = validBar()
    const target = state.target.trim() === '' ? NaN : Number(state.target)
    let perSide = state.perSide
    let note = ''
    let achieved = null
    if (bar === null) note = 'Enter a bar weight from 0 to 1,000 lb.'
    else if (state.mode === 'target') {
      if (!Number.isFinite(target) || target < bar || target > 3000) note = `Enter a total from ${bar} to 3,000 lb, including the bar.`
      else {
        const solution = solvePlates(target, { bar })
        perSide = solution.perSide
        achieved = solution.achieved
        note = solution.exact ? 'Total includes the bar and both sides.' : solution.note
      }
    } else {
      achieved = loadedBarWeight(perSide, bar)
      note = 'Total includes the bar and both sides.'
    }
    total.textContent = achieved === null ? '— lb' : `${achieved} lb`
    replace(output, [
      el('p.plate-calculator__note', { text: note }),
      achieved !== null && el('div.plate-calculator__bar', { role: 'img', 'aria-label': `${bar} lb bar. Each side: ${perSide.length ? perSide.join(' + ') : 'empty'}` }, [
        el('span.plate-calculator__shaft', { 'aria-hidden': 'true' }),
        el('span.plate-calculator__bar-label', { text: `${bar} lb bar` }),
        ...perSide.map((plate) => el('span.plate-calculator__plate', { style: `height:${56 + Math.min(plate, 45) * 2}px`, text: String(plate) })),
      ]),
      el('p.plate-calculator__loading', { dataset: { plateResult: 'true' }, text: achieved === null ? '' : `Each side: ${perSide.length ? perSide.join(' + ') : 'empty bar'}` }),
    ])
  }

  function renderControls() {
    replace(state.mode === 'target' ? controls : targetControls, [])
    replace(state.mode === 'target' ? targetControls : controls, state.mode === 'target' ? [
      el('label.plate-calculator__field', {}, ['Total weight (lb)', el('input', {
        type: 'text', inputmode: 'decimal', value: state.target, dataset: { plateTarget: 'true' },
        oninput: (event) => { state.target = event.target.value; result() },
      })]),
    ] : [
      el('p.plate-calculator__note', { text: 'Add plates for ONE side. The other side is counted automatically.' }),
      el('div.plate-calculator__inventory', {}, PLATES.map((plate) => {
        const count = state.perSide.filter((weight) => weight === plate).length
        return el('div.plate-calculator__plate-row', {}, [
          el('strong', { text: `${plate} lb` }),
          el('button', { type: 'button', disabled: count === 0, 'aria-label': `Remove ${plate} lb per side`, dataset: { plateRemove: String(plate) }, onclick: () => { state.perSide.splice(state.perSide.indexOf(plate), 1); renderControls(); result(); (controls.querySelector(`[data-plate-remove="${plate}"]:not(:disabled)`) ?? controls.querySelector(`[data-plate-add="${plate}"]`))?.focus() } }, ['−']),
          el('span', { 'aria-label': `${count} per side`, text: String(count) }),
          el('button', { type: 'button', disabled: count >= 12, 'aria-label': `Add ${plate} lb per side`, dataset: { plateAdd: String(plate) }, onclick: () => { state.perSide.push(plate); state.perSide.sort((a, b) => b - a); renderControls(); result(); controls.querySelector(`[data-plate-add="${plate}"]`)?.focus() } }, ['+']),
        ])
      })),
      el('button.button', { type: 'button', dataset: { plateClear: 'true' }, onclick: () => { state.perSide = []; renderControls(); result(); controls.querySelector('[data-plate-clear]')?.focus() } }, ['Clear plates']),
    ])
  }
  const modes = ['target', 'build'].map((mode) => el('button', {
    type: 'button', 'aria-pressed': String(state.mode === mode), dataset: { plateMode: mode },
    onclick: () => {
      if (state.mode === mode) return
      const bar = validBar()
      if (mode === 'build' && bar !== null) {
        const target = Number(state.target)
        if (state.target.trim() && Number.isFinite(target) && target >= bar && target <= 3000) state.perSide = solvePlates(target, { bar }).perSide
      } else if (mode === 'target' && bar !== null) state.target = String(loadedBarWeight(state.perSide, bar))
      state.mode = mode
      modes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.plateMode === mode)))
      renderControls(); result()
    },
  }, [mode === 'target' ? 'Weight → plates' : 'Plates → weight']))
  replace(dialog, [
    el('header.plate-calculator__header', {}, [el('div', {}, [el('h1', { id: 'plate-calculator-title', text: 'Plate calculator' }), total]), el('button.button', { type: 'button', dataset: { plateClose: 'true' }, onclick: close }, ['Done'])]),
    el('div.plate-calculator__body', {}, [
      el('div.plate-calculator__modes', { 'aria-label': 'Calculator direction' }, modes),
      el('label.plate-calculator__field', {}, ['Bar weight (lb)', el('input', {
        type: 'text', inputmode: 'decimal', value: state.bar, dataset: { plateBar: 'true' },
        oninput: (event) => { state.bar = event.target.value; result() },
      })]),
      targetControls, output, controls,
    ]),
  ])
  renderControls(); result()
  document.body.append(dialog)
  dialog.showModal()
  dialog.querySelector('[data-plate-close]').focus()
}
