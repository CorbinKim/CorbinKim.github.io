// Editor blocks that Crepe does not have: callout boxes and collapsible
// ("toggle") blocks. They are plain Markdown on disk: a blockquote whose first
// line is a marker (see plugins/callout-syntax.js), so the post stays readable
// and the site renders it with plugins/remark-callouts.js.
//
//   Markdown --(remark transform)--> custom mdast node --> ProseMirror node
//   ProseMirror node --> blockquote with an html "[!NOTE]" marker --> Markdown
import {$nodeSchema, $remark} from "@milkdown/kit/utils";
import {readAlert} from "../../plugins/callout-syntax.js";

// Turn alert blockquotes into `callout` / `toggle` mdast nodes before Milkdown
// maps the tree to its document (otherwise its own blockquote rule would win).
function convert(node) {
  if (!node.children) return;
  node.children = node.children.map(child => {
    if (child.type === "blockquote") {
      const alert = readAlert(child);
      if (alert) {
        return alert.kind === "toggle"
          ? {type: "toggle", children: alert.children}
          : {type: "callout", kind: alert.kind, children: alert.children};
      }
    }
    return child;
  });
  node.children.forEach(convert);
}

export const alertsRemark = $remark("alertsRemark", () => () => convert);

export const calloutSchema = $nodeSchema("callout", () => ({
  content: "block+",
  group: "block",
  defining: true,
  attrs: {kind: {default: "note"}},
  parseDOM: [
    {
      tag: 'div[data-type="callout"]',
      getAttrs: dom => ({kind: dom.dataset.kind || "note"})
    }
  ],
  toDOM: node => [
    "div",
    {
      "data-type": "callout",
      "data-kind": node.attrs.kind,
      class: `callout callout-${node.attrs.kind}`
    },
    0
  ],
  parseMarkdown: {
    match: ({type}) => type === "callout",
    runner: (state, node, type) => {
      state.openNode(type, {kind: node.kind}).next(node.children).closeNode();
    }
  },
  toMarkdown: {
    match: node => node.type.name === "callout",
    runner: (state, node) => {
      state.openNode("blockquote");
      // an html node is written verbatim: no escaping of "[" and "!"
      state
        .openNode("paragraph")
        .addNode("html", undefined, `[!${node.attrs.kind.toUpperCase()}]`)
        .closeNode();
      state.next(node.content);
      state.closeNode();
    }
  }
}));

// content: the title paragraph first, then any blocks (the hidden body)
export const toggleSchema = $nodeSchema("toggle", () => ({
  content: "paragraph block*",
  group: "block",
  defining: true,
  parseDOM: [{tag: 'div[data-type="toggle"]'}],
  toDOM: () => ["div", {"data-type": "toggle", class: "toggle"}, 0],
  parseMarkdown: {
    match: ({type}) => type === "toggle",
    runner: (state, node, type) => {
      state.openNode(type).next(node.children).closeNode();
    }
  },
  toMarkdown: {
    match: node => node.type.name === "toggle",
    runner: (state, node) => {
      state.openNode("blockquote");
      state.openNode("paragraph").addNode("html", undefined, "[!TOGGLE] ");
      if (node.firstChild) state.next(node.firstChild.content); // the title
      state.closeNode();
      node.forEach((child, _offset, index) => {
        if (index > 0) state.next(child);
      });
      state.closeNode();
    }
  }
}));

export const blockPlugins = [alertsRemark, calloutSchema, toggleSchema];
