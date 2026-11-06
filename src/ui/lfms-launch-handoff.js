/**
 * LFMS ignition → Today shared-element handoff.
 *
 * Animate a separate snapshot of the REAL LFMS mountain to the real
 * already-rendered Today header mark. We never move the dashboard, replace it
 * with a look-alike, or touch its data. The snapshot exists only during exit.
 */
export const LFMS_HANDOFF_MS = 720

export async function runBrandHandoff(launch, { duration = LFMS_HANDOFF_MS } = {}) {
  if (!launch || typeof document === 'undefined') return false
  const source = launch.querySelector('.lfms-launch__mark')
  const destination = document.querySelector('#app .screen--today .lfms-main-brand__mark')
  if (!source || !destination || typeof source.animate !== 'function') return false

  const from = source.getBoundingClientRect()
  const to = destination.getBoundingClientRect()
  if (![from.width, from.height, to.width, to.height].every(value => Number.isFinite(value) && value > 0)) {
    return false
  }

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const scale = Math.min(to.width / from.width, to.height / from.height)
  if (!Number.isFinite(scale) || scale <= 0) return false

  // A detached copy avoids coordinate changes from the responsive launch
  // layout and ensures a smooth motion even after the splash fades away.
  const movingMark = document.createElement('img')
  movingMark.src = source.currentSrc || source.src
  movingMark.alt = ''
  movingMark.setAttribute('aria-hidden', 'true')
  movingMark.setAttribute('data-lfms-flying-mark', 'true')
  Object.assign(movingMark.style, {
    position: 'fixed',
    left: from.left + 'px', top: from.top + 'px',
    width: from.width + 'px', height: from.height + 'px',
    objectFit: 'contain', transformOrigin: 'center center',
    margin: '0', padding: '0', border: '0',
    pointerEvents: 'none', userSelect: 'none',
    zIndex: '10001', filter: 'none', opacity: '1',
  })
  const originalSourceVisibility = source.style.visibility
  const originalDestinationVisibility = destination.style.visibility
  document.body.append(movingMark)
  source.style.visibility = 'hidden'
  destination.style.visibility = 'hidden'

  // The real Today screen becomes visible as the title card fades; the moving
  // mountain is the only element drawn above it and lands exactly on its mark.
  launch.dataset.closing = 'true'
  try {
    const flight = movingMark.animate([
      { offset: 0, opacity: 1, transform: 'translate3d(0,0,0) scale(1)' },
      { offset: .24, opacity: 1,
        transform: `translate3d(${(dx * .11).toFixed(2)}px,${(dy * .17).toFixed(2)}px,0) scale(.89)` },
      { offset: 1, opacity: 1,
        transform: `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0) scale(${scale.toFixed(5)})` },
    ], {
      duration, fill: 'forwards',
      easing: 'cubic-bezier(.62,.06,.16,1)',
    })
    await flight.finished
  } finally {
    destination.style.visibility = originalDestinationVisibility
    source.style.visibility = originalSourceVisibility
    movingMark.remove()
  }
  return true
}
