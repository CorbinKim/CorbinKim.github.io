// Footnotes in the visual editor. Milkdown's GFM preset already has the two
// nodes (footnote_reference: an inline marker, footnote_definition: the note at
// the end); what was missing is any way to create them and to keep their numbers
// right. This file adds:
//   * a plugin that keeps labels 1..n in the order the markers appear in the
//     text, keeps the notes at the end sorted to match, and drops a note whose
//     marker was deleted (the site numbers footnotes the same way);
//   * clicking a marker jumps to its note, clicking a note's number jumps back.
// Output is plain GFM: "text[^1]" and "[^1]: note", rendered by remark-gfm.
import {Plugin, TextSelection} from "@milkdown/kit/prose/state";
import {$prose} from "@milkdown/kit/utils";

const REF = "footnote_reference";
const DEF = "footnote_definition";

/** Positions of every marker and note in `doc`. */
function collect(doc) {
  const refs = [];
  const defs = [];
  doc.descendants((node, pos) => {
    if (node.type.name === REF) refs.push({pos, node});
    else if (node.type.name === DEF) {
      defs.push({pos, node});
      return false; // notes hold plain blocks; no markers inside
    }
    return true;
  });
  return {refs, defs};
}

/** Where notes belong: the end of the content, in front of the empty paragraph
 *  the editor keeps at the very end of a document (it re-adds one whenever the
 *  last block is not a paragraph, so notes placed after it would be moved again
 *  and again). */
function contentEnd(doc) {
  let pos = doc.content.size;
  for (let i = doc.childCount - 1; i >= 0; i--) {
    const child = doc.child(i);
    if (child.type.name === "paragraph" && child.content.size === 0)
      pos -= child.nodeSize;
    else break;
  }
  return pos;
}

/** One transaction that numbers markers by first appearance, relabels and
 *  re-sorts the notes, and removes orphans; null when nothing needs fixing. */
export function normalize(state) {
  const {refs, defs} = collect(state.doc);
  if (!refs.length && !defs.length) return null;

  const numbering = new Map(); // old label -> "1", "2", ... by first appearance
  for (const {node} of refs)
    if (!numbering.has(node.attrs.label))
      numbering.set(node.attrs.label, String(numbering.size + 1));

  const tr = state.tr;
  let changed = false;
  for (const {pos, node} of refs) {
    const to = numbering.get(node.attrs.label);
    if (to !== node.attrs.label) {
      tr.setNodeAttribute(pos, "label", to);
      changed = true;
    }
  }

  // notes that still have a marker, in the order they should appear
  const wanted = defs
    .filter(({node}) => numbering.has(node.attrs.label))
    .map(({node}) => ({node, label: numbering.get(node.attrs.label)}))
    .sort((a, b) => Number(a.label) - Number(b.label));
  const orphaned = defs.length !== wanted.length;

  // already fine when the notes are one run ending at the content end, in order
  const end = contentEnd(state.doc);
  const tail = defs.every(
    ({pos, node}, i) =>
      pos + node.nodeSize === (defs[i + 1] ? defs[i + 1].pos : end)
  );
  const sorted = defs.every(
    ({node}, i) => wanted[i] && wanted[i].node === node
  );

  if (orphaned || !tail || !sorted) {
    // delete every note (last first, so earlier positions stay valid) ...
    for (const {pos, node} of [...defs].reverse())
      tr.delete(pos, pos + node.nodeSize);
    // ... and write the wanted ones back at the end
    const fresh = wanted.map(({node, label}) =>
      node.type.create({...node.attrs, label}, node.content)
    );
    if (fresh.length) tr.insert(contentEnd(tr.doc), fresh);
    changed = true;
  } else {
    for (const {pos, node} of defs) {
      const to = numbering.get(node.attrs.label);
      if (to !== node.attrs.label) {
        tr.setNodeAttribute(pos, "label", to);
        changed = true;
      }
    }
  }
  return changed ? tr : null;
}

/** Put the caret inside the note labelled `label`. */
export function focusNote(view, label) {
  const {defs} = collect(view.state.doc);
  const target = defs.find(d => d.node.attrs.label === label);
  if (!target) return false;
  const inside = TextSelection.near(view.state.doc.resolve(target.pos + 2));
  view.dispatch(view.state.tr.setSelection(inside).scrollIntoView());
  view.focus();
  return true;
}

/** Insert a marker at the caret and a matching empty note at the end; the caret
 *  moves into the note, ready to type. Returns false when the caret is not in
 *  running text. */
export function insertFootnote(view) {
  const {state} = view;
  const ref = state.schema.nodes[REF];
  const def = state.schema.nodes[DEF];
  if (!ref || !def || !state.selection.$to.parent.inlineContent) return false;
  // a note cannot hold another footnote
  const {$to} = state.selection;
  for (let d = $to.depth; d > 0; d--)
    if ($to.node(d).type === def) return false;

  const at = state.selection.to;
  // a label nobody uses yet; normalize() turns it into the right number
  const provisional = "new";
  const tr = state.tr.insert(at, ref.create({label: provisional}));
  tr.insert(
    contentEnd(tr.doc),
    def.create({label: provisional}, state.schema.nodes.paragraph.create())
  );
  view.dispatch(tr);
  // the plugin has renumbered by now: read the marker's real label back
  const label = view.state.doc.nodeAt(at)?.attrs.label;
  return label ? focusNote(view, label) : false;
}

export const footnotePlugin = $prose(
  () =>
    new Plugin({
      appendTransaction: (_transactions, _oldState, newState) =>
        normalize(newState),
      props: {
        handleClickOn(view, _pos, node, nodePos, event) {
          if (node.type.name === REF) return focusNote(view, node.attrs.label);
          // the number of a note (<dt>) jumps back to its marker
          if (node.type.name === DEF && event.target?.tagName === "DT") {
            const {refs} = collect(view.state.doc);
            const marker = refs.find(
              r => r.node.attrs.label === node.attrs.label
            );
            if (!marker) return false;
            view.dispatch(
              view.state.tr
                .setSelection(
                  TextSelection.near(view.state.doc.resolve(marker.pos + 1))
                )
                .scrollIntoView()
            );
            view.focus();
            return true;
          }
          return false;
        }
      }
    })
);
