// Draft sync through a private GitHub repository. DOM-free (the caller supplies
// image bytes), so it is unit-tested against the mock GitHub server.
//
// Layout in the drafts repository:
//   drafts/<id>/draft.json          the draft (title, body, tags, cover, ...)
//   drafts/<id>/images/<name>       pictures pasted into it
//
// Conflicts: every push records `updatedAt` inside draft.json. A device knows the
// `rev` it last saw; if the file now holds a different one, someone else wrote
// in between and the push is refused (SyncConflict) instead of overwriting.
import {mapLimit} from "./postprocess.js";

export const DRAFTS_ROOT = "drafts";
const ID = /^[A-Za-z0-9-]{8,64}$/;

export class SyncConflict extends Error {
  constructor(remote) {
    super("This story was changed on another device.");
    this.name = "SyncConflict";
    /** the draft.json that is on GitHub now */
    this.remote = remote;
  }
}

const dirOf = id => {
  if (!ID.test(String(id))) throw new Error("Invalid draft id.");
  return `${DRAFTS_ROOT}/${id}`;
};

/** The fields of a draft that travel (not the local sync bookkeeping). */
export function payloadOf(draft, device) {
  const {sync: _sync, syncPending: _pending, ...fields} = draft;
  return {...fields, device, updatedAt: draft.updatedAt || Date.now()};
}

/** @param {import("./github.js").GitHub} gh  client for the drafts repository */
export function createDraftSync(gh) {
  async function readJson(path) {
    const {text} = await gh.readText(path);
    return JSON.parse(text);
  }

  return {
    /** @returns {Promise<{ok: boolean, reason?: string}>} */
    async check() {
      let info;
      try {
        info = await gh.verifyAccess({requireWrite: true});
      } catch (err) {
        const hint =
          err.code === "NO_REPO_ACCESS"
            ? `The token cannot see ${gh.fullName}. Create that repository (private) and add it to the token's repository list.`
            : err.message;
        return {ok: false, reason: hint};
      }
      // a public repository would publish every draft
      if (!info.private)
        return {
          ok: false,
          reason: `${gh.fullName} is PUBLIC. Make it private before drafts are synced to it.`
        };
      if (!info.branchExists)
        return {
          ok: false,
          reason: `${gh.fullName} has no "${gh.branch}" branch yet. Initialise it (for example with a README).`
        };
      return {ok: true};
    },

    /** Newest first: [{id, title, kind, path, updatedAt, device}] */
    async list() {
      const entries = await gh.listDir(DRAFTS_ROOT, {missingOk: true});
      const found = await mapLimit(
        entries.filter(e => e.type === "dir" && ID.test(e.name)),
        4,
        async e => {
          try {
            const d = await readJson(`${DRAFTS_ROOT}/${e.name}/draft.json`);
            return {
              id: e.name,
              title: d.title || "",
              kind: d.kind,
              path: d.path || "",
              updatedAt: d.updatedAt || 0,
              device: d.device || ""
            };
          } catch {
            return null; // half-written or foreign folder
          }
        }
      );
      return found.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
    },

    /** The draft.json that is on GitHub, or null. */
    async head(id) {
      try {
        return await readJson(`${dirOf(id)}/draft.json`);
      } catch (err) {
        if (err.code === "NOT_FOUND") return null;
        throw err;
      }
    },

    /** @returns {Promise<{draft: object, images: Array<{name, bytes: Uint8Array}>}>} */
    async read(id) {
      const draft = await readJson(`${dirOf(id)}/draft.json`);
      const files = await gh.listDir(`${dirOf(id)}/images`, {missingOk: true});
      const images = await mapLimit(
        files.filter(f => f.type === "file"),
        3,
        async f => ({name: f.name, bytes: (await gh.readBytes(f.path)).bytes})
      );
      return {draft, images};
    },

    /**
     * One commit with the draft and any new pictures; refuses to overwrite a
     * newer copy from another device.
     * @param {number|null} expectedRev  the `updatedAt` of draft.json as this
     *        device last saw it (null: it must not exist yet)
     * @returns {Promise<{rev: number}>} the new rev to remember
     */
    async push({
      draft,
      device,
      expectedRev,
      addImages = [],
      removeImages = [],
      force = false
    }) {
      const dir = dirOf(draft.id);
      const remote = await this.head(draft.id);
      if (!force && remote) {
        if (expectedRev == null || remote.updatedAt !== expectedRev)
          throw new SyncConflict(remote);
      }
      const payload = payloadOf(draft, device);
      await gh.commitFiles({
        message: `Draft: ${String(draft.title || "Untitled").slice(0, 60)}`,
        writes: [
          {path: `${dir}/draft.json`, text: JSON.stringify(payload, null, 1)},
          ...addImages.map(i => ({
            path: `${dir}/images/${i.name}`,
            bytes: i.bytes
          }))
        ],
        deletes: removeImages.map(n => `${dir}/images/${n}`)
      });
      return {rev: payload.updatedAt};
    },

    /** Delete the draft and its pictures from the repository. */
    async remove(id) {
      const dir = dirOf(id);
      const files = await gh.listTree(dir);
      if (!files.length) return;
      await gh.commitFiles({
        message: `Remove draft ${id.slice(0, 8)}`,
        deletes: files.map(f => f.path)
      });
    }
  };
}
