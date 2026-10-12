// Pure helpers (no DOM) that turn what the editor produces into the files the
// site builds. Unit-tested in test/postprocess.test.js.
import {DRAFT_IMAGE_PREFIX, IMAGE_URL_BASE} from "./config.js";

// ---- slugs -----------------------------------------------------------------

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** ASCII-only kebab-case. Returns "" for titles with no Latin letters/digits
 *  (e.g. a Korean title) - callers fall back to suggestSlug(). */
export function slugify(text, max = 60) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function suggestSlug(title, date) {
  return slugify(title) || `post-${String(date || "").replace(/\D/g, "")}`;
}

export function isValidSlug(slug) {
  return typeof slug === "string" && slug.length <= 80 && SLUG_RE.test(slug);
}

// ---- changing a published post's link ------------------------------------------

/** After a post moves to a new slug its pictures move with it: links into the
 *  old picture folder (/img/blog/<old>/...) are pointed at the new one. Other
 *  folders, including ones whose name merely starts with the old slug, stay. */
export function rewriteImageDir(text, oldSlug, newSlug) {
  const from = `${IMAGE_URL_BASE}/${oldSlug}/`;
  return String(text ?? "")
    .split(from)
    .join(`${IMAGE_URL_BASE}/${newSlug}/`);
}

/** The post's `redirect_from` list after its link changed from oldSlug to
 *  newSlug: the old address is added, the new one is removed (changing a link
 *  back), earlier addresses are kept, duplicates dropped. */
export function redirectsAfterRename(list, oldSlug, newSlug) {
  const kept = (Array.isArray(list) ? list : list ? [list] : [])
    .map(String)
    .filter(s => s && s !== newSlug);
  return [...new Set([...kept, oldSlug])].filter(s => s !== newSlug);
}

// ---- dates / tags ------------------------------------------------------------

export function todayISO(now = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function cleanTags(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const t = String(raw).replace(/\s+/g, " ").trim().slice(0, 40);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

// ---- images ------------------------------------------------------------------

// SVG is deliberately absent: opened directly it can run script on the site's
// origin (where the GitHub token lives). Export figures as PNG/JPEG/WebP.
const EXT_BY_TYPE = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif"
};
const KNOWN_EXTS = new Set([...Object.values(EXT_BY_TYPE), ".jpeg"]);

/** "<ascii-stem>-<hash8><ext>". The content hash makes names collision-free and
 *  de-duplicates a re-uploaded image. `sniffedExt` (from the file's bytes, see
 *  images.js) wins over the name; without it the name / MIME type is used.
 *  Throws for unsupported types. */
export function imageFileName(file, hash8, sniffedExt) {
  const name = String(file?.name || "");
  const dot = name.lastIndexOf(".");
  let ext = sniffedExt || (dot > 0 ? name.slice(dot).toLowerCase() : "");
  if (!sniffedExt && !KNOWN_EXTS.has(ext)) ext = EXT_BY_TYPE[file?.type] || "";
  if (!ext) {
    throw new Error(
      "Unsupported image type. Use PNG, JPEG, GIF, WebP or AVIF (export SVG as PNG)."
    );
  }
  const stem = slugify(dot > 0 ? name.slice(0, dot) : name, 40) || "image";
  return `${stem}-${hash8}${ext}`;
}

const DRAFT_IMAGE_RE = new RegExp(
  DRAFT_IMAGE_PREFIX.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") +
    "([A-Za-z0-9._-]+)",
  "g"
);

/** Names of the not-yet-published images the Markdown still references. */
export function referencedDraftImages(md) {
  return [...new Set([...String(md).matchAll(DRAFT_IMAGE_RE)].map(m => m[1]))];
}

/** Names of the not-yet-published pictures a draft uses: the body's and the cover. */
export function draftImageNames(draft) {
  const names = referencedDraftImages(draft.body);
  const cover = String(draft.cover || "");
  if (cover.startsWith(DRAFT_IMAGE_PREFIX)) {
    const name = cover.slice(DRAFT_IMAGE_PREFIX.length);
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** A cover path as it should be written to the post: a placeholder becomes the
 *  final /img/blog/<slug>/ path, a path that is already published stays. */
export function finalizeCover(cover, slug) {
  const value = String(cover || "");
  return value.startsWith(DRAFT_IMAGE_PREFIX)
    ? `${IMAGE_URL_BASE}/${slug}/${value.slice(DRAFT_IMAGE_PREFIX.length)}`
    : value;
}

/** Point placeholder image URLs at their final /img/blog/<slug>/ folder. */
export function finalizeBody(md, slug) {
  return String(md)
    .split(DRAFT_IMAGE_PREFIX)
    .join(`${IMAGE_URL_BASE}/${slug}/`);
}

// ---- Markdown ------------------------------------------------------------------

// Crepe serialises a block image as `![<height ratio>](<src> "<caption>")`: the
// alt slot holds a number (useless as alt text), the caption is the title.
const IMAGE_BLOCK =
  /^!\[(\d+(?:\.\d+)?)\]\(([^)\s]+)(?:\s+"((?:[^"\\]|\\.)*)")?\)$/;

const EMPTY_IMAGE = /^!\[[\d.]*\]\(\s*\)$/;

/** Crepe's Markdown -> the Markdown the site's pipeline expects.
 *  - block images become `![](src "caption")` (plugins/rehype-figure.js turns
 *    that into <figure><figcaption>)
 *  - an empty paragraph (Enter pressed twice) is written as `<br />` by Crepe;
 *    plain .md drops raw HTML, so remove it
 *  Code fences and $$ math blocks are never touched. */
export function toSiteMd(md) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // fences inside list items are indented 4+ spaces by Crepe
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1];
      else if (line.trim().startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    if (line.trim() === "$$") {
      fence = fence === "$$" ? null : fence || "$$";
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    // only at column 0: an indented "<br />" is content (list item, quote)
    if (line === "<br />") {
      if (lines[i + 1] !== undefined && lines[i + 1].trim() === "") i++;
      continue;
    }
    // an image block that never received an image: `![1.00]()`
    if (EMPTY_IMAGE.test(line)) {
      if (lines[i + 1] !== undefined && lines[i + 1].trim() === "") i++;
      continue;
    }
    const m = line.match(IMAGE_BLOCK);
    if (m) {
      const [, , src, caption] = m;
      out.push(caption ? `![](${src} "${caption}")` : `![](${src})`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
}

/** Rough "is there anything to publish" check on Markdown text. */
export function isBlankBody(md) {
  return !String(md)
    .replace(/<br\s*\/?>/g, "")
    .replace(/^!\[[\d.]*\]\(\s*\)$/gm, "")
    .trim();
}

// ---- misc ------------------------------------------------------------------------

/** Runs `fn` over `items` with at most `limit` in flight; keeps order. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({length: Math.min(limit, items.length)}, worker)
  );
  return results;
}

export async function sha256Hex(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    // insecure context (plain http on a LAN address): a random name is fine
    return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
