// Size and alignment of a picture, stored in the image URL's fragment so the
// Markdown stays plain:  /img/blog/x/a.png#w=50,align=center
// (plugins/rehype-figure.js turns it into styles on the site; the editor shows it
// with a decoration). Pure functions, no DOM: unit-tested in test/imageopts.test.js.

export const SIZES = [33, 50, 75, 100];
export const ALIGNS = ["left", "center", "right"];
export const MIN_WIDTH = 10; // percent; the same bounds the site accepts

/** A dragged width (percent) kept inside the allowed range, and snapped to the
 *  toolbar's presets (33 / 50 / 75 / 100) when it lands within 3 points of one,
 *  so "half width" is easy to hit by hand. */
export function snapWidth(percent) {
  const p = Math.round(Number(percent));
  if (!Number.isFinite(p)) return 0;
  const clamped = Math.min(100, Math.max(MIN_WIDTH, p));
  return SIZES.find(s => Math.abs(s - clamped) <= 3) ?? clamped;
}

/** New width in percent while a corner is dragged `dx` pixels (to the right is
 *  positive). The edge you hold follows the pointer: a centered picture grows on
 *  both sides, so it needs twice the width change. `side` is the held corner. */
export function dragWidth({startPx, containerPx, dx, side, centered}) {
  if (!(containerPx > 0) || !(startPx > 0)) return 0;
  const grow = (side === "left" ? -dx : dx) * (centered ? 2 : 1);
  return snapWidth(((startPx + grow) / containerPx) * 100);
}

/** Which corners of a picture can be dragged: the side opposite the one the
 *  picture is anchored to (left / none: right corner; right: left corner;
 *  centered: both). */
export function handleSides(align) {
  if (align === "right") return ["left"];
  if (align === "center") return ["left", "right"];
  return ["right"];
}

const FRAGMENT = /#(?=[^#]*\b(?:w|align)=)([^#]*)$/;

/** @returns {{base: string, w: number, align: string}} w 0 / align "" = unset */
export function splitImageSrc(src) {
  const value = String(src ?? "");
  const m = FRAGMENT.exec(value);
  if (!m) return {base: value, w: 0, align: ""};
  const params = {};
  for (const pair of m[1].split(/[,&;]/)) {
    const i = pair.indexOf("=");
    if (i > 0) params[pair.slice(0, i)] = pair.slice(i + 1);
  }
  const w = /^\d{1,3}$/.test(params.w || "") ? Number(params.w) : 0;
  const align = params.align;
  return {
    base: value.slice(0, m.index),
    w: w >= 10 && w <= 100 ? w : 0,
    align: ALIGNS.includes(align) ? align : ""
  };
}

/** @param {{w?: number, align?: string}} opts  falsy values are left out */
export function joinImageSrc(base, {w, align} = {}) {
  const parts = [];
  if (w) parts.push(`w=${w}`);
  if (align) parts.push(`align=${align}`);
  // commas, not "&": Markdown escapes "&" in a URL as "\\&"
  return parts.length ? `${base}#${parts.join(",")}` : base;
}

/** The path without the editor's fragment: what the file store is keyed by. */
export const imageBase = src => splitImageSrc(src).base;

/** Inline style that shows the options on the editor's image block. */
export function editorStyle({w, align}) {
  const parts = [];
  if (w) parts.push(`width:${w}%`);
  else if (align) parts.push("width:fit-content");
  parts.push("max-width:100%");
  if (align === "left") parts.push("margin-left:0;margin-right:auto");
  else if (align === "right") parts.push("margin-left:auto;margin-right:0");
  else if (align === "center") parts.push("margin-left:auto;margin-right:auto");
  return parts.join(";");
}
