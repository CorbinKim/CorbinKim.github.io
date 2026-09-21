// Auto-discovers every .mdx file under ./posts (Vite's import.meta.glob,
// resolved at build time — no manual index to maintain) and normalizes each
// into { slug, Component, title, date, excerpt, tags }. Frontmatter is
// lifted out by remark-mdx-frontmatter (see vite.config.js) and exposed as
// the module's `frontmatter` named export.
const modules = import.meta.glob("./posts/*.mdx", {eager: true});

export const posts = Object.entries(modules)
  .map(([path, mod]) => {
    const slug = path.replace("./posts/", "").replace(/\.mdx$/, "");
    const fm = mod.frontmatter || {};
    return {
      slug,
      Component: mod.default,
      title: fm.title || slug,
      date: fm.date || null,
      excerpt: fm.excerpt || "",
      tags: fm.tags || []
    };
  })
  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

export function getPost(slug) {
  return posts.find(p => p.slug === slug);
}
