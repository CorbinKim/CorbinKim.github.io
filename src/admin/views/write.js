// The writing screen: Medium-style title / subtitle / body, tags + date, with
// autosave to this browser. The body editor (Crepe) is loaded lazily.
import {h, append, autoGrow, clear, formatTime, isImeEnter} from "../dom.js";
import {DRAFT_IMAGE_PREFIX, MAX_IMAGE_BYTES, siteAsset} from "../config.js";
import {imageBase} from "../imageopts.js";
import {stringify} from "../frontmatter.js";
import {sanitizeJpeg, sniffImage} from "../images.js";
import {cleanTags, imageFileName, sha256Hex, toSiteMd} from "../postprocess.js";
import {
  deleteDraft,
  listImages,
  loadDraft,
  putImage,
  saveDraft
} from "../store.js";
import {SyncConflict} from "../sync.js";
import {pullRemoteDraft, pushLocalDraft} from "../syncops.js";
import {createToolbar} from "../toolbar.js";
import {topBar} from "../ui.js";
import {openDelete, openPublish} from "./publish.js";
import {isPlainMdx} from "../mdxcheck.js";
import {isHidden} from "../posts.js";

// ---- tags --------------------------------------------------------------------------

function tagsBox(initial, {onChange, suggestions}) {
  let tags = cleanTags(initial);
  const chips = h("span", {style: "display: contents"});
  const input = h("input", {
    type: "text",
    placeholder: "Add tags…",
    "aria-label": "Add a tag",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: false,
    list: "tag-suggestions"
  });
  const datalist = h(
    "datalist",
    {id: "tag-suggestions"},
    suggestions.map(t => h("option", {value: t}))
  );

  function render() {
    clear(chips);
    for (const t of tags) {
      chips.append(
        h(
          "span",
          {class: "tag"},
          t,
          h(
            "button",
            {
              type: "button",
              "aria-label": `Remove tag ${t}`,
              onclick: () => {
                tags = tags.filter(x => x !== t);
                render();
                onChange();
              }
            },
            "×"
          )
        )
      );
    }
  }
  function commit() {
    const parts = input.value
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    input.value = "";
    if (!parts.length) return;
    tags = cleanTags([...tags, ...parts]);
    render();
    onChange();
  }
  input.addEventListener("keydown", e => {
    if (isImeEnter(e)) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !input.value && tags.length) {
      tags = tags.slice(0, -1);
      render();
      onChange();
    }
  });
  input.addEventListener("blur", commit);
  render();

  return {
    el: h("div", {class: "tags"}, chips, input, datalist),
    get: () => {
      commit();
      return tags;
    },
    /** current chips without committing the half-typed text */
    peek: () => tags
  };
}

// ---- view ------------------------------------------------------------------------------

/** @returns {Promise<{el, destroy}|null>} null when the draft does not exist */
export async function writeView(ctx, id) {
  const draft = loadDraft(id);
  if (!draft) return null;

  // placeholder path (/img/blog/__draft__/x.png) -> blob: URL, display only
  const previews = new Map();
  for (const {name, blob} of await listImages(id)) {
    previews.set(DRAFT_IMAGE_PREFIX + name, URL.createObjectURL(blob));
  }

  // A hand-written .mdx post may hold JSX components, import lines or
  // {expressions} that the visual editor would mangle: those open as Markdown
  // only. One that is plain Markdown (math, code, tables ...) opens visually
  // like any other, and keeps its .mdx extension when saved.
  const markdownOnly = draft.ext === ".mdx" && !isPlainMdx(draft.body);
  let mode = markdownOnly
    ? "source"
    : draft.ext === ".mdx" && !draft.modeChosen
    ? "wysiwyg" // the stored mode of an .mdx draft predates this choice
    : draft.mode || "wysiwyg";
  let editor = null;
  let editorLoading = null;
  // Crepe's own serialisation of the document right after it was loaded. The
  // editor reports a "change" for the load itself, so only a markdown that
  // differs from this counts as an edit.
  let baselineMd = null;
  let savedMd = null; // the editor's text as of the last save to this browser
  let timer = 0;
  // frozen: stop writing the draft (it was published/discarded, or another tab
  // changed it). dirty: something changed since the last save, so a tab that
  // merely sits open never overwrites a newer copy. editorDirty / sourceDirty:
  // the body was actually edited, so an untouched hand-written post is never
  // re-serialised in Crepe's Markdown dialect.
  let frozen = false;
  let dirty = false;
  let editorDirty = false;
  let sourceDirty = false;
  let busy = false;
  let destroyed = false;

  // live preview (see preview.js): open by default on wide screens
  const wide = window.matchMedia("(min-width: 1100px)");
  let previewOn = (() => {
    try {
      const saved = localStorage.getItem("blogadmin:preview");
      if (saved === "1" || saved === "0") return saved === "1";
    } catch {
      // storage blocked: fall through
    }
    return wide.matches;
  })();
  let preview = null;
  let previewLoading = null;
  let previewTab = "article";
  let previewTimer = 0;
  let seenUpdatedAt = draft.updatedAt || 0;

  // ---- elements ------------------------------------------------------------------
  const status = h("span", {
    class: "bar-status",
    role: "status",
    "aria-live": "polite"
  });
  const title = h("textarea", {
    class: "title",
    rows: 1,
    placeholder: "Title",
    value: draft.title,
    "aria-label": "Title"
  });
  const subtitle = h("textarea", {
    class: "subtitle",
    rows: 1,
    placeholder: "Subtitle — shown under the title in the Writing list",
    value: draft.excerpt,
    "aria-label": "Subtitle"
  });
  const dateInput = h("input", {
    class: "input",
    type: "date",
    value: draft.date,
    "aria-label": "Date"
  });
  const tagBox = tagsBox(draft.tags, {
    onChange: schedule,
    suggestions: ctx.knownTags()
  });
  // "Hide from the site": `draft: true` in the front matter. The site then leaves
  // the story out of its list, feed, sitemap and search and serves no page for it.
  const hiddenInput = h("input", {
    type: "checkbox",
    id: "story-hidden",
    class: "hide-box"
  });
  hiddenInput.checked = isHidden(draft);
  const hideSwitch = h(
    "label",
    {class: "hide-switch", for: "story-hidden"},
    hiddenInput,
    h("span", {class: "hide-label"}, "Hide from the site"),
    h(
      "span",
      {class: "hide-help"},
      "Not listed and no page of its own. The text still sits in the public GitHub repository, so this is not a privacy setting."
    )
  );
  // Cover picture: shown on the post, on its card, and in link previews.
  const coverFile = h("input", {
    type: "file",
    class: "hidden",
    accept: "image/png,image/jpeg,image/gif,image/webp,image/avif",
    "aria-hidden": "true",
    tabIndex: -1,
    onchange: async () => {
      const file = coverFile.files[0];
      coverFile.value = "";
      if (!file) return;
      try {
        draft.cover = await addImage(file);
        paintCover();
        schedule();
      } catch {
        // addImage already told the owner why this file was refused
      }
    }
  });
  const coverBox = h("div", {class: "cover-box"});
  function paintCover() {
    clear(coverBox);
    if (!draft.cover) {
      coverBox.append(
        h(
          "button",
          {
            class: "cover-add",
            type: "button",
            onclick: () => coverFile.click()
          },
          h("strong", null, "＋ Add a cover image"),
          h(
            "span",
            {class: "muted small"},
            "Shown at the top of the post, on its card and in link previews. 1200 × 630 works best."
          )
        )
      );
      return;
    }
    coverBox.append(
      h("img", {
        class: "cover-img",
        src: previews.get(draft.cover) ?? siteAsset(draft.cover),
        alt: "Cover image"
      }),
      h(
        "div",
        {class: "cover-actions"},
        h(
          "button",
          {class: "btn", type: "button", onclick: () => coverFile.click()},
          "Replace"
        ),
        h(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: () => {
              draft.cover = "";
              paintCover();
              schedule();
            }
          },
          "Remove"
        )
      )
    );
  }
  const editorRoot = h("div", {class: "editor-root"});
  // Buttons for headings, lists, links, images, tables, math ... (toolbar.js).
  // An image button uploads through addImage (below) and inserts an image block.
  const toolbar = createToolbar({
    insertImages: async files => {
      let added = 0;
      for (const file of files) {
        try {
          editor?.commands.image(await addImage(file));
          added++;
        } catch {
          // addImage already told the owner why this file was refused
        }
      }
      editor?.focus();
      if (added) pictureHint();
    }
  });

  /** The size controls only appear on a picture you hover or click: say so the
   *  first couple of times, then stay quiet. (Browser storage may be blocked:
   *  then the hint simply shows every time.) */
  function pictureHint() {
    const key = "blogadmin:hint:picture";
    let shown = 0;
    try {
      shown = Number(localStorage.getItem(key)) || 0;
    } catch {
      // private window / blocked storage
    }
    if (shown >= 2) return;
    try {
      localStorage.setItem(key, String(shown + 1));
    } catch {
      // ignore
    }
    ctx.toast(
      "Picture added. Hover it and drag a corner to resize, or click it for size and alignment.",
      "hint",
      7000
    );
  }
  const source = h("textarea", {
    class: "source",
    spellcheck: false,
    autocapitalize: "off",
    autocorrect: "off",
    "aria-label": "Markdown source",
    value: draft.body
  });
  // Markdown mode has no toolbar: say why, and where it is
  const sourceNote = h(
    "p",
    {class: "notice hidden"},
    markdownOnly
      ? "This post uses MDX components or {expressions}, which the visual editor would damage, so it can only be edited as Markdown. A new story has the full toolbar (pictures, tables, callouts…)."
      : "Markdown mode has no toolbar. Press “Visual editor” (top right) to add pictures, tables and more with buttons."
  );
  const modeBtn = h("button", {
    class: "btn btn-quiet",
    type: "button",
    onclick: () => setMode(mode === "source" ? "wysiwyg" : "source")
  });
  const publishBtn = h(
    "button",
    {class: "btn btn-primary", type: "button", onclick: onPublish},
    draft.kind === "edit" ? "Update" : "Publish"
  );

  // ---- persistence ----------------------------------------------------------------
  function setStatus(text, warn = false) {
    status.textContent = text;
    status.classList.toggle("is-warn", warn);
  }

  /** The visual editor's text as the site's Markdown, or null while it is
   *  untouched (then the original text is kept as it was). Compares the LIVE
   *  document, not the editor's change event: that event is debounced (~200 ms),
   *  so acting right after typing must not see a stale "unchanged". */
  function editorBody() {
    if (!editor) return null;
    const md = editor.getMarkdown();
    if (!editorDirty && md === baselineMd) return null;
    editorDirty = true;
    return toSiteMd(md);
  }

  function currentBody() {
    if (mode === "source") return source.value;
    return editorBody() ?? draft.body; // loading, or nothing typed in it
  }

  function collect() {
    draft.title = title.value;
    draft.excerpt = subtitle.value;
    draft.date = dateInput.value; // empty stays empty: Publish asks for a date
    draft.tags = tagBox.get();
    draft.hidden = hiddenInput.checked;
    draft.body = currentBody();
    draft.mode = mode;
  }

  /** @returns {boolean} true when the draft is stored or there is nothing to
   *  store; false when saving failed or this tab must not save any more. */
  // ---- draft sync (private drafts repository, see sync.js) ---------------------------
  let syncTimer = 0;
  let syncing = false;
  let syncConflict = null; // the draft.json on GitHub when another device changed it
  let savedLabel = draft.updatedAt
    ? `Saved in this browser · ${formatTime(draft.updatedAt)}`
    : "New draft";

  const needsSync = () => !draft.sync || draft.syncPending;

  function syncText() {
    if (!ctx.sync) return "";
    if (syncConflict) return " · ⚠ changed on another device";
    if (syncing) return " · syncing…";
    return needsSync() ? " · will sync" : " · synced";
  }

  // set once another tab took over this story: nothing may paint over the warning
  let lockedMessage = "";

  function paintSaved() {
    if (lockedMessage) {
      setStatus(lockedMessage, true);
      return;
    }
    setStatus(savedLabel + syncText(), !!syncConflict);
  }

  function scheduleSync(ms = 8000) {
    if (!ctx.sync || frozen || syncConflict) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow(), ms);
  }

  async function syncNow({force = false} = {}) {
    clearTimeout(syncTimer);
    if (!ctx.sync || syncing || frozen) return;
    if (syncConflict && !force) return;
    if (!needsSync() && !force) return;
    if (otherTabChanged()) return;
    syncing = true;
    paintSaved();
    const startedAt = draft.updatedAt;
    try {
      const {rev, images} = await pushLocalDraft(ctx, draft, {
        force,
        expectedRev: force && syncConflict ? syncConflict.updatedAt : undefined
      });
      const editedMeanwhile = draft.updatedAt !== startedAt;
      draft.sync = {rev, images};
      draft.syncPending = editedMeanwhile;
      syncConflict = null;
      // remember the new rev unless another tab took over while we were pushing
      if (!otherTabChanged()) {
        saveDraft(draft);
        seenUpdatedAt = draft.updatedAt;
        if (editedMeanwhile) scheduleSync(2000);
      }
    } catch (err) {
      if (err instanceof SyncConflict) {
        syncConflict = err.remote;
        conflictItems.forEach(el => el.classList.remove("hidden"));
        ctx.toast(
          "This story was changed on another device. Open the ⋯ menu to choose which version to keep.",
          "error"
        );
      } else {
        scheduleSync(30000); // network or rate-limit hiccup: try again later
      }
    } finally {
      syncing = false;
      paintSaved();
    }
  }

  /** Replace this device's copy with the one on GitHub, then reopen the screen. */
  async function useOtherVersion() {
    if (
      !confirm(
        "Replace this device's version with the one from your other device? Changes made here since the last sync are lost."
      )
    )
      return;
    frozen = true;
    clearTimeout(timer);
    clearTimeout(syncTimer);
    try {
      await pullRemoteDraft(ctx, id);
      ctx.navigate(location.hash, {replace: true});
    } catch (err) {
      frozen = false;
      ctx.toast(`Could not load the other version: ${err.message}`, "error");
    }
  }

  /** On opening: has another device changed this draft since we last synced? */
  async function checkRemote() {
    await ctx.syncReady;
    if (!ctx.sync || destroyed) return;
    try {
      const head = await ctx.sync.head(id);
      if (destroyed) return;
      if (!head) {
        if (draft.sync)
          ctx.toast(
            "The synced copy of this story is gone (published or discarded on another device). It stays here until you discard it.",
            "error"
          );
        if (needsSync()) scheduleSync(1500);
        return;
      }
      if (!draft.sync || head.updatedAt === draft.sync.rev) {
        if (needsSync()) scheduleSync(1500);
      } else if (!draft.syncPending) {
        // only the other device changed it: take its version
        await pullRemoteDraft(ctx, id);
        frozen = true;
        ctx.toast("Updated from your other device.");
        ctx.navigate(location.hash, {replace: true});
      } else {
        syncConflict = head; // both sides changed: let the owner choose
        conflictItems.forEach(el => el.classList.remove("hidden"));
        paintSaved();
      }
    } catch {
      // offline or no access: the draft simply stays on this device for now
    }
  }

  /** Another tab of this browser saved a newer copy, published it or discarded
   *  it: this tab must stop writing (to storage AND to the drafts repository), or
   *  its stale copy would overwrite the newer one. */
  function otherTabChanged() {
    const stored = loadDraft(id);
    if (stored && (stored.updatedAt || 0) <= seenUpdatedAt) return false;
    frozen = true;
    clearTimeout(syncTimer);
    lockedMessage =
      "⚠ This story changed in another tab: this tab stopped saving. Use ⋯ → Download as Markdown to keep your text.";
    setStatus(lockedMessage, true);
    ctx.toast(
      "This story changed in another tab, so this tab stopped saving. Download your text from the ⋯ menu.",
      "error"
    );
    return true;
  }

  function saveNow({force = false} = {}) {
    if (destroyed) return true;
    if (frozen) return false;
    clearTimeout(timer);
    // typing in the last ~200 ms has not reached the (debounced) change event yet
    if (
      !dirty &&
      mode === "wysiwyg" &&
      editor &&
      editor.getMarkdown() !== savedMd
    )
      dirty = true;
    if (!dirty && !force) return true;
    if (otherTabChanged()) return false;
    collect();
    if (ctx.sync) draft.syncPending = true; // goes to the drafts repository soon
    const ok = saveDraft(draft);
    if (ok) {
      seenUpdatedAt = draft.updatedAt;
      dirty = false;
      if (editor) savedMd = editor.getMarkdown();
      savedLabel = `Saved in this browser · ${formatTime(Date.now())}`;
      paintSaved();
      scheduleSync();
    } else {
      setStatus(
        "⚠ Could not save in this browser: copy your text somewhere safe",
        true
      );
    }
    return ok;
  }

  function schedule() {
    if (frozen) return;
    dirty = true;
    setStatus("Editing…");
    clearTimeout(timer);
    timer = setTimeout(saveNow, 600);
    schedulePreview();
  }

  /** Commit input that is still being typed into the visual editor (an image
   *  caption only reaches the document on blur). */
  async function flushEditor() {
    if (!editor) return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && editorRoot.contains(active)) {
      editorDirty = true;
      dirty = true;
    }
    await editor.flush();
  }

  // ---- body editor ---------------------------------------------------------------------
  async function addImage(file) {
    try {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(
          `That image is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${
            MAX_IMAGE_BYTES / 1048576
          } MB. Resize it first.`
        );
      }
      let bytes = new Uint8Array(await file.arrayBuffer());
      // trust the bytes, not the file name: "x.png" may be SVG/HTML
      const kind = sniffImage(bytes);
      if (!kind)
        throw new Error(
          "That file is not a PNG, JPEG, GIF, WebP or AVIF image (SVG is not supported: export it as PNG)."
        );
      // phone photos carry GPS position and device info; the repo is public
      if (kind.type === "image/jpeg") bytes = sanitizeJpeg(bytes);
      const name = imageFileName(
        file,
        (await sha256Hex(bytes)).slice(0, 8),
        kind.ext
      );
      const path = DRAFT_IMAGE_PREFIX + name;
      const blob = new Blob([bytes], {type: kind.type});
      if (!previews.has(path)) previews.set(path, URL.createObjectURL(blob));
      await putImage(id, name, blob);
      schedule();
      return path;
    } catch (err) {
      ctx.toast(err.message || "Could not add that image.", "error");
      throw err;
    }
  }

  function ensureEditor() {
    if (!editorLoading) {
      editorLoading = (async () => {
        const {createEditor} = await import("../editor.js");
        const ed = await createEditor({
          root: editorRoot,
          markdown: draft.body,
          onChange: md => {
            if (baselineMd === null || md === baselineMd) return; // the load
            editorDirty = true;
            schedule();
          },
          onUploadImage: addImage,
          previewUrl: src =>
            previews.get(imageBase(src)) ?? siteAsset(imageBase(src))
        });
        if (destroyed) {
          await ed.destroy();
          return null;
        }
        editor = ed;
        baselineMd = ed.getMarkdown();
        savedMd = baselineMd;
        toolbar.attach(ed);
        return ed;
      })().catch(err => {
        editorLoading = null;
        ctx.toast(
          `The visual editor failed to load (${
            err.message || err
          }). Switched to Markdown mode; reload the page to try again.`,
          "error"
        );
        if (!destroyed && mode === "wysiwyg") {
          mode = "source";
          source.value = draft.body;
          applyMode();
        }
        return null;
      });
    }
    return editorLoading;
  }

  function applyMode() {
    editorRoot.classList.toggle("hidden", mode !== "wysiwyg");
    toolbar.el.classList.toggle("hidden", mode !== "wysiwyg");
    source.classList.toggle("hidden", mode !== "source");
    modeBtn.textContent = mode === "source" ? "Visual editor" : "Markdown";
    modeBtn.title = markdownOnly
      ? "This post uses MDX components or {expressions}, so it can only be edited as Markdown here"
      : "";
    modeBtn.disabled = markdownOnly;
    sourceNote.classList.toggle("hidden", mode !== "source");
  }

  async function setMode(next) {
    if (next === mode) return;
    draft.modeChosen = true;
    if (next === "source") {
      if (editor) {
        await flushEditor();
        source.value = editorBody() ?? draft.body;
      }
      mode = "source";
    } else {
      const ed = await ensureEditor();
      if (!ed) return; // failed to load: stay in Markdown mode
      if (sourceDirty) {
        ed.setMarkdown(source.value);
        editorDirty = true;
        sourceDirty = false;
      }
      mode = "wysiwyg";
    }
    applyMode();
    dirty = true;
    saveNow();
  }

  // ---- live preview --------------------------------------------------------------------
  const previewHost = h("div", {class: "preview-host"});
  const TABS = [
    ["article", "Article"],
    ["card", "Writing card"]
  ];
  const tabButtons = TABS.map(([key, label]) =>
    h(
      "button",
      {
        class: "preview-tab",
        type: "button",
        "aria-pressed": String(key === previewTab),
        onclick: () => {
          previewTab = key;
          tabButtons.forEach((b, i) =>
            b.setAttribute("aria-pressed", String(TABS[i][0] === key))
          );
          preview?.setTab(key);
        }
      },
      label
    )
  );
  const previewPane = h(
    "aside",
    {class: "preview-pane", "aria-label": "Preview"},
    h(
      "div",
      {class: "preview-tabs"},
      ...tabButtons,
      h("span", {class: "preview-note"}, "as it will look on the site")
    ),
    previewHost
  );
  const previewBtn = h("button", {
    class: "btn btn-quiet",
    type: "button",
    onclick: () => setPreview(!previewOn)
  });

  function ensurePreview() {
    if (!previewLoading) {
      previewLoading = import("../preview.js")
        .then(({createPreview}) => {
          if (destroyed) return null;
          preview = createPreview();
          preview.setTab(previewTab);
          previewHost.append(preview.el);
          return preview;
        })
        .catch(err => {
          previewLoading = null;
          ctx.toast(
            `The preview failed to load (${err.message || err}).`,
            "error"
          );
          return null;
        });
    }
    return previewLoading;
  }

  async function refreshPreview() {
    if (!previewOn || destroyed) return;
    const p = await ensurePreview();
    if (!p || destroyed || !previewOn) return;
    p.update({
      title: title.value.trim(),
      date: dateInput.value,
      excerpt: subtitle.value.trim(),
      tags: tagBox.peek(),
      cover: draft.cover,
      body: currentBody(),
      images: previews // placeholder path -> local blob: URL, for display
    });
  }

  function schedulePreview() {
    if (!previewOn) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 250);
  }

  function paintPreviewButton() {
    previewBtn.textContent = !previewOn
      ? "Preview"
      : wide.matches
      ? "Hide preview"
      : "Back to editing";
    previewBtn.setAttribute("aria-pressed", String(previewOn));
  }

  function setPreview(on) {
    previewOn = on;
    try {
      localStorage.setItem("blogadmin:preview", on ? "1" : "0");
    } catch {
      // not persisted: fine
    }
    el.classList.toggle("has-preview", on);
    paintPreviewButton();
    if (on) refreshPreview();
  }

  // keep the preview at the same relative position as the editor page
  let scrollFrame = 0;
  const onScroll = () => {
    if (!previewOn || !preview || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (max > 0 && wide.matches) preview?.syncScroll(scrollY / max);
    });
  };

  // ---- actions -----------------------------------------------------------------------------
  async function onPublish() {
    if (busy) return;
    busy = true;
    try {
      if (mode === "wysiwyg") await flushEditor();
      collect();
      saveNow({force: true});
      const {published} = await openPublish(ctx, draft, {
        returnFocus: publishBtn,
        onCommitted: () => {
          frozen = true;
          clearTimeout(timer);
          ctx.invalidatePublished();
        }
      });
      if (published) ctx.navigate("#/", {replace: true});
    } finally {
      busy = false;
    }
  }

  async function onDeletePost() {
    if (busy) return;
    busy = true;
    try {
      collect();
      saveNow({force: true});
      const {deleted} = await openDelete(ctx, draft, {
        returnFocus: menu.querySelector("summary"),
        onCommitted: () => {
          frozen = true;
          clearTimeout(timer);
          ctx.invalidatePublished();
        }
      });
      if (deleted) ctx.navigate("#/", {replace: true});
    } finally {
      busy = false;
    }
  }

  async function onDiscard() {
    const what =
      draft.kind === "edit" ? "your unpublished changes" : "this draft";
    const synced = ctx.sync
      ? " (the synced copy on your other devices too)"
      : "";
    if (!confirm(`Discard ${what}${synced}? This cannot be undone.`)) return;
    frozen = true;
    clearTimeout(timer);
    clearTimeout(syncTimer);
    await deleteDraft(id);
    ctx.sync?.remove(id).catch(() => {});
    ctx.navigate("#/", {replace: true});
  }

  async function onDownload() {
    if (mode === "wysiwyg") await flushEditor();
    collect(); // works even when this tab stopped saving
    const text = stringify({
      data: {
        ...draft.extra,
        title: draft.title.trim(),
        date: draft.date,
        excerpt: draft.excerpt.trim(),
        tags: cleanTags(draft.tags),
        cover: draft.cover || undefined,
        draft: isHidden(draft) ? true : undefined
      },
      body: draft.body
    });
    const url = URL.createObjectURL(new Blob([text], {type: "text/markdown"}));
    const a = h("a", {
      href: url,
      download: `${draft.slug || "draft"}${draft.ext}`
    });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // shown only while another device's version conflicts with this one
  const conflictItems = [
    h(
      "button",
      {
        class: "menu-item hidden",
        type: "button",
        onclick: useOtherVersion
      },
      "Use the other device's version"
    ),
    h(
      "button",
      {
        class: "menu-item hidden",
        type: "button",
        onclick: () => syncNow({force: true})
      },
      "Keep this version (overwrite the other)"
    )
  ];

  const menu = h(
    "details",
    {class: "menu"},
    h("summary", {class: "btn btn-quiet", "aria-label": "More actions"}, "⋯"),
    h(
      "div",
      {class: "menu-list"},
      h(
        "button",
        {class: "menu-item", type: "button", onclick: onDownload},
        "Download as Markdown"
      ),
      h(
        "button",
        {class: "menu-item", type: "button", onclick: onDiscard},
        draft.kind === "edit" ? "Discard my changes" : "Delete this draft"
      ),
      ...conflictItems,
      draft.kind === "edit"
        ? h(
            "button",
            {
              class: "menu-item is-danger",
              type: "button",
              onclick: onDeletePost
            },
            "Delete post from the site…"
          )
        : null
    )
  );
  // close the menu after any click inside it or outside it
  const closeMenu = e => {
    if (
      menu.open &&
      (!menu.contains(e.target) || e.target.closest(".menu-item"))
    )
      menu.open = false;
  };
  document.addEventListener("click", closeMenu);

  // ---- wiring ------------------------------------------------------------------------------
  const fitTitle = autoGrow(title);
  const fitSubtitle = autoGrow(subtitle);
  const fitAll = () => {
    fitTitle();
    fitSubtitle();
  };
  for (const el of [title, subtitle, dateInput])
    el.addEventListener("input", schedule);
  source.addEventListener("input", () => {
    sourceDirty = true;
    schedule();
  });
  dateInput.addEventListener("change", schedule);
  hiddenInput.addEventListener("change", schedule);

  title.addEventListener("keydown", e => {
    if (e.key === "Enter" && !isImeEnter(e)) {
      e.preventDefault();
      subtitle.focus();
    }
  });
  subtitle.addEventListener("keydown", e => {
    if (e.key === "Enter" && !isImeEnter(e)) {
      e.preventDefault();
      if (mode === "wysiwyg") editor?.focus();
      else source.focus();
    }
  });

  const onKey = e => {
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.key?.toLowerCase() === "s" || e.code === "KeyS")
    ) {
      e.preventDefault();
      collect();
      if (saveNow({force: true})) ctx.toast("Saved in this browser.");
      else
        ctx.toast(
          "Could not save in this browser. Copy your text somewhere safe.",
          "error"
        );
    }
  };
  // An image caption is an <input> that only writes to the document on blur
  // (or after a 1 s debounce): commit it before saving when the tab goes away.
  const saveOnLeave = () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && editorRoot.contains(active)) {
      active.blur();
      editorDirty = true;
      dirty = true;
    }
    saveNow();
  };
  const onHide = () => {
    if (document.visibilityState === "hidden") saveOnLeave();
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", saveOnLeave);
  window.addEventListener("resize", fitAll);
  window.addEventListener("scroll", onScroll, {passive: true});
  wide.addEventListener?.("change", paintPreviewButton);

  const el = h(
    "div",
    {class: "write"},
    topBar({
      left: h("a", {class: "bar-back", href: "#/"}, "← Stories"),
      status,
      right: [previewBtn, modeBtn, publishBtn, menu]
    }),
    h(
      "div",
      {class: "split"},
      h(
        "main",
        {class: "page"},
        draft.kind === "edit"
          ? h(
              "p",
              {class: "notice"},
              `Editing ${draft.path
                .split("/")
                .pop()}. Your changes stay in this browser until you press Update.`
            )
          : null,
        title,
        subtitle,
        h("div", {class: "meta"}, dateInput, tagBox.el, hideSwitch),
        coverBox,
        coverFile,
        toolbar.el,
        editorRoot,
        sourceNote,
        source
      ),
      previewPane
    )
  );

  paintCover();
  applyMode();
  setPreview(previewOn);
  paintSaved();
  checkRemote();
  // measure after the element is in the document (see app.js) and fonts load
  requestAnimationFrame(fitAll);
  document.fonts?.ready?.then(fitAll);
  document.fonts?.addEventListener?.("loadingdone", fitAll);
  if (mode === "wysiwyg") {
    ensureEditor().then(() => {
      if (!destroyed && !draft.title) title.focus();
    });
  }

  return {
    el,
    destroy() {
      saveNow();
      destroyed = true;
      clearTimeout(syncTimer);
      if (ctx.sync && !frozen && !syncConflict && needsSync()) syncNow();
      clearTimeout(timer);
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", saveOnLeave);
      window.removeEventListener("resize", fitAll);
      window.removeEventListener("scroll", onScroll);
      wide.removeEventListener?.("change", paintPreviewButton);
      clearTimeout(previewTimer);
      toolbar.destroy();
      preview?.destroy();
      document.fonts?.removeEventListener?.("loadingdone", fitAll);
      for (const url of previews.values()) URL.revokeObjectURL(url);
      editor?.destroy();
    }
  };
}
