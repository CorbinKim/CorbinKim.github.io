// remark plugin (site + live preview): GitHub-style alerts -> callout boxes and
// collapsible blocks. See callout-syntax.js for the Markdown. Output (via the
// data.hName / data.hProperties hooks of mdast-util-to-hast):
//
//   > [!NOTE] text      ->  <div class="callout callout-note">
//                             <p class="callout-title">Note</p> <p>text</p></div>
//   > [!TOGGLE] Title   ->  <details class="toggle"><summary>Title</summary> ...
//
// The styles live in src/blog/Extras.scss.
import {LABELS, readAlert} from "./callout-syntax.js";

function transform(node) {
  if (!node.children) return;
  for (const child of node.children) {
    if (child.type === "blockquote") {
      const alert = readAlert(child);
      if (alert) apply(child, alert);
    }
    transform(child);
  }
}

function apply(blockquote, {kind, children}) {
  if (kind === "toggle") {
    const [title, ...body] = children;
    const hasTitle = title.children.length > 0;
    blockquote.data = {hName: "details", hProperties: {className: ["toggle"]}};
    blockquote.children = [
      {
        type: "paragraph",
        data: {hName: "summary"},
        children: hasTitle ? title.children : [{type: "text", value: "Details"}]
      },
      ...body
    ];
    return;
  }
  blockquote.data = {
    hName: "div",
    hProperties: {className: ["callout", `callout-${kind}`]}
  };
  blockquote.children = [
    {
      type: "paragraph",
      data: {hProperties: {className: ["callout-title"]}},
      children: [{type: "text", value: LABELS[kind]}]
    },
    ...children
  ];
}

export default function remarkCallouts() {
  return tree => transform(tree);
}
