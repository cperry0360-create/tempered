/**
 * Never navigate an installed iOS Home Screen web app directly to ChatGPT.
 * Its standalone WebKit shell has no reliable browser back control.
 *
 * A share sheet (where available) can hand text to ChatGPT without replacing
 * the running Tempered view. Clipboard is a safe fallback.
 */
export async function handoffChatGptPrompt(text, { copy, share } = {}) {
  const sharePrompt = share ?? (typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    ? navigator.share.bind(navigator) : null)
  if (sharePrompt) {
    try {
      await sharePrompt({ title: 'Tempered · ChatGPT prompt', text })
      return 'shared'
    } catch {
      // Dismissed share sheet or unsupported share target: keep the user in
      // Tempered and put the prompt on the clipboard instead.
    }
  }
  if (typeof copy !== 'function') throw new Error('Clipboard fallback unavailable')
  const result = await copy(text)
  if (result === false) throw new Error('Could not copy ChatGPT prompt')
  return 'copied'
}
