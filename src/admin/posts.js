// Published posts as seen through the GitHub API, and the draft documents the
// editor works on.
import {POSTS_DIR, NEW_POST_EXT} from "./config.js";
import {parse} from "./frontmatter.js";
import {cleanTags, mapLimit, todayISO} from "./postprocess.js";
import {newId} from "./store.js";

/** Is this story kept off the site (`draft: true` in its front matter)? Drafts
 *  saved before the switch existed keep the flag among their extra fields. */
export const isHidden = draft => draft.hidden ?? draft.extra?.draft === true;

export const slugOf = name => name.replace(/\.mdx?$/, "");
export const extOf = name => (name.endsWith(".mdx") ? ".mdx" : ".md");

/** One row per post file: title/date/tags read from the frontmatter. */
export async function listPublished(gh) {
  const entries = (await gh.listDir(POSTS_DIR, {missingOk: true})).filter(
    e => e.type === "file" && /\.mdx?$/.test(e.name) && !e.name.startsWith("_")
  );
  const posts = await mapLimit(entries, 4, async e => {
    const base = {
      path: e.path,
      slug: slugOf(e.name),
      ext: extOf(e.name),
      sha: e.sha,
      title: slugOf(e.name),
      date: "",
      tags: [],
      draft: false,
      redirectFrom: [],
      error: null
    };
    try {
      const {text} = await gh.readText(e.path);
      const {data} = parse(text);
      return {
        ...base,
        title: String(data.title || base.title),
        date: String(data.date || ""),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        draft: data.draft === true,
        redirectFrom: Array.isArray(data.redirect_from)
          ? data.redirect_from.map(String)
          : []
      };
    } catch (err) {
      return {...base, error: err.message || String(err)};
    }
  });
  return posts.sort(
    (a, b) =>
      new Date(b.date || 0) - new Date(a.date || 0) ||
      a.slug.localeCompare(b.slug)
  );
}

export function newDraft() {
  return {
    id: newId(),
    kind: "new",
    path: "",
    ext: NEW_POST_EXT,
    baseSha: "",
    slug: "",
    title: "",
    excerpt: "",
    tags: [],
    cover: "",
    hidden: false,
    date: todayISO(),
    extra: {},
    body: "",
    mode: "wysiwyg"
  };
}

/** Download an existing post into an editable draft. Throws if the file's
 *  frontmatter is outside the subset frontmatter.js understands. */
export async function draftFromRemote(gh, post) {
  const {text, sha} = await gh.readText(post.path);
  const {data, body} = parse(text);
  // `draft: true` hides a post from the site; the editor shows it as a switch
  const {title, date, excerpt, tags, cover, draft: hidden, ...extra} = data;
  return {
    id: newId(),
    kind: "edit",
    path: post.path,
    ext: post.ext,
    baseSha: sha,
    slug: post.slug,
    title: String(title ?? ""),
    excerpt: String(excerpt ?? ""),
    tags: cleanTags(Array.isArray(tags) ? tags : []),
    cover: typeof cover === "string" ? cover : "",
    hidden: hidden === true,
    date: String(date || todayISO()),
    extra,
    body,
    // hand-written .mdx may contain JSX the visual editor would mangle
    mode: post.ext === ".mdx" ? "source" : "wysiwyg"
  };
}
