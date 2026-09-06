/**
 * Lightweight combat FX layer for the optional Daily Battle.
 *
 * The approved pixel effects are stored as base64 text so the repository can
 * carry the exact cleaned artwork without a binary-upload build step. We turn
 * each payload into an in-memory PNG data URL once, then reuse it for every hit.
 */

const FX_FILES = Object.freeze({
  sword: 'sword-slash.png.b64',
  impact: 'impact-spark.png.b64',
  guard: 'guard-shield.png.b64',
  magic: 'magic-burst.png.b64',
  critical: 'critical-hit.png.b64',
  dust: 'dust-impact.png.b64',
})

const FX_ROOT = new URL('../../art/battle/fx/', import.meta.url)
const cache = new Map()

function installStyles() {
  if (document.getElementById('battle-fx-runtime-style')) return
  const style = document.createElement('style')
  style.id = 'battle-fx-runtime-style'
  style.textContent = `
    .screen--battle .battle-fx__sprite {
      position: absolute;
      z-index: 8;
      width: 116px;
      height: 116px;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      pointer-events: none;
      user-select: none;
      opacity: 0;
      filter: drop-shadow(0 5px 0 rgba(10, 20, 25, .16));
      animation: battle-fx-pop 620ms steps(6, end) both;
    }

    .screen--battle .battle-fx__sprite[data-target='hero'] {
      left: 18%;
      bottom: 12%;
    }

    .screen--battle .battle-fx__sprite[data-target='enemy'] {
      right: 18%;
      bottom: 12%;
    }

    .screen--battle .battle-fx__sprite[data-kind='sword'] {
      width: 132px;
      height: 132px;
      bottom: 10%;
      animation-name: battle-fx-slash;
    }

    .screen--battle .battle-fx__sprite[data-kind='guard'] {
      width: 104px;
      height: 104px;
      bottom: 15%;
      animation-name: battle-fx-guard;
    }

    .screen--battle .battle-fx__sprite[data-kind='magic'] {
      width: 124px;
      height: 124px;
      animation-name: battle-fx-magic;
    }

    .screen--battle .battle-fx__sprite[data-kind='critical'] {
      width: 126px;
      height: 126px;
      animation-name: battle-fx-critical;
    }

    .screen--battle .battle-fx__sprite[data-kind='dust'] {
      width: 96px;
      height: 96px;
      bottom: 7%;
      animation-name: battle-fx-dust;
    }

    @keyframes battle-fx-pop {
      0% { opacity: 0; transform: scale(.55); }
      20% { opacity: 1; transform: scale(1.08); }
      68% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.18); }
    }

    @keyframes battle-fx-slash {
      0% { opacity: 0; transform: translate(-18px, 10px) rotate(-12deg) scale(.72); }
      18% { opacity: 1; transform: translate(5px, -5px) rotate(2deg) scale(1.08); }
      58% { opacity: 1; transform: translate(10px, -8px) rotate(5deg) scale(1); }
      100% { opacity: 0; transform: translate(18px, -12px) rotate(8deg) scale(1.08); }
    }

    @keyframes battle-fx-guard {
      0% { opacity: 0; transform: scale(.62); }
      24% { opacity: 1; transform: scale(1.12); }
      62% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.06); }
    }

    @keyframes battle-fx-magic {
      0% { opacity: 0; transform: scale(.35) rotate(-8deg); }
      25% { opacity: 1; transform: scale(1.14) rotate(3deg); }
      65% { opacity: 1; transform: scale(.98) rotate(0); }
      100% { opacity: 0; transform: scale(1.26) rotate(8deg); }
    }

    @keyframes battle-fx-critical {
      0% { opacity: 0; transform: scale(.4); }
      18% { opacity: 1; transform: scale(1.28); }
      42% { opacity: .45; transform: scale(.92); }
      63% { opacity: 1; transform: scale(1.14); }
      100% { opacity: 0; transform: scale(1.35); }
    }

    @keyframes battle-fx-dust {
      0% { opacity: 0; transform: translateY(12px) scale(.62); }
      30% { opacity: .95; transform: translateY(0) scale(1.06); }
      72% { opacity: .75; transform: translateY(-4px) scale(1); }
      100% { opacity: 0; transform: translateY(-10px) scale(1.16); }
    }

    @media (max-width: 560px) {
      .screen--battle .battle-fx__sprite[data-target='hero'] { left: 12%; }
      .screen--battle .battle-fx__sprite[data-target='enemy'] { right: 12%; }
      .screen--battle .battle-fx__sprite { width: 76px; height: 76px; }
      .screen--battle .battle-fx__sprite[data-kind='sword'] { width: 88px; height: 88px; }
      .screen--battle .battle-fx__sprite[data-kind='guard'] { width: 72px; height: 72px; }
      .screen--battle .battle-fx__sprite[data-kind='magic'],
      .screen--battle .battle-fx__sprite[data-kind='critical'] { width: 84px; height: 84px; }
      .screen--battle .battle-fx__sprite[data-kind='dust'] { width: 68px; height: 68px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .screen--battle .battle-fx__sprite { animation-duration: 260ms; animation-timing-function: ease-out; }
    }
  `
  document.head.append(style)
}

async function fxUrl(kind) {
  if (!FX_FILES[kind]) return null
  if (!cache.has(kind)) {
    cache.set(kind, fetch(new URL(FX_FILES[kind], FX_ROOT))
      .then((response) => {
        if (!response.ok) throw new Error(`FX ${kind} could not load`)
        return response.text()
      })
      .then((base64) => `data:image/png;base64,${base64.trim()}`)
      .catch(() => null))
  }
  return cache.get(kind)
}

async function showFx(kind, target, delay = 0) {
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  const fight = document.querySelector('.screen--battle .fight')
  if (!fight) return
  const src = await fxUrl(kind)
  if (!src || !fight.isConnected) return

  const image = document.createElement('img')
  image.className = 'battle-fx__sprite'
  image.dataset.kind = kind
  image.dataset.target = target
  image.dataset.battleFx = 'true'
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')
  image.draggable = false
  image.src = src
  fight.append(image)
  setTimeout(() => image.remove(), 760)
}

function currentTurnWasCritical() {
  const heroLine = document.querySelector('.screen--battle .feed__line[data-by="hero"]')
  return heroLine?.dataset.crit === 'true'
}

function newestEventIsUnguardedEnemyHit() {
  const newest = document.querySelector('.screen--battle .feed__line')
  if (!newest || newest.dataset.by !== 'enemy') return false
  return !String(newest.textContent ?? '').startsWith('Guard absorbs')
}

function playActionFx(action) {
  if (action === 'attack') {
    void showFx('sword', 'enemy')
    void showFx(currentTurnWasCritical() ? 'critical' : 'impact', 'enemy', 105)
  } else if (action === 'skill') {
    void showFx('magic', 'enemy')
    if (currentTurnWasCritical()) void showFx('critical', 'enemy', 115)
  } else if (action === 'guard') {
    void showFx('guard', 'hero')
  }

  if (newestEventIsUnguardedEnemyHit()) void showFx('dust', 'hero', 245)
}

function waitForBattleToSettle(action) {
  const started = performance.now()

  function check() {
    const screen = document.querySelector('.screen--battle')
    if (!screen) return

    const actionButtons = [...screen.querySelectorAll('.battle-action')]
    const activeButtonsReady = actionButtons.length > 0 && actionButtons.some((button) => !button.disabled)
    const finished = Boolean(screen.querySelector('[data-battle="restart"]'))

    if ((activeButtonsReady || finished) && performance.now() - started >= 45) {
      playActionFx(action)
      return
    }

    if (performance.now() - started < 1800) requestAnimationFrame(check)
  }

  requestAnimationFrame(check)
}

export function installBattleFx() {
  installStyles()

  for (const kind of Object.keys(FX_FILES)) void fxUrl(kind)

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const button = event.target.closest('.battle-action')
    if (!(button instanceof HTMLButtonElement) || button.disabled) return
    const action = button.dataset.action
    if (!['attack', 'guard', 'skill'].includes(action)) return
    queueMicrotask(() => waitForBattleToSettle(action))
  }, true)
}

installBattleFx()
