import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeFigure from "./plugins/rehype-figure.js";
import remarkCallouts from "./plugins/remark-callouts.js";
import {
  katexOptions,
  remarkMathEnvironments,
  wrapRawEnvironments
} from "./plugins/math-env.js";
import rehypeSafeUrls from "./plugins/rehype-safe-urls.js";
import {site} from "./src/data/site.js";
import {adminCspMeta, adminPolicy} from "./tools/admin-csp.js";
import {siteFeeds} from "./tools/site-feeds.js";

// GitHub Pages answers /admin with a 301 to /admin/ (it is a directory with an
// index.html). Vite's dev and preview servers instead fall back to the
// portfolio's index.html (React Router then renders nothing), so mimic Pages.
function adminTrailingSlash() {
  const redirect = (req, res, next) => {
    const [path, query] = req.url.split("?");
    if (path !== "/admin") return next();
    res.statusCode = 301;
    res.setHeader("Location", "/admin/" + (query ? "?" + query : ""));
    res.end();
  };
  return {
    name: "admin-trailing-slash",
    // braces matter: Vite treats a returned function as a post-middleware hook
    configureServer(server) {
      server.middlewares.use(redirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    }
  };
}

// Static portfolio + blog served at the domain root (corbinkim.github.io).
// Blog posts live in src/blog/posts/: *.md (plain Markdown, written by the
// /admin editor) and *.mdx (hand-written, may use JSX), both with LaTeX via
// remark-math + rehype-katex. @mdx-js/rollup's default `format: "detect"`
// compiles .md as plain Markdown (no JSX/expressions, raw HTML dropped) and
// .mdx as MDX, using the same plugin lists.
//
// React 16.14+ ships react/jsx-runtime, so we use the automatic JSX runtime
// (Vite's default) for both the hand-written components and MDX's compiled
// output — existing files still explicitly `import React`, which is harmless
// under the automatic runtime.
export default defineConfig({
  plugins: [
    adminTrailingSlash(),
    adminCspMeta(adminPolicy()),
    // per-post pages with share-preview tags, feed.xml, sitemap.xml, search index
    siteFeeds({
      siteUrl: site.url,
      siteName: site.name,
      siteDescription: site.tagline
    }),
    // Overleaf-style \begin{equation}...\end{equation} written without $$ around
    // it is wrapped in a $$ block before MDX parses the post (plugins/math-env.js)
    {
      name: "math-environments",
      enforce: "pre",
      transform(code, id) {
        if (
          !/[\\/]src[\\/]blog[\\/]posts[\\/][^\\/?]+\.mdx?$/.test(
            id.split("?")[0]
          )
        )
          return null;
        const wrapped = wrapRawEnvironments(code);
        return wrapped === code ? null : {code: wrapped, map: null};
      }
    },
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [
          remarkFrontmatter,
          remarkMdxFrontmatter,
          remarkMath,
          remarkMathEnvironments,
          remarkGfm,
          remarkCallouts
        ],
        rehypePlugins: [
          rehypeSafeUrls,
          [rehypeKatex, katexOptions],
          rehypeFigure
        ]
      })
    },
    react({include: /\.(jsx|js|mdx|md)$/})
  ],
  base: "/",
  // Milkdown (the editor) bundles Vue 3's esm-bundler build, which wants these
  // feature flags set explicitly (otherwise it logs a warning in dev).
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false
  },
  build: {
    // matches the GitHub Pages deploy workflow (uploads ./build) and .gitignore
    outDir: "build",
    emptyOutDir: true,
    // Two HTML entry points: the portfolio (/) and the editor (/admin/). Vite
    // emits build/index.html and build/admin/index.html; the editor's code stays
    // out of the portfolio bundle because the main entry never imports it.
    // (The editor alone, for a separate login-protected host, is built by
    // vite.admin.config.js, see docs/editor-hosting.md.)
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        admin: fileURLToPath(new URL("./admin/index.html", import.meta.url))
      }
    }
  }
});
