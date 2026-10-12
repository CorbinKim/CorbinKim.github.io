// Can a hand-written .mdx post be edited visually without losing anything?
//
// The visual editor only knows Markdown. An .mdx post may also hold JSX
// components, import/export lines and {expressions}, which the editor would drop
// or escape into plain text. A post that uses none of them is just Markdown
// (+ math, tables, code ...) and is safe to open in the visual editor; saving it
// keeps the .mdx extension (the editor escapes { } < so the result still
// compiles as MDX, see editor.js).
//
// Pure module (no DOM), unit-tested in test/mdxcheck.test.js. Deliberately
// conservative: when in doubt the post stays Markdown-only.
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import {unified} from "unified";

const parser = unified().use(remarkParse).use(remarkMath).use(remarkGfm);

// { or } not escaped with a backslash (an escaped brace is plain text in MDX)
const BARE_BRACE = /(^|[^\\])[{}]/;
// MDX "ESM": an import/export line at the start of a block
const ESM = /^(import|export)\s/;

/** @param {string} body  the post's Markdown, without its front matter */
export function isPlainMdx(body) {
  const source = String(body ?? "");
  let tree;
  try {
    tree = parser.parse(source);
  } catch {
    return false;
  }
  const risky = node => {
    // raw HTML in plain Markdown is where JSX (<Callout>...) and comments land
    if (node.type === "html") return true;
    if (node.type === "text") {
      const {start, end} = node.position ?? {};
      const raw =
        start && end ? source.slice(start.offset, end.offset) : node.value;
      // (a doubled backslash escapes itself, not the brace after it)
      if (BARE_BRACE.test(raw.replace(/\\\\/g, ""))) return true; // {expression}
    }
    return (node.children ?? []).some(risky);
  };
  if (risky(tree)) return false;
  // import/export must start a top-level block
  return !tree.children.some(
    block =>
      block.type === "paragraph" &&
      block.children?.[0]?.type === "text" &&
      ESM.test(block.children[0].value)
  );
}
