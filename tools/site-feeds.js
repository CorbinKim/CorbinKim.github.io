// Build step for the public site (Vite plugin). After `vite build` it adds, next
// to the single-page app in build/:
//
//   blog/<slug>/index.html   the app shell with THIS post's title, description,
//                            Open Graph / Twitter tags and JSON-LD in <head>.
//                            Link unfurlers (Slack, KakaoTalk, iMessage, X ...)
//                            do not run JavaScript, and an unknown path used to
//                            be answered with 404.html; now they get a real page.
//   feed.xml                 RSS 2.0, newest first, full text for Markdown posts
//   sitemap.xml              home page + posts
//   search-index.json        title / excerpt / tags / plain text, for the search
//                            box in the Writing section
//
// The posts are read from src/blog/posts/*.md|mdx (frontmatter only needs the
// subset src/admin/frontmatter.js understands). Drafts (`draft: true`) and files
// starting with "_" are left out, exactly like the site does.
import fs from "node:fs";
import path from "node:path";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import {toString} from "mdast-util-to-string";
import {unified} from "unified";
import rehypeFigure from "../plugins/rehype-figure.js";
import rehypeSafeUrls from "../plugins/rehype-safe-urls.js";
import remarkCallouts from "../plugins/remark-callouts.js";
import {parse} from "../src/admin/frontmatter.js";

const slugOf = file => file.replace(/\.mdx?$/, "");

/** @returns {Array<{slug, ext, title, date, excerpt, tags, cover, body}>} newest first */
// `redirect_from: [old-slug, ...]` in a post's front matter: earlier addresses of
// the post (the editor adds the old one when a post's link is changed). Anything
// that could not be a single path segment is ignored.
export function cleanRedirects(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(
      list
        .map(v => String(v).trim())
        .filter(
          v => v && v !== "." && v !== ".." && !/[\\/?#\u0000-\u001f]/.test(v)
        )
    )
  ];
}

export function readPosts(dir) {
  if (!fs.existsSync(dir)) return [];
  const posts = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!/\.mdx?$/.test(file) || file.startsWith("_")) continue;
    try {
      const {data, body} = parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (data.draft === true) continue;
      posts.push({
        slug: slugOf(file),
        ext: file.endsWith(".mdx") ? ".mdx" : ".md",
        title: String(data.title || slugOf(file)),
        date: String(data.date || ""),
        excerpt: String(data.excerpt || ""),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        cover: typeof data.cover === "string" ? data.cover : "",
        redirectFrom: cleanRedirects(data.redirect_from),
        body
      });
    } catch (err) {
      console.warn(`[site-feeds] skipped ${file}: ${err.message}`);
    }
  }
  return posts.sort(
    (a, b) =>
      new Date(b.date || 0) - new Date(a.date || 0) ||
      a.slug.localeCompare(b.slug)
  );
}

// ---- redirect pages for renamed posts --------------------------------------------

/** A tiny static page at a post's former address that sends the visitor (and
 *  search engines, through the canonical link) to the current one. GitHub Pages
 *  cannot send real 301s, but it serves any <slug>/index.html we write. */
export function redirectPage(post, {siteUrl}) {
  const target = `/blog/${encodeURIComponent(post.slug)}/`;
  const abs = siteUrl + target;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Redirecting…</title>
<meta name="robots" content="noindex" />
<link rel="canonical" href="${esc(abs)}" />
<meta http-equiv="refresh" content="0; url=${esc(target)}" />
<script>location.replace(${JSON.stringify(target).replace(
    /</g,
    "\\u003c"
  )});</script>
</head>
<body>
<p>This post moved to <a href="${esc(target)}">${esc(abs)}</a>.</p>
</body>
</html>
`;
}

/** Former addresses -> the page to write for each. A real post's own address
 *  always wins, and when two posts claim the same old address the newer post
 *  (the list is newest first) keeps it. */
export function redirectPages(posts) {
  const taken = new Set(posts.map(p => p.slug));
  const out = new Map();
  for (const post of posts) {
    for (const from of post.redirectFrom ?? []) {
      if (taken.has(from) || out.has(from)) continue;
      out.set(from, post);
    }
  }
  return out;
}

// ---- escaping ---------------------------------------------------------------------
const esc = s =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const cdata = s =>
  `<![CDATA[${String(s).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export const absolute = (siteUrl, p) =>
  /^https?:\/\//i.test(p) ? p : siteUrl + (p.startsWith("/") ? p : "/" + p);
// With the trailing slash: GitHub Pages serves each post as a directory
// (blog/<slug>/index.html) and 301-redirects the slash-less address to it, so the
// slash form is the one canonical URL.
const postUrl = (siteUrl, slug) =>
  `${siteUrl}/blog/${encodeURIComponent(slug)}/`;
const rfc822 = date => {
  const d = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(date) ? date + "T12:00:00Z" : date
  );
  return Number.isNaN(d.getTime()) ? null : d.toUTCString();
};

// ---- plain text (description fallback, search) ------------------------------------
const textProcessor = unified().use(remarkParse).use(remarkMath).use(remarkGfm);

export function plainText(markdown) {
  const body = String(markdown || "")
    .split("\n")
    .filter(line => !/^\s*(import|export)\s/.test(line)) // hand-written .mdx
    .join("\n");
  return toString(textProcessor.parse(body)).replace(/\s+/g, " ").trim();
}

function description(post) {
  if (post.excerpt) return post.excerpt;
  const text = plainText(post.body);
  return text.length > 200 ? text.slice(0, 197).trimEnd() + "..." : text;
}

// ---- per-post page ------------------------------------------------------------------
const HEAD_TAGS = [
  /<title>[\s\S]*?<\/title>/g,
  /<meta\s+(?:name|property)="(?:title|description|og:[^"]*|twitter:[^"]*)"[\s\S]*?\/>/g,
  /<link\s+rel="canonical"[\s\S]*?\/>/g
];

/** The built index.html with this post's metadata in <head>. */
export function postPage(shell, post, {siteUrl, siteName, defaultImage}) {
  let html = shell;
  for (const re of HEAD_TAGS) html = html.replace(re, "");
  const url = postUrl(siteUrl, post.slug);
  const desc = description(post);
  const title = `${post.title} | ${siteName}`;
  const image = absolute(siteUrl, post.cover || defaultImage);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: desc,
    url,
    mainEntityOfPage: url,
    image: [image],
    author: {"@type": "Person", name: siteName},
    ...(post.date ? {datePublished: post.date} : {}),
    ...(post.tags.length ? {keywords: post.tags.join(", ")} : {})
  };
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="title" content="${esc(title)}" />`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(post.title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    ...(post.date
      ? [
          `<meta property="article:published_time" content="${esc(
            post.date
          )}" />`
        ]
      : []),
    ...post.tags.map(
      t => `<meta property="article:tag" content="${esc(t)}" />`
    ),
    `<meta name="twitter:card" content="${
      post.cover ? "summary_large_image" : "summary"
    }" />`,
    `<meta name="twitter:title" content="${esc(post.title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    // JSON cannot contain "</script>": "<" is escaped
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(
      /</g,
      "\\u003c"
    )}</script>`
  ].join("\n    ");
  return html.replace("</head>", `    ${head}\n  </head>`);
}

// ---- feed -------------------------------------------------------------------------------
// MathML (not KaTeX's CSS-dependent HTML) so formulas survive in a feed reader.
function absolutizeLinks(siteUrl) {
  const fix = node => {
    if (node.type === "element" && node.properties) {
      for (const attr of ["src", "href"]) {
        const v = node.properties[attr];
        if (typeof v === "string" && v.startsWith("/") && !v.startsWith("//"))
          node.properties[attr] = siteUrl + v;
      }
    }
    node.children?.forEach(fix);
  };
  return fix; // a unified plugin returns the transformer
}

export function renderFeedBody(markdown, siteUrl) {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkGfm)
      .use(remarkCallouts)
      .use(remarkRehype)
      .use(rehypeSafeUrls)
      .use(rehypeKatex, {
        output: "mathml",
        strict: "ignore",
        throwOnError: false
      })
      .use(rehypeFigure)
      .use(absolutizeLinks, siteUrl)
      .use(rehypeStringify)
      .processSync(markdown)
  );
}

export function rssXml(
  posts,
  {siteUrl, siteName, siteDescription, limit = 30}
) {
  const items = posts.slice(0, limit).map(post => {
    const url = postUrl(siteUrl, post.slug);
    const date = rfc822(post.date);
    // hand-written .mdx may contain JSX: feed readers only get the excerpt
    const content =
      post.ext === ".md" ? renderFeedBody(post.body, siteUrl) : "";
    return [
      "    <item>",
      `      <title>${esc(post.title)}</title>`,
      `      <link>${esc(url)}</link>`,
      `      <guid isPermaLink="true">${esc(url)}</guid>`,
      ...(date ? [`      <pubDate>${date}</pubDate>`] : []),
      ...post.tags.map(t => `      <category>${esc(t)}</category>`),
      `      <description>${esc(description(post))}</description>`,
      ...(content
        ? [`      <content:encoded>${cdata(content)}</content:encoded>`]
        : []),
      ...(post.cover
        ? [
            `      <enclosure url="${esc(
              absolute(siteUrl, post.cover)
            )}" type="image/${enclosureType(post.cover)}" length="0" />`
          ]
        : []),
      "    </item>"
    ].join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(siteName)}</title>
    <link>${esc(siteUrl)}/</link>
    <description>${esc(siteDescription)}</description>
    <language>en</language>
    <atom:link href="${esc(
      siteUrl
    )}/feed.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;
}

function enclosureType(file) {
  const ext = file.split(/[?#]/)[0].split(".").pop().toLowerCase();
  return ext === "jpg"
    ? "jpeg"
    : ["png", "gif", "webp", "avif", "jpeg"].includes(ext)
    ? ext
    : "png";
}

// ---- sitemap / search ---------------------------------------------------------------------
export function sitemapXml(posts, {siteUrl}) {
  const urls = [
    `  <url><loc>${esc(siteUrl)}/</loc></url>`,
    ...posts.map(
      p =>
        `  <url><loc>${esc(postUrl(siteUrl, p.slug))}</loc>${
          /^\d{4}-\d{2}-\d{2}$/.test(p.date)
            ? `<lastmod>${p.date}</lastmod>`
            : ""
        }</url>`
    )
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

export function searchIndex(posts, maxText = 6000) {
  return posts.map(p => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    tags: p.tags,
    date: p.date,
    text: plainText(p.body).slice(0, maxText)
  }));
}

// ---- Vite plugin -----------------------------------------------------------------------------
/** @param {{siteUrl: string, siteName: string, siteDescription: string,
 *           defaultImage?: string, postsDir?: string}} options */
export function siteFeeds(options) {
  const {
    siteUrl,
    siteName,
    siteDescription,
    defaultImage = "/profile.png"
  } = options;
  let outDir = "";
  let root = "";
  return {
    name: "site-feeds",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const posts = readPosts(
        path.resolve(root, options.postsDir || "src/blog/posts")
      );
      const shellFile = path.join(outDir, "index.html");
      if (!fs.existsSync(shellFile)) return; // not the portfolio build
      const shell = fs.readFileSync(shellFile, "utf8");
      const out = (file, text) => {
        fs.mkdirSync(path.dirname(path.join(outDir, file)), {recursive: true});
        fs.writeFileSync(path.join(outDir, file), text);
      };
      for (const post of posts)
        out(
          `blog/${post.slug}/index.html`,
          postPage(shell, post, {siteUrl, siteName, defaultImage})
        );
      const moved = redirectPages(posts);
      for (const [from, post] of moved)
        out(`blog/${from}/index.html`, redirectPage(post, {siteUrl}));
      out("feed.xml", rssXml(posts, {siteUrl, siteName, siteDescription}));
      out("sitemap.xml", sitemapXml(posts, {siteUrl}));
      out("search-index.json", JSON.stringify(searchIndex(posts)));
      console.log(
        `[site-feeds] ${posts.length} post page(s)${
          moved.size ? `, ${moved.size} redirect(s)` : ""
        }, feed.xml, sitemap.xml, search-index.json`
      );
    }
  };
}
