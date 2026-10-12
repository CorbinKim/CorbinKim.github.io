# Draft sync (optional): continue a story on another device

By default a draft lives only in the browser where you wrote it (and Safari may
clear site data after about a week without a visit). With **draft sync** the
editor also copies each unpublished story, with its pictures, to a **private**
GitHub repository, so you can start on one computer and continue on another.

Nothing is synced unless the repository below exists and works; otherwise the
editor just keeps drafts on this device and says "sync is off" on the stories
page (that hint can be dismissed).

## Setup (once, about two minutes)

1. On GitHub create a new repository named **`blog-drafts`** under your account
   (the name is `DRAFTS_REPO` in `src/admin/config.js`).
   - Visibility: **Private**. The editor refuses to sync to a public repository,
     because that would publish every draft.
   - Tick **Add a README file**: an empty repository has no branch yet and the
     GitHub API cannot commit to it.
2. Give your token access to it. Open the token you use for the editor
   (GitHub → Settings → Developer settings → Fine-grained tokens → your token →
   Edit), and under **Repository access** add `blog-drafts` next to
   `CorbinKim.github.io`. **Contents: Read and write** applies to both.
   (A new token: select both repositories.)
3. Reload the editor. The stories page now says *synced across your devices*.

## How it behaves

- Saved edits are pushed about 8 seconds after you stop typing, and right away
  when you leave the story. The status line shows `· will sync`, `· syncing…`
  or `· synced`.
- On another device the story appears under **Drafts** as *from another device*.
  Opening it downloads the text and the pictures.
- When you reopen a story whose copy on GitHub is newer and you have no unsynced
  edits, the newer version is loaded automatically.
- If **both** sides changed (you edited here while another device pushed), nothing
  is overwritten: the status line warns, and the **⋯** menu offers *Use the
  other device's version* or *Keep this version (overwrite the other)*.
- Publishing, deleting or discarding a story also removes its synced copy.
- The drafts repository is a plain git repository (`drafts/<id>/draft.json` plus
  `drafts/<id>/images/`), so its history is a free backup.

## Good to know

- Without the repository the editor checks for it on every start; GitHub answers
  404 and the browser console shows one `Failed to load resource ... 404` line.
  That is expected and harmless until you create `blog-drafts`.

## Limits

- Only the token's two repositories are reachable, so the token stays limited;
  but a draft there is only as private as that repository: keep it private.
- Two devices editing the same story *at the same moment* is resolved by the
  menu above, not merged automatically.
- Every synced save is a commit in the drafts repository (not in the portfolio),
  so it does not trigger a site rebuild.
