// Dependency-free rehype plugin (plain ESM): drops href/src values whose URL
// scheme is not on a small allow-list, so a pasted `[x](javascript:...)` can
// never become a live javascript: link. Relative URLs (/img/a.png, #anchor,
// ../x) and schemes http, https, mailto, tel are kept. Only touches hast
// `element` nodes (what Markdown produces); JSX written by hand in .mdx is not
// inspected.
const ALLOWED = new Set(["http", "https", "mailto", "tel"]);
const ATTRS = {a: ["href"], img: ["src"], source: ["src"], video: ["src"]};

function isSafe(value) {
  // browsers ignore leading C0 controls/space and strip tab/CR/LF anywhere
  // inside the scheme, so normalise the same way before looking at it
  const v = String(value).replace(/[\u0000- \u007f]/g, "");
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(v);
  return !m || ALLOWED.has(m[1].toLowerCase());
}

function walk(node) {
  if (node.type === "element" && node.properties) {
    for (const attr of ATTRS[node.tagName] || []) {
      const v = node.properties[attr];
      if (typeof v === "string" && !isSafe(v)) delete node.properties[attr];
    }
  }
  if (node.children) node.children.forEach(walk);
}

export default function rehypeSafeUrls() {
  return tree => {
    walk(tree);
  };
}
