/**
 * Moving an export in and out of the browser as a file.
 *
 * An adapter, so touching Blob, URL and the DOM is fine here — this is the
 * boundary that exists precisely so the domain never has to.
 *
 * The UI for this arrives with the settings screen. What lives here is the
 * mechanism: build a file, hand it to the user, read one back.
 */

export const EXPORT_MIME = 'application/json'

/**
 * `tempered-backup-2026-09-04.json` — sorts chronologically in a downloads
 * folder, and says what it is without being opened.
 *
 * @param {import('../clock/clock.js').Clock} clock
 * @returns {string}
 */
export function exportFilename(clock) {
  return `tempered-backup-${clock.today()}.json`
}

/**
 * Serialises an export document as a file's worth of bytes.
 *
 * Pretty-printed deliberately: a backup a user can open and read is a backup
 * they can trust, and the size cost is irrelevant at this scale.
 *
 * @param {object} exportDocument
 * @returns {Blob}
 */
export function toBlob(exportDocument) {
  return new Blob([JSON.stringify(exportDocument, null, 2)], { type: EXPORT_MIME })
}

/**
 * Hands the export to the user as a download.
 *
 * @param {object} exportDocument
 * @param {import('../clock/clock.js').Clock} clock
 * @param {Document} [dom]
 * @returns {string} the filename offered.
 */
export function downloadExport(exportDocument, clock, dom = globalThis.document) {
  const filename = exportFilename(clock)
  const url = URL.createObjectURL(toBlob(exportDocument))
  try {
    const link = dom.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    dom.body.append(link)
    link.click()
    link.remove()
  } finally {
    // Revoked on the next tick: revoking synchronously can cancel the download
    // before the browser has finished reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return filename
}

/**
 * Reads a file the user picked. The caller passes the text to `prepareImport`,
 * which decides whether it is acceptable — this function only reads bytes.
 *
 * @param {Blob} file
 * @returns {Promise<string>}
 */
export async function readFileAsText(file) {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file'))
    reader.readAsText(file)
  })
}
