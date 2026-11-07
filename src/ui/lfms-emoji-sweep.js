/** Play the approved rendered emoji asset once, including on repeated/offline launches. */
export async function startEmojiSweep(launch, { delay = 1430 } = {}) {
  const stage = launch?.querySelector('[data-lfms-emoji-sweep]')
  if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    const [blob] = await Promise.all([
      fetch(new URL('../../branding/lfms/emoji-sweep.webp', import.meta.url), { signal: controller.signal })
        .then(response => {
          if (!response.ok) throw new Error('Sweep asset unavailable')
          return response.blob()
        }),
      new Promise(resolve => setTimeout(resolve, delay)),
    ])
    if (!launch.isConnected) return () => {}
    // A cached animated image can retain its blank final frame. A new blob URL
    // restarts playback without query-string cache misses or offline failures.
    const source = URL.createObjectURL(blob)
    const image = new Image()
    let released = false
    const cleanup = () => {
      if (released) return
      released = true
      image.remove()
      URL.revokeObjectURL(source)
    }
    image.className = 'lfms-launch__emoji-image'
    image.alt = ''
    image.width = 960
    image.height = 540
    image.onerror = cleanup
    image.src = source
    stage.append(image)
    return cleanup
  } catch {
    // The original brand and Today handoff remain usable if loading fails.
    return () => {}
  } finally {
    clearTimeout(timeout)
  }
}
