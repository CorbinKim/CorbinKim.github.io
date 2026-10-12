// Run: node --test github.test.js
import {describe, it} from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {inspect} from "node:util";
import {
  GitHub,
  GitHubError,
  base64ToBytes,
  base64ToBytesChunked,
  bytesToBase64,
  bytesToBase64Chunked,
  bytesToText,
  mapRunState,
  textToBytes,
  tokenCreationUrl,
  validateRepoPath
} from "../src/admin/github.js";
import {REAL_ALLOW_HEADERS, startMockGitHub} from "./mock-github-server.js";

// ---- helpers ---------------------------------------------------------------
async function withMock(fn, opts) {
  const mock = await startMockGitHub(opts);
  try {
    await fn(mock);
  } finally {
    await mock.close();
  }
}
const client = (mock, token, extra = {}) =>
  new GitHub({
    token,
    owner: mock.owner,
    repo: mock.repo,
    branch: mock.branch,
    apiBase: mock.url,
    sleep: async () => {}, // no real backoff in tests
    ...extra
  });
const gitBlobSha = buf =>
  crypto
    .createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]))
    .digest("hex");
const randomBytes = n => new Uint8Array(crypto.randomBytes(n));
const rejectsWith = async (p, props) => {
  await assert.rejects(p, e => {
    assert.ok(e instanceof GitHubError, `expected GitHubError, got ${e}`);
    for (const [k, v] of Object.entries(props)) {
      if (v instanceof RegExp) assert.match(String(e[k]), v, `${k}: ${e[k]}`);
      else assert.equal(e[k], v, `${k}: ${e[k]}`);
    }
    return true;
  });
};
const fakeClock = () => {
  let t = 0;
  return {
    now: () => t,
    sleep: async ms => {
      t += ms;
    },
    get t() {
      return t;
    }
  };
};

const KOREAN =
  "---\ntitle: 어텐션은 왜 √d 로 나눌까? 👩‍💻🎉\ndate: 2026-10-11\n---\n\n" +
  "안녕하세요. 스케일드 닷 프로덕트 어텐션 — \\( \\frac{QK^T}{\\sqrt{d_k}} \\)\r\n" +
  "$$\n\\sum_{i=1}^{n} x_i \\neq \\text{한글}\n$$\n\u{1F600} \u{1F1F0}\u{1F1F7} e\u0301 \\n literal";

// ============================================================================
describe("base64 / UTF-8 helpers", () => {
  it("naive btoa(String.fromCharCode(...bytes)) overflows the stack on 3 MB, ours does not", () => {
    const big = randomBytes(3 * 1024 * 1024);
    assert.throws(() => String.fromCharCode(...big), RangeError);
    const b64 = bytesToBase64Chunked(big);
    assert.equal(b64, Buffer.from(big).toString("base64"));
    assert.deepEqual(base64ToBytesChunked(b64), big);
  });

  it("native and chunked implementations agree (incl. 25 MB, subarray offsets, ArrayBuffer)", () => {
    const big = randomBytes(25 * 1024 * 1024);
    const expected = Buffer.from(big).toString("base64");
    assert.equal(bytesToBase64Chunked(big), expected);
    assert.equal(bytesToBase64(big), expected);
    assert.equal(Buffer.compare(base64ToBytes(expected), big), 0);
    const sub = big.subarray(1001, 5003);
    assert.equal(bytesToBase64(sub), Buffer.from(sub).toString("base64"));
    assert.equal(
      bytesToBase64(
        sub.buffer.slice(sub.byteOffset, sub.byteOffset + sub.length)
      ),
      Buffer.from(sub).toString("base64")
    );
  });

  it("decodes the newline-wrapped base64 the Contents API returns", () => {
    const bytes = randomBytes(1000);
    const wrapped =
      Buffer.from(bytes)
        .toString("base64")
        .replace(/(.{60})/g, "$1\n") + "\n";
    assert.equal(Buffer.compare(base64ToBytes(wrapped), bytes), 0);
    assert.equal(Buffer.compare(base64ToBytesChunked(wrapped), bytes), 0);
  });

  it("Korean/emoji text round-trips through UTF-8 bytes; btoa(text) would throw", () => {
    assert.throws(() => btoa(KOREAN));
    assert.equal(bytesToText(textToBytes(KOREAN)), KOREAN);
    assert.equal(
      bytesToText(base64ToBytes(bytesToBase64(textToBytes(KOREAN)))),
      KOREAN
    );
  });

  it("bytesToText refuses invalid UTF-8 instead of corrupting it", () => {
    assert.throws(
      () => bytesToText(new Uint8Array([0xff, 0xfe, 0x00, 0x80])),
      e => e.code === "NOT_TEXT"
    );
  });

  it("validateRepoPath", () => {
    for (const ok of [
      "a.mdx",
      "src/blog/posts/한글 제목.mdx",
      "public/img/blog/2026-10-11/a b.png"
    ]) {
      assert.equal(validateRepoPath(ok), ok);
    }
    for (const bad of [
      "",
      "/a",
      "a/",
      "a//b",
      "../a",
      "a/../b",
      "a/./b",
      "a\\b",
      ".git/config",
      "a/.GIT/x",
      "a\nb",
      42,
      null
    ]) {
      assert.throws(
        () => validateRepoPath(bad),
        e => e.code === "BAD_PATH",
        String(bad)
      );
    }
  });
});

// ============================================================================
describe("construction & token hygiene", () => {
  it("tokenCreationUrl pre-fills GitHub's token form with minimal permissions", () => {
    const u = new URL(
      tokenCreationUrl({owner: "CorbinKim", repo: "CorbinKim.github.io"})
    );
    assert.equal(
      u.origin + u.pathname,
      "https://github.com/settings/personal-access-tokens/new"
    );
    assert.equal(u.searchParams.get("target_name"), "CorbinKim");
    assert.equal(u.searchParams.get("contents"), "write");
    assert.equal(u.searchParams.get("expires_in"), "90");
    assert.ok(u.searchParams.get("name").length <= 40);
    assert.equal(u.searchParams.get("workflows"), null);
    assert.equal(u.searchParams.get("actions"), null);
    const withActions = new URL(
      tokenCreationUrl({owner: "o", repo: "r", actionsRead: true})
    );
    assert.equal(withActions.searchParams.get("actions"), "read");
  });

  it("rejects bad owner/repo and whitespace tokens (without echoing the token)", () => {
    assert.throws(
      () => new GitHub({owner: "", repo: "x"}),
      e => e.code === "BAD_ARGS"
    );
    const secret = "github_pat_abc def\nghi";
    try {
      new GitHub({token: secret, owner: "o", repo: "r"});
      assert.fail("should throw");
    } catch (e) {
      assert.equal(e.code, "BAD_TOKEN_FORMAT");
      assert.ok(!e.message.includes("github_pat"));
      assert.ok(!JSON.stringify(e).includes("github_pat"));
    }
  });

  it("trims a pasted token and never exposes it via JSON/inspect/errors", async () => {
    await withMock(async mock => {
      const tok = mock.tokens.readonly;
      const gh = client(mock, `  ${tok}\n`);
      assert.ok(!JSON.stringify(gh).includes(tok));
      assert.ok(!inspect(gh, {showHidden: true, depth: 5}).includes(tok));
      assert.equal(gh.toJSON().token, "[redacted]");
      assert.equal(gh.tokenKind, "fine-grained");
      let err;
      try {
        await gh.commitFiles({
          message: "x",
          writes: [{path: "a.txt", text: "a"}]
        });
      } catch (e) {
        err = e;
      }
      assert.ok(err instanceof GitHubError);
      for (const s of [
        err.message,
        err.stack,
        JSON.stringify(err),
        inspect(err, {depth: 6})
      ]) {
        assert.ok(!s.includes(tok), "token leaked");
        assert.ok(!s.includes("Bearer"), "auth header leaked");
      }
    });
  });

  it("only sends headers that api.github.com's CORS preflight allows, and Authorization only with a token", async () => {
    await withMock(async mock => {
      const sent = [];
      const spy = (url, init) => {
        sent.push({url: String(url), headers: {...init.headers}});
        return fetch(url, init);
      };
      const gh = client(mock, mock.tokens.write, {fetch: spy});
      await gh.verifyAccess();
      await gh.listDir("src");
      await gh.readText("README.md");
      await gh.commitFiles({
        message: "m",
        writes: [{path: "x.txt", text: "x"}]
      });
      await gh.getDeployStatus(mock.headSha());
      await gh.listDir("src"); // conditional request path
      const allowed = new Set(REAL_ALLOW_HEADERS.map(h => h.toLowerCase()));
      allowed.add("accept"); // CORS-safelisted
      for (const s of sent) {
        for (const h of Object.keys(s.headers)) {
          assert.ok(
            allowed.has(h.toLowerCase()),
            `header ${h} is not on GitHub's CORS allow-list`
          );
        }
        assert.ok(s.url.startsWith(mock.url));
      }
      assert.ok(
        sent.some(s => s.headers["If-None-Match"]),
        "etag cache should issue If-None-Match"
      );
      // anonymous: no Authorization at all
      const before = mock.state.requests.length;
      await client(mock, "").verifyAccess();
      for (const r of mock.state.requests.slice(before))
        assert.equal(r.headers.authorization, undefined);
    });
  });

  it("mock answers CORS preflight like api.github.com", async () => {
    await withMock(async mock => {
      const res = await fetch(
        `${mock.url}/repos/${mock.owner}/${mock.repo}/git/blobs`,
        {
          method: "OPTIONS",
          headers: {
            Origin: "https://corbinkim.github.io",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers":
              "authorization,content-type,x-github-api-version"
          }
        }
      );
      assert.equal(res.status, 204);
      assert.equal(res.headers.get("access-control-allow-origin"), "*");
      assert.match(
        res.headers.get("access-control-allow-headers"),
        /Authorization.*Content-Type.*X-GitHub-Api-Version/
      );
    });
  });
});

// ============================================================================
describe("verifyAccess()", () => {
  it("write token: ok, canPush verified by the probe, login + branch info", async () => {
    await withMock(async mock => {
      const r = await client(mock, mock.tokens.write).verifyAccess();
      assert.equal(r.status, "ok");
      assert.equal(r.login, "octo-owner");
      assert.equal(r.repoFullName, "CorbinKim/CorbinKim.github.io");
      assert.equal(r.defaultBranch, "main");
      assert.equal(r.canPush, true);
      assert.equal(r.canPushVerified, true);
      assert.equal(r.branchExists, true);
      assert.equal(r.headSha, mock.headSha());
      assert.equal(r.message, null);
      assert.equal(r.tokenKind, "fine-grained");
      assert.ok(
        mock.state.requests.length <= 4,
        "verifyAccess should cost <= 4 requests"
      );
      assert.equal(r.rateLimit.limit, 5000);
    });
  });

  it("read-only token: resolves with canPush=false and the owner-facing message (even though /repos says push:true)", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.readonly);
      const r = await gh.verifyAccess();
      assert.equal(r.status, "read-only");
      assert.equal(r.canPush, false);
      assert.equal(r.login, "octo-owner");
      assert.match(
        r.message,
        /^Token lacks Contents: write on CorbinKim\/CorbinKim\.github\.io/
      );
      assert.match(r.message, /Read and write/);
      // Without the probe the user-level `permissions.push` quirk fools us:
      const naive = await client(mock, mock.tokens.readonly).verifyAccess({
        probeWrite: false
      });
      assert.equal(naive.canPush, true);
      assert.equal(naive.canPushVerified, false);
    });
  });

  it("token not scoped to this (public) repo: read-only, no write probe needed", async () => {
    await withMock(async mock => {
      const r = await client(mock, mock.tokens.notSelected).verifyAccess();
      assert.equal(r.status, "read-only");
      assert.equal(r.canPush, false);
      assert.match(r.message, /Token lacks Contents: write/);
      assert.equal(
        mock.state.requests.filter(x => x.method === "POST").length,
        0
      );
    });
  });

  it("requireWrite turns read-only into a NO_WRITE error", async () => {
    await withMock(async mock => {
      await rejectsWith(
        client(mock, mock.tokens.readonly).verifyAccess({requireWrite: true}),
        {
          code: "NO_WRITE",
          status: 403,
          message:
            /Token lacks Contents: write on CorbinKim\/CorbinKim\.github\.io/
        }
      );
    });
  });

  it("invalid token: BAD_TOKEN / 401 with a re-create-the-token message", async () => {
    await withMock(async mock => {
      await rejectsWith(
        client(mock, "github_pat_totally_made_up_123").verifyAccess(),
        {
          code: "BAD_TOKEN",
          status: 401,
          message:
            /rejected the token.*expired or revoked.*CorbinKim\/CorbinKim\.github\.io/
        }
      );
    });
  });

  it("no access to a private repo / wrong repo name: NO_REPO_ACCESS", async () => {
    await withMock(
      async mock => {
        await rejectsWith(
          client(mock, mock.tokens.notSelected).verifyAccess(),
          {
            code: "NO_REPO_ACCESS",
            status: 404,
            message:
              /cannot see CorbinKim\/CorbinKim\.github\.io.*select this repository/
          }
        );
      },
      {isPrivate: true}
    );
    await withMock(async mock => {
      const gh = new GitHub({
        token: mock.tokens.write,
        owner: "CorbinKim",
        repo: "typo-repo",
        apiBase: mock.url
      });
      await rejectsWith(gh.verifyAccess(), {
        code: "NO_REPO_ACCESS",
        message: /CorbinKim\/typo-repo/
      });
    });
  });

  it("anonymous (no token): read-only, nothing but GETs, no login", async () => {
    await withMock(async mock => {
      const r = await client(mock, "").verifyAccess();
      assert.equal(r.status, "anonymous");
      assert.equal(r.authenticated, false);
      assert.equal(r.canPush, false);
      assert.equal(r.login, null);
      assert.match(r.message, /No token: read-only/);
      assert.ok(mock.state.requests.every(x => x.method === "GET"));
    });
  });

  it("GET /user failing (not on the fine-grained list) does not fail verification", async () => {
    await withMock(async mock => {
      mock.state.userEndpointForbidden = true;
      const r = await client(mock, mock.tokens.write).verifyAccess();
      assert.equal(r.login, null);
      assert.equal(r.canPush, true);
    });
  });

  it("classic tokens: scopes exposed; a classic token without public_repo is read-only", async () => {
    await withMock(async mock => {
      const ok = await client(mock, mock.tokens.classic).verifyAccess();
      assert.equal(ok.tokenKind, "classic");
      assert.deepEqual(ok.scopes, ["public_repo"]);
      assert.equal(ok.canPush, true);
      const no = await client(mock, mock.tokens.classicNoScope).verifyAccess();
      assert.equal(no.canPush, false);
      assert.match(no.message, /public_repo/);
    });
  });

  it("an inconclusive write probe (422 / empty repo) keeps the permissions hint instead of reporting read-only", async () => {
    await withMock(async mock => {
      mock.state.failNext.push({
        method: "POST",
        pathRe: /git\/blobs$/,
        status: 422,
        message: "Invalid request",
        times: 1
      });
      const r = await client(mock, mock.tokens.write).verifyAccess();
      assert.equal(r.canPush, true);
      assert.equal(r.canPushVerified, false);
      assert.equal(r.status, "ok");
    });
  });

  it("a dead token during the probe still throws BAD_TOKEN (not read-only)", async () => {
    await withMock(async mock => {
      mock.state.failNext.push({
        method: "POST",
        pathRe: /git\/blobs$/,
        status: 401,
        message: "Bad credentials",
        times: 1
      });
      await rejectsWith(client(mock, mock.tokens.write).verifyAccess(), {
        code: "BAD_TOKEN"
      });
    });
  });

  it("warns about protected or missing branches", async () => {
    await withMock(async mock => {
      mock.state.protection = {
        status: 422,
        message: "Changes must be made through a pull request."
      };
      const r = await client(mock, mock.tokens.write).verifyAccess();
      assert.equal(r.branchProtected, true);
      assert.match(r.warnings[0], /protected/);
      const missing = await client(mock, mock.tokens.write, {
        branch: "nope"
      }).verifyAccess();
      assert.equal(missing.branchExists, false);
      assert.match(missing.warnings[0], /does not exist/);
    });
  });

  it("primary and secondary rate limits surface as RATE_LIMIT with parsed headers", async () => {
    await withMock(async mock => {
      mock.state.forceRateLimit = "primary";
      await assert.rejects(
        client(mock, mock.tokens.write).verifyAccess(),
        e => {
          assert.equal(e.code, "RATE_LIMIT");
          assert.equal(e.rateLimit.remaining, 0);
          assert.ok(
            e.rateLimit.reset instanceof Date && e.rateLimit.reset > new Date()
          );
          assert.match(e.message, /rate limit reached.*in about \d+ min/);
          return true;
        }
      );
      mock.state.forceRateLimit = "secondary";
      await assert.rejects(
        client(mock, mock.tokens.write).verifyAccess(),
        e => {
          assert.equal(e.code, "RATE_LIMIT");
          assert.equal(e.rateLimit.retryAfter, 30);
          assert.match(e.message, /in 30 s/);
          return true;
        }
      );
    });
  });

  it("tracks lastRateLimit from response headers", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      await gh.listDir("src");
      assert.equal(gh.lastRateLimit.limit, 5000);
      assert.ok(gh.lastRateLimit.remaining < 5000);
    });
  });
});

// ============================================================================
describe("listDir / readText / readBytes / listTree", () => {
  it("lists a directory and the root (files and dirs)", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const posts = await gh.listDir("src/blog/posts");
      assert.deepEqual(
        posts.map(p => [p.name, p.type, p.path]),
        [["hello.mdx", "file", "src/blog/posts/hello.mdx"]]
      );
      assert.match(posts[0].sha, /^[0-9a-f]{40}$/);
      const root = await gh.listDir();
      assert.deepEqual(root.map(e => [e.name, e.type]).sort(), [
        ["README.md", "file"],
        ["src", "dir"]
      ]);
    });
  });

  it("missing dir -> NOT_FOUND, or [] with missingOk; a file passed to listDir -> NOT_DIR", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      await rejectsWith(gh.listDir("nope/nothing"), {
        code: "NOT_FOUND",
        status: 404
      });
      assert.deepEqual(await gh.listDir("nope/nothing", {missingOk: true}), []);
      await rejectsWith(gh.listDir("README.md"), {code: "NOT_DIR"});
    });
  });

  it("works anonymously on a public repo", async () => {
    await withMock(async mock => {
      const gh = client(mock, "");
      assert.equal((await gh.listDir("src/blog/posts")).length, 1);
      assert.match((await gh.readText("README.md")).text, /mock/);
    });
  });

  it("readText returns exact Korean/emoji/LaTeX text and the blob sha", async () => {
    await withMock(async mock => {
      mock.seed({"src/blog/posts/한글 제목.mdx": KOREAN});
      const gh = client(mock, mock.tokens.write);
      const {text, sha} = await gh.readText("src/blog/posts/한글 제목.mdx");
      assert.equal(text, KOREAN);
      assert.equal(sha, gitBlobSha(Buffer.from(KOREAN, "utf8")));
    });
  });

  it("files > 1 MB (Contents API returns encoding:none) fall back to the raw media type", async () => {
    await withMock(async mock => {
      const big = "가나다라마바사 ".repeat(150_000); // ~3 MB of UTF-8 text
      const bin = randomBytes(3 * 1024 * 1024);
      mock.seed({"big.txt": big, "big.bin": bin});
      const gh = client(mock, mock.tokens.write);
      const before = mock.state.requests.length;
      assert.equal((await gh.readText("big.txt")).text, big);
      const reqs = mock.state.requests.slice(before);
      assert.equal(reqs.length, 2);
      assert.match(reqs[1].headers.accept, /vnd\.github\.raw/);
      const r = await gh.readBytes("big.bin");
      assert.equal(Buffer.compare(Buffer.from(r.bytes), Buffer.from(bin)), 0);
      assert.equal(r.size, bin.length);
    });
  });

  it("errors: missing file, directory, binary-as-text", async () => {
    await withMock(async mock => {
      mock.seed({"b.bin": new Uint8Array([0xff, 0xfe, 0xfd, 0x80, 0x81])});
      const gh = client(mock, mock.tokens.write);
      await rejectsWith(gh.readText("src/missing.mdx"), {
        code: "NOT_FOUND",
        message: "File not found: src/missing.mdx."
      });
      await rejectsWith(gh.readText("src"), {code: "IS_DIR"});
      await rejectsWith(gh.readText("b.bin"), {code: "NOT_TEXT"});
      assert.equal((await gh.readBytes("b.bin")).bytes.length, 5);
    });
  });

  it("directories with >= 1000 entries are re-listed through the Trees API (Contents API caps at 1000)", async () => {
    await withMock(async mock => {
      const files = {};
      for (let i = 0; i < 1005; i++)
        files[`many/f${String(i).padStart(4, "0")}.txt`] = "x";
      mock.seed(files);
      const gh = client(mock, mock.tokens.write);
      const list = await gh.listDir("many");
      assert.equal(list.length, 1005);
      assert.equal(list[0].name, "f0000.txt");
      assert.ok(mock.requestsTo("GET", /\/git\/trees\//).length >= 1);
    });
  });

  it("conditional requests: unchanged -> 304 served from cache, changed -> fresh data", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const a = await gh.listDir("src/blog/posts");
      const b = await gh.listDir("src/blog/posts");
      assert.deepEqual(b, a);
      assert.equal(mock.state.notModified, 1);
      await gh.commitFiles({
        message: "add",
        writes: [{path: "src/blog/posts/new.mdx", text: "n"}]
      });
      const c = await gh.listDir("src/blog/posts");
      assert.deepEqual(c.map(x => x.name).sort(), ["hello.mdx", "new.mdx"]);
    });
  });

  it("listTree returns every blob under a prefix (to find a post's images before deleting)", async () => {
    await withMock(async mock => {
      mock.seed({
        "public/img/blog/p1/a.png": "a",
        "public/img/blog/p1/sub/b.png": "b",
        "public/img/blog/p2/c.png": "c"
      });
      const t = await client(mock, mock.tokens.write).listTree(
        "public/img/blog/p1"
      );
      assert.deepEqual(t.map(x => x.path).sort(), [
        "public/img/blog/p1/a.png",
        "public/img/blog/p1/sub/b.png"
      ]);
    });
  });
});

// ============================================================================
describe("commitFiles()", () => {
  it("one atomic commit for post + several images (incl. 3 MB binary): single commit, parent chain, bytes exact", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const chainBefore = mock.chain();
      const oldHead = mock.headSha();
      const png3mb = randomBytes(3 * 1024 * 1024);
      const allBytes = new Uint8Array(256).map((_, i) => i); // every byte value
      const small = randomBytes(1234);
      const nBlobs0 = mock.state.blobPosts;
      const res = await gh.commitFiles({
        message: "Publish: 어텐션 👩‍💻",
        writes: [
          {path: "src/blog/posts/2026-10-11-attention.mdx", text: KOREAN},
          {
            path: "public/img/blog/2026-10-11-attention/hero.png",
            bytes: png3mb
          },
          {
            path: "public/img/blog/2026-10-11-attention/all-bytes.bin",
            bytes: allBytes
          },
          {path: "public/img/blog/2026-10-11-attention/한글.jpg", bytes: small}
        ]
      });
      const chain = mock.chain();
      assert.equal(
        chain.length,
        chainBefore.length + 1,
        "exactly one new commit"
      );
      assert.equal(chain[0].sha, res.commitSha);
      assert.equal(chain[0].parents.length, 1);
      assert.equal(chain[0].parents[0], oldHead, "parent is the previous head");
      assert.equal(chain[1].sha, oldHead);
      assert.equal(chain[0].message, "Publish: 어텐션 👩‍💻");
      assert.equal(res.parentSha, oldHead);
      assert.equal(res.noChanges, false);
      assert.equal(res.retries, 0);
      assert.match(res.htmlUrl, new RegExp(`/commit/${res.commitSha}$`));
      assert.equal(mock.headSha(), res.commitSha);

      // byte-for-byte, as stored by the server ...
      assert.equal(
        Buffer.compare(
          mock.readFile("public/img/blog/2026-10-11-attention/hero.png"),
          Buffer.from(png3mb)
        ),
        0
      );
      assert.equal(
        Buffer.compare(
          mock.readFile("public/img/blog/2026-10-11-attention/all-bytes.bin"),
          Buffer.from(allBytes)
        ),
        0
      );
      assert.equal(
        mock
          .readFile("src/blog/posts/2026-10-11-attention.mdx")
          .toString("utf8"),
        KOREAN
      );
      // ... and as read back through the client (3 MB goes through the raw fallback)
      const back = await gh.readBytes(
        "public/img/blog/2026-10-11-attention/hero.png"
      );
      assert.equal(
        Buffer.compare(Buffer.from(back.bytes), Buffer.from(png3mb)),
        0
      );
      assert.equal(
        (await gh.readText("src/blog/posts/2026-10-11-attention.mdx")).text,
        KOREAN
      );
      // untouched files survive (base_tree was used)
      assert.ok(mock.readFile("README.md"));
      assert.ok(mock.readFile("src/blog/posts/hello.mdx"));
    });
  });

  it("makes exactly: GET ref, GET commit, N blobs, 1 tree, 1 commit, 1 PATCH (and nothing else)", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const n0 = mock.state.requests.length;
      await gh.commitFiles({
        message: "m",
        writes: [
          {path: "a.txt", text: "a"},
          {path: "b.bin", bytes: new Uint8Array([1, 2, 3])}
        ],
        deletes: ["README.md"]
      });
      const sig = mock.state.requests
        .slice(n0)
        .map(r => `${r.method} ${r.path.replace(/[0-9a-f]{40}/, "<sha>")}`);
      assert.deepEqual(sig.sort(), [
        "GET /repos/CorbinKim/CorbinKim.github.io/git/commits/<sha>",
        "GET /repos/CorbinKim/CorbinKim.github.io/git/ref/heads/main",
        "PATCH /repos/CorbinKim/CorbinKim.github.io/git/refs/heads/main",
        "POST /repos/CorbinKim/CorbinKim.github.io/git/blobs",
        "POST /repos/CorbinKim/CorbinKim.github.io/git/blobs",
        "POST /repos/CorbinKim/CorbinKim.github.io/git/commits",
        "POST /repos/CorbinKim/CorbinKim.github.io/git/trees"
      ]);
      const patch = mock.state.requests.find(r => r.method === "PATCH");
      assert.equal(patch.headers["x-github-api-version"], "2022-11-28");
    });
  });

  it("delete + write in a single commit (post replaced, its old images removed)", async () => {
    await withMock(async mock => {
      mock.seed({
        "src/blog/posts/old.mdx": "old",
        "public/img/blog/old/a.png": "a",
        "public/img/blog/old/b.png": "b"
      });
      const gh = client(mock, mock.tokens.write);
      const before = mock.chain().length;
      const res = await gh.commitFiles({
        message: "Rename old -> new",
        writes: [{path: "src/blog/posts/new.mdx", text: "new"}],
        deletes: [
          "src/blog/posts/old.mdx",
          "public/img/blog/old/a.png",
          "public/img/blog/old/b.png"
        ]
      });
      assert.equal(mock.chain().length, before + 1);
      const files = mock.headFiles();
      assert.ok(files.has("src/blog/posts/new.mdx"));
      assert.ok(!files.has("src/blog/posts/old.mdx"));
      assert.ok(
        ![...files.keys()].some(p => p.startsWith("public/img/blog/old/"))
      );
      assert.ok(
        files.has("README.md") && files.has("src/blog/posts/hello.mdx")
      );
      assert.deepEqual(res.deleted.length, 3);
    });
  });

  it("deletes-only commit works (delete a post + its image folder found via listTree)", async () => {
    await withMock(async mock => {
      mock.seed({
        "src/blog/posts/x.mdx": "x",
        "public/img/blog/x/1.png": "1",
        "public/img/blog/x/2.png": "2"
      });
      const gh = client(mock, mock.tokens.write);
      const imgs = (await gh.listTree("public/img/blog/x")).map(f => f.path);
      await gh.commitFiles({
        message: "Delete x",
        deletes: ["src/blog/posts/x.mdx", ...imgs]
      });
      const files = mock.headFiles();
      assert.ok(!files.has("src/blog/posts/x.mdx"));
      assert.equal(
        [...files.keys()].filter(p => p.startsWith("public/img/blog/x")).length,
        0
      );
    });
  });

  it("identical content -> noChanges, no empty commit, no deploy", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const head = mock.headSha();
      const res = await gh.commitFiles({
        message: "again",
        writes: [{path: "README.md", text: "# mock\n"}]
      });
      assert.equal(res.noChanges, true);
      assert.equal(res.commitSha, head);
      assert.equal(mock.headSha(), head);
      assert.equal(mock.requestsTo("POST", /\/git\/commits$/).length, 0);
      assert.equal(mock.requestsTo("PATCH", /./).length, 0);
    });
  });

  it("validates input before any network traffic", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const bad = [
        [
          {
            message: "m",
            writes: [{path: "a.txt", text: "1"}],
            deletes: ["a.txt"]
          },
          "BAD_PATH"
        ],
        [
          {
            message: "m",
            writes: [
              {path: "a.txt", text: "1"},
              {path: "a.txt", text: "2"}
            ]
          },
          "BAD_PATH"
        ],
        [{message: "m", writes: [{path: "../evil", text: "1"}]}, "BAD_PATH"],
        [{message: "m", deletes: ["/abs"]}, "BAD_PATH"],
        [{message: "m"}, "BAD_ARGS"],
        [{message: "  ", writes: [{path: "a", text: "1"}]}, "BAD_ARGS"],
        [{message: "m", writes: [{path: "a"}]}, "BAD_ARGS"],
        [{message: "m", writes: [{path: "a", bytes: "not bytes"}]}, "BAD_ARGS"],
        [
          {
            message: "m",
            writes: [
              {path: "huge.bin", bytes: new Uint8Array(21 * 1024 * 1024)}
            ]
          },
          "TOO_LARGE"
        ],
        [
          {
            message: "m",
            writes: [1, 2, 3].map(i => ({
              path: `h${i}.bin`,
              bytes: new Uint8Array(18 * 1024 * 1024)
            }))
          },
          "TOO_LARGE"
        ]
      ];
      for (const [args, code] of bad)
        await rejectsWith(gh.commitFiles(args), {code});
      assert.equal(
        mock.state.requests.length,
        0,
        "nothing should have hit the network"
      );
    });
  });

  it("non-fast-forward: refetches the ref, rebuilds tree+commit on the new head, retries, keeps the other commit's work, reuses blobs", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const oldHead = mock.headSha();
      mock.state.raceBeforePatch = 1; // someone pushes between our GET ref and our PATCH
      const res = await gh.commitFiles({
        message: "Publish",
        writes: [
          {path: "post.mdx", text: "hello"},
          {path: "img.bin", bytes: randomBytes(5000)}
        ]
      });
      assert.equal(res.retries, 1);
      const chain = mock.chain();
      assert.equal(chain.length, 3); // initial..., external, ours
      const external = chain[1];
      assert.equal(external.message, "external commit");
      assert.equal(external.parents[0], oldHead);
      assert.equal(chain[0].sha, res.commitSha);
      assert.equal(
        chain[0].parents[0],
        external.sha,
        "our commit sits on top of the external one"
      );
      assert.equal(res.parentSha, external.sha);
      const files = mock.headFiles();
      assert.ok(
        [...files.keys()].some(p => p.startsWith("external-")),
        "external commit's file survived"
      );
      assert.equal(files.get("post.mdx").toString(), "hello");
      // blobs uploaded once, trees/commits/PATCH twice
      assert.equal(mock.requestsTo("POST", /\/git\/blobs$/).length, 2);
      assert.equal(mock.requestsTo("POST", /\/git\/trees$/).length, 2);
      assert.equal(mock.requestsTo("POST", /\/git\/commits$/).length, 2);
      assert.equal(mock.requestsTo("PATCH", /./).length, 2);
      // the orphaned first attempt must not be on the branch
      assert.equal(chain.filter(c => c.message === "Publish").length, 1);
    });
  });

  it("gives up with a friendly CONFLICT after maxRetries; never force-pushes", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      mock.state.raceBeforePatch = 100;
      await rejectsWith(
        gh.commitFiles({
          message: "m",
          writes: [{path: "a.txt", text: "a"}],
          maxRetries: 2
        }),
        {
          code: "CONFLICT",
          message: /kept changing.*Publish again/
        }
      );
      assert.equal(mock.requestsTo("PATCH", /./).length, 3);
      assert.ok(mock.requestsTo("PATCH", /./).every(() => true));
      assert.ok(!mock.headFiles().has("a.txt"));
    });
  });

  it("branch protection: no retry loop, PROTECTED_BRANCH message (422 and 403 flavours)", async () => {
    for (const protection of [
      {status: 422, message: 'Required status check "build" is expected.'},
      {
        status: 403,
        message: "Protected branch update failed for refs/heads/main."
      },
      {status: 422, message: "Changes must be made through a pull request."}
    ]) {
      await withMock(async mock => {
        const gh = client(mock, mock.tokens.write);
        mock.state.protection = protection;
        await rejectsWith(
          gh.commitFiles({message: "m", writes: [{path: "a.txt", text: "a"}]}),
          {
            code: "PROTECTED_BRANCH",
            message: /Branch "main" is protected/
          }
        );
        assert.equal(
          mock.requestsTo("PATCH", /./).length,
          1,
          "protection must not be retried"
        );
      });
    }
  });

  it("protection + a concurrent push at the same time: still PROTECTED_BRANCH, not an endless retry", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      mock.state.protection = {
        status: 422,
        message: "Changes must be made through a pull request."
      };
      mock.state.raceBeforePatch = 5;
      await rejectsWith(
        gh.commitFiles({message: "m", writes: [{path: "a.txt", text: "a"}]}),
        {code: "PROTECTED_BRANCH"}
      );
      assert.equal(mock.requestsTo("PATCH", /./).length, 1);
    });
  });

  it("deleting a path that no longer exists: if GitHub 422s, the missing deletes are dropped and the rest commits", async () => {
    await withMock(async mock => {
      mock.state.strictDeletes = true;
      const gh = client(mock, mock.tokens.write);
      const res = await gh.commitFiles({
        message: "m",
        writes: [{path: "n.txt", text: "n"}],
        deletes: ["README.md", "already/gone.png"]
      });
      assert.deepEqual(res.skippedDeletes, ["already/gone.png"]);
      assert.deepEqual(res.deleted, ["README.md"]);
      assert.equal(res.retries, 0);
      const files = mock.headFiles();
      assert.ok(files.has("n.txt") && !files.has("README.md"));
      // a 422 that is NOT about missing deletes is surfaced
      mock.state.failNext.push({
        method: "POST",
        pathRe: /git\/trees$/,
        status: 422,
        message: "something else",
        times: 1
      });
      await rejectsWith(
        gh.commitFiles({
          message: "m",
          writes: [{path: "o.txt", text: "o"}],
          deletes: ["n.txt"]
        }),
        {code: "VALIDATION"}
      );
    });
  });

  it("read-only token: NO_PERMISSION with the owner-facing message, fails on the first write, repo untouched", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.readonly);
      const head = mock.headSha();
      const blobs = mock.blobCount();
      await rejectsWith(
        gh.commitFiles({message: "m", writes: [{path: "a.txt", text: "a"}]}),
        {
          code: "NO_PERMISSION",
          status: 403,
          needs: "Contents: write",
          message:
            /^Token lacks Contents: write on CorbinKim\/CorbinKim\.github\.io\./
        }
      );
      assert.equal(mock.headSha(), head);
      assert.equal(mock.blobCount(), blobs);
    });
  });

  it("invalid token: BAD_TOKEN before anything is uploaded", async () => {
    await withMock(async mock => {
      const gh = client(mock, "github_pat_nope_nope_nope");
      await rejectsWith(
        gh.commitFiles({message: "m", writes: [{path: "a.txt", text: "a"}]}),
        {
          code: "BAD_TOKEN",
          status: 401
        }
      );
      assert.equal(mock.state.requests.length, 1);
    });
  });

  it("classic token without public_repo (GitHub answers 404 on writes): explains the scope", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.classicNoScope);
      await rejectsWith(
        gh.commitFiles({message: "m", writes: [{path: "a.txt", text: "a"}]}),
        {
          code: "NOT_FOUND",
          message: /public_repo/
        }
      );
    });
  });

  it("missing branch: clear message", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write, {branch: "nope"});
      await rejectsWith(
        gh.commitFiles({message: "m", writes: [{path: "a.txt", text: "a"}]}),
        {
          code: "NOT_FOUND",
          message:
            /Branch "nope" does not exist on CorbinKim\/CorbinKim\.github\.io/
        }
      );
    });
  });

  it("rate limit hit mid-commit surfaces RATE_LIMIT and leaves the branch alone", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      mock.state.failNext.push({
        method: "POST",
        pathRe: /git\/trees$/,
        status: 403,
        message: "You have exceeded a secondary rate limit.",
        headers: {"retry-after": "60"},
        times: 1
      });
      const head = mock.headSha();
      await rejectsWith(
        gh.commitFiles({message: "m", writes: [{path: "a.txt", text: "a"}]}),
        {code: "RATE_LIMIT", message: /in 60 s/}
      );
      assert.equal(mock.headSha(), head);
    });
  });

  it("GETs retry on 502; writes do not", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      mock.state.failNext.push({
        method: "GET",
        pathRe: /git\/ref\//,
        status: 502,
        message: "Bad gateway",
        times: 2
      });
      const res = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      assert.equal(mock.headSha(), res.commitSha);
      mock.state.failNext.push({
        method: "POST",
        pathRe: /git\/blobs$/,
        status: 502,
        message: "Bad gateway",
        times: 1
      });
      const blobsBefore = mock.requestsTo("POST", /git\/blobs$/).length;
      await rejectsWith(
        gh.commitFiles({message: "m2", writes: [{path: "b.txt", text: "b"}]}),
        {code: "SERVER", status: 502}
      );
      assert.equal(
        mock.requestsTo("POST", /git\/blobs$/).length,
        blobsBefore + 1
      );
    });
  });

  it("fetch failure -> NETWORK error", async () => {
    const gh = new GitHub({
      token: "github_pat_x",
      owner: "o",
      repo: "r",
      fetch: async () => {
        throw new TypeError("fetch failed");
      }
    });
    await rejectsWith(gh.verifyAccess(), {
      code: "NETWORK",
      message: /Could not reach GitHub/
    });
  });

  it("uploads blobs at most 4 at a time", async () => {
    await withMock(async mock => {
      mock.state.blobDelayMs = 25;
      const gh = client(mock, mock.tokens.write);
      const writes = Array.from({length: 12}, (_, i) => ({
        path: `img/${i}.bin`,
        bytes: randomBytes(100 + i)
      }));
      await gh.commitFiles({message: "many", writes});
      assert.ok(mock.state.maxBlobConcurrency > 1, "should parallelise");
      assert.ok(
        mock.state.maxBlobConcurrency <= 4,
        `concurrency ${mock.state.maxBlobConcurrency}`
      );
      assert.equal(mock.headFiles().size, 2 + 12);
    });
  });

  it("passes author/committer through", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const r = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}],
        author: {name: "Corbin Kim", email: "gkim26@ncsu.edu"}
      });
      assert.equal(mock.commit(r.commitSha).author.name, "Corbin Kim");
    });
  });

  it("Korean + emoji + LaTeX text survives write -> read exactly (UTF-8, CRLF, combining marks)", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const path = "src/blog/posts/2026-10-11-딥러닝-난이도.mdx";
      await gh.commitFiles({
        message: "한글 커밋 🚀",
        writes: [{path, text: KOREAN}]
      });
      assert.equal(mock.readFile(path).toString("utf8"), KOREAN);
      assert.equal(
        Buffer.compare(mock.readFile(path), Buffer.from(KOREAN, "utf8")),
        0
      );
      const back = await gh.readText(path);
      assert.equal(back.text, KOREAN);
      assert.equal(
        (await gh.listDir("src/blog/posts")).find(f =>
          f.name.includes("딥러닝")
        ).name,
        "2026-10-11-딥러닝-난이도.mdx"
      );
    });
  });
});

// ============================================================================
describe("getDeployStatus()", () => {
  it("single checks follow queued -> in_progress -> success for the deploy workflow only", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.write);
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      const s1 = await gh.getDeployStatus(commitSha);
      const s2 = await gh.getDeployStatus(commitSha);
      const s3 = await gh.getDeployStatus(commitSha);
      assert.deepEqual(
        [s1.state, s2.state, s3.state],
        ["queued", "in_progress", "success"]
      );
      assert.match(s3.url, /\/actions\/runs\/\d+$/);
      assert.equal(s3.conclusion, "success");
      assert.equal(mock.state.requests.at(-1).query.event, "push");
      assert.equal(mock.state.requests.at(-1).query.head_sha, commitSha);
    });
  });

  it("wait:true polls to the end and reports every change; a failing Check Format run is ignored", async () => {
    await withMock(async mock => {
      mock.state.prettierConclusion = "failure";
      const clock = fakeClock();
      const gh = client(mock, mock.tokens.write, {
        sleep: clock.sleep,
        now: clock.now
      });
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      const seen = [];
      const end = await gh.getDeployStatus(commitSha, {
        wait: true,
        intervalMs: 1000,
        onUpdate: s => seen.push(s.state)
      });
      assert.deepEqual(seen, ["queued", "in_progress", "success"]);
      assert.equal(end.state, "success");
    });
  });

  it("deploy failure and cancellation (superseded by a newer push)", async () => {
    await withMock(async mock => {
      mock.state.deployScript = [
        ["in_progress", null],
        ["completed", "failure"]
      ];
      const gh = client(mock, mock.tokens.write);
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      const end = await gh.getDeployStatus(commitSha, {wait: true});
      assert.equal(end.state, "failure");
      assert.equal(end.conclusion, "failure");
      mock.state.deployScript = [["completed", "cancelled"]];
      const {commitSha: c2} = await gh.commitFiles({
        message: "m2",
        writes: [{path: "b.txt", text: "b"}]
      });
      assert.equal((await gh.getDeployStatus(c2)).state, "cancelled");
    });
  });

  it("run not created yet: keeps polling, then picks it up", async () => {
    await withMock(async mock => {
      mock.state.hideRunsPolls = 2;
      const clock = fakeClock();
      const gh = client(mock, mock.tokens.write, {
        sleep: clock.sleep,
        now: clock.now
      });
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      const end = await gh.getDeployStatus(commitSha, {
        wait: true,
        intervalMs: 2000
      });
      assert.equal(end.state, "success");
      assert.ok(clock.t >= 4000);
    });
  });

  it("no run ever appears (workflow disabled?): 'unknown' after appearTimeoutMs", async () => {
    await withMock(async mock => {
      mock.state.autoRuns = false;
      const clock = fakeClock();
      const gh = client(mock, mock.tokens.write, {
        sleep: clock.sleep,
        now: clock.now
      });
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      const end = await gh.getDeployStatus(commitSha, {
        wait: true,
        intervalMs: 5000,
        appearTimeoutMs: 20000
      });
      assert.equal(end.state, "unknown");
      assert.equal(end.reason, "no-run-yet");
      assert.match(
        end.url,
        /github\.com\/CorbinKim\/CorbinKim\.github\.io\/actions$/
      );
      assert.ok(clock.t >= 20000 && clock.t < 40000);
    });
  });

  it("stuck run: gives up at timeoutMs with timedOut:true", async () => {
    await withMock(async mock => {
      mock.state.deployScript = [["in_progress", null]];
      const clock = fakeClock();
      const gh = client(mock, mock.tokens.write, {
        sleep: clock.sleep,
        now: clock.now
      });
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      const end = await gh.getDeployStatus(commitSha, {
        wait: true,
        intervalMs: 1000,
        timeoutMs: 5000
      });
      assert.equal(end.state, "in_progress");
      assert.equal(end.timedOut, true);
    });
  });

  it("token without Actions: read on a repo that hides runs -> 'unknown' (no-permission), not a throw", async () => {
    await withMock(async mock => {
      const gh = client(mock, mock.tokens.noActions);
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      mock.state.actionsPublic = false;
      const r = await gh.getDeployStatus(commitSha);
      assert.equal(r.state, "unknown");
      assert.equal(r.reason, "no-permission");
      assert.equal(r.error.code, "NO_PERMISSION");
      assert.equal(
        (await client(mock, mock.tokens.write).getDeployStatus(commitSha))
          .state,
        "queued"
      );
    });
  });

  it("abort signal stops the polling loop", async () => {
    await withMock(async mock => {
      mock.state.deployScript = [["queued", null]];
      const ac = new AbortController();
      const gh = client(mock, mock.tokens.write, {sleep: undefined});
      const {commitSha} = await gh.commitFiles({
        message: "m",
        writes: [{path: "a.txt", text: "a"}]
      });
      setTimeout(() => ac.abort(), 30);
      await assert.rejects(
        gh.getDeployStatus(commitSha, {
          wait: true,
          intervalMs: 10_000,
          signal: ac.signal
        }),
        e => e.name === "AbortError"
      );
    });
  });

  it("rejects a malformed sha; mapRunState table", async () => {
    await withMock(async mock => {
      await rejectsWith(
        client(mock, mock.tokens.write).getDeployStatus("not-a-sha"),
        {code: "BAD_ARGS"}
      );
    });
    const t = [
      [{status: "queued"}, "queued"],
      [{status: "waiting"}, "queued"],
      [{status: "pending"}, "queued"],
      [{status: "in_progress"}, "in_progress"],
      [{status: "completed", conclusion: "success"}, "success"],
      [{status: "completed", conclusion: "failure"}, "failure"],
      [{status: "completed", conclusion: "timed_out"}, "failure"],
      [{status: "completed", conclusion: "startup_failure"}, "failure"],
      [{status: "completed", conclusion: "cancelled"}, "cancelled"],
      [{status: "completed", conclusion: "skipped"}, "unknown"],
      [{status: "weird"}, "unknown"],
      [null, "unknown"]
    ];
    for (const [run, want] of t)
      assert.equal(mapRunState(run), want, JSON.stringify(run));
  });
});
