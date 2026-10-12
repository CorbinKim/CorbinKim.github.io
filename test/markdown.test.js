// The live preview must render a body the way the real site does.
// Run: node --test test/markdown.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluate} from "@mdx-js/mdx";
import runtime from "react/jsx-runtime.js";
import ReactDOMServer from "react-dom/server.js";
import React from "react";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import {fromHtml} from "hast-util-from-html";
import {toHtml} from "hast-util-to-html";
import rehypeFigure from "../plugins/rehype-figure.js";
import remarkCallouts from "../plugins/remark-callouts.js";
import rehypeSafeUrls from "../plugins/rehype-safe-urls.js";
import {renderBody} from "../src/admin/markdown.js";

// exactly the chain in vite.config.js, for a .md file
async function siteHtml(body) {
  const mod = await evaluate(
    {value: body, path: "/x/post.md"},
    {
      ...runtime,
      format: "md",
      remarkPlugins: [
        remarkFrontmatter,
        remarkMdxFrontmatter,
        remarkMath,
        remarkGfm,
        remarkCallouts
      ],
      rehypePlugins: [rehypeSafeUrls, rehypeKatex, rehypeFigure]
    }
  );
  return ReactDOMServer.renderToStaticMarkup(React.createElement(mod.default));
}

// React and rehype-stringify serialise the same tree slightly differently
// (whitespace between blocks, attribute order, <br/> vs <br>): canonicalise.
function canon(html) {
  html = html
    .replace(/>\s+</g, "><")
    .replace(/;"/g, '"') // style="a:b;" and style="a:b" are the same CSS
    .replace(/data-footnotes="true"/g, 'data-footnotes=""')
    .replace(/data-footnote-ref="true"/g, 'data-footnote-ref=""');
  const tree = fromHtml(html, {fragment: true});
  (function sortAttrs(n) {
    if (n.properties)
      n.properties = Object.fromEntries(
        Object.entries(n.properties).sort(([a], [b]) => a.localeCompare(b))
      );
    (n.children || []).forEach(sortAttrs);
  })(tree);
  return toHtml(tree).replace(/>\s+</g, "><");
}

const SAMPLES = {
  headings:
    "# One\n\n## Two\n\n### Three {x}\n\nText with **bold**, _italic_, `code` and a [link](https://example.com).",
  lists: "- a\n- b\n  - nested\n\n1. one\n2. two\n\n- [x] done\n- [ ] todo",
  table: "| a | b |\n| :- | -: |\n| 1 | 2 |\n| `x` | **y** |",
  math: "Inline $a_{ij}^2$ and\n\n$$\n\\frac{e^{x_i}}{\\sum_j e^{x_j}}\n$$\n\nand a literal \\$5.",
  code: "```python\nprint('hi <b>')\n```\n\n    indented { code }",
  figure:
    '![](/img/blog/x/a.png "Figure 1. Caption with $x$ and <b>")\n\n![](/img/blog/x/b.png)\n\nText ![inline](/c.png) here.',
  blockquote: "> quote\n>\n> > nested\n\n---\n\n***",
  special: "curly \\{ brace and 5 \\< 6 and &amp; and © and 한글 😀",
  unsafe:
    "[x](javascript:alert(1)) ![y](javascript:alert(2)) <script>alert(3)</script> <b>raw</b>",
  footnote: "Text[^1]\n\n[^1]: The note.",
  callout: "> [!WARNING]\n> Careful with **this**.\n>\n> Second paragraph.",
  toggle: "> [!TOGGLE] Why?\n>\n> Because $x$.\n>\n> - one\n> - two",
  sizedFigure: '![](/img/a.png#w=50,align=center "Cap")'
};

for (const [name, md] of Object.entries(SAMPLES)) {
  test(`preview HTML equals the site's HTML: ${name}`, async () => {
    assert.equal(canon(renderBody(md)), canon(await siteHtml(md)));
  });
}

test("raw HTML and script URLs never reach the preview", () => {
  const html = renderBody(SAMPLES.unsafe);
  assert.doesNotMatch(html, /<script|<b>|javascript:/i);
});

test("empty and null input are fine", () => {
  assert.equal(renderBody(""), "");
  assert.equal(renderBody(null), "");
});
