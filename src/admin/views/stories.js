// Home screen: local drafts + the posts already on the site.
import {h, clear, formatDate, formatTime} from "../dom.js";
import {SITE_URL} from "../config.js";
import {pullRemoteDraft} from "../syncops.js";
import {deleteDraft, listDrafts, saveDraft} from "../store.js";
import {draftFromRemote, listPublished, newDraft} from "../posts.js";
import {brandLink, topBar} from "../ui.js";

const DOCS_URL =
  "https://github.com/CorbinKim/CorbinKim.github.io/blob/main/docs/draft-sync.md";
const HINT_KEY = "blogadmin:syncHintDismissed";
const syncHintDismissed = () => {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
};
const dismissSyncHint = () => {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    // not remembered: it will show again
  }
};

export function storiesView(ctx) {
  let destroyed = false;

  const draftsHost = h("div");
  const publishedHost = h("div");

  function startNew() {
    const draft = newDraft();
    if (!saveDraft(draft)) {
      ctx.toast(
        "This browser cannot store drafts (storage is full or blocked, e.g. a private window).",
        "error"
      );
      return;
    }
    ctx.navigate(`#/draft/${draft.id}`);
  }

  // ---- drafts ---------------------------------------------------------------------
  let remote = []; // drafts that exist only in the private drafts repository

  async function loadRemote() {
    await ctx.syncReady;
    if (destroyed) return;
    if (ctx.sync) {
      try {
        remote = await ctx.sync.list();
      } catch {
        remote = [];
      }
    }
    renderDrafts();
  }

  function syncLine() {
    const {state, reason} = ctx.syncStatus || {};
    if (state === "on") return "synced across your devices";
    if (state === "checking") return "checking draft sync…";
    if (state === "unavailable" && reason)
      return "sync is off: saved in this browser only";
    return "saved in this browser only";
  }

  async function openRemote(entry, row) {
    if (row.classList.contains("is-loading")) return;
    row.classList.add("is-loading");
    try {
      await pullRemoteDraft(ctx, entry.id);
      ctx.navigate(`#/draft/${entry.id}`);
    } catch (err) {
      row.classList.remove("is-loading");
      ctx.toast(`Could not open the draft: ${err.message}`, "error");
    }
  }

  function renderDrafts() {
    clear(draftsHost);
    const drafts = listDrafts();
    const here = new Set(drafts.map(d => d.id));
    const elsewhere = remote.filter(r => !here.has(r.id));
    const status = ctx.syncStatus || {};
    const showHint = status.state === "unavailable" && !syncHintDismissed();
    if (!drafts.length && !elsewhere.length && !showHint) return;

    draftsHost.append(
      h(
        "div",
        {class: "section-head"},
        h("h2", null, "Drafts"),
        h("span", {class: "mono muted"}, syncLine())
      )
    );
    if (showHint) {
      draftsHost.append(
        h(
          "p",
          {class: "notice small"},
          `Draft sync is off: ${status.reason} `,
          h(
            "a",
            {href: DOCS_URL, target: "_blank", rel: "noopener noreferrer"},
            "How to turn it on"
          ),
          " · ",
          h(
            "button",
            {
              class: "btn btn-quiet small",
              type: "button",
              onclick: () => {
                dismissSyncHint();
                renderDrafts();
              }
            },
            "Don't show again"
          )
        )
      );
    }
    if (!drafts.length && !elsewhere.length) return;
    draftsHost.append(
      h(
        "ul",
        {class: "rows"},
        drafts.map(d =>
          h(
            "li",
            {class: "row"},
            h(
              "div",
              {class: "row-main"},
              h(
                "a",
                {class: "row-title", href: `#/draft/${d.id}`},
                d.title || "Untitled story"
              ),
              h(
                "div",
                {class: "row-meta"},
                d.kind === "edit"
                  ? `editing ${d.path.split("/").pop()}`
                  : "new story",
                " · ",
                formatTime(d.updatedAt || Date.now()),
                ctx.sync
                  ? d.sync && !d.syncPending
                    ? " · synced"
                    : " · not synced yet"
                  : ""
              )
            ),
            h(
              "button",
              {
                class: "btn btn-quiet",
                type: "button",
                onclick: async () => {
                  const also = ctx.sync ? " (and its synced copy)" : "";
                  if (
                    !confirm(
                      `Discard this draft${
                        d.title ? ` “${d.title}”` : ""
                      }${also}? This cannot be undone.`
                    )
                  )
                    return;
                  await deleteDraft(d.id);
                  ctx.sync?.remove(d.id).catch(() => {});
                  renderDrafts();
                }
              },
              "Discard"
            )
          )
        ),
        elsewhere.map(r => {
          const row = h("li", {class: "row"});
          row.append(
            h(
              "div",
              {class: "row-main"},
              h(
                "a",
                {
                  class: "row-title",
                  href: "#/",
                  onclick: e => {
                    e.preventDefault();
                    openRemote(r, row);
                  }
                },
                r.title || "Untitled story",
                h("span", {class: "badge"}, "from another device")
              ),
              h(
                "div",
                {class: "row-meta"},
                r.kind === "edit"
                  ? `editing ${r.path.split("/").pop()}`
                  : "new story",
                " · ",
                formatTime(r.updatedAt)
              )
            ),
            h(
              "button",
              {
                class: "btn btn-quiet",
                type: "button",
                onclick: async () => {
                  if (
                    !confirm(
                      `Discard “${
                        r.title || "Untitled story"
                      }” everywhere? This cannot be undone.`
                    )
                  )
                    return;
                  try {
                    await ctx.sync.remove(r.id);
                    remote = remote.filter(x => x.id !== r.id);
                    renderDrafts();
                  } catch (err) {
                    ctx.toast(err.message, "error");
                  }
                }
              },
              "Discard"
            )
          );
          return row;
        })
      )
    );
  }

  // ---- published ---------------------------------------------------------------
  async function openPublished(post, row) {
    const existing = listDrafts().find(
      d => d.kind === "edit" && d.path === post.path
    );
    if (existing) {
      ctx.toast("Resuming your unpublished edits to this post.");
      ctx.navigate(`#/draft/${existing.id}`);
      return;
    }
    if (row.classList.contains("is-loading")) return; // double click
    row.classList.add("is-loading");
    try {
      const draft = await draftFromRemote(ctx.gh, post);
      // another click (or tab) may have created the draft while we were reading
      const again = listDrafts().find(
        d => d.kind === "edit" && d.path === post.path
      );
      if (again) {
        ctx.navigate(`#/draft/${again.id}`);
        return;
      }
      if (!saveDraft(draft)) {
        row.classList.remove("is-loading");
        ctx.toast(
          "This browser cannot store drafts (storage is full or blocked, e.g. a private window).",
          "error"
        );
        return;
      }
      ctx.navigate(`#/draft/${draft.id}`);
    } catch (err) {
      row.classList.remove("is-loading");
      ctx.toast(`Could not open “${post.title}”: ${err.message}`, "error");
    }
  }

  function renderPublished(posts) {
    clear(publishedHost);
    publishedHost.append(
      h(
        "div",
        {class: "section-head"},
        h("h2", null, "Published"),
        h(
          "button",
          {class: "btn btn-quiet", type: "button", onclick: () => load(true)},
          "Refresh"
        )
      )
    );
    if (!posts.length) {
      publishedHost.append(
        h("p", {class: "muted"}, "No posts on the site yet.")
      );
      return;
    }
    publishedHost.append(
      h(
        "ul",
        {class: "rows"},
        posts.map(p => {
          const row = h("li", {class: "row"});
          row.append(
            h(
              "div",
              {class: "row-main"},
              h(
                "a",
                {
                  class: "row-title",
                  href: "#/",
                  onclick: e => {
                    e.preventDefault();
                    openPublished(p, row);
                  }
                },
                p.title,
                p.ext === ".mdx" ? h("span", {class: "badge"}, ".mdx") : null,
                p.draft ? h("span", {class: "badge"}, "hidden") : null
              ),
              h(
                "div",
                {class: "row-meta"},
                [formatDate(p.date), ...p.tags].filter(Boolean).join(" · "),
                p.error ? ` · ⚠ ${p.error}` : ""
              )
            ),
            h(
              "a",
              {
                class: "btn btn-quiet",
                href: `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`,
                target: "_blank",
                rel: "noopener noreferrer"
              },
              "View ↗"
            )
          );
          return row;
        })
      )
    );
  }

  async function load(force = false) {
    clear(publishedHost);
    publishedHost.append(h("p", {class: "muted"}, "Loading published posts…"));
    try {
      const posts = await ctx.getPublished(force);
      if (!destroyed) renderPublished(posts);
    } catch (err) {
      if (destroyed) return;
      clear(publishedHost);
      publishedHost.append(
        h("p", {class: "error"}, err.message || String(err)),
        h(
          "button",
          {class: "btn", type: "button", onclick: () => load(true)},
          "Try again"
        )
      );
    }
  }

  const el = h(
    "div",
    null,
    topBar({
      left: brandLink(),
      right: [
        ctx.user?.login
          ? h("span", {class: "mono muted"}, ctx.user.login)
          : null,
        h(
          "button",
          {class: "btn btn-quiet", type: "button", onclick: ctx.signOut},
          "Sign out"
        ),
        h(
          "button",
          {class: "btn btn-primary", type: "button", onclick: startNew},
          "New story"
        )
      ]
    }),
    h(
      "main",
      {class: "page"},
      h("h1", null, "Your stories"),
      h(
        "p",
        {class: "lede"},
        "Write in the editor, press Publish, and the site rebuilds in about a minute."
      ),
      draftsHost,
      publishedHost
    )
  );

  renderDrafts();
  loadRemote();
  load();

  return {
    el,
    destroy() {
      destroyed = true;
    }
  };
}
