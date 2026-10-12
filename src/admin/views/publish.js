// Publish / delete dialogs: one atomic commit through the GitHub API, then
// follow the Pages deploy workflow until the site is live.
import {h, append, clear} from "../dom.js";
import {IMAGES_DIR, POSTS_DIR, SITE_URL} from "../config.js";
import {stringify} from "../frontmatter.js";
import {
  cleanTags,
  finalizeBody,
  draftImageNames,
  finalizeCover,
  isBlankBody,
  isValidSlug,
  suggestSlug
} from "../postprocess.js";
import {deleteDraft, listImages} from "../store.js";
import {createDialog} from "../ui.js";

/** The copy in the private drafts repository (if any) must not outlive the
 *  story; failures only leave a stale draft there, never block the publish. */
function removeSyncedCopy(ctx, id) {
  ctx.sync?.remove(id).catch(() => {});
}

/** A problem the owner can fix (shown as-is, not a bug). */
class UserError extends Error {}

const DOT = {pending: "○", active: "…", done: "✓", fail: "✗"};

function oneLine(text, max = 72) {
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** The files one publish commits: the post, plus every image it references. */
async function buildFiles(draft, slug) {
  const names = draftImageNames(draft);
  const stored = new Map(
    (await listImages(draft.id)).map(i => [i.name, i.blob])
  );
  const missing = names.filter(n => !stored.has(n));
  if (missing.length) {
    throw new UserError(
      `These images are no longer stored in this browser: ${missing.join(
        ", "
      )}. ` + "Delete them from the story and insert them again."
    );
  }
  const path = draft.path || `${POSTS_DIR}/${slug}${draft.ext}`;
  const text = stringify({
    data: {
      ...draft.extra,
      title: draft.title.trim(),
      date: draft.date,
      excerpt: draft.excerpt.trim(),
      tags: cleanTags(draft.tags),
      cover: finalizeCover(draft.cover, slug) || undefined
    },
    body: finalizeBody(draft.body, slug)
  });
  const writes = [{path, text}];
  for (const name of names) {
    writes.push({
      path: `${IMAGES_DIR}/${slug}/${name}`,
      bytes: new Uint8Array(await stored.get(name).arrayBuffer())
    });
  }
  return {path, writes};
}

function problemsWith(draft) {
  const problems = [];
  if (!draft.title.trim()) problems.push("Add a title.");
  if (isBlankBody(draft.body)) problems.push("The story is empty.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date || ""))
    problems.push("Pick a valid date.");
  return problems;
}

// ---- progress list ----------------------------------------------------------------

function progressList(steps) {
  const items = new Map();
  const el = h(
    "ul",
    {class: "progress"},
    steps.map(([id, label]) => {
      const dot = h("span", {class: "dot"}, DOT.pending);
      const text = h("span", null, label);
      const li = h("li", null, dot, text);
      items.set(id, {li, dot, text, label});
      return li;
    })
  );
  return {
    el,
    set(id, state, detail) {
      const it = items.get(id);
      it.dot.textContent = DOT[state];
      it.li.className = state === "pending" ? "" : `is-${state}`;
      it.text.textContent = detail ? `${it.label} — ${detail}` : it.label;
    }
  };
}

/** Follows the deploy workflow for `commitSha`. Never throws for a closed
 *  dialog; returns {state, url}. */
async function trackDeploy(gh, commitSha, progress, signal) {
  progress.set("build", "active", "waiting for GitHub Actions");
  let status;
  try {
    status = await gh.getDeployStatus(commitSha, {
      wait: true,
      signal,
      onUpdate: s => {
        if (s.state === "queued") progress.set("build", "active", "queued");
        else if (s.state === "in_progress")
          progress.set("build", "active", "building");
      }
    });
  } catch (err) {
    if (signal.aborted) return {state: "aborted"};
    progress.set(
      "build",
      "fail",
      err.message || "could not read deploy status"
    );
    return {state: "unknown"};
  }
  const actions = `https://github.com/${gh.fullName}/actions`;
  if (status.timedOut) {
    progress.set("build", "active", "still building");
    return {state: "slow", url: status.url || actions};
  }
  switch (status.state) {
    case "success":
      progress.set("build", "done", "built");
      progress.set("live", "done", "deployed");
      return {state: "success", url: status.url};
    case "failure":
      progress.set("build", "fail", "the build failed");
      return {state: "failure", url: status.url || actions};
    case "cancelled":
      progress.set("build", "done", "replaced by a newer deploy");
      return {state: "cancelled", url: status.url || actions};
    default:
      progress.set(
        "build",
        "fail",
        status.reason === "no-permission"
          ? "this token cannot read deploy status"
          : "no deploy run found"
      );
      return {state: "unknown", url: actions};
  }
}

function resultNotice(outcome, {liveUrl, verb}) {
  switch (outcome.state) {
    case "success":
      return h(
        "p",
        {class: "notice"},
        `${verb} and live. Browsers cache the site for up to 10 minutes; this link skips that.`
      );
    case "failure":
      return h(
        "p",
        {class: "notice is-warn"},
        "Your change is saved on GitHub but the site build failed, so the live site is unchanged. ",
        h(
          "a",
          {href: outcome.url, target: "_blank", rel: "noopener noreferrer"},
          "Open the build log ↗"
        )
      );
    case "cancelled":
      return h(
        "p",
        {class: "notice"},
        "A newer publish replaced this deploy; your change is included in it."
      );
    case "slow":
      return h(
        "p",
        {class: "notice"},
        "Saved to GitHub. The build is taking longer than usual, so I stopped watching. Check ",
        h(
          "a",
          {href: outcome.url, target: "_blank", rel: "noopener noreferrer"},
          "the Actions tab ↗"
        ),
        "."
      );
    case "unknown":
      return h(
        "p",
        {class: "notice"},
        "Saved to GitHub. I could not confirm the deploy, check ",
        h(
          "a",
          {href: outcome.url, target: "_blank", rel: "noopener noreferrer"},
          "the Actions tab ↗"
        ),
        "."
      );
    default:
      return null;
  }
}

// ---- publish ------------------------------------------------------------------------

/** @returns {Promise<{published: boolean}>} resolves when the dialog closes */
export function openPublish(ctx, draft, {onCommitted, returnFocus}) {
  return new Promise(resolve => {
    const gh = ctx.gh;
    const isEdit = draft.kind === "edit";
    const verb = isEdit ? "Updated" : "Published";
    const ac = new AbortController();
    let running = false;
    let published = false;
    let chosenSlug = draft.slug || suggestSlug(draft.title, draft.date);

    const dlg = createDialog({
      title: isEdit ? "Update story" : "Publish story",
      returnFocus,
      canClose: () => !running,
      onClose: () => {
        ac.abort();
        resolve({published});
      }
    });

    function closeButton(label = "Close") {
      return h(
        "button",
        {class: "btn", type: "button", onclick: dlg.close},
        label
      );
    }

    // ---- 1. review ----------------------------------------------------------------
    async function showReview() {
      running = false;
      clear(dlg.body);
      clear(dlg.actions);
      dlg.setTitle(isEdit ? "Update story" : "Publish story");

      const problems = problemsWith(draft);
      const slugInput = h("input", {
        class: "input",
        id: "slug",
        value: chosenSlug,
        readOnly: isEdit,
        spellcheck: false,
        autocapitalize: "off",
        autocomplete: "off"
      });
      const slugMsg = h("p", {class: "mono muted"});
      const filesHost = h("ul", {class: "files"});
      const go = h(
        "button",
        {class: "btn btn-primary", type: "button"},
        isEdit ? "Update" : "Publish"
      );

      const names = draftImageNames(draft);
      function refresh() {
        const slug = slugInput.value.trim();
        chosenSlug = slug;
        const ok = isValidSlug(slug);
        slugMsg.textContent = ok
          ? `${SITE_URL.replace("https://", "")}/blog/${slug}`
          : "Use lowercase letters, numbers and single hyphens (a-z, 0-9, -).";
        slugMsg.style.color = ok ? "" : "var(--danger)";
        clear(filesHost);
        const path = draft.path || `${POSTS_DIR}/${slug || "…"}${draft.ext}`;
        filesHost.append(h("li", null, path));
        for (const n of names)
          filesHost.append(h("li", null, `${IMAGES_DIR}/${slug || "…"}/${n}`));
        go.disabled = !ok || problems.length > 0;
      }
      slugInput.addEventListener("input", refresh);
      refresh();

      append(dlg.body, [
        h(
          "p",
          {class: "muted"},
          `One commit to ${gh.branch} on ${gh.fullName}. The site rebuilds automatically, about a minute.`
        ),
        problems.length
          ? h(
              "ul",
              {class: "error"},
              problems.map(p => h("li", null, p))
            )
          : null,
        h(
          "label",
          {class: "field", for: "slug"},
          h("span", null, isEdit ? "Slug (fixed)" : "Slug (URL)"),
          slugInput
        ),
        slugMsg,
        filesHost
      ]);
      dlg.actions.append(closeButton("Cancel"), go);
      go.addEventListener("click", () => run(slugInput.value.trim()));
      slugInput.addEventListener("keydown", e => {
        if (
          e.key === "Enter" &&
          !go.disabled &&
          !(e.isComposing || e.keyCode === 229)
        ) {
          e.preventDefault();
          go.click();
        }
      });
      if (!isEdit) slugInput.focus();
    }

    // ---- 2. run ---------------------------------------------------------------------
    async function run(slug) {
      running = true;
      clear(dlg.body);
      clear(dlg.actions);
      dlg.setTitle(isEdit ? "Updating…" : "Publishing…");
      const progress = progressList([
        ["commit", "Saving to GitHub"],
        ["build", "Building the site"],
        ["live", "Live"]
      ]);
      dlg.body.append(progress.el);
      progress.set("commit", "active");

      let commitSha = null;
      try {
        const {path, writes} = await buildFiles(draft, slug);

        // Compare with what is on GitHub right now (one cheap directory read).
        const entries = await gh.listDir(POSTS_DIR, {missingOk: true});
        if (!isEdit) {
          if (
            entries.some(
              e => e.name === `${slug}.md` || e.name === `${slug}.mdx`
            )
          )
            throw new UserError(
              `A post called “${slug}” already exists. Choose a different slug.`
            );
        } else {
          const remote = entries.find(e => e.path === path);
          if (remote && remote.sha !== draft.baseSha) {
            const overwrite = confirm(
              "This post was changed on GitHub after you opened it here.\n\nOverwrite those changes with your version?"
            );
            if (!overwrite)
              throw new UserError("Cancelled: nothing was changed.");
          }
        }

        const message = `${isEdit ? "Update" : "Publish"}: ${oneLine(
          draft.title
        )}`;
        const res = await gh.commitFiles({message, writes});
        published = true;
        onCommitted?.();
        await deleteDraft(draft.id);
        removeSyncedCopy(ctx, draft.id);

        if (res.noChanges) {
          progress.set("commit", "done", "already up to date");
          progress.set("build", "done", "nothing to build");
          progress.set("live", "done");
          running = false;
          dlg.actions.append(closeButton("Done"));
          return;
        }
        commitSha = res.commitSha;
        progress.set("commit", "done", commitSha.slice(0, 7));
      } catch (err) {
        running = false;
        progress.set("commit", "fail");
        dlg.body.append(h("p", {class: "error"}, err.message || String(err)));
        dlg.actions.append(
          closeButton(),
          h(
            "button",
            {class: "btn", type: "button", onclick: showReview},
            "Back"
          )
        );
        return;
      }

      // The change is on GitHub: nothing left to protect, so the dialog may be
      // closed while the site builds (closing just stops watching).
      running = false;
      dlg.setTitle("Saved, building…");
      dlg.actions.append(closeButton("Close (keep building)"));
      const outcome = await trackDeploy(gh, commitSha, progress, ac.signal);
      if (outcome.state === "aborted") return;
      clear(dlg.actions);
      const liveUrl = `${SITE_URL}/blog/${slug}?v=${commitSha.slice(0, 7)}`;
      dlg.setTitle(
        outcome.state === "failure" ? "Saved, build failed" : `${verb}`
      );
      const notice = resultNotice(outcome, {liveUrl, verb});
      if (notice) dlg.body.append(notice);
      dlg.actions.append(closeButton("Done"));
      if (outcome.state === "success" || outcome.state === "cancelled") {
        dlg.actions.append(
          h(
            "a",
            {
              class: "btn btn-primary",
              href: liveUrl,
              target: "_blank",
              rel: "noopener noreferrer"
            },
            "View post ↗"
          )
        );
      }
    }

    showReview();
  });
}

// ---- delete --------------------------------------------------------------------------

/** @returns {Promise<{deleted: boolean}>} */
export function openDelete(ctx, draft, {onCommitted, returnFocus}) {
  return new Promise(resolve => {
    const gh = ctx.gh;
    const ac = new AbortController();
    let running = false;
    let deleted = false;

    const dlg = createDialog({
      title: "Delete post from the site",
      returnFocus,
      canClose: () => !running,
      onClose: () => {
        ac.abort();
        resolve({deleted});
      }
    });

    const cancel = h(
      "button",
      {class: "btn", type: "button", onclick: dlg.close},
      "Cancel"
    );
    const go = h(
      "button",
      {class: "btn btn-danger", type: "button"},
      "Delete post"
    );
    dlg.body.append(
      h(
        "p",
        null,
        "This removes ",
        h("strong", null, draft.title || draft.slug),
        ` (${draft.path}) and the images under ${IMAGES_DIR}/${draft.slug}/ from the site. The commit stays in GitHub's history, so it can be restored.`
      )
    );
    if (draft.localEdits) {
      dlg.body.append(
        h(
          "p",
          {class: "muted"},
          "Your unpublished edits to this post in this browser are discarded too."
        )
      );
    }
    dlg.actions.append(cancel, go);

    go.addEventListener("click", async () => {
      running = true;
      clear(dlg.body);
      clear(dlg.actions);
      dlg.setTitle("Deleting…");
      const progress = progressList([
        ["commit", "Saving to GitHub"],
        ["build", "Rebuilding the site"],
        ["live", "Live"]
      ]);
      dlg.body.append(progress.el);
      progress.set("commit", "active");
      let commitSha;
      try {
        const images = await gh.listTree(`${IMAGES_DIR}/${draft.slug}`);
        const res = await gh.commitFiles({
          message: `Delete: ${oneLine(draft.title || draft.slug)}`,
          deletes: [draft.path, ...images.map(i => i.path)]
        });
        deleted = true;
        onCommitted?.();
        // a post deleted straight from the list may have no draft in this browser
        if (draft.id) {
          await deleteDraft(draft.id);
          removeSyncedCopy(ctx, draft.id);
        }
        commitSha = res.commitSha;
        progress.set("commit", "done", commitSha.slice(0, 7));
      } catch (err) {
        running = false;
        progress.set("commit", "fail");
        dlg.body.append(h("p", {class: "error"}, err.message || String(err)));
        dlg.actions.append(
          h(
            "button",
            {class: "btn", type: "button", onclick: dlg.close},
            "Close"
          )
        );
        return;
      }
      running = false;
      dlg.setTitle("Deleted, rebuilding…");
      dlg.actions.append(
        h(
          "button",
          {class: "btn", type: "button", onclick: dlg.close},
          "Close (keep building)"
        )
      );
      const outcome = await trackDeploy(gh, commitSha, progress, ac.signal);
      if (outcome.state === "aborted") return;
      clear(dlg.actions);
      dlg.setTitle("Deleted");
      const notice = resultNotice(outcome, {verb: "Deleted"});
      if (notice) dlg.body.append(notice);
      dlg.actions.append(
        h(
          "button",
          {class: "btn btn-primary", type: "button", onclick: dlg.close},
          "Done"
        )
      );
    });
  });
}
