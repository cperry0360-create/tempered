/**
 * Phase 8 UI states.
 *
 * Empty is neutral and useful. Error is actionable and never strands the user.
 * Both carry explicit semantics so VoiceOver gets the same information as the
 * visual surface.
 */

import { el } from './dom.js'

export function emptyState(title, detail) {
  return el('section.empty-state', { role: 'status', 'aria-live': 'polite' }, [
    el('p.empty-state__title', { text: title }),
    detail && el('p.empty-state__detail', { text: detail }),
  ])
}

export function errorState({
  title = 'Something went wrong',
  detail = 'Your data is still here. Try this screen again.',
  onRetry,
  onBack,
}) {
  return el('section.card.error-state', { role: 'alert', 'aria-live': 'assertive' }, [
    el('p.error-state__eyebrow', { text: 'TEMPERED' }),
    el('h1.error-state__title', { text: title }),
    el('p.error-state__detail', { text: detail }),
    el('div.error-state__actions', {}, [
      onRetry && el('button.button', {
        type: 'button',
        dataset: { action: 'retry' },
        onclick: onRetry,
      }, ['TRY AGAIN']),
      onBack && el('button.button.button--quiet', {
        type: 'button',
        dataset: { action: 'back' },
        onclick: onBack,
      }, ['GO BACK']),
    ]),
  ])
}

/** A visually hidden polite announcer for screen changes and async results. */
export function liveRegion() {
  return el('div.sr-only', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  })
}
