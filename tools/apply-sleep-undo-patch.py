from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'expected block not found in {path}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/ui/screens/today.js',
    """function valueLabel(activity, value) {\n  if (value === true || value === null || value === undefined) return 'Logged'\n  const unit = unitLabel(activity)\n  return `${value}${unit ? ` ${unit}` : ''}`\n}\n""",
    """function valueLabel(activity, value) {\n  if (value === true || value === null || value === undefined) return 'Logged'\n  const shown = activity?.id === 'sleep' && typeof value === 'number'\n    ? Number(value.toFixed(2))\n    : value\n  const unit = unitLabel(activity)\n  return `${shown}${unit ? ` ${unit}` : ''}`\n}\n""",
)

replace_once(
    'src/ui/screens/today.js',
    """  function editor(activity, weekly = null) {\n    const adding = isAdditiveNumber(activity)\n    const unit = unitLabel(activity)\n    const input = el('input.today-editor__input', {\n      type: 'text', inputmode: 'decimal',\n      placeholder: adding ? `Add ${unit || 'amount'}` : (unit || 'Value'),\n      'aria-label': `${adding ? 'Add to' : 'Log'} ${activity.name}${activity.unit ? `, ${activity.unit}` : ''}`,\n      dataset: { entry: activity.id },\n      disabled: !canLogSelected(),\n      onkeydown: (event) => {\n        if (event.key === 'Enter') {\n          event.preventDefault()\n          record(activity, input.value)\n        }\n      },\n    })\n""",
    """  function editor(activity, weekly = null) {\n    const adding = isAdditiveNumber(activity)\n    const unit = unitLabel(activity)\n    const sleep = activity.id === 'sleep'\n    const input = el('input.today-editor__input', {\n      type: sleep ? 'number' : 'text', inputmode: 'decimal',\n      ...(sleep ? {\n        min: '0', max: '24', step: '0.1',\n        value: typeof activity.value === 'number' ? String(activity.value) : '',\n      } : {}),\n      placeholder: sleep ? 'Hours, e.g. 7.5' : (adding ? `Add ${unit || 'amount'}` : (unit || 'Value')),\n      'aria-label': `${adding ? 'Add to' : 'Log'} ${activity.name}${activity.unit ? `, ${activity.unit}` : ''}`,\n      dataset: { entry: activity.id },\n      disabled: !canLogSelected(),\n      onkeydown: (event) => {\n        if (event.key === 'Enter') {\n          event.preventDefault()\n          record(activity, input.value)\n        }\n      },\n    })\n""",
)

replace_once(
    'src/ui/screens/today.js',
    """    return el('div.today-editor', { dataset: { editor: activity.id } }, [\n      el('div.today-editor__manual', {}, [\n""",
    """    return el('div.today-editor', { dataset: { editor: activity.id } }, [\n      sleep && el('div.today-editor__quick.today-editor__quick--sleep', { 'aria-label': 'Common sleep amounts' },\n        [6.5, 7, 7.5, 8, 8.5].map((hours) => el('button.today-editor__chip', {\n          type: 'button',\n          dataset: { sleepquick: String(hours) },\n          onclick: () => { input.value = String(hours); input.focus() },\n        }, [`${hours} h`]))),\n      el('div.today-editor__manual', {}, [\n""",
)

replace_once(
    'src/ui/screens/today.js',
    """      presetInput && el('span.today-editor__hint', {\n        text: preset === null\n          ? 'Save an amount to turn SET + into a one-tap add.'\n          : `The green button adds ${preset}${unit ? ` ${unit}` : ''} in one tap.`,\n      }),\n      weekly && el('span.today-editor__hint', { text: statusFor(activity, weekly) }),\n""",
    """      sleep && el('span.today-editor__hint', {\n        text: 'Decimals are hours: 7.5 = 7 h 30 m · 7.75 = 7 h 45 m.',\n      }),\n      presetInput && el('span.today-editor__hint', {\n        text: preset === null\n          ? 'Save an amount to turn SET + into a one-tap add.'\n          : `The green button adds ${preset}${unit ? ` ${unit}` : ''} in one tap.`,\n      }),\n      weekly && el('span.today-editor__hint', { text: statusFor(activity, weekly) }),\n""",
)

replace_once(
    'src/ui/screens/session.js',
    """    const check = el('button.setrow__check', {\n      type: 'button', disabled: done,\n      'aria-label': done ? `Set ${index + 1} logged` : `Log set ${index + 1}`,\n      dataset: { log: `${entry.exercise.id}:${index}`, ...(active ? { acid: 'active' } : {}) },\n      onclick: async () => {\n        for (const input of inputs) {\n          if (input.dataset?.field) set[input.dataset.field] = numberOrNull(input.value)\n        }\n        const logged = {\n          exerciseId: entry.exercise.id,\n          weight: set.weight ?? null, reps: set.reps ?? null,\n          timeSec: set.timeSec ?? null, distance: set.distance ?? null,\n          perSide: set.perSide === true,\n          substitutedFor: entry.substitutedFor ?? null,\n          programDayId: entry.programDayId ?? null,\n          slotIndex: entry.slotIndex ?? null,\n          setIndex: index,\n        }\n        const log = await workout.logSet(session, logged)\n        // The stored record, not the object we sent: it carries `completedAt`,\n        // which is what docs/11 F1 measures the session's duration from.\n        loggedHere.push(log)\n        set.logged = true\n        set.logId = log.id\n        render()\n        startRest(entry)\n      },\n    }, [icon('check')])\n""",
    """    const check = el('button.setrow__check', {\n      type: 'button',\n      'aria-label': done ? `Undo set ${index + 1}` : `Log set ${index + 1}`,\n      dataset: {\n        log: `${entry.exercise.id}:${index}`,\n        done: String(done),\n        ...(active ? { acid: 'active' } : {}),\n      },\n      onclick: async () => {\n        if (done) {\n          const wasLatestLogged = entry.sets.findLastIndex((other) => other.logged === true) === index\n          if (set.logId) {\n            await workout.removeSet(set.logId)\n            loggedHere = loggedHere.filter((log) => log.id !== set.logId)\n          }\n          set.logged = false\n          set.logId = null\n          if (wasLatestLogged && rest?.exerciseId === entry.exercise.id) rest = null\n          persistDraft()\n          render()\n          return\n        }\n\n        for (const input of inputs) {\n          if (input.dataset?.field) set[input.dataset.field] = numberOrNull(input.value)\n        }\n        const logged = {\n          exerciseId: entry.exercise.id,\n          weight: set.weight ?? null, reps: set.reps ?? null,\n          timeSec: set.timeSec ?? null, distance: set.distance ?? null,\n          perSide: set.perSide === true,\n          substitutedFor: entry.substitutedFor ?? null,\n          programDayId: entry.programDayId ?? null,\n          slotIndex: entry.slotIndex ?? null,\n          setIndex: index,\n        }\n        const log = await workout.logSet(session, logged)\n        // The stored record, not the object we sent: it carries `completedAt`,\n        // which is what docs/11 F1 measures the session's duration from.\n        loggedHere.push(log)\n        set.logged = true\n        set.logId = log.id\n        render()\n        startRest(entry)\n      },\n    }, [icon('check')])\n""",
)

replace_once(
    'src/version.js',
    "export const VERSION = '0.13.1 (8)'",
    "export const VERSION = '0.13.2 (8)'",
)

replace_once(
    'index.html',
    '<script type="module" src="./src/main.js?v=0.13.1"></script>',
    '<script type="module" src="./src/main.js?v=0.13.2"></script>',
)

print('sleep + set undo patch applied')
