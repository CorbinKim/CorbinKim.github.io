// Tiny DOM helpers. Everything is built with createElement / textContent -
// never innerHTML - so nothing a post or an API response contains can inject
// markup into the page that holds the GitHub token.

const ATTR_ONLY = new Set(["list", "form", "for", "role"]);

/** h("button", {class: "btn", onclick: fn, disabled: true}, "Label", child) */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function")
      el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key.startsWith("aria-") || ATTR_ONLY.has(key))
      el.setAttribute(key, value === true ? "" : value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).length === 10 ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

/** Enter that merely confirms an IME composition must not count as Enter.
 *  Safari fires that keydown AFTER compositionend, with isComposing already
 *  false but keyCode 229 - so check both. */
export function isImeEnter(e) {
  return e.isComposing || e.keyCode === 229;
}

/** Auto-growing <textarea> (title / subtitle). */
export function autoGrow(el) {
  const fit = () => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  el.addEventListener("input", fit);
  return fit;
}
