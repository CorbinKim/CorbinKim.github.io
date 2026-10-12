// Where the /admin/ editor publishes to. Plain constants, no DOM, so the pure
// helpers (postprocess.js) can be unit-tested under node.

export const REPO = {
  owner: "CorbinKim",
  repo: "CorbinKim.github.io",
  branch: "main"
};

// Draft sync (optional): unpublished stories are copied to this PRIVATE repository
// so they can be continued on another device. It must exist, be private, and be
// in the token's repository list (Contents: Read and write); otherwise the editor
// simply keeps drafts on this device. See docs/draft-sync.md.
export const DRAFTS_REPO = {
  owner: "CorbinKim",
  repo: "blog-drafts",
  branch: "main"
};

export const SITE_URL = "https://corbinkim.github.io";

// Repo-relative locations the site builds from.
export const POSTS_DIR = "src/blog/posts";
export const IMAGES_DIR = "public/img/blog";

// Site-absolute URL prefix of those images (public/ is served at the root).
export const IMAGE_URL_BASE = "/img/blog";

// Images pasted into a story that is not published yet live under this
// placeholder path inside the Markdown; it is rewritten to /img/blog/<slug>/ at
// publish time (the slug can still change until then).
export const DRAFT_IMAGE_PREFIX = `${IMAGE_URL_BASE}/__draft__/`;

// Stories written in the editor are plain Markdown (no JSX), see vite.config.js.
export const NEW_POST_EXT = ".md";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// True in the editor build that runs on its own host (vite.admin.config.js).
export const ADMIN_ONLY =
  typeof import.meta.env !== "undefined" &&
  import.meta.env.VITE_ADMIN_ONLY === "1";

/** A site-absolute URL (/img/blog/x.png) as the editor should load it. Pictures
 *  of published posts live on the live site; when the editor itself runs on
 *  another host, a bare "/img/..." would 404, so point it at the live site. */
export function siteAsset(src, adminOnly = ADMIN_ONLY) {
  if (!adminOnly || typeof src !== "string") return src;
  return src.startsWith("/") && !src.startsWith("//") ? SITE_URL + src : src;
}

// Development only: lets `vite dev` talk to a local mock of the GitHub API
// (test/mock-github-server.js) instead of api.github.com. The condition is a
// build-time constant, so production bundles never contain an override.
export const API_BASE =
  import.meta.env?.DEV && import.meta.env.VITE_ADMIN_API_BASE
    ? import.meta.env.VITE_ADMIN_API_BASE
    : undefined;

// Development only: a second mock server for the drafts repository.
export const DRAFTS_API_BASE =
  import.meta.env?.DEV && import.meta.env.VITE_ADMIN_DRAFTS_API_BASE
    ? import.meta.env.VITE_ADMIN_DRAFTS_API_BASE
    : undefined;
