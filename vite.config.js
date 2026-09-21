import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

// Static portfolio + blog served at the domain root (corbinkim.github.io).
// Blog posts are authored as .mdx (src/blog/posts/*.mdx) with LaTeX via
// remark-math + rehype-katex. React 16.14+ ships react/jsx-runtime, so we use
// the automatic JSX runtime (Vite's default) for both the hand-written
// components and MDX's compiled output — existing files still explicitly
// `import React`, which is harmless under the automatic runtime.
export default defineConfig({
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [
          remarkFrontmatter,
          remarkMdxFrontmatter,
          remarkMath,
          remarkGfm
        ],
        rehypePlugins: [rehypeKatex]
      })
    },
    react({include: /\.(jsx|js|mdx|md)$/})
  ],
  base: "/",
  build: {
    // matches the GitHub Pages deploy workflow (uploads ./build) and .gitignore
    outDir: "build",
    emptyOutDir: true
  }
});
