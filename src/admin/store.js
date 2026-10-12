// Browser storage for the editor: the GitHub token, local drafts, and the
// images pasted into drafts. Every access is wrapped: Safari private windows,
// blocked site data and quota errors all throw, and ITP can silently empty
// script-writable storage after ~7 days without a visit, so nothing here may
// be assumed to exist.

const TOKEN_KEY = "blogadmin:token";
const DRAFT_PREFIX = "blogadmin:draft:";

function attempt(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// ---- token -----------------------------------------------------------------
// The plain token only ever lives in sessionStorage (this tab, gone when it
// closes). To stay signed in across tabs and restarts it is kept in the
// password-locked "vault" (see vault.js): ciphertext in localStorage.

const VAULT_KEY = "blogadmin:vault";

export function loadSessionToken() {
  return attempt(() => sessionStorage.getItem(TOKEN_KEY), null) || "";
}

export function saveSessionToken(token) {
  return attempt(() => {
    sessionStorage.setItem(TOKEN_KEY, token);
    return true;
  }, false);
}

export function clearSessionToken() {
  attempt(() => sessionStorage.removeItem(TOKEN_KEY));
}

/** @returns {object|null} the encrypted token record, if one was saved. */
export function loadVault() {
  return attempt(() => JSON.parse(localStorage.getItem(VAULT_KEY)), null);
}

export function saveVault(vault) {
  return attempt(() => {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    return true;
  }, false);
}

export function clearVault() {
  attempt(() => localStorage.removeItem(VAULT_KEY));
}

// A plain token was never meant to be written to localStorage: remove any
// that an earlier build may have left behind.
attempt(() => localStorage.removeItem(TOKEN_KEY));

/** A random id of this browser, written into synced drafts so a conflict can say
 *  which device changed them. */
export function deviceId() {
  const KEY = "blogadmin:device";
  const existing = attempt(() => localStorage.getItem(KEY), null);
  if (existing) return existing;
  const id = newId().slice(0, 8);
  attempt(() => localStorage.setItem(KEY, id));
  return id;
}

// ---- drafts (localStorage, one JSON document per draft) ------------------------

export function newId() {
  return (
    attempt(() => crypto.randomUUID(), null) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

export function listDrafts() {
  const out = [];
  attempt(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
      const d = attempt(() => JSON.parse(localStorage.getItem(key)), null);
      if (d && d.id) out.push(d);
    }
  });
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function loadDraft(id) {
  return attempt(
    () => JSON.parse(localStorage.getItem(DRAFT_PREFIX + id)),
    null
  );
}

/** @returns {boolean} false when the browser refused (quota / blocked). */
export function saveDraft(draft) {
  return attempt(() => {
    draft.updatedAt = Date.now();
    localStorage.setItem(DRAFT_PREFIX + draft.id, JSON.stringify(draft));
    return true;
  }, false);
}

export async function deleteDraft(id) {
  attempt(() => localStorage.removeItem(DRAFT_PREFIX + id));
  await deleteImages(id);
}

// ---- draft images (IndexedDB, in-memory fallback) -------------------------------
// A File cannot live in localStorage, and a blob: URL dies with the page, so
// pasted images are kept in IndexedDB keyed "<draftId>/<fileName>".

const DB_NAME = "blogadmin";
const STORE = "images";
const memory = new Map();
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result;
    const req = fn(tx.objectStore(STORE));
    if (req) req.onsuccess = () => (result = req.result);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const imageKey = (draftId, name) => `${draftId}/${name}`;
// "\uffff" sorts after every character a file name can contain.
const rangeOf = draftId =>
  IDBKeyRange.bound(`${draftId}/`, `${draftId}/${String.fromCharCode(0xffff)}`);

// Stored as {type, buffer}, not as a Blob: WebKit (Safari, incl. private
// windows) can fail the whole transaction when a Blob/File is put in
// IndexedDB, while an ArrayBuffer always works.
export async function putImage(draftId, name, blob) {
  memory.set(imageKey(draftId, name), blob);
  try {
    const record = {type: blob.type, buffer: await blob.arrayBuffer()};
    const db = await openDb();
    await run(db, "readwrite", s => s.put(record, imageKey(draftId, name)));
  } catch {
    // kept in memory only: survives navigation, not a reload
  }
}

/** @returns {Promise<Array<{name: string, blob: Blob}>>} */
export async function listImages(draftId) {
  const found = new Map();
  try {
    const db = await openDb();
    const [keys, records] = await Promise.all([
      run(db, "readonly", s => s.getAllKeys(rangeOf(draftId))),
      run(db, "readonly", s => s.getAll(rangeOf(draftId)))
    ]);
    keys.forEach((k, i) => {
      const {type, buffer} = records[i];
      found.set(
        String(k).slice(draftId.length + 1),
        new Blob([buffer], {type})
      );
    });
  } catch {
    // memory only
  }
  for (const [key, blob] of memory) {
    if (key.startsWith(`${draftId}/`))
      found.set(key.slice(draftId.length + 1), blob);
  }
  return [...found].map(([name, blob]) => ({name, blob}));
}

export async function deleteImages(draftId) {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(`${draftId}/`)) memory.delete(key);
  }
  try {
    const db = await openDb();
    await run(db, "readwrite", s => s.delete(rangeOf(draftId)));
  } catch {
    // nothing stored
  }
}
