/**
 * Dependency-free GitHub client for the /admin/ blog editor.
 *
 * Pure ES module. Uses only globals that exist in every modern browser and in
 * Node >= 20: fetch, atob, btoa, TextEncoder, TextDecoder, URL, AbortSignal.
 * No Buffer, no process, no require, no imports.
 *
 * Everything goes through api.github.com's REST API (CORS is open for any
 * origin, including an Authorization header - verified with a preflight).
 *
 *   const gh = new GitHub({token, owner: "CorbinKim",
 *                          repo: "CorbinKim.github.io", branch: "main"});
 *   const who = await gh.verifyAccess();
 *   const {commitSha, htmlUrl} = await gh.commitFiles({
 *     message: "Publish: My post",
 *     writes: [
 *       {path: "src/blog/posts/my-post.mdx", text: "---\ntitle: 안녕 👋\n---\n"},
 *       {path: "public/img/blog/my-post/a.png", bytes: uint8array}
 *     ],
 *     deletes: ["src/blog/posts/old.mdx"]
 *   });
 *   const status = await gh.getDeployStatus(commitSha, {wait: true});
 *
 * Error contract: every failure is a GitHubError with
 *   .status      HTTP status (0 for client-side/network problems)
 *   .code        stable machine code (see ERROR_CODES)
 *   .message     sentence meant to be shown to the site owner
 *   .apiMessage  GitHub's own message, if any
 *   .rateLimit   {limit, remaining, used, resource, reset: Date, retryAfter}
 * The token is never part of an error, a log line, toJSON() or the object.
 */

export const DEFAULT_API_BASE = "https://api.github.com";
export const API_VERSION = "2022-11-28";

/** Per-file / per-commit guard rails (client side; GitHub's own limit for
 * POST /git/blobs is not documented, the docs only promise 100 MB for GET). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_COMMIT_BYTES = 50 * 1024 * 1024;

export const ERROR_CODES = [
  "BAD_ARGS", // programmer error / invalid input
  "BAD_PATH", // path rejected before talking to GitHub
  "BAD_TOKEN", // 401: token invalid, expired or revoked
  "BAD_TOKEN_FORMAT", // pasted token has whitespace / odd characters
  "NO_REPO_ACCESS", // 404 on the repo: wrong name or token not scoped to it
  "NO_PERMISSION", // 403 "Resource not accessible by personal access token"
  "NO_WRITE", // verifyAccess({requireWrite}) on a read-only token
  "NOT_FOUND", // 404 on a file / ref / run
  "RATE_LIMIT", // primary or secondary rate limit
  "SSO", // org requires SAML SSO authorization of the token
  "PROTECTED_BRANCH", // branch protection / rulesets rejected the push
  "CONFLICT", // non-fast-forward (after retries) or other 409
  "VALIDATION", // 422
  "SERVER", // 5xx
  "NETWORK", // fetch itself failed (offline, blocked, CORS)
  "TOO_LARGE", // client-side size guard
  "NOT_TEXT", // file is not valid UTF-8
  "IS_DIR", // asked for a file but got a directory
  "NOT_DIR", // asked for a directory but got a file
  "TRUNCATED", // GitHub truncated a huge tree
  "UNKNOWN"
];

export class GitHubError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = "GitHubError";
    this.status = info.status ?? 0;
    this.code = info.code ?? "UNKNOWN";
    this.apiMessage = info.apiMessage ?? null;
    this.documentationUrl = info.documentationUrl ?? null;
    this.rateLimit = info.rateLimit ?? null;
    this.requestId = info.requestId ?? null;
    this.method = info.method ?? null;
    this.path = info.path ?? null;
    this.needs = info.needs ?? null;
    if (info.cause) this.cause = info.cause;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      status: this.status,
      message: this.message,
      apiMessage: this.apiMessage,
      method: this.method,
      path: this.path,
      needs: this.needs,
      rateLimit: this.rateLimit,
      requestId: this.requestId
    };
  }
}

// ---------------------------------------------------------------------------
// bytes <-> base64 <-> text helpers (exported, usable from the editor UI)
// ---------------------------------------------------------------------------

const B64_CHUNK = 0x8000; // 32 KiB: far below the engine's argument limit

/** Chunked fallback: never passes more than 32 KiB to fromCharCode.apply, so
 * a 50 MB image cannot blow the call stack (the classic
 * btoa(String.fromCharCode(...bytes)) crashes at roughly 100-200 KB). */
export function bytesToBase64Chunked(bytes) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    parts.push(
      String.fromCharCode.apply(null, bytes.subarray(i, i + B64_CHUNK))
    );
  }
  return btoa(parts.join(""));
}

export function base64ToBytesChunked(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Uint8Array -> base64 string (native Uint8Array#toBase64 when available). */
export function bytesToBase64(bytes) {
  const u8 = toUint8Array(bytes);
  if (typeof u8.toBase64 === "function") return u8.toBase64();
  return bytesToBase64Chunked(u8);
}

/** base64 (whitespace/newlines tolerated, as the Contents API wraps lines) ->
 * Uint8Array. */
export function base64ToBytes(b64) {
  const clean = String(b64).replace(/\s+/g, "");
  if (typeof Uint8Array.fromBase64 === "function") {
    return Uint8Array.fromBase64(clean);
  }
  return base64ToBytesChunked(clean);
}

/** JS string -> UTF-8 bytes. Never use btoa(text): it throws on non-Latin1
 * (Korean, emoji). Lone surrogates become U+FFFD, as in any UTF-8 encoder. */
export function textToBytes(text) {
  return new TextEncoder().encode(String(text));
}

/** UTF-8 bytes -> string. Throws NOT_TEXT instead of silently corrupting a
 * binary file with U+FFFD. A leading BOM is dropped (TextDecoder default). */
export function bytesToText(bytes) {
  try {
    return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  } catch (e) {
    throw new GitHubError("That file is not valid UTF-8 text.", {
      code: "NOT_TEXT",
      cause: e
    });
  }
}

function toUint8Array(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) {
    return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  }
  throw new GitHubError("Expected a Uint8Array of file bytes.", {
    code: "BAD_ARGS"
  });
}

/** Throws GitHubError(BAD_PATH) unless `p` is a clean repo-relative path. */
export function validateRepoPath(p) {
  const bad = why =>
    new GitHubError(`Invalid repository path "${p}": ${why}.`, {
      code: "BAD_PATH"
    });
  if (typeof p !== "string" || p === "")
    throw bad("must be a non-empty string");
  if (p.length > 4096) throw bad("too long");
  if (p.startsWith("/") || p.endsWith("/")) throw bad("no leading/trailing /");
  if (p.includes("\\")) throw bad("use / not \\");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(p)) throw bad("control characters");
  for (const seg of p.split("/")) {
    if (seg === "" || seg === "." || seg === "..")
      throw bad("empty or . / .. segment");
    if (seg.toLowerCase() === ".git") throw bad(".git is reserved");
  }
  return p;
}

const encodePath = p => p.split("/").map(encodeURIComponent).join("/");

// ---------------------------------------------------------------------------
// rate limit / error helpers
// ---------------------------------------------------------------------------

function num(h, name) {
  const v = h.get(name);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function readRateLimit(headers) {
  const limit = num(headers, "x-ratelimit-limit");
  const remaining = num(headers, "x-ratelimit-remaining");
  const used = num(headers, "x-ratelimit-used");
  const reset = num(headers, "x-ratelimit-reset");
  const retryAfter = num(headers, "retry-after");
  if (limit == null && remaining == null && retryAfter == null) return null;
  return {
    limit,
    remaining,
    used,
    resource: headers.get("x-ratelimit-resource"),
    reset: reset == null ? null : new Date(reset * 1000),
    retryAfter
  };
}

const PROTECTED_RE =
  /protected branch|required status check|changes must be made through a pull request|review.*required|required.*review|signed commits|repository rule|GH006|GH013|cannot update this protected ref/i;

function tokenKindOf(token) {
  if (!token) return "none";
  if (token.startsWith("github_pat_")) return "fine-grained";
  if (token.startsWith("ghp_")) return "classic";
  return "unknown";
}

function permissionHint(kind, needs) {
  const [perm, level] = String(needs || "Contents: write").split(": ");
  const lvl = level === "write" ? "Read and write" : "Read-only";
  if (kind === "classic") {
    return level === "write"
      ? " A classic token needs the `public_repo` scope (or `repo` for a private repository)."
      : " A classic token needs no scope to read a public repository.";
  }
  return ` Edit the token at github.com/settings/personal-access-tokens: choose this repository under Repository access and set Repository permissions > ${perm} to "${lvl}".`;
}

function sleepDefault(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const t = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError(signal));
    };
    signal?.addEventListener?.("abort", onAbort, {once: true});
  });
}

function abortError(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException("Aborted", "AbortError");
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let failed = null;
  const worker = async () => {
    while (failed === null) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        failed = e;
        return;
      }
    }
  };
  await Promise.all(
    Array.from({length: Math.min(limit, items.length)}, worker)
  );
  if (failed !== null) throw failed;
  return results;
}

/**
 * Link that opens GitHub's "new fine-grained token" form with the minimum
 * permissions pre-filled (documented URL parameters; the repository itself
 * cannot be pre-selected, so the owner still has to pick "Only select
 * repositories" > this repo). Metadata: read is added automatically by GitHub.
 * Name is limited to 40 characters, description to 1024.
 */
export function tokenCreationUrl({
  owner,
  repo,
  days = 90,
  actionsRead = false
} = {}) {
  const q = new URLSearchParams({
    name: `Blog admin - ${repo}`.slice(0, 40),
    description:
      `Publishes blog posts to ${owner}/${repo} from /admin/. ` +
      "Select ONLY that repository below.",
    target_name: owner,
    expires_in: String(days),
    contents: "write"
  });
  if (actionsRead) q.set("actions", "read");
  return `https://github.com/settings/personal-access-tokens/new?${q}`;
}

/** Map one workflow run to the small state vocabulary the UI uses. */
export function mapRunState(run) {
  if (!run) return "unknown";
  const {status, conclusion} = run;
  if (status === "completed") {
    if (conclusion === "success") return "success";
    if (conclusion === "cancelled") return "cancelled"; // superseded by a newer push (concurrency group)
    if (conclusion === "skipped" || conclusion === "neutral") return "unknown";
    return "failure"; // failure, timed_out, startup_failure, action_required, stale
  }
  if (status === "in_progress") return "in_progress";
  if (["queued", "requested", "waiting", "pending"].includes(status)) {
    return "queued";
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// client
// ---------------------------------------------------------------------------

export class GitHub {
  #token;
  #fetch;
  #sleep;
  #now;
  #etags = new Map();

  /**
   * @param {object} o
   * @param {string} [o.token]  fine-grained PAT (github_pat_...) or classic
   * @param {string} o.owner
   * @param {string} o.repo
   * @param {string} [o.branch="main"]
   * @param {string} [o.apiBase="https://api.github.com"]
   * @param {typeof fetch} [o.fetch]  injectable for tests
   * @param {boolean} [o.etagCache=true]  If-None-Match for repeated GETs
   * @param {Function} [o.sleep]  (ms, signal) => Promise, injectable
   */
  constructor({
    token = "",
    owner,
    repo,
    branch = "main",
    apiBase = DEFAULT_API_BASE,
    fetch: fetchImpl,
    etagCache = true,
    sleep,
    now
  } = {}) {
    const ident = /^[A-Za-z0-9_.-]+$/;
    if (!owner || !ident.test(owner) || !repo || !ident.test(repo)) {
      throw new GitHubError("owner and repo are required.", {code: "BAD_ARGS"});
    }
    if (!branch || /\s|\.\.|^\/|\/$/.test(branch)) {
      throw new GitHubError("Invalid branch name.", {code: "BAD_ARGS"});
    }
    const t = String(token || "").trim();
    // A pasted token with a newline/space/non-ASCII char makes fetch throw a
    // confusing "invalid header value" TypeError - catch it here, without
    // echoing the token.
    // eslint-disable-next-line no-control-regex
    if (t && !/^[\x21-\x7e]+$/.test(t)) {
      throw new GitHubError(
        "The token contains spaces or unusual characters. Paste it again without extra whitespace.",
        {code: "BAD_TOKEN_FORMAT"}
      );
    }
    this.#token = t;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.apiBase = String(apiBase).replace(/\/+$/, "");
    this.#fetch = fetchImpl ?? ((...a) => globalThis.fetch(...a));
    this.#sleep = sleep ?? sleepDefault;
    this.#now = now ?? (() => Date.now());
    this.useEtagCache = etagCache;
    /** Rate-limit headers of the most recent response (or null). */
    this.lastRateLimit = null;
  }

  get fullName() {
    return `${this.owner}/${this.repo}`;
  }
  get hasToken() {
    return this.#token !== "";
  }
  /** "fine-grained" | "classic" | "unknown" | "none" - from the token prefix. */
  get tokenKind() {
    return tokenKindOf(this.#token);
  }
  /** Never serialises the token. */
  toJSON() {
    return {
      owner: this.owner,
      repo: this.repo,
      branch: this.branch,
      apiBase: this.apiBase,
      tokenKind: this.tokenKind,
      token: this.hasToken ? "[redacted]" : null
    };
  }

  get #repoPath() {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(
      this.repo
    )}`;
  }
  get #refPath() {
    return `heads/${encodePath(this.branch)}`;
  }

  // ----- transport --------------------------------------------------------

  async #request(method, path, opts = {}) {
    const {
      query,
      body,
      accept = "application/vnd.github+json",
      as = "json",
      ctx = {},
      signal
    } = opts;
    const url = new URL(this.apiBase + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v != null) url.searchParams.set(k, String(v));
      }
    }
    // Only headers on GitHub's CORS allow-list (Authorization, Content-Type,
    // If-None-Match, X-GitHub-Api-Version, Accept are all on it).
    const headers = {Accept: accept, "X-GitHub-Api-Version": API_VERSION};
    if (this.#token) headers.Authorization = `Bearer ${this.#token}`;
    const init = {method, headers, credentials: "omit", signal};
    const cacheKey = `${accept}|${url}`;
    const useEtag = method === "GET" && as === "json" && this.useEtagCache;
    if (method === "GET") {
      init.cache = "no-cache";
      if (useEtag && this.#etags.has(cacheKey)) {
        headers["If-None-Match"] = this.#etags.get(cacheKey).etag;
      }
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const maxAttempts = method === "GET" ? 3 : 1;
    for (let attempt = 1; ; attempt++) {
      let res;
      try {
        res = await this.#fetch(url.toString(), init);
      } catch (e) {
        if (e?.name === "AbortError") throw e;
        throw new GitHubError(
          "Could not reach GitHub (offline, blocked by an extension, or GitHub is down).",
          {code: "NETWORK", method, path, cause: e}
        );
      }
      this.lastRateLimit = readRateLimit(res.headers) ?? this.lastRateLimit;

      if (res.status === 304 && useEtag && this.#etags.has(cacheKey)) {
        return {
          status: 200,
          headers: res.headers,
          data: this.#etags.get(cacheKey).data,
          notModified: true
        };
      }
      if (res.ok) {
        let data = null;
        if (res.status !== 204) {
          if (as === "bytes") data = new Uint8Array(await res.arrayBuffer());
          else if (as === "text") data = await res.text();
          else {
            const text = await res.text();
            data = text ? JSON.parse(text) : null;
          }
        }
        const etag = res.headers.get("etag");
        if (useEtag && etag) {
          if (this.#etags.size > 200) {
            this.#etags.delete(this.#etags.keys().next().value);
          }
          this.#etags.set(cacheKey, {etag, data});
        }
        return {status: res.status, headers: res.headers, data};
      }
      if ([502, 503, 504].includes(res.status) && attempt < maxAttempts) {
        await this.#sleep(400 * attempt, signal);
        continue;
      }
      throw await this.#errorFrom(res, method, path, ctx);
    }
  }

  async #errorFrom(res, method, path, ctx) {
    let payload = null;
    let text = "";
    try {
      text = await res.text();
      payload = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    let apiMessage =
      payload?.message ?? (text && text.length < 300 ? text : "");
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      const extra = payload.errors
        .map(e => (typeof e === "string" ? e : e.message || e.code))
        .filter(Boolean)
        .join("; ");
      if (extra) apiMessage = `${apiMessage} (${extra})`;
    }
    const status = res.status;
    const rl = readRateLimit(res.headers);
    const full = this.fullName;
    const needs = ctx.needs ?? null;
    const info = {
      status,
      apiMessage: apiMessage || null,
      documentationUrl: payload?.documentation_url ?? null,
      rateLimit: rl,
      requestId: res.headers.get("x-github-request-id"),
      method,
      path,
      needs
    };
    const mk = (code, message) => new GitHubError(message, {...info, code});
    const kind = this.tokenKind;

    if (status === 401) {
      return this.hasToken
        ? mk(
            "BAD_TOKEN",
            "GitHub rejected the token (wrong, expired or revoked). Create a new fine-grained token for " +
              full +
              " and paste it again."
          )
        : mk("BAD_TOKEN", "A GitHub token is required for this action.");
    }

    const isRate =
      status === 429 ||
      (status === 403 &&
        (rl?.remaining === 0 ||
          rl?.retryAfter != null ||
          /rate limit|abuse detection|secondary/i.test(apiMessage)));
    if (isRate) {
      let when = "in a minute or so";
      if (rl?.retryAfter != null) when = `in ${rl.retryAfter} s`;
      else if (rl?.reset) {
        const mins = Math.max(
          1,
          Math.ceil((rl.reset.getTime() - this.#now()) / 60000)
        );
        when = `in about ${mins} min`;
      }
      return mk("RATE_LIMIT", `GitHub rate limit reached. Try again ${when}.`);
    }
    if (status === 403 && res.headers.get("x-github-sso")) {
      return mk(
        "SSO",
        "This token must be authorized for the organization's SAML single sign-on before it can be used."
      );
    }
    if (
      status === 403 &&
      /Resource not accessible by (personal access token|integration)/i.test(
        apiMessage
      )
    ) {
      return mk(
        "NO_PERMISSION",
        `Token lacks ${needs || "the required permission"} on ${full}.` +
          permissionHint(kind, needs)
      );
    }
    if (PROTECTED_RE.test(apiMessage) && method !== "GET") {
      return mk(
        "PROTECTED_BRANCH",
        `Branch "${this.branch}" is protected and rejected the push: ${apiMessage} ` +
          "Let the token's owner push directly (or bypass the rule), or relax the branch protection."
      );
    }
    if (status === 403) {
      return mk(
        "NO_PERMISSION",
        `GitHub refused the request: ${apiMessage || "Forbidden"}.` +
          (needs ? permissionHint(kind, needs) : "")
      );
    }
    if (status === 404) {
      const code = ctx.notFoundCode ?? "NOT_FOUND";
      const msg =
        code === "NO_REPO_ACCESS"
          ? `The token cannot see ${full}. Check the owner/repo name and, for a fine-grained token, select this repository under Repository access.`
          : ctx.write && this.hasToken
          ? `GitHub answered "Not Found" while writing to ${full}: the branch or repository does not exist, or the token cannot write to it.` +
            permissionHint(kind, "Contents: write")
          : ctx.notFoundMessage || `Not found: ${ctx.what || path}.`;
      return mk(code, msg);
    }
    if (status === 409) {
      return mk(
        "CONFLICT",
        `GitHub reported a conflict: ${apiMessage || "Conflict"}.`
      );
    }
    if (status === 422) {
      if (/fast.?forward/i.test(apiMessage)) {
        return mk(
          "CONFLICT",
          "The branch moved while publishing (not a fast-forward)."
        );
      }
      return mk(
        "VALIDATION",
        `GitHub rejected the request: ${apiMessage || "Validation failed"}.`
      );
    }
    if (status >= 500) {
      return mk(
        "SERVER",
        `GitHub is having trouble (HTTP ${status}). Try again in a moment.`
      );
    }
    return mk(
      "UNKNOWN",
      `Unexpected GitHub response (HTTP ${status}): ${
        apiMessage || res.statusText
      }`
    );
  }

  // ----- verifyAccess -----------------------------------------------------

  /**
   * Checks token + repo + write access with at most 4 requests.
   *
   * Throws GitHubError BAD_TOKEN (401), NO_REPO_ACCESS (404) or RATE_LIMIT.
   * Resolves (does not throw) for read-only tokens: canPush === false and
   * `message` explains why. Pass {requireWrite: true} to throw NO_WRITE.
   *
   * canPush is decided by the repo's `permissions` object AND, when a token is
   * present, a harmless write probe (POST /git/blobs with the content "\n": it
   * creates at most one unreachable object that GitHub garbage-collects). The probe exists because the
   * `permissions` object describes the *user*, not necessarily the token's
   * scope - and because every token can read a public repo, so "valid token"
   * does not imply "can push". Set {probeWrite: false} to skip it.
   *
   * Without a token (anonymous) only read endpoints are called and
   * canPush is false.
   */
  async verifyAccess({probeWrite = true, requireWrite = false} = {}) {
    const full = this.fullName;
    const {data: repo, headers: repoHeaders} = await this.#request(
      "GET",
      this.#repoPath,
      {ctx: {needs: "Metadata: read", notFoundCode: "NO_REPO_ACCESS"}}
    );
    // X-OAuth-Scopes is only sent for classic tokens (it is on the CORS
    // expose list, so browsers can read it).
    const scopesHeader = repoHeaders.get("x-oauth-scopes");
    const scopes =
      scopesHeader == null
        ? null
        : scopesHeader
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

    let login = null;
    if (this.hasToken) {
      try {
        const {data: user} = await this.#request("GET", "/user", {
          ctx: {needs: "Metadata: read"}
        });
        login = user?.login ?? null;
      } catch (e) {
        // GET /user is not on GitHub's documented fine-grained list; a 403/404
        // here must not fail the whole check. Only a dead token is fatal.
        if (e.code === "BAD_TOKEN") throw e;
      }
    }

    const p = repo.permissions;
    const hint = !!(p && (p.push || p.admin || p.maintain));
    let canPush = hint;
    let canPushVerified = false;
    let writeProblem = null;
    if (this.hasToken && probeWrite && (hint || p === undefined)) {
      try {
        await this.#request("POST", `${this.#repoPath}/git/blobs`, {
          body: {content: "\n", encoding: "utf-8"},
          ctx: {needs: "Contents: write", write: true}
        });
        canPush = true;
        canPushVerified = true;
      } catch (e) {
        if (["NO_PERMISSION", "NOT_FOUND", "NO_REPO_ACCESS"].includes(e.code)) {
          canPush = false;
          canPushVerified = true;
          writeProblem = e;
        } else if (["VALIDATION", "CONFLICT", "UNKNOWN"].includes(e.code)) {
          // Inconclusive (e.g. an empty repository): keep the permissions hint.
        } else {
          throw e; // BAD_TOKEN, RATE_LIMIT, SSO, NETWORK, SERVER, ...
        }
      }
    }

    let branchInfo = null;
    try {
      const {data} = await this.#request(
        "GET",
        `${this.#repoPath}/branches/${encodePath(this.branch)}`,
        {ctx: {needs: "Contents: read", what: `branch ${this.branch}`}}
      );
      branchInfo = data;
    } catch (e) {
      if (e.code !== "NOT_FOUND") throw e;
    }

    const warnings = [];
    if (!branchInfo) {
      warnings.push(`Branch "${this.branch}" does not exist on ${full}.`);
    } else if (branchInfo.protected) {
      warnings.push(
        `Branch "${this.branch}" is protected; direct commits may be rejected unless the token's owner may bypass the rule.`
      );
    }

    let message = null;
    let status = "ok";
    if (!this.hasToken) {
      status = "anonymous";
      message = `No token: read-only access to ${full}. Paste a fine-grained token with Contents: Read and write to publish.`;
    } else if (!canPush) {
      status = "read-only";
      message =
        writeProblem?.code === "NO_PERMISSION" && writeProblem.message
          ? writeProblem.message
          : `Token lacks Contents: write on ${full}.` +
            permissionHint(this.tokenKind, "Contents: write");
    }

    const result = {
      status,
      authenticated: this.hasToken,
      login,
      repoFullName: repo.full_name ?? full,
      defaultBranch: repo.default_branch ?? null,
      private: !!repo.private,
      branch: this.branch,
      branchExists: !!branchInfo,
      branchProtected: !!branchInfo?.protected,
      headSha: branchInfo?.commit?.sha ?? null,
      canPush,
      canPushVerified,
      tokenKind: this.tokenKind,
      scopes,
      message,
      warnings,
      rateLimit: this.lastRateLimit
    };
    if (requireWrite && !canPush) {
      throw new GitHubError(message, {
        status: 403,
        code: "NO_WRITE",
        needs: "Contents: write",
        apiMessage: writeProblem?.apiMessage ?? null
      });
    }
    return result;
  }

  // ----- reading ----------------------------------------------------------

  /**
   * Lists a directory (default: repo root) on the configured branch.
   * @returns {Promise<Array<{name,path,type,sha,size,downloadUrl,htmlUrl}>>}
   *   type is "file" | "dir" | "symlink" | "submodule".
   * Needs Contents: read. The Contents API caps a directory at 1,000 entries;
   * if that many come back we re-list from the Git Trees API (no cap, up to
   * 100,000 entries in the repo).
   */
  async listDir(path = "", {missingOk = false} = {}) {
    if (path) validateRepoPath(path);
    const apiPath = `${this.#repoPath}/contents${
      path ? "/" + encodePath(path) : ""
    }`;
    let data;
    try {
      ({data} = await this.#request("GET", apiPath, {
        query: {ref: this.branch},
        ctx: {needs: "Contents: read", what: path || "/"}
      }));
    } catch (e) {
      if (missingOk && e.code === "NOT_FOUND") return [];
      throw e;
    }
    if (!Array.isArray(data)) {
      throw new GitHubError(`"${path}" is a file, not a directory.`, {
        code: "NOT_DIR",
        path
      });
    }
    if (data.length >= 1000) return this.#listDirViaTrees(path);
    return data.map(e => ({
      name: e.name,
      path: e.path,
      type: e.type,
      sha: e.sha,
      size: e.size,
      downloadUrl: e.download_url ?? null,
      htmlUrl: e.html_url ?? null
    }));
  }

  async #headTree() {
    const headSha = await this.#getHeadSha();
    const commit = await this.#getCommit(headSha);
    return {headSha, treeSha: commit.tree.sha};
  }

  async #recursiveTree(treeSha) {
    const {data} = await this.#request(
      "GET",
      `${this.#repoPath}/git/trees/${treeSha}`,
      {query: {recursive: "1"}, ctx: {needs: "Contents: read"}}
    );
    if (data.truncated) {
      throw new GitHubError("The repository tree is too large to list.", {
        code: "TRUNCATED"
      });
    }
    return data.tree;
  }

  async #listDirViaTrees(path) {
    const {treeSha} = await this.#headTree();
    const prefix = path ? path + "/" : "";
    return (await this.#recursiveTree(treeSha))
      .filter(
        e =>
          e.path.startsWith(prefix) &&
          !e.path.slice(prefix.length).includes("/")
      )
      .map(e => ({
        name: e.path.slice(prefix.length),
        path: e.path,
        type:
          e.type === "tree"
            ? "dir"
            : e.type === "commit"
            ? "submodule"
            : "file",
        sha: e.sha,
        size: e.size ?? 0,
        downloadUrl: null,
        htmlUrl: null
      }));
  }

  /**
   * Every blob under `prefix` (recursive), from one Git Trees call.
   * Use it to find a post's images before deleting the post.
   * @returns {Promise<Array<{path, sha, size}>>}
   */
  async listTree(prefix = "") {
    if (prefix) validateRepoPath(prefix);
    const {treeSha} = await this.#headTree();
    const p = prefix ? prefix + "/" : "";
    return (await this.#recursiveTree(treeSha))
      .filter(e => e.type === "blob" && e.path.startsWith(p))
      .map(e => ({path: e.path, sha: e.sha, size: e.size ?? 0}));
  }

  /**
   * Reads a file as bytes. Uses the Contents API (base64 JSON, <= 1 MB); for
   * bigger files (encoding "none") re-requests with the raw media type, which
   * GitHub supports up to 100 MB.
   */
  async readBytes(path) {
    validateRepoPath(path);
    const apiPath = `${this.#repoPath}/contents/${encodePath(path)}`;
    const ctx = {
      needs: "Contents: read",
      what: path,
      notFoundMessage: `File not found: ${path}.`
    };
    const {data} = await this.#request("GET", apiPath, {
      query: {ref: this.branch},
      ctx
    });
    if (Array.isArray(data)) {
      throw new GitHubError(`"${path}" is a directory, not a file.`, {
        code: "IS_DIR",
        path
      });
    }
    if (data.type !== "file") {
      throw new GitHubError(
        `"${path}" is a ${data.type}, not a regular file.`,
        {
          code: "IS_DIR",
          path
        }
      );
    }
    let bytes;
    if (data.encoding === "base64" && (data.content || data.size === 0)) {
      bytes = base64ToBytes(data.content);
    } else {
      ({data: bytes} = await this.#request("GET", apiPath, {
        query: {ref: this.branch},
        accept: "application/vnd.github.raw+json",
        as: "bytes",
        ctx
      }));
    }
    return {bytes, sha: data.sha, size: data.size};
  }

  /** @returns {Promise<{text: string, sha: string}>} sha = blob sha, handy for
   * detecting concurrent edits. Korean/emoji safe (UTF-8 via TextDecoder). */
  async readText(path) {
    const {bytes, sha} = await this.readBytes(path);
    return {text: bytesToText(bytes), sha};
  }

  async #getHeadSha() {
    const {data} = await this.#request(
      "GET",
      `${this.#repoPath}/git/ref/${this.#refPath}`,
      {
        ctx: {
          needs: "Contents: read",
          notFoundMessage: `Branch "${this.branch}" does not exist on ${this.fullName}.`
        }
      }
    );
    return data.object.sha;
  }

  async #getCommit(sha) {
    const {data} = await this.#request(
      "GET",
      `${this.#repoPath}/git/commits/${encodeURIComponent(sha)}`,
      {ctx: {needs: "Contents: read"}}
    );
    return data;
  }

  // ----- writing ----------------------------------------------------------

  /**
   * Creates ONE commit on the configured branch containing every write and
   * delete (Git Data API):
   *   GET ref -> GET commit -> POST blob x N -> POST tree(base_tree) ->
   *   POST commit -> PATCH ref (force:false)
   * Text is UTF-8 encoded locally and uploaded as base64 so bytes are exact;
   * binary files are uploaded as base64 blobs, at most 4 in parallel.
   * Deletes use `sha: null` tree entries. If the PATCH fails because someone
   * else pushed in the meantime (422/409 and the branch head changed) the new
   * head is fetched, the tree and commit are rebuilt on top of it, and the PATCH
   * retried (blobs are reused) up to `maxRetries` times.
   * If the resulting tree equals the current one nothing is committed and the
   * result has noChanges: true.
   *
   * Needs Contents: write (+ Contents: read).
   *
   * @param {object} o
   * @param {string} o.message  commit message
   * @param {Array<{path:string,text?:string,bytes?:Uint8Array}>} [o.writes]
   * @param {string[]} [o.deletes]  file paths (not directories)
   * @param {{name:string,email:string}} [o.author]  default: the token's user
   * @param {{name:string,email:string}} [o.committer]
   * @param {number} [o.maxRetries=3]
   * @param {AbortSignal} [o.signal]
   * @returns {Promise<{commitSha, htmlUrl, parentSha, treeSha, retries,
   *   noChanges, written: string[], deleted: string[]}>}
   */
  async commitFiles({
    message,
    writes = [],
    deletes = [],
    author,
    committer,
    maxRetries = 3,
    signal
  } = {}) {
    if (typeof message !== "string" || !message.trim()) {
      throw new GitHubError("A commit message is required.", {
        code: "BAD_ARGS"
      });
    }
    if (!writes.length && !deletes.length) {
      throw new GitHubError("Nothing to commit.", {code: "BAD_ARGS"});
    }

    // -- validate & encode locally, before any network traffic
    const seen = new Set();
    const items = [];
    let total = 0;
    for (const w of writes) {
      validateRepoPath(w?.path);
      if (seen.has(w.path)) {
        throw new GitHubError(`Path listed twice: ${w.path}`, {
          code: "BAD_PATH"
        });
      }
      seen.add(w.path);
      let bytes;
      if (w.bytes != null) bytes = toUint8Array(w.bytes);
      else if (typeof w.text === "string") bytes = textToBytes(w.text);
      else {
        throw new GitHubError(`Write for ${w.path} needs text or bytes.`, {
          code: "BAD_ARGS"
        });
      }
      if (bytes.length > MAX_FILE_BYTES) {
        throw new GitHubError(
          `${w.path} is ${(bytes.length / 1048576).toFixed(
            1
          )} MB; the limit is ${
            MAX_FILE_BYTES / 1048576
          } MB per file. Resize or compress the image first.`,
          {code: "TOO_LARGE", path: w.path}
        );
      }
      total += bytes.length;
      items.push({path: w.path, bytes});
    }
    if (total > MAX_COMMIT_BYTES) {
      throw new GitHubError(
        `This commit is ${(total / 1048576).toFixed(1)} MB; the limit is ${
          MAX_COMMIT_BYTES / 1048576
        } MB. Split it into several commits.`,
        {code: "TOO_LARGE"}
      );
    }
    const delPaths = [];
    for (const d of deletes) {
      validateRepoPath(d);
      if (seen.has(d)) {
        throw new GitHubError(`Path both written and deleted: ${d}`, {
          code: "BAD_PATH"
        });
      }
      seen.add(d);
      delPaths.push(d);
    }

    const write = {needs: "Contents: write", write: true};
    const repoPath = this.#repoPath;

    // -- 1. ref -> 2. commit (fail fast on a bad token before uploading MBs)
    let headSha = await this.#getHeadSha();
    let baseTree = (await this.#getCommit(headSha)).tree.sha;

    // -- 3. blobs (content-addressed, so reusable across retries)
    const blobShas = await mapLimit(items, 4, async it => {
      const {data} = await this.#request("POST", `${repoPath}/git/blobs`, {
        body: {content: bytesToBase64(it.bytes), encoding: "base64"},
        ctx: write,
        signal
      });
      return data.sha;
    });
    let entries = [
      ...items.map((it, i) => ({
        path: it.path,
        mode: "100644",
        type: "blob",
        sha: blobShas[i]
      })),
      ...delPaths.map(p => ({path: p, mode: "100644", type: "blob", sha: null}))
    ];

    let skippedDeletes = [];
    for (let attempt = 0; ; attempt++) {
      // -- 4. tree on top of the current head
      let tree;
      try {
        ({data: tree} = await this.#request("POST", `${repoPath}/git/trees`, {
          body: {base_tree: baseTree, tree: entries},
          ctx: write,
          signal
        }));
      } catch (e) {
        // Deleting a path that is not in base_tree may be rejected (422).
        // Drop deletes that do not exist and retry once; anything else is real.
        const stillDeleting = entries.some(en => en.sha === null);
        if (!(e.code === "VALIDATION" && stillDeleting)) throw e;
        const existing = new Set(
          (await this.#recursiveTree(baseTree)).map(en => en.path)
        );
        const missing = entries.filter(
          en => en.sha === null && !existing.has(en.path)
        );
        if (!missing.length) throw e;
        skippedDeletes = [...skippedDeletes, ...missing.map(m => m.path)];
        entries = entries.filter(en => !missing.includes(en));
        if (!entries.length) throw e;
        attempt--; // not a race retry
        continue;
      }
      const result = {
        parentSha: headSha,
        treeSha: tree.sha,
        retries: attempt,
        written: items.map(i => i.path),
        deleted: delPaths.filter(d => !skippedDeletes.includes(d)),
        skippedDeletes
      };
      if (tree.sha === baseTree) {
        return {
          ...result,
          commitSha: headSha,
          htmlUrl: `https://github.com/${this.fullName}/commit/${headSha}`,
          noChanges: true
        };
      }
      // -- 5. commit
      const commitBody = {message, tree: tree.sha, parents: [headSha]};
      if (author) commitBody.author = author;
      if (committer) commitBody.committer = committer;
      const {data: commit} = await this.#request(
        "POST",
        `${repoPath}/git/commits`,
        {
          body: commitBody,
          ctx: write,
          signal
        }
      );
      // -- 6. move the branch (never force)
      try {
        await this.#request("PATCH", `${repoPath}/git/refs/${this.#refPath}`, {
          body: {sha: commit.sha, force: false},
          ctx: write,
          signal
        });
        return {
          ...result,
          commitSha: commit.sha,
          htmlUrl:
            commit.html_url ||
            `https://github.com/${this.fullName}/commit/${commit.sha}`,
          noChanges: false
        };
      } catch (e) {
        const raceLike =
          e instanceof GitHubError &&
          (e.status === 422 || e.status === 409) &&
          e.code !== "PROTECTED_BRANCH";
        if (!raceLike) throw e;
        const latest = await this.#getHeadSha();
        if (latest === headSha) throw e; // head did not move: a real rejection
        if (attempt >= maxRetries) {
          throw new GitHubError(
            "The branch kept changing while publishing. Wait a moment and press Publish again.",
            {
              code: "CONFLICT",
              status: 409,
              apiMessage: e.apiMessage,
              method: "PATCH"
            }
          );
        }
        headSha = latest;
        baseTree = (await this.#getCommit(headSha)).tree.sha;
        await this.#sleep(150 * (attempt + 1), signal);
      }
    }
  }

  // ----- deploy status ----------------------------------------------------

  /**
   * Looks up the Pages deploy workflow run for a commit.
   * GET /repos/{o}/{r}/actions/runs?head_sha=...&event=push (Actions: read;
   * anonymous works on a public repo).
   *
   * One head commit usually has several runs (Check Format, CodeQL, Deploy), so
   * runs are filtered to `workflowPath` (default the deploy workflow).
   *
   * @returns {Promise<{state:'queued'|'in_progress'|'success'|'failure'|'cancelled'|'unknown',
   *   url:string, runId?:number, status?:string, conclusion?:string|null,
   *   reason?:string, timedOut?:boolean}>}
   *  'cancelled' = superseded by a newer push (the workflow has
   *  cancel-in-progress); treat it as "a newer deploy is on its way".
   *  'unknown' + reason: 'no-run-yet' | 'no-permission'.
   *
   * With {wait: true} it polls every `intervalMs` until the run is finished,
   * `timeoutMs` elapses, or `signal` aborts; `onUpdate(status)` fires on each
   * change. If no run shows up within `appearTimeoutMs` it gives up with
   * 'unknown'/'no-run-yet'.
   */
  async getDeployStatus(
    commitSha,
    {
      workflowPath = ".github/workflows/deploy.yml",
      event = "push",
      wait = false,
      intervalMs = 4000,
      timeoutMs = 10 * 60 * 1000,
      appearTimeoutMs = 60 * 1000,
      onUpdate,
      signal
    } = {}
  ) {
    if (!/^[0-9a-f]{7,40}$/i.test(String(commitSha))) {
      throw new GitHubError("A commit SHA is required.", {code: "BAD_ARGS"});
    }
    const actionsUrl = `https://github.com/${this.fullName}/actions`;
    const once = async () => {
      let data;
      try {
        ({data} = await this.#request("GET", `${this.#repoPath}/actions/runs`, {
          query: {head_sha: commitSha, event, per_page: 30},
          ctx: {needs: "Actions: read"},
          signal
        }));
      } catch (e) {
        if (e.code === "NO_PERMISSION" || e.code === "NOT_FOUND") {
          return {
            state: "unknown",
            url: actionsUrl,
            reason: "no-permission",
            error: e
          };
        }
        throw e;
      }
      const runs = (data?.workflow_runs ?? []).filter(
        r => !workflowPath || String(r.path || "").startsWith(workflowPath)
      );
      if (!runs.length)
        return {state: "unknown", url: actionsUrl, reason: "no-run-yet"};
      runs.sort(
        (a, b) =>
          (b.run_attempt ?? 1) - (a.run_attempt ?? 1) ||
          String(b.created_at).localeCompare(String(a.created_at))
      );
      const run = runs[0];
      return {
        state: mapRunState(run),
        url: run.html_url || actionsUrl,
        runId: run.id,
        status: run.status,
        conclusion: run.conclusion ?? null
      };
    };

    let last = await once();
    if (!wait) return last;
    const started = this.#now();
    let lastKey = "";
    for (;;) {
      const key = `${last.state}|${last.runId}`;
      if (key !== lastKey) {
        lastKey = key;
        onUpdate?.(last);
      }
      if (["success", "failure", "cancelled"].includes(last.state)) return last;
      if (last.reason === "no-permission") return last;
      const elapsed = this.#now() - started;
      if (last.reason === "no-run-yet" && elapsed >= appearTimeoutMs)
        return last;
      if (elapsed >= timeoutMs) return {...last, timedOut: true};
      await this.#sleep(intervalMs, signal);
      last = await once();
    }
  }
}

export default GitHub;
