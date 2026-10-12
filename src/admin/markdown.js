// Markdown -> HTML with the SAME transforms the site applies to .md posts
// (vite.config.js: remark-math, remark-gfm, rehype-safe-urls, rehype-katex,
// rehype-figure), for the editor's live preview. No MDX and no eval: raw HTML in
// the Markdown is dropped, exactly like an .md post on the site, and nothing
// here needs 'unsafe-eval' (the editor page has a strict CSP).
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import {unified} from "unified";
import rehypeFigure from "../../plugins/rehype-figure.js";
import {
  katexOptions,
  remarkMathEnvironments,
  wrapRawEnvironments
} from "../../plugins/math-env.js";
import remarkCallouts from "../../plugins/remark-callouts.js";
import rehypeSafeUrls from "../../plugins/rehype-safe-urls.js";

// remark-rehype writes GFM table alignment as the legacy align="" attribute; the
// site's MDX pipeline turns it into style="text-align:..". Do the same so the
// preview and the site render tables identically.
function rehypeAlignToStyle() {
  const walk = node => {
    if (
      node.type === "element" &&
      (node.tagName === "td" || node.tagName === "th") &&
      node.properties?.align
    ) {
      node.properties.style = `text-align:${node.properties.align}`;
      delete node.properties.align;
    }
    node.children?.forEach(walk);
  };
  return tree => walk(tree);
}

const processor = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkMathEnvironments)
  .use(remarkGfm)
  .use(remarkCallouts)
  .use(remarkRehype)
  .use(rehypeAlignToStyle)
  .use(rehypeSafeUrls)
  .use(rehypeKatex, {...katexOptions, strict: "ignore", throwOnError: false})
  .use(rehypeFigure)
  .use(rehypeStringify);

/** @returns {string} HTML for the post body (what goes in .mt-article-body) */
export function renderBody(markdown) {
  return String(
    processor.processSync(wrapRawEnvironments(String(markdown ?? "")))
  );
}
