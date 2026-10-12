// The browser side of draft sync: move a draft (and its pictures) between this
// browser's storage and the private drafts repository (see sync.js).
import {sniffImage} from "./images.js";
import {draftImageNames} from "./postprocess.js";
import {
  deleteImages,
  deviceId,
  listImages,
  putImage,
  saveDraft
} from "./store.js";

/** Download a synced draft into this browser, replacing any local copy.
 *  @returns {Promise<object>} the stored draft */
export async function pullRemoteDraft(ctx, id) {
  const {draft: remote, images} = await ctx.sync.read(id);
  await deleteImages(id);
  for (const {name, bytes} of images) {
    const kind = sniffImage(bytes);
    await putImage(
      id,
      name,
      new Blob([bytes], {type: kind?.type || "application/octet-stream"})
    );
  }
  const {device: _device, ...fields} = remote;
  const draft = {
    ...fields,
    id,
    sync: {rev: remote.updatedAt, images: images.map(i => i.name)},
    syncPending: false
  };
  if (!saveDraft(draft))
    throw new Error(
      "This browser cannot store drafts (storage full or blocked)."
    );
  return draft;
}

/** Upload the draft and the pictures the repository does not have yet.
 *  @returns {Promise<{rev: number, images: string[]}>} what to remember in draft.sync
 *  @throws SyncConflict when another device wrote in the meantime */
export async function pushLocalDraft(
  ctx,
  draft,
  {force = false, expectedRev} = {}
) {
  const referenced = new Set(draftImageNames(draft));
  const have = new Set(draft.sync?.images || []);
  const add = [];
  for (const {name, blob} of await listImages(draft.id)) {
    if (referenced.has(name) && !have.has(name))
      add.push({name, bytes: new Uint8Array(await blob.arrayBuffer())});
  }
  const remove = [...have].filter(name => !referenced.has(name));
  const {rev} = await ctx.sync.push({
    draft,
    device: deviceId(),
    expectedRev: expectedRev ?? draft.sync?.rev ?? null,
    addImages: add,
    removeImages: remove,
    force
  });
  const kept = [...have].filter(name => referenced.has(name));
  return {rev, images: [...kept, ...add.map(i => i.name)]};
}
