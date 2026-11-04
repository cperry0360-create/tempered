/** LFMS V8 launch exit — an already-loaded barbell pulls a narrow physical fold.
 * The logo and dashboard remain in their original DOM layers. No app data touched.
 */
export const LFMS_REVEAL_START_MS = 2050
export const LFMS_REVEAL_DURATION_MS = 1010

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t) }

function skinAndFold(progress, width, height) {
  const rip = []
  for (let i = 0; i <= 24; i++) {
    const y = i * height / 24
    const v = y / height
    const wave = 3.5 * Math.sin(2 * Math.PI * v + .43) + 2 * Math.sin(5.2 * Math.PI * v + .2)
    const eased = progress ** 1.12
    const x = width * (1 - 1.28 * eased + .34 * eased * (v - .45)) + wave * eased * (1 - progress * .4)
    rip.push([x, y])
  }
  const point = ([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`
  const thickness = Math.max(4, Math.min(width * .115, 45) * (1 - progress * .75))
  const outside = rip.map(([x, y], i) => [x + thickness + 6 * Math.sin(i * .6 + .7) * (1 - progress), y])
  return {
    skin: `polygon(0px 0px,${rip.map(point).join(',')},0px ${height}px)`,
    fold: `polygon(${rip.map(point).join(',')},${outside.reverse().map(point).join(',')})`,
  }
}

/** Run after the real dashboard has rendered and the loaded bar has landed. */
export function runCinematicReveal(launch) {
  const skin = launch?.querySelector('.lfms-launch__skin')
  const bar = launch?.querySelector('.lfms-launch__barbell-stage')
  if (!launch || !skin || !bar) return Promise.resolve()

  // This narrow strip contains no duplicated lettering or giant flying panel.
  const fold = document.createElement('div')
  fold.className = 'lfms-launch__peel-strip'
  fold.setAttribute('aria-hidden', 'true')
  launch.append(fold)
  const bounds = bar.getBoundingClientRect()
  const startX = bounds.left + bounds.width / 2
  const startY = bounds.top + bounds.height / 2
  // Stop the *arrival* animation before taking over the *pull* trajectory.
  bar.style.animation = 'none'
  launch.dataset.revealing = 'true'
  const started = performance.now()
  return new Promise(resolve => {
    function paint(now) {
      if (!launch.isConnected) { resolve(); return }
      const raw = clamp((now - started) / LFMS_REVEAL_DURATION_MS)
      const p = raw < .13 ? .10 * raw / .13 : .10 + .90 * ((raw - .13) / .87) ** .85
      const width = window.innerWidth, height = window.innerHeight
      const cut = skinAndFold(p, width, height)
      skin.style.clipPath = cut.skin
      fold.style.clipPath = cut.fold
      fold.style.transform = `translate3d(${width * .03 * p ** 1.12}px,${height * .095 * p ** 1.6}px,0) rotate(${4 * p ** 1.35}deg)`
      fold.style.opacity = String(1 - smooth((p - .43) / .37))
      const x = startX + width * .43 * p ** 1.7
      const y = startY + height * 1.19 * p ** 1.75
      bar.style.left = `${x}px`
      bar.style.top = `${y}px`
      bar.style.transform = `translate(-50%,-50%) rotate(${1 + 118 * p ** 1.16}deg)`
      if (raw < 1) requestAnimationFrame(paint)
      else { skin.style.clipPath = 'inset(0 100% 0 0)'; resolve() }
    }
    requestAnimationFrame(paint)
  })
}
