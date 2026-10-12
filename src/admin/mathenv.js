// LaTeX equations as in Overleaf, inside the visual editor (see plugins/math-env.js
// for the rules and why). Three pieces:
//
//  * remark: an inline `$$\begin{equation}...$$` on a line of its own is read as
//    the editor's math block (a "LaTeX" code block);
//  * parser: every Markdown string the editor parses (opening a story, switching
//    from Markdown mode, pasting text) first has bare \begin{equation}...\end{...}
//    blocks wrapped in $$, so pasted Overleaf code arrives intact;
//  * a transaction rule: what is typed (or edited in the inline-math popup) and
//    turns out to be one complete environment becomes a math block on the spot.
import {ParserReady, parserCtx} from "@milkdown/kit/core";
import {Plugin, TextSelection} from "@milkdown/kit/prose/state";
import {$prose, $remark} from "@milkdown/kit/utils";
import {
  isMathEnvironment,
  remarkMathEnvironments,
  wrapRawEnvironments
} from "../../plugins/math-env.js";

const BEGIN = /^\s*\\begin\{[a-z]+\*?\}/;
const MAX_LINES = 80; // paragraphs scanned for the matching \end

const remarkPlugin = $remark(
  "mathEnvironments",
  () => () => remarkMathEnvironments({asCode: true})
);

/** Milkdown plugin: wrap the editor's Markdown parser (see the header). */
const parserWrap = ctx => async () => {
  await ctx.wait(ParserReady);
  ctx.update(parserCtx, parse => text => parse(wrapRawEnvironments(text)));
};

/** The text of a paragraph made only of text and line breaks, else null. */
function plainText(paragraph) {
  let text = "";
  let plain = true;
  paragraph.forEach(child => {
    if (child.isText) text += child.text;
    else if (child.type.name === "hardbreak") text += "\n";
    else plain = false;
  });
  return plain ? text : null;
}

/** The environment a single paragraph holds, if it is exactly one. */
function environmentIn(paragraph, schema) {
  const kids = [];
  paragraph.forEach(c => {
    if (!(c.isText && !c.text.trim())) kids.push(c);
  });
  const inline = schema.nodes.math_inline;
  if (
    inline &&
    kids.length === 1 &&
    kids[0].type === inline &&
    isMathEnvironment(kids[0].attrs.value)
  )
    return kids[0].attrs.value.trim();
  const text = plainText(paragraph);
  return text !== null && isMathEnvironment(text) ? text.trim() : null;
}

/** Ranges {from, to, value} of paragraphs (one, or several typed with Enter
 *  between the lines) that together are one complete environment. */
function findEnvironments(doc, schema) {
  const paragraph = schema.nodes.paragraph;
  const hits = [];
  const scan = (parent, base) => {
    const kids = [];
    parent.forEach((child, offset) => kids.push({child, pos: base + offset}));
    for (let i = 0; i < kids.length; i++) {
      const {child, pos} = kids[i];
      if (child.type !== paragraph) continue;
      const single = environmentIn(child, schema);
      if (single) {
        hits.push({from: pos, to: pos + child.nodeSize, value: single});
        continue;
      }
      let value = plainText(child);
      if (value === null || !BEGIN.test(value)) continue;
      for (let j = i + 1; j < kids.length && j <= i + MAX_LINES; j++) {
        const next = kids[j];
        const line =
          next.child.type === paragraph ? plainText(next.child) : null;
        if (line === null) break;
        value += "\n" + line;
        if (isMathEnvironment(value)) {
          hits.push({
            from: pos,
            to: next.pos + next.child.nodeSize,
            value: value.trim()
          });
          i = j;
          break;
        }
      }
    }
  };
  scan(doc, 0);
  doc.descendants((node, pos) => {
    if (node.isBlock && !node.isTextblock && node.childCount)
      scan(node, pos + 1);
  });
  return hits;
}

const rule = $prose(
  () =>
    new Plugin({
      appendTransaction(transactions, _oldState, state) {
        if (!transactions.some(t => t.docChanged)) return null;
        const {schema} = state;
        const block = schema.nodes.code_block;
        if (!block) return null;
        const hits = findEnvironments(state.doc, schema);
        if (!hits.length) return null;

        const {from: selFrom} = state.selection;
        const tr = state.tr;
        let caretAt = -1;
        for (const hit of hits.sort((a, b) => b.from - a.from)) {
          tr.replaceWith(
            hit.from,
            hit.to,
            block.create({language: "LaTeX"}, schema.text(hit.value))
          );
          // the caret was in that text: continue inside the new block
          if (selFrom >= hit.from && selFrom <= hit.to && caretAt < 0)
            caretAt = hit.from + 1 + hit.value.length;
        }
        if (caretAt >= 0)
          tr.setSelection(TextSelection.near(tr.doc.resolve(caretAt)));
        return tr;
      }
    })
);

/** The plugins to `editor.use(...)`, after Crepe's own. */
export const mathEnvironments = [remarkPlugin, parserWrap, rule].flat();
