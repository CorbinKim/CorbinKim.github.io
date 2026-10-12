// Run: node --test rehype-figure.test.js   (React 16 has no "exports" map, hence
// the explicit .js subpaths)
import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluate} from "@mdx-js/mdx";
import runtime from "react/jsx-runtime.js";
import ReactDOMServer from "react-dom/server.js";
import React from "react";
import rehypeFigure from "../plugins/rehype-figure.js";

async function html(value, format = "md", rehypePlugins = [rehypeFigure]) {
  const mod = await evaluate(
    {value, path: "/x/post." + format},
    {...runtime, format, rehypePlugins}
  );
  return ReactDOMServer.renderToStaticMarkup(React.createElement(mod.default));
}
const IMG = 'src="/a.png"';

test("captioned image becomes figure + figcaption (title removed from img)", async () => {
  assert.equal(
    await html('![Alt](/a.png "Figure 1. Caption")'),
    `<figure><img ${IMG} alt="Alt" loading="lazy" decoding="async"/><figcaption>Figure 1. Caption</figcaption></figure>`
  );
});

test("caption text is escaped, not interpreted", async () => {
  assert.equal(
    await html('![A](/a.png "x <b>y</b> & z")'),
    `<figure><img ${IMG} alt="A" loading="lazy" decoding="async"/><figcaption>x &lt;b&gt;y&lt;/b&gt; &amp; z</figcaption></figure>`
  );
});

test("image without title stays in its paragraph, only gains lazy loading", async () => {
  assert.equal(
    await html("![Alt](/a.png)"),
    `<p><img ${IMG} alt="Alt" loading="lazy" decoding="async"/></p>`
  );
});

test("inline image with title (mixed with text) is untouched except lazy", async () => {
  assert.equal(
    await html('Before ![A](/a.png "t") after'),
    `<p>Before <img ${IMG} alt="A" title="t" loading="lazy" decoding="async"/> after</p>`
  );
});

test("linked captioned image: figure wraps the link", async () => {
  assert.equal(
    await html('[![A](/a.png "Cap")](https://example.com)'),
    `<figure><a href="https://example.com"><img ${IMG} alt="A" loading="lazy" decoding="async"/></a><figcaption>Cap</figcaption></figure>`
  );
});

test("two images in one paragraph are not turned into a figure", async () => {
  const out = await html('![A](/a.png "1")\n![B](/b.png "2")');
  assert.ok(!out.includes("<figure"));
  assert.equal((out.match(/loading="lazy"/g) || []).length, 2);
});

test('Milkdown image-block ![1.00](url "caption"): ratio alt is dropped', async () => {
  assert.equal(
    await html('![1.00](/a.png "Cap")'),
    `<figure><img ${IMG} alt="" loading="lazy" decoding="async"/><figcaption>Cap</figcaption></figure>`
  );
  assert.equal(
    await html("![0.62](/a.png)"),
    `<p><img ${IMG} alt="" loading="lazy" decoding="async"/></p>`
  );
  // a real alt that merely looks numeric (not toFixed(2)) is kept
  assert.ok((await html("![2024](/a.png)")).includes('alt="2024"'));
});

test("legacy hand-written <figure> in .mdx is not double-wrapped", async () => {
  const mdx = `<figure>

![Diagram](/a.png "would-be caption")

<figcaption>Figure 1.</figcaption>

</figure>`;
  const out = await html(mdx, "mdx");
  assert.equal((out.match(/<figure/g) || []).length, 1);
  assert.equal((out.match(/<figcaption/g) || []).length, 1);
  assert.ok(out.includes('loading="lazy"'));
});

test("works inside lists and blockquotes", async () => {
  const out = await html(
    '- item\n\n  ![A](/a.png "Cap")\n\n> ![B](/b.png "Cap2")'
  );
  assert.equal((out.match(/<figure>/g) || []).length, 2);
});

test("idempotent when applied twice", async () => {
  const once = await html('![A](/a.png "Cap")');
  const twice = await html('![A](/a.png "Cap")', "md", [
    rehypeFigure,
    rehypeFigure
  ]);
  assert.equal(twice, once);
});

// ---- size and alignment in the URL fragment (written by the editor's toolbar) ----
const ST = 'loading="lazy" decoding="async"';

test("captioned image: width and alignment become the figure's style, fragment is removed", async () => {
  assert.equal(
    await html('![](/a.png#w=50&align=center "Cap")'),
    `<figure style="width:50%;max-width:100%;margin-left:auto;margin-right:auto"><img src="/a.png" alt="" ${ST}/><figcaption>Cap</figcaption></figure>`
  );
});

test("captioned image with only an alignment shrinks the figure to the picture", async () => {
  assert.equal(
    await html('![](/a.png#align=right "Cap")'),
    `<figure style="width:fit-content;max-width:100%;margin-left:auto;margin-right:0"><img src="/a.png" alt="" ${ST}/><figcaption>Cap</figcaption></figure>`
  );
});

test("uncaptioned image alone in its paragraph: the style goes on the img", async () => {
  assert.equal(
    await html("![](/a.png#w=33&align=left)"),
    `<p><img src="/a.png" alt="" style="display:block;width:33%;max-width:100%;margin-left:0;margin-right:auto" ${ST}/></p>`
  );
  assert.equal(
    await html("![](/a.png#align=center)"),
    `<p><img src="/a.png" alt="" style="display:block;max-width:100%;margin-left:auto;margin-right:auto" ${ST}/></p>`
  );
});

test("width alone keeps the picture left-aligned (no margins added)", async () => {
  assert.equal(
    await html("![](/a.png#w=75)"),
    `<p><img src="/a.png" alt="" style="display:block;width:75%;max-width:100%" ${ST}/></p>`
  );
});

test("out-of-range or unknown values are ignored and the URL is left alone", async () => {
  for (const frag of [
    "#w=5",
    "#w=500",
    "#w=abc",
    "#align=up",
    "#w=",
    "#section",
    "#w50"
  ]) {
    assert.equal(
      await html(`![](/a.png${frag})`),
      `<p><img src="/a.png${frag}" alt="" ${ST}/></p>`,
      frag
    );
  }
  // a valid value next to an invalid one: the valid one wins
  assert.match(
    await html("![](/a.png#w=500&align=right)"),
    /margin-left:auto;margin-right:0/
  );
});

test("an inline image only loses the editor's fragment", async () => {
  assert.equal(
    await html("Text ![x](/a.png#w=50&align=center) more"),
    `<p>Text <img src="/a.png" alt="x" ${ST}/> more</p>`
  );
});

test("a linked picture keeps its link and gets the size on the figure", async () => {
  assert.equal(
    await html('[![A](/a.png#w=60 "Cap")](https://example.com)'),
    `<figure style="width:60%;max-width:100%"><a href="https://example.com"><img src="/a.png" alt="A" ${ST}/></a><figcaption>Cap</figcaption></figure>`
  );
});

test("inside a hand-written <figure> the fragment is dropped and nothing is styled", async () => {
  const out = await html("<figure>\n\n![](/a.png#w=50)\n\n</figure>", "mdx");
  assert.match(out, /<figure>/);
  assert.match(out, /src="\/a.png"/);
  assert.doesNotMatch(out, /style=/);
});

test("the editor's comma form is read like the & form", async () => {
  assert.equal(
    await html('![](/a.png#w=50,align=center "Cap")'),
    await html('![](/a.png#w=50&align=center "Cap")')
  );
  assert.match(
    await html("![](/a.png#align=left,w=25)"),
    /width:25%;max-width:100%;margin-left:0;margin-right:auto/
  );
});
