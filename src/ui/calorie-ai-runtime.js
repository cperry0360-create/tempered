export const CALORIE_PHOTO_PROMPT = `Estimate the total calories in the food and drink visible in the attached meal photo or photos for my Tempered food log.

Use any readable nutrition labels or menu information in the image. Otherwise estimate realistic portion sizes from what is visible. Include sauces, dressings, cooking oil, drinks, and sides when they appear. Do not ask follow-up questions. If there is uncertainty, choose one reasonable midpoint estimate rather than returning a range.

Return exactly ONE Markdown fenced code block and nothing outside it. Do not add a language label to the code fence. Inside the code block put exactly one line in this format:
TEMPERED_CALORIES=<whole-number calories>

The fenced code block is required so the result has a one-tap Copy button.`

export function parseTemperedCalories(text) {
  const raw = String(text ?? '').trim()
  const tagged = raw.match(/TEMPERED_CALORIES\s*[:=]\s*([0-9]{1,5})/i)
  if (tagged) return Number(tagged[1])
  if (/^[0-9]{1,5}(?:\s*(?:kcal|calories?))?$/i.test(raw)) return Number(raw.match(/[0-9]{1,5}/)?.[0])
  return null
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* fall through to legacy copy */ }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand?.('copy') === true
  textarea.remove()
  return copied
}

function makeButton(className, text, label) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = text
  button.setAttribute('aria-label', label)
  return button
}

/**
 * Provider-neutral photo calorie handoff. Tempered never uploads the photo or
 * embeds an AI provider key: the user copies a prompt, uses the AI app of their
 * choice, copies its one-line result, then pastes that result back into Calories.
 */
export function installCalorieAiRuntime() {
  const mount = document.getElementById('app')
  if (!mount) return () => {}
  let scheduled = false

  const schedule = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      enhance()
    })
  }

  function status(editor, message, state = '') {
    let node = editor.querySelector('[data-calorie-ai="status"]')
    if (!node) {
      node = document.createElement('span')
      node.className = 'today-editor__hint calorie-ai__status'
      node.dataset.calorieAi = 'status'
      editor.append(node)
    }
    node.dataset.state = state
    node.textContent = message
  }

  async function pasteResult(editor) {
    const input = editor.querySelector('[data-entry="calories_logged"]')
    const save = editor.querySelector('[data-action="log"]')
    if (!input || !save) return

    if (!navigator.clipboard?.readText) {
      input.focus()
      status(editor, 'Paste the AI result here, then tap Add.', 'manual')
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      const calories = parseTemperedCalories(text)
      if (calories === null) {
        input.focus()
        status(editor, 'Could not find TEMPERED_CALORIES in the clipboard. Paste it into the box.', 'error')
        return
      }
      input.value = String(calories)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      status(editor, `Adding ${calories} kcal from the copied AI result…`, 'ready')
      save.click()
    } catch {
      input.focus()
      status(editor, 'Clipboard access was blocked. Paste the AI result here, then tap Add.', 'manual')
    }
  }

  function enhance() {
    const wrap = mount.querySelector('[data-activity="calories_logged"]')
    if (!wrap) return
    const row = wrap.querySelector('.today-item--number')
    if (row && !row.querySelector('[data-calorie-ai="prompt"]')) {
      const quick = row.querySelector('.today-item__quick')
      if (quick) quick.hidden = true
      const expand = row.querySelector('.today-item__expand')
      const button = makeButton('today-item__ai-prompt', 'COPY AI PROMPT', 'Copy AI meal-photo calorie prompt')
      button.dataset.calorieAi = 'prompt'
      button.onclick = async (event) => {
        event.stopPropagation()
        const copied = await copyText(CALORIE_PHOTO_PROMPT)
        button.textContent = copied ? 'PROMPT COPIED' : 'COPY FAILED'
        button.dataset.copied = String(copied)
        window.setTimeout(() => {
          if (!button.isConnected) return
          button.textContent = 'COPY AI PROMPT'
          delete button.dataset.copied
        }, 1800)
      }
      row.insertBefore(button, expand ?? null)
    }

    const editor = wrap.querySelector('[data-editor="calories_logged"]')
    if (editor && !editor.querySelector('[data-calorie-ai="paste"]')) {
      const button = makeButton('today-editor__ai-paste', 'PASTE AI RESULT', 'Paste AI calorie result and add it')
      button.dataset.calorieAi = 'paste'
      button.onclick = () => pasteResult(editor)
      editor.append(button)
      status(editor, 'Photo flow: copy prompt → attach meal photo in your AI app → tap Copy on its code block → paste here.')
    }
  }

  const observer = new MutationObserver(schedule)
  observer.observe(mount, { childList: true, subtree: true })
  schedule()
  return () => observer.disconnect()
}
