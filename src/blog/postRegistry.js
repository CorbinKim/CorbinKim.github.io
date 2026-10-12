// Auto-discovers every .md / .mdx file under ./posts (Vite's import.meta.glob,
// resolved at build time — no manual index to maintain) and normalizes each
// into { slug, Component, title, date, excerpt, tags }. Frontmatter is
// lifted out by remark-mdx-frontmatter (see vite.config.js) and exposed as
// the module's `frontmatter` named export.
//
// .md  = plain Markdown written by the /admin editor (no JSX / expressions)
// .mdx = hand-written posts that need JSX
//
// Files starting with "_" are never bundled (negative glob). Posts with
// `draft: true` are hidden from the list and the /blog/:slug route in
// production builds (shown under `vite dev`) — but note they ARE still
// compiled into the JS bundle, so `draft` is not a privacy feature.
const modules = import.meta.glob(["./posts/*.{md,mdx}", "!./posts/_*"], {
  eager: true
});

export const posts = Object.entries(modules)
  .map(([path, mod]) => {
    const slug = path.replace("./posts/", "").replace(/\.mdx?$/, "");
    const fm = mod.frontmatter || {};
    return {
      slug,
      Component: mod.default,
      title: fm.title || slug,
      date: fm.date || null,
      excerpt: fm.excerpt || "",
      // optional header picture (a site path such as /img/blog/<slug>/cover.png)
      cover: fm.cover || "",
      tags: fm.tags || [],
      draft: fm.draft === true
    };
  })
  .filter(p => !p.draft || import.meta.env.DEV)
  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

export function getPost(slug) {
  return posts.find(p => p.slug === slug);
}
