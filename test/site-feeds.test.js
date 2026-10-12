// Run: node --test test/site-feeds.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  plainText,
  postPage,
  readPosts,
  renderFeedBody,
  rssXml,
  searchIndex,
  sitemapXml
} from "../tools/site-feeds.js";

const SITE = {
  siteUrl: "https://example.github.io",
  siteName: "Corbin Kim",
  siteDescription: "Notes & papers",
  defaultImage: "/profile.png"
};

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "posts-"));
  const w = (f, s) => fs.writeFileSync(path.join(dir, f), s);
  w(
    "newer.md",
    '---\ntitle: "A <b>newer</b> & \\"quoted\\" post"\ndate: "2026-10-01"\nexcerpt: "Short & sweet"\ntags: ["ML", "ECE-591"]\ncover: "/img/blog/newer/cover.png"\n---\n\nBody with $x^2$ and a [link](/blog/older).\n\n![](/img/blog/newer/a.png "Cap")\n\n```py\nprint(1)\n```\n'
  );
  w(
    "older.md",
    '---\ntitle: "Older"\ndate: "2026-09-01"\n---\n\nNo excerpt here, so the first words of the text are used as the description of this page.\n'
  );
  w(
    "hand.mdx",
    '---\ntitle: "Hand written"\ndate: "2026-09-15"\n---\n\nimport X from "./x"\n\n<X />\n\nText of the mdx post.\n'
  );
  w(
    "secret.md",
    '---\ntitle: "Hidden draft"\ndate: "2026-10-05"\ndraft: true\n---\n\nnot public\n'
  );
  w("_scratch.md", '---\ntitle: "Underscore"\n---\n\nx\n');
  w("broken.md", "---\ntitle: [unterminated\n---\n\nx\n");
  return dir;
}

test("readPosts: newest first, drafts / underscore / unparsable files left out", () => {
  const posts = readPosts(fixture());
  assert.deepEqual(
    posts.map(p => p.slug),
    ["newer", "hand", "older"]
  );
  assert.equal(posts[0].cover, "/img/blog/newer/cover.png");
  assert.deepEqual(posts[0].tags, ["ML", "ECE-591"]);
  assert.equal(readPosts("/nonexistent/dir").length, 0);
});

test("plainText: no markup, math value kept, mdx import lines dropped", () => {
  const posts = readPosts(fixture());
  assert.match(
    plainText(posts[0].body),
    /^Body with x\^2 and a link and \. print\(1\)$|Body with x\^2 and a link/
  );
  assert.doesNotMatch(plainText(posts[1].body), /import X/);
});

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Corbin Kim | Portfolio</title>
    <meta
      name="title"
      content="Corbin Kim | Portfolio"
    />
    <meta name="description" content="site description" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Site" />
    <meta property="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" />
    <script type="module" src="/assets/index-abc.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

test("postPage: replaces the site's head tags with the post's, keeps the rest", () => {
  const post = readPosts(fixture())[0];
  const html = postPage(SHELL, post, SITE);
  assert.match(
    html,
    /<title>A &lt;b&gt;newer&lt;\/b&gt; &amp; &quot;quoted&quot; post \| Corbin Kim<\/title>/
  );
  assert.match(
    html,
    /<meta name="description" content="Short &amp; sweet" \/>/
  );
  assert.match(
    html,
    /<meta property="og:url" content="https:\/\/example.github.io\/blog\/newer\/" \/>/
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/example.github.io\/img\/blog\/newer\/cover.png" \/>/
  );
  assert.match(
    html,
    /<meta name="twitter:card" content="summary_large_image" \/>/
  );
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/example.github.io\/blog\/newer\/" \/>/
  );
  assert.match(html, /<meta property="article:tag" content="ECE-591" \/>/);
  // the site-level tags are gone (one title, one description, no stale og:title "Site")
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  assert.doesNotMatch(html, /content="Site"|site description|Portfolio/);
  // everything the app needs survives
  assert.match(
    html,
    /<script type="module" src="\/assets\/index-abc.js"><\/script>/
  );
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<meta charset="utf-8" \/>/);
});

test("postPage: no cover -> small card and the default image; no excerpt -> text", () => {
  const post = readPosts(fixture()).find(p => p.slug === "older");
  const html = postPage(SHELL, post, SITE);
  assert.match(html, /name="twitter:card" content="summary"/);
  assert.match(
    html,
    /og:image" content="https:\/\/example.github.io\/profile.png"/
  );
  assert.match(
    html,
    /name="description" content="No excerpt here, so the first words/
  );
});

test("postPage: JSON-LD is valid JSON and cannot close the script tag", () => {
  const post = {
    ...readPosts(fixture())[0],
    title: "x</script><script>alert(1)</script>"
  };
  const html = postPage(SHELL, post, SITE);
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
    html
  );
  const data = JSON.parse(m[1].replace(/\\u003c/g, "<"));
  assert.equal(data["@type"], "BlogPosting");
  assert.equal(data.headline, post.title);
  assert.ok(!/<script>alert/.test(html));
});

test("rssXml: items newest first, absolute links, full text only for .md", () => {
  const xml = rssXml(readPosts(fixture()), SITE);
  assert.match(xml, /<title>Corbin Kim<\/title>/);
  assert.match(xml, /<description>Notes &amp; papers<\/description>/);
  const order = [
    ...xml.matchAll(
      /<link>https:\/\/example.github.io\/blog\/([^</]+)\/<\/link>/g
    )
  ].map(m => m[1]);
  assert.deepEqual(order, ["newer", "hand", "older"]);
  assert.match(xml, /<pubDate>Thu, 01 Oct 2026 12:00:00 GMT<\/pubDate>/);
  assert.match(
    xml,
    /<enclosure url="https:\/\/example.github.io\/img\/blog\/newer\/cover.png" type="image\/png"/
  );
  const items = xml.split("<item>").slice(1);
  assert.match(items[0], /<content:encoded><!\[CDATA\[/);
  assert.doesNotMatch(
    items[1],
    /content:encoded/,
    "the hand-written .mdx post only gets its excerpt"
  );
  // links and pictures inside the text are absolute, math is MathML
  assert.match(items[0], /href="https:\/\/example.github.io\/blog\/older"/);
  assert.match(
    items[0],
    /<figure[^>]*><img src="https:\/\/example.github.io\/img\/blog\/newer\/a.png"/
  );
  assert.match(items[0], /<math/);
  assert.doesNotMatch(items[0], /katex-html/);
});

test("rssXml: ]]> inside content cannot break out of CDATA", () => {
  const posts = [
    {
      slug: "x",
      ext: ".md",
      title: "t",
      date: "2026-10-01",
      excerpt: "e",
      tags: [],
      cover: "",
      body: "text ]]> more"
    }
  ];
  const xml = rssXml(posts, SITE);
  assert.ok(
    !/\]\]> more/.test(xml.replace("]]]]><![CDATA[>", "")) ||
      xml.includes("]]]]><![CDATA[>")
  );
});

test("sitemapXml lists the home page and every post", () => {
  const xml = sitemapXml(readPosts(fixture()), SITE);
  assert.equal((xml.match(/<url>/g) || []).length, 4);
  assert.match(xml, /<loc>https:\/\/example.github.io\/<\/loc>/);
  assert.match(
    xml,
    /<loc>https:\/\/example.github.io\/blog\/newer\/<\/loc><lastmod>2026-10-01<\/lastmod>/
  );
});

test("slugs with spaces are percent-encoded in URLs", () => {
  const post = {
    slug: "copy of post",
    ext: ".md",
    title: "t",
    date: "",
    excerpt: "e",
    tags: [],
    cover: "",
    body: ""
  };
  assert.match(sitemapXml([post], SITE), /blog\/copy%20of%20post\/</);
});

test("searchIndex carries searchable plain text", () => {
  const idx = searchIndex(readPosts(fixture()));
  assert.equal(idx.length, 3);
  assert.deepEqual(Object.keys(idx[0]).sort(), [
    "date",
    "excerpt",
    "slug",
    "tags",
    "text",
    "title"
  ]);
  assert.match(idx[0].text, /Body with/);
  assert.ok(searchIndex(readPosts(fixture()), 10)[0].text.length <= 10);
});

test("renderFeedBody turns site-relative URLs into absolute ones", () => {
  assert.match(
    renderFeedBody("![](/a.png) [x](/b)", SITE.siteUrl),
    /src="https:\/\/example.github.io\/a.png"[\s\S]*href="https:\/\/example.github.io\/b"/
  );
});
