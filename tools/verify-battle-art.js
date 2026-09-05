#!/usr/bin/env node
/**
 * Validates any battle PNGs that exist against art/battle/ASSETS.json.
 *
 * Missing files are informational by default because the app deliberately has
 * glyph fallbacks until the art pass is complete. Pass --strict when the asset
 * set is ready to make missing files fail CI as well.
 *
 * No image library is required. PNG width and height live in the IHDR header.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = normalize(join(here, '..'))
const battleRoot = join(root, 'art', 'battle')
const manifestPath = join(battleRoot, 'ASSETS.json')
const strict = process.argv.includes('--strict')

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export function pngDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

export function validateAsset(asset, buffer) {
  const dimensions = pngDimensions(buffer)
  if (!dimensions) return { ok: false, detail: 'not a valid PNG with an IHDR header' }
  if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
    return {
      ok: false,
      detail: `${dimensions.width}×${dimensions.height}; expected ${asset.width}×${asset.height}`,
    }
  }
  return { ok: true, detail: `${dimensions.width}×${dimensions.height}` }
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
  console.error('Battle art manifest is not schema version 1.')
  process.exit(1)
}

let failures = 0
let missing = 0
let present = 0

for (const asset of manifest.assets) {
  const path = join(battleRoot, asset.path)
  if (!existsSync(path)) {
    missing += 1
    console.log(`${strict ? 'FAIL' : 'MISS'}  ${asset.kind.padEnd(5)}  ${asset.id}  ${asset.path}`)
    if (strict) failures += 1
    continue
  }

  present += 1
  const result = validateAsset(asset, readFileSync(path))
  if (!result.ok) failures += 1
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${asset.kind.padEnd(5)}  ${asset.id}  ${result.detail}`)
}

console.log(`\nBattle art: ${present} present, ${missing} missing, ${failures} failing.`)
if (!strict && missing > 0) console.log('Missing art is allowed until the final art pass. Use --strict to require the complete set.')
process.exit(failures === 0 ? 0 : 1)
