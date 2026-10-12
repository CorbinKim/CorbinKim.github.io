// Draft sync against the mock GitHub server. Run: node --test test/sync.test.js
import {test, before, after} from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {GitHub} from "../src/admin/github.js";
import {SyncConflict, createDraftSync} from "../src/admin/sync.js";
import {startMockGitHub} from "./mock-github-server.js";

let mock, publicMock;
before(async () => {
  mock = await startMockGitHub({
    repo: "blog-drafts",
    isPrivate: true,
    files: {"README.md": "drafts\n"}
  });
  publicMock = await startMockGitHub({
    repo: "blog-drafts",
    isPrivate: false,
    files: {"README.md": "x\n"}
  });
});
after(async () => {
  await mock.close();
  await publicMock.close();
});

const client = (m = mock, token = m.tokens.write) =>
  new GitHub({
    token,
    owner: m.owner,
    repo: m.repo,
    apiBase: m.url,
    etagCache: false
  });
const sync = (m = mock) => createDraftSync(client(m));
const ID1 = "11111111-aaaa-4bbb-8ccc-111111111111";
const ID2 = "22222222-aaaa-4bbb-8ccc-222222222222";
const draft = (id, extra = {}) => ({
  id,
  kind: "new",
  path: "",
  ext: ".md",
  baseSha: "",
  slug: "",
  title: "한글 제목 😀",
  excerpt: "e",
  tags: ["a"],
  cover: "",
  date: "2026-10-12",
  extra: {},
  body: "본문 $x^2$\n",
  mode: "wysiwyg",
  updatedAt: 1000,
  ...extra
});
const bytes = n => crypto.randomBytes(n);

test("check: private repo with a branch and write access is fine", async () => {
  assert.deepEqual(await sync().check(), {ok: true});
});

test("check: a PUBLIC repository is refused (it would publish the drafts)", async () => {
  const r = await sync(publicMock).check();
  assert.equal(r.ok, false);
  assert.match(r.reason, /PUBLIC/);
});

test("check: a token without access to the repository explains what to do", async () => {
  const r = await createDraftSync(
    client(mock, mock.tokens.notSelected)
  ).check();
  assert.equal(r.ok, false);
  assert.match(r.reason, /cannot see|Contents|write/i);
});

test("push a new draft with pictures; another device lists it and reads it back exactly", async () => {
  const a = sync();
  const img = bytes(1_200_000);
  const {rev} = await a.push({
    draft: draft(ID1),
    device: "devA",
    expectedRev: null,
    addImages: [{name: "fig-1.png", bytes: img}]
  });
  assert.equal(rev, 1000);

  const b = sync(); // "another device": a fresh client, nothing in memory
  const list = await b.list();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], {
    id: ID1,
    title: "한글 제목 😀",
    kind: "new",
    path: "",
    updatedAt: 1000,
    device: "devA"
  });
  const {draft: got, images} = await b.read(ID1);
  assert.equal(got.title, "한글 제목 😀");
  assert.equal(got.body, "본문 $x^2$\n");
  assert.equal(got.device, "devA");
  assert.equal(images.length, 1);
  assert.ok(
    Buffer.from(images[0].bytes).equals(img),
    "picture bytes identical"
  );
  assert.equal(images[0].name, "fig-1.png");
});

test("local-only bookkeeping never leaves the device", async () => {
  const a = sync();
  await a.push({
    draft: draft(ID2, {sync: {rev: 5, images: ["x"]}, syncPending: true}),
    device: "devA",
    expectedRev: null
  });
  const stored = await a.head(ID2);
  assert.ok(!("sync" in stored) && !("syncPending" in stored));
  await a.remove(ID2);
});

test("an update with the right rev succeeds; a stale rev is a conflict, not an overwrite", async () => {
  const a = sync();
  const b = sync();
  await a.push({
    draft: draft(ID1, {title: "A edit", updatedAt: 2000}),
    device: "devA",
    expectedRev: 1000
  });
  // device B still believes rev 1000
  await assert.rejects(
    () =>
      b.push({
        draft: draft(ID1, {title: "B edit", updatedAt: 3000}),
        device: "devB",
        expectedRev: 1000
      }),
    e =>
      e instanceof SyncConflict &&
      e.remote.title === "A edit" &&
      e.remote.updatedAt === 2000
  );
  assert.equal((await a.head(ID1)).title, "A edit", "the newer copy survived");
  // after looking at the remote, B knows rev 2000 and may push
  await b.push({
    draft: draft(ID1, {title: "B edit", updatedAt: 3000}),
    device: "devB",
    expectedRev: 2000
  });
  assert.equal((await a.head(ID1)).title, "B edit");
});

test("pushing without a rev onto an existing draft is a conflict; force overwrites", async () => {
  const a = sync();
  await assert.rejects(
    () =>
      a.push({
        draft: draft(ID1, {updatedAt: 4000}),
        device: "devA",
        expectedRev: null
      }),
    SyncConflict
  );
  await a.push({
    draft: draft(ID1, {title: "forced", updatedAt: 4000}),
    device: "devA",
    expectedRev: null,
    force: true
  });
  assert.equal((await a.head(ID1)).title, "forced");
});

test("pictures: new ones are added, dropped ones are deleted", async () => {
  const a = sync();
  await a.push({
    draft: draft(ID1, {updatedAt: 5000}),
    device: "d",
    expectedRev: 4000,
    addImages: [{name: "b.png", bytes: bytes(10)}],
    removeImages: ["fig-1.png"]
  });
  const {images} = await a.read(ID1);
  assert.deepEqual(images.map(i => i.name).sort(), ["b.png"]);
});

test("a draft that does not exist: head is null, list ignores foreign folders", async () => {
  assert.equal(await sync().head("99999999-aaaa-4bbb-8ccc-999999999999"), null);
  mock.seed({
    "drafts/not-a-draft-folder!/x.txt": "x",
    "drafts/readme.txt": "x"
  });
  const list = await sync().list();
  assert.deepEqual(
    list.map(d => d.id),
    [ID1]
  );
});

test("remove deletes the draft and its pictures in one commit", async () => {
  const a = sync();
  const before = mock.chain().length;
  await a.remove(ID1);
  assert.equal(mock.chain().length, before + 1);
  assert.equal(await a.head(ID1), null);
  assert.equal((await a.list()).length, 0);
  await a.remove(ID1); // nothing left: no error, no commit
  assert.equal(mock.chain().length, before + 1);
});

test("draft ids cannot be used to reach other paths", async () => {
  const a = sync();
  for (const bad of [
    "../x",
    "a/b",
    "",
    "short",
    "x".repeat(100),
    "11111111-aaaa-4bbb-8ccc-1111111111/../"
  ])
    await assert.rejects(
      () => a.head(bad),
      /Invalid draft id/,
      JSON.stringify(bad)
    );
});
