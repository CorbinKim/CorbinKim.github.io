// Content-Security-Policy of the /admin/ editor page, shared by the public build
// (vite.config.js) and the separate editor build (vite.admin.config.js).
//
// The GitHub token lives in this origin's storage, so the editor gets a strict
// policy: scripts only from itself, network only to api.github.com.
// 'unsafe-inline' is for STYLES only (CodeMirror and KaTeX set inline styles);
// no inline scripts are allowed.

/** @param {{siteImages?: string}} o  siteImages: origin to load pictures of
 *  published posts from, when the editor runs on a different host */
export function adminPolicy({siteImages = ""} = {}) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' blob: data:${siteImages ? " " + siteImages : ""}`,
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.github.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ];
}

/** Vite plugin: the policy as a <meta> tag of the editor's HTML (build only: the
 *  dev server needs inline scripts and a websocket for hot reload). `frame-
 *  ancestors` cannot be set from a <meta>; the editor refuses to run inside a
 *  frame in code instead (src/admin/main.js). */
export function adminCspMeta(policy, htmlPathPrefix = "/admin/") {
  return {
    name: "admin-csp-meta",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.path.startsWith(htmlPathPrefix)) return html;
        return {
          html,
          tags: [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: policy.join("; ")
              },
              injectTo: "head-prepend"
            }
          ]
        };
      }
    }
  };
}
