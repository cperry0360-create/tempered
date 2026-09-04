/**
 * The smallest DOM helpers that make hand-written views readable.
 *
 * No framework, per CLAUDE.md. These exist so screen code reads as structure
 * rather than as a wall of createElement calls.
 */

/**
 * @param {string} tag  Optionally with classes: 'div.card.is-open'
 * @param {object|null} [props]
 * @param {(Node|string|null|false|undefined)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = null, children = []) {
  const [name, ...classes] = tag.split('.')
  const node = document.createElement(name)
  if (classes.length) node.className = classes.join(' ')

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue
    if (key === 'class') node.className = `${node.className} ${value}`.trim()
    else if (key === 'text') node.textContent = String(value)
    else if (key === 'html') node.innerHTML = String(value)
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value)
    } else if (key === 'dataset') Object.assign(node.dataset, value)
    else if (key in node && key !== 'list') node[key] = value
    else node.setAttribute(key, String(value))
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

/** @param {HTMLElement} node @param {(Node|string|null|false)[]} children */
export function replace(node, children) {
  node.replaceChildren()
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

/** @param {string} selector @param {ParentNode} [root] */
export const qs = (selector, root = document) => root.querySelector(selector)

/** @param {string} selector @param {ParentNode} [root] */
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)]
