// Dependency-free front-matter reader/writer for blog posts (plain ESM, runs in
// the browser and in node).
//
//   stringify({data, body}) -> "---\nkey: <JSON>\n...---\n\n<body>"
//   parse(text)             -> {data, body}
//
// WRITER: every value is emitted as JSON (flow style, ", " / ": " separators).
// JSON is a subset of YAML 1.2 flow syntax, so remark-frontmatter +
// remark-mdx-frontmatter (which use the `yaml` package) read it back
// unchanged. A title such as `[Paper review] Foo: "bar" # baz` needs no special
// casing because it is always a double-quoted, escaped, single-line string.
//
// READER: tolerant of what a human (or Claude) is likely to hand-write in a
// post: plain / "double" / 'single' quoted scalars (multi-line too), flow
// sequences and mappings (multi-line too), block sequences (`- a`), block
// scalars (`|`, `>`, with chomping), booleans, null, numbers, comments.
// Anything outside that (anchors, tags, nested block mappings, ...) throws
// with a line number rather than silently losing data. Dates stay strings.

const KNOWN_ORDER = ["title", "date", "excerpt", "tags", "draft"];

// ---------------------------------------------------------------- writer ----

// JSON.stringify leaves these raw; make them explicit so no YAML parser can
// treat them as line breaks / BOMs.
const esc = s =>
  s.replace(
    /[\u0085\u2028\u2029\ufeff]/g,
    c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );

function toFlow(v) {
  if (v instanceof Date) return JSON.stringify(v.toISOString().slice(0, 10));
  if (Array.isArray(v)) return "[" + v.map(toFlow).join(", ") + "]";
  if (v && typeof v === "object") {
    return (
      "{" +
      Object.keys(v)
        .filter(k => v[k] !== undefined)
        .map(k => esc(JSON.stringify(k)) + ": " + toFlow(v[k]))
        .join(", ") +
      "}"
    );
  }
  if (v === undefined) return "null";
  if (typeof v === "number" && !Number.isFinite(v)) return "null";
  return esc(JSON.stringify(v));
}

const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export function stringify({data = {}, body = ""} = {}) {
  const keys = [
    ...KNOWN_ORDER.filter(k => k in data),
    ...Object.keys(data).filter(k => !KNOWN_ORDER.includes(k))
  ];
  const lines = [];
  for (const k of keys) {
    const v = data[k];
    if (v === undefined || v === null) continue;
    if (k === "draft" && v !== true) continue; // only ever written as `true`
    const key = BARE_KEY.test(k) ? k : esc(JSON.stringify(k));
    lines.push(`${key}: ${toFlow(v)}`);
  }
  const text = String(body ?? "");
  const tail = text === "" || text.endsWith("\n") ? text : text + "\n";
  return `---\n${lines.length ? lines.join("\n") + "\n" : ""}---\n\n${tail}`;
}

// ---------------------------------------------------------------- reader ----

const fail = (line, msg) => {
  throw new Error(`frontmatter line ${line}: ${msg}`);
};

const DQ_ESC = {
  0: "\0",
  a: "\x07",
  b: "\b",
  t: "\t",
  "\t": "\t",
  n: "\n",
  v: "\v",
  f: "\f",
  r: "\r",
  e: "\x1b",
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  N: "\u0085",
  _: "\u00a0",
  L: "\u2028",
  P: "\u2029"
};

// Fold the inside of a quoted scalar: a line break plus surrounding blanks
// becomes one space; k extra blank lines become k newlines.
function fold(raw) {
  return raw.replace(/[ \t]*\n(?:[ \t]*\n)*[ \t]*/g, m => {
    const breaks = (m.match(/\n/g) || []).length;
    return breaks === 1 ? " " : "\n".repeat(breaks - 1);
  });
}

function decodeDouble(raw, line) {
  // `\` + newline is an escaped line break (joins without a space)
  const joined = raw.replace(/\\\n[ \t]*/g, "\u0000JOIN\u0000");
  return fold(joined)
    .replace(/\u0000JOIN\u0000/g, "")
    .replace(
      /\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|([\s\S]))/g,
      (m, x, u, U, c) => {
        if (x || u || U) return String.fromCodePoint(parseInt(x || u || U, 16));
        if (c in DQ_ESC) return DQ_ESC[c];
        return fail(line, `unknown escape \\${c}`);
      }
    );
}

const decodeSingle = raw => fold(raw).replace(/''/g, "'");

function plainScalar(s) {
  const t = s.trim();
  if (t === "" || t === "~" || /^(null|Null|NULL)$/.test(t)) return null;
  if (/^(true|True|TRUE)$/.test(t)) return true;
  if (/^(false|False|FALSE)$/.test(t)) return false;
  if (/^[-+]?[0-9]+$/.test(t)) return Number(t);
  if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(t)) {
    return Number(t);
  }
  return t;
}

// Cursor over the whole YAML text so quoted scalars / flow collections can
// span lines.
class Cursor {
  constructor(text, pos, lineAt) {
    this.t = text;
    this.i = pos;
    this.lineAt = lineAt;
  }
  line() {
    return this.lineAt(this.i);
  }
  ws() {
    while (/[ \t\n]/.test(this.t[this.i] ?? "x")) this.i++;
  }
  quoted() {
    const q = this.t[this.i];
    const start = this.i + 1;
    let j = start;
    for (; j < this.t.length; j++) {
      const c = this.t[j];
      if (q === '"' && c === "\\") j++;
      else if (q === '"' && c === '"') break;
      else if (q === "'" && c === "'") {
        if (this.t[j + 1] === "'") j++;
        else break;
      }
    }
    if (j >= this.t.length) fail(this.line(), "unterminated quoted string");
    const raw = this.t.slice(start, j);
    const line = this.line();
    this.i = j + 1;
    return q === '"' ? decodeDouble(raw, line) : decodeSingle(raw);
  }
  flow() {
    this.ws();
    const c = this.t[this.i];
    if (c === "[") return this.seq();
    if (c === "{") return this.map();
    if (c === '"' || c === "'") return this.quoted();
    // plain scalar inside a flow collection ends at , ] } or a newline
    const start = this.i;
    while (this.i < this.t.length && !/[,\]}\n]/.test(this.t[this.i])) {
      if (this.t[this.i] === "#" && /\s/.test(this.t[this.i - 1] ?? "")) break;
      if (this.t[this.i] === ":" && /[\s]/.test(this.t[this.i + 1] ?? " ")) {
        break;
      }
      this.i++;
    }
    return plainScalar(this.t.slice(start, this.i));
  }
  seq() {
    const out = [];
    this.i++; // [
    for (;;) {
      this.ws();
      if (this.i >= this.t.length) fail(this.line(), "unterminated [ ... ]");
      if (this.t[this.i] === "]") {
        this.i++;
        return out;
      }
      out.push(this.flow());
      this.ws();
      if (this.t[this.i] === ",") this.i++;
      else if (this.t[this.i] !== "]") {
        fail(this.line(), "expected , or ] in flow sequence");
      }
    }
  }
  map() {
    const out = {};
    this.i++; // {
    for (;;) {
      this.ws();
      if (this.i >= this.t.length) fail(this.line(), "unterminated { ... }");
      if (this.t[this.i] === "}") {
        this.i++;
        return out;
      }
      const k = this.flow();
      this.ws();
      let v = null;
      if (this.t[this.i] === ":") {
        this.i++;
        v = this.flow();
        this.ws();
      }
      out[String(k)] = v;
      if (this.t[this.i] === ",") this.i++;
      else if (this.t[this.i] !== "}") {
        fail(this.line(), "expected , or } in flow mapping");
      }
    }
  }
}

const KEY_LINE =
  /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#'"[\]{},&*!|>%@`-][^:]*?|-[^\s:][^:]*?)[ \t]*:(?:[ \t]+(.*)|)$/;

function parseMapping(yaml) {
  const lines = yaml.split("\n");
  // offset of each line start, for the char-level cursor
  const offsets = [];
  let off = 0;
  for (const l of lines) {
    offsets.push(off);
    off += l.length + 1;
  }
  const lineAt = pos => {
    let n = 0;
    while (n + 1 < offsets.length && offsets[n + 1] <= pos) n++;
    return n + 2; // +1 for 1-based, +1 for the opening `---`
  };
  const isBlank = l => /^\s*(#.*)?$/.test(l);
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const m = KEY_LINE.exec(line);
    if (!m) fail(i + 2, `cannot parse "${line.trim().slice(0, 60)}"`);
    let key = m[1];
    if (key[0] === '"') key = decodeDouble(key.slice(1, -1), i + 2);
    else if (key[0] === "'") key = decodeSingle(key.slice(1, -1));
    const rest = (m[2] ?? "").replace(/^[ \t]+/, "");
    const valueStart = offsets[i] + line.length - rest.length;
    let value;

    if (rest === "" || rest[0] === "#") {
      // block sequence ("- x" at same or deeper indent) or null
      const items = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j];
        if (isBlank(l)) continue;
        const im = /^[ \t]*-(?:[ \t]+(.*))?$/.exec(l);
        if (!im) break;
        items.push(plainOrQuoted(im[1] ?? "", j + 2));
      }
      if (j < lines.length && /^[ \t]+\S/.test(lines[j]) && !items.length) {
        fail(j + 2, "nested block mappings are not supported");
      }
      value = items.length ? items : null;
      // trim trailing blank lines we skipped over
      while (j > i + 1 && isBlank(lines[j - 1])) j--;
      i = j;
    } else if (/^[|>][+-]?[0-9]?[+-]?[ \t]*(#.*)?$/.test(rest)) {
      const style = rest[0];
      const chomp = /[+-]/.exec(rest.split("#")[0])?.[0] ?? "";
      let j = i + 1;
      const block = [];
      for (; j < lines.length; j++) {
        if (lines[j].trim() === "" || /^[ \t]/.test(lines[j])) {
          block.push(lines[j]);
        } else break;
      }
      const end = j;
      while (block.length && block[block.length - 1].trim() === "") block.pop();
      const indent = Math.min(
        ...block.filter(l => l.trim()).map(l => /^[ \t]*/.exec(l)[0].length),
        Infinity
      );
      const body = block.map(l => l.slice(Math.min(indent, l.length)));
      let text;
      if (style === "|") text = body.join("\n");
      else {
        text = body
          .join("\n")
          .replace(/([^\n])\n(?=[^\n ])/g, "$1 ")
          .replace(/\n\n(?=[^\n])/g, "\n");
      }
      const trailing = lines.slice(i + 1, end).length - block.length;
      if (chomp === "-") value = text;
      else if (chomp === "+") value = text + "\n".repeat(1 + trailing);
      else value = block.length ? text + "\n" : "";
      i = end;
    } else if (rest[0] === '"' || rest[0] === "'") {
      const cur = new Cursor(yaml, valueStart, lineAt);
      value = cur.quoted();
      const after = yaml.slice(cur.i).split("\n", 1)[0];
      if (!/^[ \t]*(#.*)?$/.test(after))
        fail(lineAt(cur.i), "junk after value");
      i = lineAt(cur.i) - 2 + 1;
    } else if (rest[0] === "[" || rest[0] === "{") {
      const cur = new Cursor(yaml, valueStart, lineAt);
      value = cur.flow();
      const after = yaml.slice(cur.i).split("\n", 1)[0];
      if (!/^[ \t]*(#.*)?$/.test(after))
        fail(lineAt(cur.i), "junk after value");
      i = lineAt(cur.i) - 2 + 1;
    } else if (/^[&*!%@`]/.test(rest)) {
      fail(i + 2, "anchors, aliases and tags are not supported");
    } else {
      // plain scalar, possibly continued on more-indented lines
      let text = rest.replace(/[ \t]+#.*$/, "");
      let j = i + 1;
      while (j < lines.length && /^[ \t]+\S/.test(lines[j])) {
        if (/^[ \t]+#/.test(lines[j])) break;
        text += " " + lines[j].trim().replace(/[ \t]+#.*$/, "");
        j++;
      }
      value = plainScalar(text);
      i = j;
    }
    data[key] = value;
  }
  return data;
}

function plainOrQuoted(s, lineNo) {
  const t = s.trim();
  if (t[0] === '"' || t[0] === "'") {
    const cur = new Cursor(t, 0, () => lineNo);
    return cur.quoted();
  }
  if (t[0] === "[" || t[0] === "{")
    return new Cursor(t, 0, () => lineNo).flow();
  return plainScalar(t.replace(/[ \t]+#.*$/, ""));
}

export function parse(input) {
  const src = String(input ?? "")
    .replace(/^\ufeff/, "")
    .replace(/\r\n?/g, "\n");
  const open = /^---[ \t]*\n/.exec(src);
  if (!open) return {data: {}, body: src};
  const rest = src.slice(open[0].length);
  const close = /^(?:---|\.\.\.)[ \t]*(?:\n|$)/m.exec(rest);
  if (!close) return {data: {}, body: src}; // unterminated: not frontmatter
  const data = parseMapping(rest.slice(0, close.index).replace(/\n$/, ""));
  const body = rest.slice(close.index + close[0].length).replace(/^\n/, "");
  return {data, body};
}

/**
 * Set or clear `draft: true` in a post's front matter by touching a single line
 * (added, replaced or removed); every other byte stays as it was written, so
 * hiding and showing a post again gives back the original file.
 * @returns {string|null} the new text, or null when the front matter cannot be
 *   edited safely (none at all, never closed, or a `draft` value that spans
 *   several lines)
 */
export function setDraftFlag(input, hidden) {
  const src = String(input ?? "");
  const open = /^\ufeff?---[ \t]*\r?\n/.exec(src);
  if (!open) return null;
  const rest = src.slice(open[0].length);
  const close = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!close) return null;
  const eol = /\r\n/.test(open[0]) ? "\r\n" : "\n";
  const lines = rest.slice(0, close.index).split(/(?<=\n)/);
  if (lines.length === 1 && lines[0] === "") lines.pop();

  const at = lines.findIndex(l => /^["']?draft["']?[ \t]*:/.test(l));
  if (at >= 0 && /^[ \t]+\S/.test(lines[at + 1] ?? "")) return null; // multi-line value
  if (hidden) {
    if (at >= 0) {
      const had = /\r?\n$/.exec(lines[at]);
      lines[at] = "draft: true" + (had ? had[0] : eol);
    } else {
      if (lines.length && !/\n$/.test(lines[lines.length - 1]))
        lines[lines.length - 1] += eol;
      lines.push("draft: true" + eol);
    }
  } else if (at >= 0) {
    lines.splice(at, 1);
  } else {
    return src;
  }
  return open[0] + lines.join("") + rest.slice(close.index);
}

export default {parse, stringify};
