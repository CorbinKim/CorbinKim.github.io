// Shared UI pieces: top bar, toasts, modal dialog.
import {h} from "./dom.js";

export function topBar({left, status, right}) {
  return h(
    "header",
    {class: "bar"},
    left,
    status || h("span", {class: "bar-spacer"}),
    h("div", {class: "bar-actions"}, right)
  );
}

export function brandLink() {
  return h("a", {class: "bar-brand", href: "#/"}, "Corbin Kim · Write");
}

// ---- toasts -------------------------------------------------------------------

let toastHost = null;

export function toast(message, kind = "info", ms = 5000) {
  if (!toastHost) {
    toastHost = h("div", {
      class: "toasts",
      role: "status",
      "aria-live": "polite"
    });
    document.body.append(toastHost);
  }
  const el = h(
    "div",
    {
      class:
        "toast" +
        (kind === "error" ? " is-error" : kind === "hint" ? " is-hint" : "")
    },
    message
  );
  toastHost.append(el);
  setTimeout(() => el.remove(), kind === "error" ? Math.max(ms, 8000) : ms);
}

// ---- modal dialog ----------------------------------------------------------------

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal dialog. Escape and a click on the backdrop close it unless
 *  canClose() says no; the page behind does not scroll; Tab stays inside; focus
 *  goes back to the element that opened it. A route change closes it too (the
 *  story it was about is gone) - canClose() permitting. */
export function createDialog({
  title,
  canClose = () => true,
  onClose,
  returnFocus
}) {
  const heading = h("h2", {id: "dialog-title"}, title);
  const body = h("div");
  const actions = h("div", {class: "actions"});
  const box = h(
    "div",
    {
      class: "dialog",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "dialog-title",
      tabIndex: -1
    },
    heading,
    body,
    actions
  );
  const overlay = h("div", {class: "overlay"}, box);
  // Safari does not focus a <button> when it is clicked, so activeElement is
  // usually <body> here: callers say where focus should return to.
  const previouslyFocused = returnFocus || document.activeElement;
  const previousOverflow = document.body.style.overflow;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("hashchange", onRoute);
    document.body.style.overflow = previousOverflow;
    if (previouslyFocused?.isConnected) previouslyFocused.focus?.();
    onClose?.();
  }
  function onKey(e) {
    if (e.key === "Escape" && canClose()) {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      const items = [...box.querySelectorAll(FOCUSABLE)].filter(
        el => el.offsetParent !== null
      );
      if (!items.length) {
        e.preventDefault();
        box.focus();
      } else if (!box.contains(document.activeElement)) {
        e.preventDefault();
        items[0].focus();
      } else if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
        e.preventDefault();
        items[0].focus();
      }
    }
  }
  function onRoute() {
    if (canClose()) close();
  }
  overlay.addEventListener("mousedown", e => {
    if (e.target === overlay && canClose()) close();
  });
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("hashchange", onRoute);
  document.body.style.overflow = "hidden";
  document.body.append(overlay);
  box.focus();

  return {
    box,
    body,
    actions,
    close,
    setTitle: text => (heading.textContent = text)
  };
}
