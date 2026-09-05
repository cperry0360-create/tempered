/**
 * Slices exercise art out of a source sheet into art/exercises/<id>.png.
 *
 *   node tools/slice-exercise-art.js
 *
 * Pure Node — no image library, because there is none to install. PNG decode and
 * encode are done here against node:zlib, which is enough for cropping.
 *
 * CURRENTLY UNUSED, AND KEPT ON PURPOSE. The art in art/exercises/ no longer
 * comes from a sheet: it is taken from the free-exercise-db archive, one file per
 * exercise, recorded in art/exercises/SOURCES.json. There is nothing left to
 * slice, so ART_MANIFEST is empty and running this writes nothing.
 *
 * It stays because the cropper itself is the hard part and it works. If a real
 * frame sheet ever arrives, add an entry per exercise and the tool does the rest.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

/**
 * Which region of which sheet belongs to which exercise.
 *
 * Empty. The one entry that lived here cropped `art/source/exercise-frames.png`,
 * which held a single watermarked movement rather than the sheet docs/09 assumed.
 * That file has been deleted and its crop replaced, so the manifest describes
 * nothing. `trim: true` on a future entry crops surrounding white rather than
 * guessing a box.
 *
 * @type {{exerciseId: string, source: string, trim?: boolean,
 *         x?: number, y?: number, width?: number, height?: number}[]}
 */
const ART_MANIFEST = []

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

/** @param {Buffer} buffer */
function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** @param {string} type @param {Buffer} data */
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Decodes a truecolour or truecolour+alpha PNG into raw pixels. */
function decode(buffer) {
  let offset = 8
  let width = 0, height = 0, colorType = 0, bitDepth = 0
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      bitDepth = data[8]; colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    offset += 12 + length
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG: bitDepth ${bitDepth}, colorType ${colorType}`)
  }

  const channels = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const pixels = Buffer.alloc(height * stride)

  let read = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[read++]
    const line = raw.subarray(read, read + stride); read += stride
    const out = pixels.subarray(y * stride, (y + 1) * stride)
    const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0
      const b = prior ? prior[x] : 0
      const c = prior && x >= channels ? prior[x - channels] : 0
      let value = line[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[x] = value & 0xff
    }
  }
  return { width, height, channels, pixels }
}

/** Encodes raw pixels back to a PNG. Filter 0 throughout: simple and adequate. */
function encode({ width, height, channels, pixels }) {
  const stride = width * channels
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function crop(image, box) {
  const { channels, pixels, width } = image
  const out = Buffer.alloc(box.height * box.width * channels)
  for (let y = 0; y < box.height; y++) {
    const from = ((box.y + y) * width + box.x) * channels
    pixels.copy(out, y * box.width * channels, from, from + box.width * channels)
  }
  return { width: box.width, height: box.height, channels, pixels: out }
}

/** Finds the content box by trimming near-white margins. */
function contentBox(image, threshold = 245) {
  const { width, height, channels, pixels } = image
  let top = height, left = width, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      if (pixels[i] > threshold && pixels[i + 1] > threshold && pixels[i + 2] > threshold) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  if (right < 0) return { x: 0, y: 0, width, height }
  const pad = 8
  const x = Math.max(0, left - pad)
  const y = Math.max(0, top - pad)
  return {
    x, y,
    width: Math.min(width - x, right - left + 1 + pad * 2),
    height: Math.min(height - y, bottom - top + 1 + pad * 2),
  }
}

if (ART_MANIFEST.length === 0) {
  console.log('Nothing to slice: ART_MANIFEST is empty. See the note at the top of this file.')
  process.exit(0)
}

mkdirSync(root + 'art/exercises', { recursive: true })
for (const entry of ART_MANIFEST) {
  const image = decode(readFileSync(root + entry.source))
  const box = entry.trim ? contentBox(image) : entry
  const out = crop(image, box)
  const path = `art/exercises/${entry.exerciseId}.png`
  writeFileSync(root + path, encode(out))
  console.log(`${path}  ${out.width}x${out.height}  (from ${image.width}x${image.height})`)
}
console.log(`\n${ART_MANIFEST.length} movement(s) sliced.`)
