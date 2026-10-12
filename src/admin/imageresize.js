// Drag a picture's corner to resize it (Medium style). The width is stored the
// same way as the toolbar's size menu, as a percentage in the image URL's
// fragment (imageopts.js), so the site and the live preview need nothing new.
//
// The corner squares are CSS pseudo-elements of .image-wrapper (editor.css): the
// Crepe image block is a framework-rendered node view, so extra DOM inside it
// could be wiped on its next render. This plugin only hit-tests the pointer
// against where those squares are drawn. Keep HANDLE_* in sync with editor.css.
import {NodeSelection, Plugin} from "@milkdown/kit/prose/state";
import {$prose} from "@milkdown/kit/utils";
import {
  dragWidth,
  handleSides,
  joinImageSrc,
  splitImageSrc
} from "./imageopts.js";

const HANDLE_INSET = 8; // px from the picture's edge (editor.css .image-wrapper::before/after)
const HANDLE_SIZE = 14;
const GRAB = 4; // extra px around the drawn square that still grabs it

/** Which corner of the picture under the event is being grabbed, if any. */
function cornerAt(event) {
  const block = event.target?.closest?.(".milkdown-image-block");
  const wrapper = block?.querySelector(".image-wrapper");
  if (!wrapper || event.button !== 0) return null;
  const r = wrapper.getBoundingClientRect();
  const near = HANDLE_INSET + HANDLE_SIZE + GRAB;
  const far = HANDLE_INSET - GRAB;
  const inBottom =
    event.clientY >= r.bottom - near && event.clientY <= r.bottom - far;
  if (!inBottom) return null;
  const align = block.dataset.align || "";
  for (const side of handleSides(align)) {
    const x =
      side === "left" ? event.clientX - r.left : r.right - event.clientX;
    if (x >= far && x <= near) return {block, side, align};
  }
  return null;
}

/** Document position of the image-block whose DOM is `block`. */
function posOf(view, block) {
  let found = -1;
  view.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === "image-block" && view.nodeDOM(pos) === block) {
      found = pos;
      return false;
    }
  });
  return found;
}

function startResize(view, event, {block, side, align}) {
  event.preventDefault();
  event.stopPropagation();

  const parent = block.parentElement;
  const cs = getComputedStyle(parent);
  const containerPx =
    parent.clientWidth -
    parseFloat(cs.paddingLeft || "0") -
    parseFloat(cs.paddingRight || "0");
  const startPx = block.getBoundingClientRect().width;
  const startX = event.clientX;
  // inline state we borrow while dragging; the decoration restores the real one
  const savedStyle = block.getAttribute("style");
  const wasSized = block.hasAttribute("data-sized");
  let width = 0;

  const label = w => `${w}%`;
  const onMove = e => {
    // the release was missed (e.g. it happened outside the window)
    if (e.buttons === 0) return finish(true);
    const w = dragWidth({
      startPx,
      containerPx,
      dx: e.clientX - startX,
      side,
      centered: align === "center"
    });
    if (!w) return;
    width = w;
    block.setAttribute("data-sized", "1");
    block.style.width = label(w);
    block.style.maxWidth = "100%";
    block.setAttribute("data-resizing", label(w));
  };
  const restore = () => {
    if (savedStyle == null) block.removeAttribute("style");
    else block.setAttribute("style", savedStyle);
    if (!wasSized) block.removeAttribute("data-sized");
    block.removeAttribute("data-resizing");
  };
  const finish = commit => {
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("mouseup", onUp, true);
    window.removeEventListener("keydown", onKey, true);
    document.documentElement.classList.remove("is-resizing-picture");
    restore();
    if (!commit || !width) return;
    const pos = posOf(view, block);
    if (pos < 0) return;
    const node = view.state.doc.nodeAt(pos);
    const {base, ...current} = splitImageSrc(node.attrs.src);
    if (current.w === width) return;
    const {state} = view;
    const tr = state.tr.setNodeAttribute(
      pos,
      "src",
      joinImageSrc(base, {...current, w: width})
    );
    // select the picture, like a click: the toolbar then shows its size
    // (the selection must belong to the document after the change)
    view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
  };
  const onUp = e => {
    e.preventDefault();
    e.stopPropagation();
    finish(true);
  };
  const onKey = e => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    finish(false);
  };

  document.documentElement.classList.add("is-resizing-picture");
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("mouseup", onUp, true);
  window.addEventListener("keydown", onKey, true);
}

export const pictureResize = $prose(
  () =>
    new Plugin({
      props: {
        handleDOMEvents: {
          // The picture block is draggable (moving it): a press on a corner must
          // resize instead, so claim the press before ProseMirror sees it.
          mousedown(view, event) {
            if (!view.editable) return false;
            const corner = cornerAt(event);
            if (!corner) return false;
            startResize(view, event, corner);
            return true;
          },
          dragstart(_view, event) {
            if (
              !document.documentElement.classList.contains(
                "is-resizing-picture"
              )
            )
              return false;
            event.preventDefault();
            return true;
          }
        }
      }
    })
);
