import { el, replace } from './dom.js'

const HOLD = 25
const REST = 15
const steps = [false, true].flatMap((bent) =>
  [1, 2].flatMap((rep) => ['Left', 'Right'].map((side) => ({ bent, rep, side }))))

function illustration(bent) {
  const rearLeg = bent ? '138,79 126,110 88,140 109,140' : '138,79 111,110 88,140 109,140'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 160">
    <path d="M31 144H267V24" stroke="slategray" stroke-width="3" fill="none"/>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="7">
      <path d="M138 79L174 54L215 67L265 58 M138 79L187 109L180 140H201" stroke="lightgray"/>
      <polyline points="${rearLeg}" stroke="lightskyblue"/>
    </g>
    <circle cx="184" cy="36" r="13" fill="lightgray"/>
  </svg>`
  return el('img', {
    src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    alt: `Side view of the wall stretch with the highlighted rear knee ${bent ? 'slightly bent' : 'straight'} and rear heel on the floor`,
    width: 300, height: 160,
  })
}

export function openFootMobility({ save }) {
  const trigger = document.activeElement
  const dialog = el('dialog.mobility-screen.foot-mobility', { 'aria-labelledby': 'foot-mobility-title' })
  const body = el('div.foot-mobility__body')
  dialog.append(el('header.mobility-screen__head', {}, [
    el('button.mobility-screen__back', { type: 'button', 'aria-label': 'Close foot mobility', onclick: () => dialog.close() }, ['×']),
    el('h2', { id: 'foot-mobility-title', text: 'Foot mobility' }),
  ]), body)

  let completed = 0
  let resting = false
  let remaining = HOLD
  let startedAt = null
  let startingRemaining = 0
  let interval
  let saving = false

  function pause() {
    clearInterval(interval)
    if (startedAt !== null) {
      remaining = Math.max(0, startingRemaining - (performance.now() - startedAt) / 1000)
      startedAt = null
    }
  }

  function tick() {
    const time = Math.max(0, startingRemaining - (performance.now() - startedAt) / 1000)
    if (time > 0) {
      body.querySelector('[data-foot-clock]').textContent = `${Math.ceil(time)} s`
      return
    }
    pause()
    if (!resting) completed += 1
    resting = !resting
    remaining = resting ? REST : HOLD
    if (resting && completed < steps.length) start()
    else render()
  }

  function start() {
    startingRemaining = remaining
    startedAt = performance.now()
    interval = setInterval(tick, 100)
    render()
  }

  function render() {
    const step = steps[completed]
    if (!step) {
      const error = el('p', { role: 'status' })
      const button = el('button.mobility-flow__complete', { type: 'button', onclick: async () => {
        if (saving) return
        saving = true
        button.disabled = true
        try {
          await save()
          dialog.close()
        } catch {
          error.textContent = 'Could not save. Try again.'
          button.disabled = false
        } finally {
          saving = false
        }
      } }, ['Save to Daily Log'])
      replace(body, [el('h3', { text: '8 of 8 holds complete' }), button, error])
      return
    }
    replace(body, [
      el('p', { text: `${completed} of ${steps.length} holds complete` }),
      el('h3', { text: `${resting ? 'Rest · next: ' : ''}${step.bent ? 'Bent' : 'Straight'} knee` }),
      el('p', { text: `${step.side} leg back · Rep ${step.rep} of 2 on this side` }),
      illustration(step.bent),
      el('p', { text: `Hands on the wall. Keep the back heel and toes down. ${step.bent ? 'Soften the back knee.' : 'Keep the back knee straight.'} Lean until you feel a gentle calf stretch.` }),
      el('p', { text: 'Use this routine only if your podiatrist has cleared gentle calf stretching. Stop if you feel heel, arch, or big-toe pain.' }),
      el('strong.mobility-flow__clock', { dataset: { footClock: 'true' }, text: `${Math.ceil(remaining)} s` }),
      el('button.mobility-flow__timer', { type: 'button', onclick: () => {
        if (startedAt === null) start()
        else { pause(); render() }
      } }, [startedAt !== null ? 'Pause' : resting ? 'Resume rest' : remaining === HOLD ? 'Start hold' : 'Resume hold']),
    ])
  }

  function pauseWhenHidden() {
    if (document.hidden && startedAt !== null) { pause(); render() }
  }
  document.addEventListener('visibilitychange', pauseWhenHidden)
  dialog.addEventListener('close', () => {
    pause()
    document.removeEventListener('visibilitychange', pauseWhenHidden)
    dialog.remove()
    trigger?.focus()
  }, { once: true })
  document.body.append(dialog)
  render()
  dialog.showModal()
}
