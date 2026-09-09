/**
 * Lightweight day planner. Planner items are intentionally separate from the
 * health/RPG scoring model: completing a work or personal todo never earns XP.
 */

/**
 * @param {object} deps
 * @param {import('../adapters/storage/storage-adapter.js').StorageAdapter} deps.storage
 * @param {import('../adapters/clock/clock.js').Clock} deps.clock
 */
export function createPlannerService({ storage, clock }) {
  async function list(date = clock.today()) {
    const rows = (await storage.getAll('plannerItems'))
      .filter((row) => row.date === date || (!row.done && row.date < date))
      .map((row) => row.date < date ? { ...row, rolloverFrom: row.date } : row)
    return rows.sort((a, b) => {
      if (Boolean(a.done) !== Boolean(b.done)) return Number(a.done) - Number(b.done)
      const aDue = a.dueDate || '9999-12-31'
      const bDue = b.dueDate || '9999-12-31'
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    })
  }

  async function add({ date = clock.today(), title, kind = 'personal', notes = '', dueDate = null }) {
    const clean = String(title ?? '').trim()
    if (!clean) return null
    const safeKind = kind === 'work' ? 'work' : 'personal'
    const cleanNotes = String(notes ?? '').trim()
    const cleanDueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dueDate ?? '')) ? String(dueDate) : null
    const stamp = clock.now()
    const row = {
      id: `p_${date}_${stamp}_${Math.floor(stamp % 100000)}`,
      date,
      title: clean,
      kind: safeKind,
      notes: cleanNotes,
      dueDate: cleanDueDate,
      done: false,
      createdAt: clock.nowIso(),
      completedAt: null,
    }
    await storage.put('plannerItems', row)
    return row
  }

  async function toggle(id) {
    const row = await storage.get('plannerItems', id)
    if (!row) return null
    const done = !row.done
    const next = {
      ...row,
      done,
      completedAt: done ? clock.nowIso() : null,
    }
    await storage.put('plannerItems', next)
    return next
  }

  async function update(id, changes = {}) {
    const row = await storage.get('plannerItems', id)
    if (!row) return null
    const title = changes.title === undefined ? row.title : String(changes.title).trim()
    if (!title) return null
    const next = {
      ...row,
      title,
      kind: changes.kind === undefined ? row.kind : (changes.kind === 'work' ? 'work' : 'personal'),
      notes: changes.notes === undefined ? String(row.notes ?? '') : String(changes.notes ?? '').trim(),
      dueDate: changes.dueDate === undefined
        ? (row.dueDate ?? null)
        : (/^\d{4}-\d{2}-\d{2}$/.test(String(changes.dueDate ?? '')) ? String(changes.dueDate) : null),
      updatedAt: clock.nowIso(),
    }
    await storage.put('plannerItems', next)
    return next
  }

  async function remove(id) {
    await storage.delete('plannerItems', id)
  }

  return { list, add, toggle, update, remove }
}
