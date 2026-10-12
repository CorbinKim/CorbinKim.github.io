/**
 * In-memory mock of the slice of api.github.com that github.js uses.
 * node:http only, no dependencies.
 *
 *   import {startMockGitHub} from "./mock-github-server.js";
 *   const mock = await startMockGitHub();          // random free port
 *   const gh = new GitHub({token: mock.tokens.write, owner: mock.owner,
 *                          repo: mock.repo, apiBase: mock.url});
 *   ...
 *   await mock.close();
 *
 * Or run standalone for manual testing of the admin UI:
 *   node mock-github-server.js 8787
 *   (point the editor's apiBase at http://127.0.0.1:8787 and paste the token
 *    printed at startup)
 *
 * Endpoints (exactly what github.js calls):
 *   GET   /user
 *   GET   /repos/:o/:r
 *   GET   /repos/:o/:r/branches/:branch
 *   GET   /repos/:o/:r/git/ref/heads/:branch
 *   GET   /repos/:o/:r/git/commits/:sha
 *   POST  /repos/:o/:r/git/blobs          (base64 | utf-8)
 *   GET   /repos/:o/:r/git/blobs/:sha
 *   POST  /repos/:o/:r/git/trees          (base_tree, sha:null deletes)
 *   GET   /repos/:o/:r/git/trees/:sha     (?recursive=1)
 *   POST  /repos/:o/:r/git/commits
 *   PATCH /repos/:o/:r/git/refs/heads/:branch   (fast-forward only unless force)
 *   GET   /repos/:o/:r/contents/:path     (JSON, raw media type, dirs, 1 MB cap)
 *   GET   /repos/:o/:r/actions/runs       (?head_sha=&event=)
 *   OPTIONS *                             (CORS preflight)
 *
 * Fidelity notes: object ids are real git-style sha1s for blobs; trees are
 * stored flat (path -> blob) and their id is a sha1 of the sorted entries, so
 * identical content gives an identical tree id (that is what makes the client's
 * "noChanges" detection testable). Responses carry the same CORS and
 * rate-limit headers the real API sends.
 */
import http from "node:http";
import crypto from "node:crypto";
import {pathToFileURL} from "node:url";

// Copied from a real preflight response of api.github.com (2026-10-11).
export const REAL_ALLOW_HEADERS = [
  "Authorization",
  "Content-Type",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "If-Unmodified-Since",
  "Accept-Encoding",
  "X-GitHub-OTP",
  "X-Requested-With",
  "User-Agent",
  "GraphQL-Features",
  "X-Github-Next-Global-ID",
  "X-GitHub-Api-Version",
  "X-Fetch-Nonce",
  "Copilot-Integration-Id",
  "DD-CLIENT-TOKEN",
  "X-Client-Application"
];
const EXPOSE_HEADERS =
  "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset";

const sha1 = buf => crypto.createHash("sha1").update(buf).digest("hex");
const blobSha = buf =>
  sha1(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf]));
const EMPTY_TREE = sha1("tree-empty");

export async function startMockGitHub({
  owner = "CorbinKim",
  repo = "CorbinKim.github.io",
  branch = "main",
  isPrivate = false,
  files = {},
  port = 0
} = {}) {
  const fullName = `${owner}/${repo}`;
  const blobs = new Map(); // sha -> Buffer
  const trees = new Map(); // sha -> Map(path -> {mode, sha})
  const commits = new Map(); // sha -> commit
  const refs = new Map(); // "heads/main" -> sha
  const runs = new Map(); // head sha -> [run]
  trees.set(EMPTY_TREE, new Map());
  let commitCounter = 0;
  let runCounter = 1000;

  const tokens = new Map();
  const state = {
    owner,
    repo,
    branch,
    fullName,
    isPrivate,
    requests: [], // {method, path, query, headers, status}
    blobPosts: 0,
    blobInFlight: 0,
    maxBlobConcurrency: 0,
    blobDelayMs: 0,
    notModified: 0,
    raceBeforePatch: 0, // number of times to sneak in an external commit
    failNext: [], // {method, pathRe, status, body, headers, times}
    protection: null, // {status, message} -> PATCH ref rejected
    autoRuns: true,
    deployScript: [
      ["queued", null],
      ["in_progress", null],
      ["completed", "success"]
    ],
    prettierConclusion: "success",
    hideRunsPolls: 0,
    actionsPublic: true, // public repo: anyone may list runs
    strictDeletes: false, // 422 when a delete targets a path not in base_tree
    userEndpointForbidden: false, // simulate GET /user 403 for fine-grained
    rate: {limit: 5000, remaining: 5000, resource: "core"},
    forceRateLimit: null // "primary" | "secondary" (consumed once)
  };

  // ---- git model helpers ---------------------------------------------------
  const headOf = b => refs.get(`heads/${b}`);
  const treeOfCommit = sha => commits.get(sha)?.tree;
  const treeId = entries => {
    const lines = [...entries.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([p, e]) => `${e.mode} ${e.sha}\t${p}`)
      .join("\n");
    return entries.size ? sha1("tree\n" + lines) : EMPTY_TREE;
  };
  const putTree = entries => {
    const id = treeId(entries);
    trees.set(id, entries);
    return id;
  };
  const putBlob = buf => {
    const id = blobSha(buf);
    blobs.set(id, buf);
    return id;
  };
  const putCommit = ({tree, parents, message, author, committer}) => {
    const n = ++commitCounter;
    const id = sha1(`commit ${tree} ${parents.join(",")} ${message} ${n}`);
    const who = {
      name: "Mock User",
      email: "mock@users.noreply.github.com",
      date: new Date(1.7e12 + n * 1000).toISOString()
    };
    commits.set(id, {
      sha: id,
      tree,
      parents,
      message,
      author: {...who, ...(author || {})},
      committer: {...who, ...(committer || {})}
    });
    return id;
  };
  const isAncestor = (anc, desc) => {
    const stack = [desc];
    const seen = new Set();
    while (stack.length) {
      const s = stack.pop();
      if (s === anc) return true;
      if (seen.has(s)) continue;
      seen.add(s);
      stack.push(...(commits.get(s)?.parents ?? []));
    }
    return false;
  };
  /** test helper: make a commit on top of the head with the given files. */
  const seed = (fileMap, {message = "seed", deletes = [], b = branch} = {}) => {
    const parent = headOf(b);
    const base = new Map(parent ? trees.get(treeOfCommit(parent)) : []);
    for (const [p, v] of Object.entries(fileMap)) {
      const buf =
        Buffer.isBuffer(v) || v instanceof Uint8Array
          ? Buffer.from(v)
          : Buffer.from(String(v), "utf8");
      base.set(p, {mode: "100644", sha: putBlob(buf)});
    }
    for (const p of deletes) base.delete(p);
    const id = putCommit({
      tree: putTree(base),
      parents: parent ? [parent] : [],
      message
    });
    refs.set(`heads/${b}`, id);
    maybeCreateRuns(id);
    return id;
  };
  const headFiles = (b = branch) => {
    const t = trees.get(treeOfCommit(headOf(b)));
    return new Map([...t.entries()].map(([p, e]) => [p, blobs.get(e.sha)]));
  };
  const chain = (b = branch) => {
    const out = [];
    for (let s = headOf(b); s; s = commits.get(s).parents[0])
      out.push(commits.get(s));
    return out; // newest first
  };

  function maybeCreateRuns(headSha) {
    if (!state.autoRuns) return;
    const mk = (name, path, event, script) => ({
      id: ++runCounter,
      name,
      path,
      event,
      head_sha: headSha,
      head_branch: branch,
      run_attempt: 1,
      created_at: new Date(1.7e12 + runCounter * 1000).toISOString(),
      html_url: `https://github.com/${fullName}/actions/runs/${runCounter}`,
      _script: script,
      _poll: 0
    });
    runs.set(headSha, [
      mk(
        "Deploy portfolio to GitHub Pages",
        ".github/workflows/deploy.yml",
        "push",
        state.deployScript
      ),
      mk("Check Format", ".github/workflows/prettier.yml", "push", [
        ["completed", state.prettierConclusion]
      ]),
      mk("Push on main", "dynamic/github-code-scanning/codeql", "dynamic", [
        ["completed", "success"]
      ])
    ]);
  }

  // initial repo content
  seed(
    {
      "README.md": "# mock\n",
      "src/blog/posts/hello.mdx": "---\ntitle: Hello\n---\nHi\n"
    },
    {message: "initial"}
  );
  if (Object.keys(files).length) seed(files, {message: "seed files"});

  // ---- auth ----------------------------------------------------------------
  /**
   * @param spec {login, contents: 'write'|'read'|null, actions: 'read'|null,
   *   repoSelected: boolean, permissionsPush: boolean|undefined (what
   *   GET /repos reports - lets a test reproduce the "permissions describes the
   *   user, not the token" quirk), scopes: string[] (classic)}
   */
  const addToken = (token, spec) => {
    tokens.set(token, {
      login: "octo-owner",
      contents: "write",
      actions: "read",
      repoSelected: true,
      ...spec
    });
    return token;
  };
  const T = {
    write: addToken("github_pat_WRITE_TOKEN_0123456789", {}),
    readonly: addToken("github_pat_READONLY_TOKEN_0123456789", {
      contents: "read",
      permissionsPush: true // user is the owner; token is not
    }),
    notSelected: addToken("github_pat_NOT_SELECTED_0123456789", {
      repoSelected: false,
      contents: null,
      actions: null
    }),
    classic: addToken("ghp_CLASSICTOKEN0123456789abcdef", {
      scopes: ["public_repo"]
    }),
    classicNoScope: addToken("ghp_CLASSICNOSCOPE0123456789abcdef", {
      scopes: [],
      contents: null,
      actions: null,
      repoSelected: false
    }),
    noActions: addToken("github_pat_NO_ACTIONS_0123456789", {actions: null})
  };

  // ---- http ----------------------------------------------------------------
  const readBody = req =>
    new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://mock");
    const path = decodeURIComponent(u.pathname);
    const rec = {
      method: req.method,
      path,
      query: Object.fromEntries(u.searchParams),
      headers: req.headers,
      status: 0
    };
    state.requests.push(rec);

    const baseHeaders = {
      "access-control-allow-origin": "*",
      "access-control-expose-headers": EXPOSE_HEADERS,
      "x-github-request-id": crypto
        .randomBytes(6)
        .toString("hex")
        .toUpperCase(),
      "x-github-api-version-selected": "2022-11-28"
    };
    const send = (status, body, extra = {}) => {
      rec.status = status;
      const headers = {...baseHeaders, ...extra};
      let payload = body;
      if (
        body !== undefined &&
        !Buffer.isBuffer(body) &&
        typeof body !== "string"
      ) {
        payload = JSON.stringify(body);
        headers["content-type"] ??= "application/json; charset=utf-8";
      }
      if (status !== 204 && status !== 304) {
        headers["cache-control"] ??= "private, max-age=60, s-maxage=60";
      }
      res.writeHead(status, headers);
      res.end(payload);
    };
    const json = (status, body, extra = {}) => {
      // ETag + conditional request for successful GETs
      if (req.method === "GET" && status === 200) {
        const text = JSON.stringify(body);
        const etag = `"${sha1(text)}"`;
        if (req.headers["if-none-match"] === etag) {
          state.notModified++;
          return send(304, undefined, {etag, ...rateHeaders(false)});
        }
        return send(200, text, {
          etag,
          "content-type": "application/json; charset=utf-8",
          ...rateHeaders(true),
          ...extra
        });
      }
      return send(status, body, {...rateHeaders(true), ...extra});
    };
    const err = (status, message, extra = {}) =>
      json(
        status,
        {
          message,
          documentation_url: "https://docs.github.com/rest",
          status: String(status)
        },
        extra
      );

    let consumed = 0;
    const rateHeaders = count => {
      if (count) {
        state.rate.remaining = Math.max(0, state.rate.remaining - 1);
        consumed++;
      }
      const h = {
        "x-ratelimit-limit": String(state.rate.limit),
        "x-ratelimit-remaining": String(state.rate.remaining),
        "x-ratelimit-used": String(state.rate.limit - state.rate.remaining),
        "x-ratelimit-resource": state.rate.resource,
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3000)
      };
      return h;
    };

    try {
      // ---- CORS preflight
      if (req.method === "OPTIONS") {
        return send(204, undefined, {
          "access-control-allow-headers": REAL_ALLOW_HEADERS.join(", "),
          "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE",
          "access-control-max-age": "86400"
        });
      }

      // ---- injected failures
      const idx = state.failNext.findIndex(
        f =>
          (!f.method || f.method === req.method) &&
          (!f.pathRe || f.pathRe.test(path))
      );
      if (idx >= 0) {
        const f = state.failNext[idx];
        if (--f.times <= 0) state.failNext.splice(idx, 1);
        return json(
          f.status,
          f.body ?? {message: f.message ?? "injected"},
          f.headers ?? {}
        );
      }
      if (state.forceRateLimit) {
        const kind = state.forceRateLimit;
        state.forceRateLimit = null;
        if (kind === "primary") {
          state.rate.remaining = 0;
          return json(
            403,
            {message: "API rate limit exceeded for user ID 1."},
            {
              ...rateHeaders(false),
              "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 600)
            }
          );
        }
        return json(
          403,
          {
            message:
              "You have exceeded a secondary rate limit. Please wait a few minutes before you try again."
          },
          {"retry-after": "30"}
        );
      }

      // ---- auth
      const authz = req.headers.authorization;
      let who = null;
      if (authz) {
        const tok = authz.replace(/^(Bearer|token)\s+/i, "");
        who = tokens.get(tok);
        if (!who) return err(401, "Bad credentials");
        if (who.scopes) baseHeaders["x-oauth-scopes"] = who.scopes.join(", ");
      }
      const base = `/repos/${owner}/${repo}`;
      const canRead = () =>
        !isPrivate || (who && who.repoSelected && who.contents);
      const canWrite = () =>
        who && who.repoSelected && who.contents === "write";

      if (path === "/user") {
        if (!who) return err(401, "Requires authentication");
        if (state.userEndpointForbidden) {
          return err(403, "Resource not accessible by personal access token");
        }
        return json(200, {login: who.login, id: 1, name: "Octo Owner"});
      }
      if (!path.startsWith(base)) {
        return err(404, "Not Found");
      }
      const rest = path.slice(base.length); // "" | "/git/..."
      const needRead = () => {
        if (!canRead()) {
          err(404, "Not Found");
          return false;
        }
        return true;
      };
      const needWrite = () => {
        if (!who) {
          err(401, "Requires authentication");
          return false;
        }
        if (!canWrite()) {
          if (isPrivate && !who.repoSelected) err(404, "Not Found");
          else if (who.scopes)
            err(404, "Not Found"); // classic w/o scope: GitHub answers 404
          else err(403, "Resource not accessible by personal access token");
          return false;
        }
        return true;
      };

      // ---- GET repo
      if (rest === "" && req.method === "GET") {
        if (!needRead()) return;
        const body = {
          id: 1,
          name: repo,
          full_name: fullName,
          private: isPrivate,
          default_branch: branch
        };
        if (who) {
          const push =
            who.permissionsPush ??
            (who.repoSelected && who.contents === "write");
          body.permissions = {
            admin: false,
            maintain: false,
            push,
            triage: true,
            pull: true
          };
        }
        return json(200, body);
      }

      // ---- branches
      let m = rest.match(/^\/branches\/(.+)$/);
      if (m && req.method === "GET") {
        if (!needRead()) return;
        const head = headOf(m[1]);
        if (!head) return err(404, "Branch not found");
        return json(200, {
          name: m[1],
          commit: {sha: head},
          protected: !!state.protection
        });
      }

      // ---- refs
      m = rest.match(/^\/git\/ref\/(heads\/.+)$/);
      if (m && req.method === "GET") {
        if (!needRead()) return;
        const sha = refs.get(m[1]);
        if (!sha) return err(404, "Not Found");
        return json(200, {ref: `refs/${m[1]}`, object: {sha, type: "commit"}});
      }
      m = rest.match(/^\/git\/refs\/(heads\/.+)$/);
      if (m && req.method === "PATCH") {
        if (!needWrite()) return;
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        // simulate somebody else pushing between our GET ref and this PATCH
        if (state.raceBeforePatch > 0) {
          state.raceBeforePatch--;
          seed(
            {[`external-${commitCounter + 1}.txt`]: "pushed by someone else\n"},
            {message: "external commit"}
          );
        }
        const cur = refs.get(m[1]);
        if (!cur) return err(422, "Reference does not exist");
        if (!commits.has(body.sha)) return err(422, "Object does not exist");
        if (state.protection) {
          return err(state.protection.status, state.protection.message);
        }
        if (!body.force && !isAncestor(cur, body.sha)) {
          return err(422, "Update is not a fast forward");
        }
        refs.set(m[1], body.sha);
        maybeCreateRuns(body.sha);
        return json(200, {
          ref: `refs/${m[1]}`,
          object: {sha: body.sha, type: "commit"}
        });
      }

      // ---- commits
      m = rest.match(/^\/git\/commits\/([0-9a-f]+)$/);
      if (m && req.method === "GET") {
        if (!needRead()) return;
        const c = commits.get(m[1]);
        if (!c) return err(404, "Not Found");
        return json(200, {
          sha: c.sha,
          html_url: `https://github.com/${fullName}/commit/${c.sha}`,
          message: c.message,
          tree: {sha: c.tree},
          parents: c.parents.map(sha => ({sha})),
          author: c.author,
          committer: c.committer
        });
      }
      if (rest === "/git/commits" && req.method === "POST") {
        if (!needWrite()) return;
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        if (!trees.has(body.tree)) return err(422, "Tree SHA does not exist");
        for (const p of body.parents ?? []) {
          if (!commits.has(p)) return err(422, "Parent SHA does not exist");
        }
        if (typeof body.message !== "string" || !body.message) {
          return err(
            422,
            "Invalid request.\n\nFor 'properties/message', nil is not a string."
          );
        }
        const id = putCommit(body);
        return json(201, {
          sha: id,
          html_url: `https://github.com/${fullName}/commit/${id}`,
          tree: {sha: body.tree},
          parents: (body.parents ?? []).map(sha => ({sha}))
        });
      }

      // ---- blobs
      if (rest === "/git/blobs" && req.method === "POST") {
        if (!needWrite()) return;
        state.blobPosts++;
        state.blobInFlight++;
        state.maxBlobConcurrency = Math.max(
          state.maxBlobConcurrency,
          state.blobInFlight
        );
        try {
          const raw = await readBody(req);
          if (state.blobDelayMs)
            await new Promise(r => setTimeout(r, state.blobDelayMs));
          const body = JSON.parse(raw.toString("utf8") || "{}");
          if (typeof body.content !== "string") {
            return err(
              422,
              "Invalid request.\n\nFor 'properties/content', nil is not a string."
            );
          }
          const enc = body.encoding ?? "utf-8";
          if (!["utf-8", "base64"].includes(enc))
            return err(422, "Invalid encoding");
          if (
            enc === "base64" &&
            !/^[A-Za-z0-9+/\s]*={0,2}$/.test(body.content)
          ) {
            return err(422, "Invalid base64 content");
          }
          const buf = Buffer.from(
            body.content,
            enc === "base64" ? "base64" : "utf8"
          );
          const id = putBlob(buf);
          return json(201, {sha: id, url: `${base}/git/blobs/${id}`});
        } finally {
          state.blobInFlight--;
        }
      }
      m = rest.match(/^\/git\/blobs\/([0-9a-f]+)$/);
      if (m && req.method === "GET") {
        if (!needRead()) return;
        const b = blobs.get(m[1]);
        if (!b) return err(404, "Not Found");
        return json(200, {
          sha: m[1],
          size: b.length,
          encoding: "base64",
          content: b.toString("base64")
        });
      }

      // ---- trees
      if (rest === "/git/trees" && req.method === "POST") {
        if (!needWrite()) return;
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        let entries;
        if (body.base_tree) {
          if (!trees.has(body.base_tree))
            return err(422, "base_tree does not exist");
          entries = new Map(trees.get(body.base_tree));
        } else entries = new Map();
        if (!Array.isArray(body.tree) || !body.tree.length) {
          return err(
            422,
            "Invalid request.\n\nFor 'properties/tree', nil is not an array."
          );
        }
        for (const e of body.tree) {
          if (
            typeof e.path !== "string" ||
            !e.path ||
            e.path.startsWith("/") ||
            /(^|\/)\.\.?(\/|$)/.test(e.path)
          ) {
            return err(422, `tree.path contains an invalid path: ${e.path}`);
          }
          if (e.sha === null) {
            if (!entries.has(e.path)) {
              state.missingDeletes = [...(state.missingDeletes ?? []), e.path];
              // GitHub's behaviour for this is undocumented; make it testable.
              if (state.strictDeletes) {
                return err(
                  422,
                  `tree.path ${e.path} does not exist in base_tree`
                );
              }
            }
            entries.delete(e.path);
            continue;
          }
          if (!blobs.has(e.sha))
            return err(422, `tree.sha ${e.sha} is not a valid blob`);
          if (!["100644", "100755"].includes(e.mode))
            return err(422, "tree.mode is invalid");
          entries.set(e.path, {mode: e.mode, sha: e.sha});
        }
        const id = putTree(entries);
        return json(201, {
          sha: id,
          tree: [...entries].map(([path, x]) => ({path, ...x, type: "blob"}))
        });
      }
      m = rest.match(/^\/git\/trees\/([0-9a-f]+)$/);
      if (m && req.method === "GET") {
        if (!needRead()) return;
        const t = trees.get(m[1]);
        if (!t) return err(404, "Not Found");
        const out = [];
        const seenDirs = new Set();
        for (const [p, e] of [...t].sort(([a], [b]) => (a < b ? -1 : 1))) {
          const parts = p.split("/");
          for (let i = 1; i < parts.length; i++) {
            const d = parts.slice(0, i).join("/");
            if (!seenDirs.has(d)) {
              seenDirs.add(d);
              out.push({
                path: d,
                mode: "040000",
                type: "tree",
                sha: sha1("dir:" + d)
              });
            }
          }
          out.push({
            path: p,
            mode: e.mode,
            type: "blob",
            sha: e.sha,
            size: blobs.get(e.sha).length
          });
        }
        return json(200, {sha: m[1], tree: out, truncated: false});
      }

      // ---- contents
      m = rest.match(/^\/contents(?:\/(.*))?$/);
      if (m && req.method === "GET") {
        if (!needRead()) return;
        const ref = u.searchParams.get("ref") || branch;
        const head = headOf(ref);
        if (!head) return err(404, "No commit found for the ref " + ref);
        const t = trees.get(treeOfCommit(head));
        const p = m[1] ?? "";
        const accept = req.headers.accept ?? "";
        if (t.has(p)) {
          const e = t.get(p);
          const buf = blobs.get(e.sha);
          if (/vnd\.github\.raw/.test(accept)) {
            return send(200, buf, {
              "content-type": "application/vnd.github.raw; charset=utf-8",
              ...rateHeaders(true)
            });
          }
          const big = buf.length > 1_000_000;
          return json(200, {
            type: "file",
            name: p.split("/").pop(),
            path: p,
            sha: e.sha,
            size: buf.length,
            encoding: big ? "none" : "base64",
            content: big
              ? ""
              : buf.toString("base64").replace(/(.{60})/g, "$1\n") + "\n",
            html_url: `https://github.com/${fullName}/blob/${ref}/${p}`,
            download_url: `https://raw.githubusercontent.com/${fullName}/${ref}/${p}`
          });
        }
        const prefix = p ? p + "/" : "";
        const kids = new Map();
        for (const [fp, e] of t) {
          if (!fp.startsWith(prefix)) continue;
          const tail = fp.slice(prefix.length);
          const [first, ...more] = tail.split("/");
          if (more.length) {
            if (!kids.has(first))
              kids.set(first, {
                type: "dir",
                name: first,
                path: prefix + first,
                sha: sha1("dir:" + prefix + first),
                size: 0
              });
          } else {
            kids.set(first, {
              type: "file",
              name: first,
              path: fp,
              sha: e.sha,
              size: blobs.get(e.sha).length,
              download_url: `https://raw.githubusercontent.com/${fullName}/${ref}/${fp}`,
              html_url: `https://github.com/${fullName}/blob/${ref}/${fp}`
            });
          }
        }
        if (!kids.size) return err(404, "Not Found");
        // real API: directory listings are capped at 1,000 entries
        return json(200, [...kids.values()].slice(0, 1000));
      }

      // ---- actions
      if (rest === "/actions/runs" && req.method === "GET") {
        if (!who && !state.actionsPublic)
          return err(401, "Requires authentication");
        if (who && !state.actionsPublic && who.actions !== "read") {
          return err(403, "Resource not accessible by personal access token");
        }
        if (who && who.actions == null && !state.actionsPublic) {
          return err(403, "Resource not accessible by personal access token");
        }
        if (state.hideRunsPolls > 0) {
          state.hideRunsPolls--;
          return json(200, {total_count: 0, workflow_runs: []});
        }
        const list = (runs.get(u.searchParams.get("head_sha")) ?? []).filter(
          r =>
            !u.searchParams.get("event") ||
            r.event === u.searchParams.get("event")
        );
        const out = list.map(r => {
          const step = r._script[Math.min(r._poll, r._script.length - 1)];
          r._poll++;
          const {_script, _poll, ...pub} = r;
          return {...pub, status: step[0], conclusion: step[1]};
        });
        return json(200, {total_count: out.length, workflow_runs: out});
      }

      return err(404, "Not Found");
    } catch (e) {
      rec.status = 500;
      if (!res.headersSent) {
        res.writeHead(500, {
          ...baseHeaders,
          "content-type": "application/json"
        });
      }
      res.end(JSON.stringify({message: "mock server error: " + e.message}));
    }
  });

  await new Promise(r => server.listen(port, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    owner,
    repo,
    branch,
    tokens: T,
    addToken,
    state,
    seed,
    headSha: (b = branch) => headOf(b),
    headFiles,
    chain,
    commit: sha => commits.get(sha),
    blobCount: () => blobs.size,
    readFile: (p, b = branch) => headFiles(b).get(p),
    requestsTo: (method, re) =>
      state.requests.filter(r => r.method === method && re.test(r.path)),
    close: () => new Promise(r => server.close(() => r()))
  };
}

// Standalone mode: node mock-github-server.js [port]
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const mock = await startMockGitHub({port: Number(process.argv[2]) || 8787});
  console.log(
    `mock GitHub on ${mock.url}  (repo ${mock.owner}/${mock.repo}, branch ${mock.branch})`
  );
  console.log(`write token : ${mock.tokens.write}`);
  console.log(`read-only   : ${mock.tokens.readonly}`);
}
