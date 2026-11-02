/**
 * Waterline in the same 24x24 viewBox as the canonical LFMS lifting icon.
 * This clips ONLY the blue SVG glyph, so the blue can never extend beyond
 * the white figure's actual silhouette (including barbells and gaps).
 */
export function waterWavePath(percent, phase = 0) {
  const value = Number(percent)
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  const level = 24 * (1 - clamped / 100)
  // Fade the crest away near empty/full so no blue leaks at the extremes.
  const amplitude = Math.min(0.35, level * 0.36, (24 - level) * 0.36)
  const points = Array.from({ length: 25 }, (_, x) => {
    const y = level + amplitude * Math.sin(x * Math.PI / 7 + phase)
    return `${x} ${y.toFixed(3)}`
  })
  return `M ${points[0]} ${points.slice(1).map(point => 'L ' + point).join(' ')} L 24 24 L 0 24 Z`
}
