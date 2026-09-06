/**
 * Daily workout presentation for Today.
 *
 * The workout domain already treats a program slot as the unit of work. This
 * module makes that model visible on Today: today's prescribed slots plus any
 * unfinished slots from earlier in the same program week. A slot can be opened
 * on its own for between-call sets, or the owning program day can be opened as a
 * full session. Both paths write the same programDayId/slotIndex set records.
 */

const DAY_INDEX = Object.freeze({
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
})

const COMPLETED_SLOT_SENTINEL = '__tempered_completed_slot__'

function weekdayIndex(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.getDay()
}

function dayIndex(day) {
  return DAY_INDEX[String(day?.id ?? '').toLowerCase()] ?? null
}

function taskRow(dayEntry, task, kind) {
  return {
    kind,
    programDay: dayEntry.day,
    task,
    name: task.slot?.name ?? task.slot?.exerciseId ?? 'Exercise',
    logged: task.logged ?? 0,
    prescribed: task.prescribed ?? task.slot?.sets ?? 0,
    done: task.done === true,
    started: task.started === true,
  }
}

/**
 * Build the daily workout queue from the canonical current-week task status.
 *
 * Earlier unfinished slots roll into Today. Future program days do not. Today's
 * completed slots remain visible so a morning session is reflected back as a
 * completed checklist rather than making the workout vanish.
 */
export function buildDailyWorkoutQueue(status, todayKey) {
  const todayIndex = weekdayIndex(todayKey)
  const days = status?.week?.days ?? []
  if (todayIndex === null || days.length === 0) {
    return { active: [], completed: [], rollover: [], today: [], primaryDay: null, scheduledDay: null }
  }

  const eligible = days
    .map((entry) => ({ entry, index: dayIndex(entry.day) }))
    .filter(({ index }) => index !== null && index <= todayIndex)
    .sort((a, b) => a.index - b.index)

  const todayEntry = eligible.find(({ index }) => index === todayIndex)?.entry ?? null
  const rollover = eligible
    .filter(({ index }) => index < todayIndex)
    .flatMap(({ entry }) => entry.tasks
      .filter((task) => !task.done)
      .map((task) => taskRow(entry, task, 'rollover')))

  const today = todayEntry
    ? todayEntry.tasks.map((task) => taskRow(todayEntry, task, 'today'))
    : []
  const todayActive = today.filter((row) => !row.done)
  const completed = today.filter((row) => row.done)
  const active = [...rollover, ...todayActive]

  const primaryDay = todayActive.length > 0
    ? todayEntry?.day ?? null
    : rollover[0]?.programDay ?? null

  return {
    active,
    completed,
    rollover,
    today,
    primaryDay,
    scheduledDay: todayEntry?.day ?? null,
  }
}

/**
 * Build the version of a program day that should open in a full session NOW.
 *
 * A full session is only another route through the same slot records. A slot
 * already finished earlier in the day is represented by an intentionally
 * unknown exercise id so the existing session builder skips it while preserving
 * every later slot's original array index. A partially finished slot keeps its
 * original index but asks only for the remaining number of sets.
 *
 * Keeping the array positions stable is critical: session logging writes that
 * position as `slotIndex`, which is how Today and Train agree on completion.
 */
export function remainingProgramDay(status, programDay) {
  if (!programDay) return null
  const entry = status?.week?.days?.find((candidate) => candidate.day?.id === programDay.id)
  if (!entry) return programDay

  const source = Array.isArray(programDay.exercises) && programDay.exercises.length > 0
    ? programDay.exercises
    : entry.tasks.map((task) => task.slot)

  return {
    ...programDay,
    exercises: source.map((slot, index) => {
      const task = entry.tasks[index]
      if (!task) return slot
      if (task.done) return { ...slot, exerciseId: `${COMPLETED_SLOT_SENTINEL}${programDay.id}_${index}` }
      const prescribed = Number(task.prescribed ?? slot?.sets ?? 0)
      const logged = Number(task.logged ?? 0)
      const remaining = Math.max(1, prescribed - logged)
      return { ...slot, sets: remaining }
    }),
  }
}

function iconSvg(check = false) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('icon')
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  path.setAttribute('d', check ? 'M5 12.5 9.2 17 19 7' : 'M6 8h12M4 12h16M7 16h10')
  svg.append(path)
  return svg
}

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text
}

function progressText(row) {
  const base = `${row.logged} / ${row.prescribed} sets`
  if (row.done) return `${base} · complete`
  if (row.kind === 'rollover') return `Rolled from ${row.programDay?.name ?? row.programDay?.id ?? 'earlier'} · ${base}`
  if (row.started) return `${base} · in progress`
  const min = row.task.slot?.repMin
  const max = row.task.slot?.repMax
  return Number.isFinite(min) && Number.isFinite(max) ? `${base} · ${min}–${max} reps` : base
}

function slotPayload(row) {
  return {
    dayId: row.programDay.id,
    slotIndex: row.task.index,
    exerciseId: row.task.slot.exerciseId,
    slot: row.task.slot,
    alreadyLogged: row.task.logged,
  }
}

function workoutRow(row, app) {
  const node = document.createElement(row.done ? 'div' : 'button')
  node.className = 'today-item today-item--exercise today-workout-task'
  if (!row.done) node.type = 'button'
  node.dataset.dailyWorkoutTask = row.task.key ?? `${row.programDay.id}#${row.task.index}`
  node.dataset.rollover = String(row.kind === 'rollover')
  node.dataset.done = String(row.done)
  node.dataset.logged = String(row.logged)
  node.dataset.prescribed = String(row.prescribed)

  const glyph = document.createElement('span')
  glyph.className = 'today-item__icon'
  glyph.dataset.complete = String(row.done)
  glyph.dataset.attribute = 'might'
  glyph.append(iconSvg(row.done))

  const main = document.createElement('span')
  main.className = 'today-item__main'
  const name = document.createElement('span')
  name.className = 'today-item__name'
  name.textContent = row.name
  const meta = document.createElement('span')
  meta.className = 'today-item__meta'
  meta.textContent = progressText(row)
  main.append(name, meta)

  node.append(glyph, main)
  if (!row.done) {
    const cta = document.createElement('span')
    cta.className = 'today-item__cta'
    cta.textContent = row.started ? 'Continue' : 'Log sets'
    node.append(cta)
    node.addEventListener('click', () => app.startSession({ slotTask: slotPayload(row) }))
  }
  return node
}

function summaryText(queue) {
  if (queue.active.length === 0) {
    if (queue.completed.length > 0) return `${queue.completed.length} of ${queue.today.length} movements complete`
    return 'No workout scheduled today'
  }
  const rolled = queue.rollover.length
  return `${queue.active.length} movement${queue.active.length === 1 ? '' : 's'} left${rolled ? ` · ${rolled} rolled over` : ''}`
}

/**
 * Replace the week-aggregated Training presentation with the user's actual
 * daily workout checklist. Returns a cleanup function for setup reruns.
 */
export function installDailyWorkoutEnhancer({ mount, workout, app, clock }) {
  if (!mount || !workout || !app || !clock) return () => {}
  let scheduled = false
  let stopped = false

  async function enhance() {
    scheduled = false
    if (stopped) return
    const section = mount.querySelector('[data-section="training"]')
    if (!section) return

    const status = await workout.weekStatus()
    const queue = buildDailyWorkoutQueue(status, clock.today())
    const fingerprint = JSON.stringify(queue.active.map((row) => [row.programDay.id, row.task.index, row.logged, row.prescribed]))
      + '|' + JSON.stringify(queue.completed.map((row) => [row.programDay.id, row.task.index, row.logged]))
    if (section.dataset.dailyWorkoutFingerprint === fingerprint) return
    section.dataset.dailyWorkoutFingerprint = fingerprint

    setText(section.querySelector('.today-section__title'), 'Workout')
    setText(section.querySelector('.today-section__detail'), summaryText(queue))

    const header = section.querySelector('.today-section__head')
    let start = header?.querySelector('.today-section__start')
    if (queue.primaryDay) {
      if (!start) {
        start = document.createElement('button')
        start.type = 'button'
        start.className = 'today-section__start'
        header?.append(start)
      } else {
        // Replace the node so the old Today handler cannot start a different day.
        const replacement = start.cloneNode(false)
        start.replaceWith(replacement)
        start = replacement
      }
      const sessionDay = remainingProgramDay(status, queue.primaryDay)
      start.dataset.startDailyWorkout = queue.primaryDay.id
      start.textContent = 'Start full session'
      start.addEventListener('click', () => app.startSession({ programDay: sessionDay }))
    } else {
      start?.remove()
    }

    const body = section.querySelector('.today-training')
    if (!body) return
    body.replaceChildren()

    const rows = [...queue.active, ...queue.completed]
    if (rows.length > 0) {
      const list = document.createElement('div')
      list.className = 'today-list today-workout-list'
      for (const row of rows) list.append(workoutRow(row, app))
      body.append(list)
    } else {
      const empty = document.createElement('div')
      empty.className = 'today-empty'
      empty.textContent = 'No workout work is waiting today.'
      body.append(empty)
    }

    const hint = document.createElement('p')
    hint.className = 'today-training__hint'
    hint.textContent = 'Finish it in one session or knock out sets throughout the day. Unfinished movements roll forward through this workout week.'
    body.append(hint)
  }

  function schedule() {
    if (scheduled || stopped) return
    scheduled = true
    queueMicrotask(() => enhance().catch((error) => console.error('[tempered] daily workout surface failed', error)))
  }

  const observer = new MutationObserver(schedule)
  observer.observe(mount, { childList: true, subtree: true })
  schedule()
  return () => { stopped = true; observer.disconnect() }
}
