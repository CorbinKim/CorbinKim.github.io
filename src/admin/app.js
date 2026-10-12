// /admin/ entry logic: session (token), hash router, view switching.
//   #/            stories list
//   #/draft/<id>  the writing screen
// Nothing here imports the portfolio app (React, router, Blog.scss): the
// editor ships as its own chunk graph.
import {API_BASE, DRAFTS_API_BASE, DRAFTS_REPO, REPO} from "./config.js";
import {clear} from "./dom.js";
import {GitHub} from "./github.js";
import {listPublished} from "./posts.js";
import {createDraftSync} from "./sync.js";
import {
  clearSessionToken,
  clearVault,
  loadSessionToken,
  loadVault,
  saveSessionToken,
  saveVault
} from "./store.js";
import {toast} from "./ui.js";
import {decryptToken, encryptToken} from "./vault.js";
import {connectView} from "./views/connect.js";
import {unlockView} from "./views/unlock.js";
import {storiesView} from "./views/stories.js";
import {writeView} from "./views/write.js";

export async function start(root) {
  let current = null;
  let routeSeq = 0;
  let publishedCache = null;

  const makeClient = token => new GitHub({token, ...REPO, apiBase: API_BASE});

  /** Shared by connect() and unlock(): vet the token, then keep it for this tab. */
  async function openSession(gh, info, token) {
    // A classic/OAuth token (ghp_, gho_, ...) is not limited to this repo: if
    // it leaked from browser storage it would expose every repository of the
    // owner. Only a fine-grained token scoped to one repo is accepted.
    if (info.tokenKind !== "fine-grained") {
      throw new Error(
        "This is not a fine-grained token. Classic tokens work on all your repositories, which is too much to keep in a browser. Create a fine-grained token limited to this repository and paste that."
      );
    }
    saveSessionToken(token);
    ctx.gh = gh;
    ctx.user = info;
    publishedCache = null;
    for (const warning of info.warnings || []) toast(warning);
    ctx.syncReady = initSync(token); // in the background; views await ctx.syncReady
  }

  /** Draft sync needs the private drafts repository (config.js DRAFTS_REPO). */
  async function initSync(token) {
    ctx.sync = null;
    ctx.syncStatus = {state: "checking"};
    try {
      const sync = createDraftSync(
        new GitHub({token, ...DRAFTS_REPO, apiBase: DRAFTS_API_BASE})
      );
      const result = await sync.check();
      if (result.ok) {
        ctx.sync = sync;
        ctx.syncStatus = {state: "on"};
      } else {
        ctx.syncStatus = {state: "unavailable", reason: result.reason};
      }
    } catch (err) {
      ctx.syncStatus = {state: "unavailable", reason: err.message};
    }
  }

  const ctx = {
    gh: null,
    user: null,
    toast,
    /** the draft-sync client when the private drafts repository works, else null */
    sync: null,
    syncStatus: {state: "off"},
    syncReady: Promise.resolve(),

    /** {replace: true} swaps the current history entry instead of adding one
     *  (after publish / discard / a missing draft, so Back never lands on a
     *  dead #/draft/<id>). */
    navigate(hash, {replace = false} = {}) {
      if (replace) {
        history.replaceState(null, "", hash);
        route();
      } else if (location.hash === hash) route();
      else location.hash = hash;
    },

    knownTags: () =>
      [...new Set((publishedCache || []).flatMap(p => p.tags))].sort(),

    async getPublished(force = false) {
      if (publishedCache && !force) return publishedCache;
      const posts = await listPublished(ctx.gh);
      // a listing with unreadable rows (rate limit, network blip) is shown but
      // not remembered, so the next visit tries again
      publishedCache = posts.some(p => p.error) ? null : posts;
      return posts;
    },

    /** Call after a commit: the list of published posts is stale. */
    invalidatePublished() {
      publishedCache = null;
    },

    /** Opens a session with `token` after checking it can write to the repo.
     *  With `password` the token is also saved on this device, encrypted, so
     *  the next visit only needs the password (see vault.js). */
    async connect(token, {password = ""} = {}) {
      if (!token) throw new Error("Paste your token first.");
      const gh = makeClient(token);
      await openSession(gh, await gh.verifyAccess({requireWrite: true}), token);
      if (password) {
        const vault = await encryptToken(token, password);
        if (!saveVault(vault))
          toast(
            "Signed in, but this browser would not save the locked token (storage blocked?).",
            "error"
          );
      }
      ctx.navigate("#/");
    },

    /** Decrypts the saved token with the owner's password and signs in. */
    async unlock(password) {
      const vault = loadVault();
      if (!vault) throw new Error("There is no saved token on this device.");
      const token = await decryptToken(vault, password); // throws VaultError
      const gh = makeClient(token);
      try {
        await openSession(
          gh,
          await gh.verifyAccess({probeWrite: false}),
          token
        );
      } catch (err) {
        if (err.code === "BAD_TOKEN")
          err.message =
            "The saved token was rejected by GitHub (expired or revoked). Choose “Use a different token” below and paste a new one.";
        throw err;
      }
      ctx.navigate("#/");
    },

    /** Forget the token saved on this device (the password-locked copy). */
    forgetDevice() {
      clearVault();
      route();
    },

    hasVault: () => !!loadVault(),

    signOut() {
      const locked = !!loadVault();
      if (
        !confirm(
          locked
            ? "Lock the editor? Your drafts stay in this browser; you will unlock it again with your password."
            : "Sign out? Your drafts stay in this browser; you will need to paste the token again."
        )
      )
        return;
      clearSessionToken();
      ctx.gh = null;
      ctx.user = null;
      ctx.sync = null;
      ctx.syncStatus = {state: "off"};
      publishedCache = null;
      route();
    }
  };

  async function route() {
    const seq = ++routeSeq;
    current?.destroy();
    current = null;
    clear(root);

    let view;
    if (!ctx.gh) {
      view = loadVault() ? unlockView(ctx) : connectView(ctx);
    } else {
      const m = location.hash.match(/^#\/draft\/([\w-]+)$/);
      if (m) {
        view = await writeView(ctx, m[1]);
        if (!view) {
          if (seq !== routeSeq) return;
          toast("That draft no longer exists.");
          ctx.navigate("#/", {replace: true});
          return;
        }
      } else {
        view = storiesView(ctx);
      }
    }
    if (seq !== routeSeq) {
      view.destroy();
      return;
    }
    current = view;
    root.append(view.el);
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("unhandledrejection", e => {
    // image upload errors already toast themselves
    if (e.reason?.handled) return;
    console.error(e.reason);
  });

  // Resume this tab's session (e.g. after a reload). A dead token is dropped; a
  // network problem keeps it so the owner can retry.
  const token = loadSessionToken();
  if (token) {
    try {
      const gh = makeClient(token);
      ctx.user = await gh.verifyAccess({probeWrite: false});
      ctx.gh = gh;
      ctx.syncReady = initSync(token);
    } catch (err) {
      if (err.code === "BAD_TOKEN" || err.code === "BAD_TOKEN_FORMAT")
        clearSessionToken();
      toast(err.message || "Could not reach GitHub.", "error");
    }
  }
  route();
}
