const APPEARANCE_OPTIONS = new Set(['system', 'light', 'dark'])
const THEME_COLORS = { light: '#F3F5F8', dark: '#1B222C' }

/** Persisted display preference and system-colour-scheme bridge. */
export function createAppearanceService({ storage, documentRef = globalThis.document, windowRef = globalThis.window }) {
  let preference = 'system'
  let media = null
  let listening = false

  function apply() {
    const theme = preference === 'system'
      ? (media?.matches ? 'dark' : 'light')
      : preference
    documentRef.documentElement.dataset.theme = theme
    if (documentRef.documentElement.style) documentRef.documentElement.style.colorScheme = theme
    const themeColor = documentRef.querySelector('meta[name="theme-color"]')
    if (themeColor) themeColor.content = THEME_COLORS[theme]
    return theme
  }

  function onSystemChange() {
    if (preference === 'system') apply()
  }

  function addListener() {
    if (!media || listening) return
    if (media.addEventListener) media.addEventListener('change', onSystemChange)
    else media.addListener?.(onSystemChange)
    listening = true
  }

  function removeListener() {
    if (!media || !listening) return
    if (media.removeEventListener) media.removeEventListener('change', onSystemChange)
    else media.removeListener?.(onSystemChange)
    listening = false
  }

  async function getPreference() {
    const profile = await storage.get('profile', 'profile')
    return APPEARANCE_OPTIONS.has(profile?.appearance) ? profile.appearance : 'system'
  }

  async function initialize() {
    preference = await getPreference()
    media ??= windowRef.matchMedia('(prefers-color-scheme: dark)')
    addListener()
    apply()
    return preference
  }

  async function setPreference(value) {
    if (!APPEARANCE_OPTIONS.has(value)) throw new Error(`Unknown appearance: ${value}`)
    const profile = await storage.get('profile', 'profile')
    if (!profile) throw new Error('Cannot save appearance before the profile exists')
    await storage.put('profile', { ...profile, appearance: value })
    preference = value
    media ??= windowRef.matchMedia('(prefers-color-scheme: dark)')
    addListener()
    apply()
    return preference
  }

  return { initialize, getPreference, setPreference, dispose: removeListener }
}
