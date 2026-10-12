// Build of the /admin/ editor ONLY, for a separate host that sits behind a login
// (Cloudflare Pages + Cloudflare Access, see docs/editor-hosting.md). The public
// portfolio build (vite.config.js -> build/) does not contain the editor.
//
//   npm run build:admin   ->  build-admin/
//
// Besides the app this emits the files Cloudflare Pages reads from the output
// directory: _headers (real HTTP security headers), _redirects (/ -> /admin/),
// robots.txt and the favicon.
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import {SITE_URL} from "./src/admin/config.js";
import {adminCspMeta, adminPolicy} from "./tools/admin-csp.js";

// img-src includes the live site because pictures of already published posts
// are served from there.
const POLICY = adminPolicy({siteImages: SITE_URL});

const HEADERS = `# Security headers for the editor (read by Cloudflare Pages)
/*
  Content-Security-Policy: ${[...POLICY, "frame-ancestors 'none'"].join("; ")}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
`;

function adminHost() {
  return {
    name: "admin-host",
    generateBundle() {
      const emit = (fileName, source) =>
        this.emitFile({type: "asset", fileName, source});
      emit("_headers", HEADERS);
      emit("_redirects", "/ /admin/ 302\n");
      emit("robots.txt", "User-agent: *\nDisallow: /\n");
      emit(
        "favicon.svg",
        fs.readFileSync(new URL("./public/favicon.svg", import.meta.url))
      );
    }
  };
}

export default defineConfig({
  plugins: [adminCspMeta(POLICY), adminHost()],
  base: "/",
  publicDir: false, // the portfolio's public/ (photos, resume ...) is not needed
  define: {
    // Milkdown bundles Vue's esm-bundler build, which wants these set
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    // this build runs on its own host: pictures of published posts live on the
    // live site (see siteAsset() in src/admin/config.js)
    "import.meta.env.VITE_ADMIN_ONLY": JSON.stringify("1")
  },
  build: {
    outDir: "build-admin",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: fileURLToPath(new URL("./admin/index.html", import.meta.url))
      }
    }
  }
});
