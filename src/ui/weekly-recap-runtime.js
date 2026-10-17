import { createWeeklyRecapService } from '../app/weekly-recap.js'
import { previousWeek } from '../domain/weekly-recap.js'
import { showWeeklyRecap } from './weekly-recap.js'
import { loadActiveSessionDraft } from './session-draft.js'

/** Launch and foreground policy; optional recaps must never block startup. */
export async function installWeeklyRecapRuntime(context) {
  const service = createWeeklyRecapService(context)
  let dialog = null
  let busy = false
  let destroyed = false
  let checkedReset = null
  const safe = manual => Boolean(context.app) && !context.setup && document.visibilityState !== 'hidden'
    && !document.querySelector('dialog[open], .session-sheet, .screen--session')
    && !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')
    && (manual || !loadActiveSessionDraft())

  async function check(manual = false) {
    const reset = previousWeek(context.clock.today()).reset
    if (destroyed || busy || dialog || (!manual && checkedReset === reset) || !safe(manual)) return
    busy = true
    try {
      const report = await service.report()
      if (destroyed || !safe(manual)) return
      if (!manual && !report.eligible) { checkedReset = reset; return }
      dialog = showWeeklyRecap(report, {
        onClose: () => { dialog = null }, onProgress: () => context.app.show('history'),
      })
      checkedReset = reset
      await service.acknowledge(report.start)
    } catch (error) {
      console.warn('[tempered] weekly recap unavailable; logging remains available', error)
    } finally { busy = false }
  }
  const onForeground = () => { void check() }
  const onManual = () => { void check(true) }
  document.addEventListener('visibilitychange', onForeground)
  window.addEventListener('tempered:native-foreground', onForeground)
  window.addEventListener('tempered:screen-shown', onForeground)
  window.addEventListener('tempered:open-weekly-recap', onManual)
  await check()
  return {
    check,
    destroy() {
      destroyed = true
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('tempered:native-foreground', onForeground)
      window.removeEventListener('tempered:screen-shown', onForeground)
      window.removeEventListener('tempered:open-weekly-recap', onManual)
      dialog?.close()
    },
  }
}
