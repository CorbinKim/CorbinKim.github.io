// Run: node --test test/postprocess.test.js
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
import rehypeFigure from "../plugins/rehype-figure.js";
import {
  cleanTags,
  finalizeBody,
  imageFileName,
  isBlankBody,
  isValidSlug,
  mapLimit,
  referencedDraftImages,
  slugify,
  suggestSlug,
  todayISO,
  toSiteMd
} from "../src/admin/postprocess.js";
import {parse, stringify} from "../src/admin/frontmatter.js";

// The same plugin chain the site uses for .md posts (vite.config.js).
async function render(value) {
  const mod = await evaluate(
    {value, path: "/x/post.md"},
    {
      ...runtime,
      format: "md",
      remarkPlugins: [
        remarkFrontmatter,
        remarkMdxFrontmatter,
        remarkMath,
        remarkGfm
      ],
      rehypePlugins: [rehypeKatex, rehypeFigure]
    }
  );
  return {
    html: ReactDOMServer.renderToStaticMarkup(React.createElement(mod.default)),
    frontmatter: mod.frontmatter
  };
}

test("slugify: ascii kebab-case, strips accents and punctuation", () => {
  assert.equal(
    slugify("[Paper review] Deep Learning: Example  Difficulty!"),
    "paper-review-deep-learning-example-difficulty"
  );
  assert.equal(slugify("Café Münster"), "cafe-munster");
  assert.equal(slugify("한글 제목"), "");
  assert.equal(slugify("  --  "), "");
  assert.equal(slugify("a".repeat(100)).length, 60);
  assert.ok(!slugify("a".repeat(59) + " b").endsWith("-"));
});

test("suggestSlug falls back to a dated slug for non-latin titles", () => {
  assert.equal(suggestSlug("한글 제목", "2026-10-11"), "post-20261011");
  assert.equal(suggestSlug("Hello World", "2026-10-11"), "hello-world");
});

test("isValidSlug", () => {
  for (const ok of ["a", "a-b", "post-20261011", "x1-2y"])
    assert.ok(isValidSlug(ok), ok);
  for (const bad of ["", "A", "a b", "a--b", "-a", "a-", "a/b", "../x", "é"])
    assert.ok(!isValidSlug(bad), bad);
  assert.ok(!isValidSlug("a".repeat(81)));
});

test("todayISO uses local date parts, zero padded", () => {
  assert.equal(todayISO(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("cleanTags trims, de-duplicates case-insensitively, drops empties", () => {
  assert.deepEqual(cleanTags([" ML ", "ml", "", "Open  RAN", "Open RAN"]), [
    "ML",
    "Open RAN"
  ]);
});

test("imageFileName: ascii stem + hash + known extension", () => {
  assert.equal(
    imageFileName({name: "Fig 1 (final).PNG", type: "image/png"}, "abcd1234"),
    "fig-1-final-abcd1234.png"
  );
  assert.equal(
    imageFileName({name: "스크린샷.png", type: "image/png"}, "abcd1234"),
    "image-abcd1234.png"
  );
  assert.equal(
    imageFileName({name: "image", type: "image/jpeg"}, "00112233"),
    "image-00112233.jpg"
  );
  assert.throws(() =>
    imageFileName({name: "x.svg", type: "image/svg+xml"}, "0")
  );
  assert.throws(() => imageFileName({name: "x", type: ""}, "0"));
});

test("draft image placeholders are found and rewritten", () => {
  const md =
    "![](/img/blog/__draft__/a-1.png)\n\ntext ![x](/img/blog/__draft__/b_2.jpg)\n\n" +
    "![](/img/blog/__draft__/a-1.png) ![k](/img/blog/old/keep.png)";
  assert.deepEqual(referencedDraftImages(md), ["a-1.png", "b_2.jpg"]);
  const out = finalizeBody(md, "my-post");
  assert.ok(!out.includes("__draft__"));
  assert.ok(out.includes("/img/blog/my-post/a-1.png"));
  assert.ok(out.includes("/img/blog/old/keep.png"));
});

test("toSiteMd: block images lose the ratio alt and keep the caption", () => {
  assert.equal(
    toSiteMd('![1.00](/img/blog/x/a.png "Figure 1. Attention.")\n'),
    '![](/img/blog/x/a.png "Figure 1. Attention.")\n'
  );
  assert.equal(
    toSiteMd("![0.75](/img/blog/x/a.png)\n"),
    "![](/img/blog/x/a.png)\n"
  );
  assert.equal(
    toSiteMd('![1.00](/a.png "He said \\"hi\\"")'),
    '![](/a.png "He said \\"hi\\"")\n'
  );
});

test("toSiteMd: inline images with real alt text are untouched", () => {
  const md = "See ![diagram](/a.png) here.\n";
  assert.equal(toSiteMd(md), md);
  assert.equal(toSiteMd("![Real alt](/a.png)\n"), "![Real alt](/a.png)\n");
});

test("toSiteMd: empty paragraphs (<br />) are removed", () => {
  assert.equal(toSiteMd("a\n\n<br />\n\nb\n"), "a\n\nb\n");
});

test("toSiteMd: never rewrites inside code fences or $$ blocks", () => {
  const md =
    '```md\n![1.00](/a.png "c")\n<br />\n```\n\n$$\n<br />\n![1.00](/a.png)\n$$\n';
  assert.equal(toSiteMd(md), md);
});

test("toSiteMd: normalises surrounding blank lines and CRLF", () => {
  assert.equal(toSiteMd("\n\r\nhello\r\n\r\n\r\n"), "hello\n");
});

test("isBlankBody", () => {
  assert.ok(isBlankBody(""));
  assert.ok(isBlankBody("\n<br />\n  \n"));
  assert.ok(!isBlankBody("x"));
});

test("mapLimit keeps order and respects the concurrency limit", async () => {
  let active = 0;
  let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async n => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 5));
    active--;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12]);
  assert.equal(peak, 2);
  assert.deepEqual(await mapLimit([], 3, async x => x), []);
});

test("end to end: Crepe-style output -> post file -> site HTML", async () => {
  const crepe = [
    "## Method",
    "",
    "Inline math $a_{ij}^2$ and a literal \\$5 and curly \\{ brace.",
    "",
    "$$",
    "\\mathrm{softmax}(x)_i = \\frac{e^{x_i}}{\\sum_j e^{x_j}}",
    "$$",
    "",
    '![1.00](/img/blog/__draft__/fig-1-abcd1234.png "Figure 1. Architecture.")',
    "",
    "<br />",
    "",
    "- one",
    "- two"
  ].join("\n");
  const file = stringify({
    data: {
      title: '[Paper review] 한글 & "quotes"',
      date: "2026-10-11",
      excerpt: "An excerpt: with colon",
      tags: ["ML", "ECE-591"]
    },
    body: finalizeBody(toSiteMd(crepe), "my-post")
  });

  const {data, body} = parse(file);
  assert.equal(data.title, '[Paper review] 한글 & "quotes"');
  assert.deepEqual(data.tags, ["ML", "ECE-591"]);

  const {html, frontmatter} = await render(file);
  assert.deepEqual(frontmatter, data);
  assert.match(html, /<h2>Method<\/h2>/);
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/);
  assert.match(html, /\$5 and curly \{ brace/);
  assert.match(
    html,
    /<figure><img src="\/img\/blog\/my-post\/fig-1-abcd1234.png" alt="" loading="lazy" decoding="async"\/><figcaption>Figure 1\. Architecture\.<\/figcaption><\/figure>/
  );
  assert.doesNotMatch(html, /__draft__|1\.00|<br/);
  assert.match(html, /<li>one<\/li>\s*<li>two<\/li>/);
  assert.ok(body.startsWith("## Method"));
});
