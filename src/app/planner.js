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
    const rows = await storage.getAllByIndex('plannerItems', 'date', date)
    return rows.sort((a, b) => {
      if (Boolean(a.done) !== Boolean(b.done)) return Number(a.done) - Number(b.done)
      return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    })
  }

  async function add({ date = clock.today(), title, kind = 'personal' }) {
    const clean = String(title ?? '').trim()
    if (!clean) return null
    const safeKind = kind === 'work' ? 'work' : 'personal'
    const stamp = clock.now()
    const row = {
      id: `p_${date}_${stamp}_${Math.floor(stamp % 100000)}`,
      date,
      title: clean,
      kind: safeKind,
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

  async function remove(id) {
    await storage.delete('plannerItems', id)
  }

  return { list, add, toggle, remove }
}
