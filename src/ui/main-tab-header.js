/** One visual identity for LFMS's four primary tabs.
 * Keep the same DOM, logo asset, size and title markup on Today, Train,
 * Fuel and Progress. Existing screen-specific class hooks are retained. */
import { el } from './dom.js'

const markSrc = new URL('../../branding/lfms/logo-mark.svg', import.meta.url).href

/** @param {'Today'|'Train'|'Fuel'|'Progress'|'Day review'} title
 * @param {{brandClass?:string,markClass?:string,copyClass?:string}} [legacy] */
export function mainTabBrand(title, legacy = {}) {
  const brand = el('div.lfms-main-brand', { class: legacy.brandClass }, [
    el('img.lfms-main-brand__mark', {
      class: legacy.markClass, src: markSrc, alt: '', loading: 'eager',
      width: 44, height: 36,
    }),
    el('div.lfms-main-brand__copy', { class: legacy.copyClass }, [
      el('h1.screen__title.lfms-main-brand__title', { text: title }),
    ]),
  ])
  return brand
}
