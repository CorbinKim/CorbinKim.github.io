// Run: node --test src/admin/        (needs node >= 18; zero config)
// `yaml` and `@mdx-js/mdx` are used only as ORACLES: the tests that need them
// are skipped if they cannot be imported.
import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {parse, setDraftFlag, stringify} from "../src/admin/frontmatter.js";

const YAML = await import("yaml")
  .then(m => m.default || m)
  .catch(() => null);
const mdx = await import("@mdx-js/mdx").catch(() => null);
const fm = await import("remark-frontmatter")
  .then(m => m.default)
  .catch(() => null);
const mdxFm = await import("remark-mdx-frontmatter")
  .then(m => m.default)
  .catch(() => null);

// frontmatter text between the fences, as `yaml` (what remark-mdx-frontmatter
// uses) would read it
const oracle = text => {
  const m = /^---\n([\s\S]*?)\n?---\n/.exec(text);
  return YAML.parse(m[1]);
};

// the post's `frontmatter` export as the real MDX pipeline produces it
async function viaMdx(text, format = "md") {
  const out = String(
    await mdx.compile(
      {value: text, path: "/x/post." + format},
      {format, remarkPlugins: [fm, mdxFm]}
    )
  );
  const m = /export const frontmatter = (\{[\s\S]*?\n\});/.exec(out);
  return new Function("return " + m[1])();
}

const postsDir = new URL("../src/blog/posts/", import.meta.url);
// The real posts (if the site has any right now: the folder is gone from git when
// the last post is deleted) are used as extra fixtures below.
const existing = existsSync(postsDir)
  ? readdirSync(postsDir)
      .filter(f => /\.mdx?$/.test(f))
      .map(f => [f, readFileSync(new URL(f, postsDir), "utf8")])
  : [];

for (const [name, text] of existing) {
  test(`existing post ${name}: parse() == yaml oracle`, {skip: !YAML}, () => {
    assert.deepEqual(parse(text).data, oracle(text));
  });

  test(`existing post ${name}: stringify(parse()) is byte-identical`, () => {
    const {data, body} = parse(text);
    assert.equal(stringify({data, body}), text);
  });

  test(`existing post ${name}: body untouched`, () => {
    const {body} = parse(text);
    assert.equal(text.endsWith(body), true);
    assert.equal(body.startsWith("---"), false);
  });
}

const TITLES = [
  "[Paper review] Deep Learning Through the Lens of Example  Difficulty",
  'He said "hi": it\'s a test',
  "Colon: here, and key: value",
  "# not a comment",
  "- not a list",
  "? not a complex key",
  "{not: a map}",
  "[not, a, list]",
  "*alias &anchor !tag %dir @at `tick`",
  "---",
  "--- \n--- injected: yes",
  "back\\slash and \\n literal",
  "yes",
  "null",
  "~",
  "true",
  "123",
  "1e3",
  "2026-09-21",
  "한글 제목: 어텐션 [논문 리뷰] 🚀",
  "tab\there",
  "  leading and trailing  ",
  "",
  "line one\nline two\n\nafter blank",
  "unicode \u2028 sep \u2029 nel \u0085 bom \uFEFF end",
  "ends with colon:",
  "x: y # z",
  "</title><script>alert(1)</script>",
  "a".repeat(500)
];

for (const title of TITLES) {
  const label = JSON.stringify(title).slice(0, 50);
  test(`title round trip: ${label}`, () => {
    const data = {title, date: "2026-10-11", excerpt: "e", tags: ["a"]};
    const text = stringify({data, body: "Body\n"});
    // 1. our own reader
    assert.deepEqual(parse(text).data, data);
    assert.equal(parse(text).body, "Body\n");
    // 2. the yaml package
    if (YAML) assert.deepEqual(oracle(text), data);
    // 3. the real MDX pipeline (what the site actually uses)
    if (mdx && fm && mdxFm) {
      return viaMdx(text).then(got => assert.deepEqual(got, data));
    }
  });
}

test("front matter is always single-line-per-key (no injection)", () => {
  const text = stringify({
    data: {title: "a\n---\nevil: 1", tags: ["x\ny"]},
    body: ""
  });
  assert.equal(text.split("\n").filter(l => l === "---").length, 2);
  assert.equal(parse(text).data.evil, undefined);
});

test("empty tags, missing tags, draft", () => {
  assert.equal(
    stringify({data: {title: "t", tags: []}, body: "b"}),
    '---\ntitle: "t"\ntags: []\n---\n\nb\n'
  );
  assert.deepEqual(
    parse('---\ntitle: "t"\ntags: []\n---\n\nb\n').data.tags,
    []
  );
  assert.equal(parse('---\ntitle: "t"\n---\n\nb').data.tags, undefined);
  assert.equal(parse("---\ntags:\n---\n").data.tags, null);
  assert.equal(
    stringify({data: {title: "t", draft: true}}),
    '---\ntitle: "t"\ndraft: true\n---\n\n'
  );
  assert.equal(
    stringify({data: {title: "t", draft: false}}),
    '---\ntitle: "t"\n---\n\n'
  );
  assert.equal(parse("---\ndraft: true\n---\n").data.draft, true);
  assert.equal(parse("---\ndraft: false\n---\n").data.draft, false);
});

test("key order: known keys first, unknown keys preserved", () => {
  const text = stringify({
    data: {cover: "/img/x.png", tags: ["b"], title: "t", date: "2026-01-02"},
    body: "x"
  });
  assert.equal(
    text,
    '---\ntitle: "t"\ndate: "2026-01-02"\ntags: ["b"]\ncover: "/img/x.png"\n---\n\nx\n'
  );
  assert.deepEqual(parse(text).data.cover, "/img/x.png");
});

// Hand-written styles a person might use; every one must match `yaml`.
const HAND_WRITTEN = {
  "plain scalars":
    "title: Plain title with a - dash (and parens)\ndate: 2026-09-21\nexcerpt: Short one\ntags: [a, b, c]",
  "single quotes":
    "title: 'It''s [quoted]'\ndate: '2026-09-21'\ntags: ['x', 'y z']",
  "double quotes with escapes":
    'title: "A \\"b\\" \\u00e9 \\\\ \\t"\ntags: ["x"]',
  "block sequence":
    'title: "t"\ntags:\n  - one\n  - "two words"\n  - \'three\'\nexcerpt: e',
  "block sequence same indent": 'title: "t"\ntags:\n- one\n- two\nexcerpt: e',
  "literal block scalar":
    "title: t\nexcerpt: |\n  line one\n  line two\n\n  para two\ntags: []",
  "literal strip": "excerpt: |-\n  a\n  b\ntitle: t",
  "literal keep": "excerpt: |+\n  a\n\n\ntitle: t",
  "folded block scalar":
    "excerpt: >\n  folded line one\n  continues here\n\n  new paragraph\ntitle: t",
  "folded strip": "excerpt: >-\n  one\n  two\ntitle: t",
  "multi-line double quoted":
    'excerpt: "first line\n  second line\n\n  after blank"\ntitle: t',
  "multi-line single quoted": "excerpt: 'first\n  second'\ntitle: t",
  "multi-line plain": "excerpt: first part\n  second part\ntitle: t",
  "multi-line flow seq": 'tags: [\n  "a",\n  "b c",\n  d,\n]\ntitle: t',
  "flow map": 'title: t\nmeta: {a: 1, "b c": [1, 2], d: null}',
  comments:
    '# top comment\ntitle: "t" # trailing\n\n# between\ntags: [a, b] # tags\ndate: 2026-09-21 # day',
  "booleans/null/numbers":
    "a: true\nb: False\nc: null\nd: ~\ne: 12\nf: -3.5\ng: 1e3\nh:\ni: yes",
  "colon not followed by space": "title: Foo:bar\nurl: http://x.com/a?b=c#d",
  "quoted key": '"title": "t"\n\'date\': "2026-01-01"',
  "empty value then key": "tags:\ntitle: t",
  "windows newlines": 'title: "t"\r\ntags: ["a"]'
};

for (const [name, y] of Object.entries(HAND_WRITTEN)) {
  test(`hand-written: ${name}`, {skip: !YAML}, () => {
    const text = `---\n${y}\n---\n\nbody\n`;
    const expected = YAML.parse(y.replace(/\r\n/g, "\n"));
    const got = parse(text);
    assert.deepEqual(got.data, expected);
    assert.equal(got.body, "body\n");
    // and re-writing it yields the same semantics (through yaml again);
    // stringify() deliberately omits null values
    const rewritten = stringify(got);
    const nonNull = Object.fromEntries(
      Object.entries(expected).filter(([, v]) => v !== null)
    );
    assert.deepEqual(oracle(rewritten), nonNull);
    assert.deepEqual(parse(rewritten).data, nonNull);
  });
}

test("edge: no front matter / unterminated / empty / BOM / CRLF", () => {
  assert.deepEqual(parse("just body\n"), {data: {}, body: "just body\n"});
  const unterminated = '---\ntitle: "x"\nno closing fence\n';
  assert.deepEqual(parse(unterminated), {data: {}, body: unterminated});
  assert.deepEqual(parse("---\n---\nbody"), {data: {}, body: "body"});
  assert.deepEqual(parse("---\n---\n\nbody"), {data: {}, body: "body"});
  assert.equal(parse('\uFEFF---\ntitle: "t"\n---\n\nb').data.title, "t");
  const crlf = parse(
    '---\r\ntitle: "t"\r\ntags: ["a"]\r\n---\r\n\r\nline1\r\nline2\r\n'
  );
  assert.deepEqual(crlf.data, {title: "t", tags: ["a"]});
  assert.equal(crlf.body, "line1\nline2\n");
  assert.deepEqual(parse("").data, {});
  assert.equal(stringify({data: {}, body: ""}), "---\n---\n\n");
  assert.deepEqual(parse(stringify({data: {}, body: ""})), {
    data: {},
    body: ""
  });
});

test("body: a later --- (hr) or +++ never leaks into front matter", () => {
  const body = "Intro\n\n---\n\nmore: text\n\n---\n";
  const text = stringify({data: {title: "t"}, body});
  assert.deepEqual(parse(text), {data: {title: "t"}, body});
});

test("body is preserved byte-for-byte (leading blank lines beyond one, trailing ws)", () => {
  const body = "\n\n  indented\n\ttabbed  \n\n\n";
  const text = stringify({data: {title: "t"}, body});
  assert.equal(parse(text).body, body);
});

test("unsupported constructs throw with a line number instead of corrupting", () => {
  assert.throws(
    () => parse("---\nmeta:\n  nested: 1\n---\n"),
    /line 3.*nested/
  );
  assert.throws(() => parse("---\ntitle: &a x\n---\n"), /line 2.*anchors/);
  assert.throws(
    () => parse('---\ntitle: "unterminated\n---\n'),
    /unterminated/
  );
  assert.throws(() => parse('---\ntitle: "a" junk\n---\n'), /junk/);
});

test("fuzz: random strings survive stringify -> (own parser | yaml | mdx)", async () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const alphabet = [
    ..."abcXYZ019 \t\n:#-?[]{},&*!|>'\"%@`\\/<>=~.",
    "한",
    "글",
    "é",
    "🚀",
    "\u2028",
    "\u0085",
    "\uFEFF",
    "\u00a0"
  ];
  for (let n = 0; n < 1500; n++) {
    const len = Math.floor(rnd() * 24);
    let s = "";
    for (let k = 0; k < len; k++)
      s += alphabet[Math.floor(rnd() * alphabet.length)];
    const tags = Array.from(
      {length: Math.floor(rnd() * 3)},
      () => s.slice(0, 5) + n
    );
    const data = {title: s, date: "2026-01-01", excerpt: s + "!", tags};
    const text = stringify({data, body: "b\n"});
    assert.deepEqual(
      parse(text).data,
      data,
      "own parser: " + JSON.stringify(s)
    );
    if (YAML)
      assert.deepEqual(oracle(text), data, "yaml: " + JSON.stringify(s));
  }
  // a smaller sample through the full MDX compiler
  if (mdx && fm && mdxFm) {
    for (let n = 0; n < 60; n++) {
      let s = "";
      for (let k = 0; k < 12; k++)
        s += alphabet[Math.floor(rnd() * alphabet.length)];
      const data = {title: s, date: "2026-01-01", excerpt: s, tags: [s]};
      assert.deepEqual(await viaMdx(stringify({data, body: "x\n"})), data);
    }
  }
});

// ---- setDraftFlag: hide / show a post by touching one line ----------------------------------

const POST =
  '---\ntitle: "A"\ndate: "2026-10-01"\ntags: ["x"]\n---\n\nBody $x$\n';

test("setDraftFlag: adds draft: true as the last front matter line, nothing else changes", () => {
  const out = setDraftFlag(POST, true);
  assert.equal(
    out,
    '---\ntitle: "A"\ndate: "2026-10-01"\ntags: ["x"]\ndraft: true\n---\n\nBody $x$\n'
  );
});

test("setDraftFlag: hide then show gives back the original bytes", () => {
  assert.equal(setDraftFlag(setDraftFlag(POST, true), false), POST);
  const hand =
    "---\ntitle: 'Hand written'\ntags:\n  - a\n  - b\ndate: 2026-09-20 # when\n---\nText\n";
  assert.equal(setDraftFlag(setDraftFlag(hand, true), false), hand);
});

test("setDraftFlag: an existing draft line is replaced or removed in place", () => {
  const withFalse = "---\ntitle: A\ndraft: false\nexcerpt: e\n---\nT\n";
  assert.equal(
    setDraftFlag(withFalse, true),
    "---\ntitle: A\ndraft: true\nexcerpt: e\n---\nT\n"
  );
  const withTrue =
    "---\ntitle: A\ndraft: true # hidden for now\nexcerpt: e\n---\nT\n";
  assert.equal(
    setDraftFlag(withTrue, false),
    "---\ntitle: A\nexcerpt: e\n---\nT\n"
  );
  assert.equal(
    setDraftFlag(withTrue, true),
    "---\ntitle: A\ndraft: true\nexcerpt: e\n---\nT\n"
  );
});

test("setDraftFlag: showing a post that is not hidden returns the text as it is", () => {
  assert.equal(setDraftFlag(POST, false), POST);
});

test("setDraftFlag: keeps CRLF line endings, a BOM and an empty block", () => {
  const crlf = "---\r\ntitle: A\r\n---\r\nBody\r\n";
  assert.equal(
    setDraftFlag(crlf, true),
    "---\r\ntitle: A\r\ndraft: true\r\n---\r\nBody\r\n"
  );
  assert.equal(
    setDraftFlag("﻿---\ntitle: A\n---\nB\n", true),
    "﻿---\ntitle: A\ndraft: true\n---\nB\n"
  );
  assert.equal(
    setDraftFlag("---\n---\nB\n", true),
    "---\ndraft: true\n---\nB\n"
  );
});

test("setDraftFlag: body text that looks like front matter is never touched", () => {
  const text = "---\ntitle: A\n---\nBody\n\n---\ndraft: false\n---\n";
  assert.equal(
    setDraftFlag(text, true),
    "---\ntitle: A\ndraft: true\n---\nBody\n\n---\ndraft: false\n---\n"
  );
});

test("setDraftFlag: no safe edit -> null", () => {
  assert.equal(setDraftFlag("Just text\n", true), null);
  assert.equal(setDraftFlag("---\ntitle: A\nno closing line\n", true), null);
  assert.equal(setDraftFlag("---\ndraft:\n  true\n---\nT\n", true), null);
});

test("setDraftFlag result still parses, with draft true", () => {
  assert.equal(parse(setDraftFlag(POST, true)).data.draft, true);
  assert.equal(
    parse(setDraftFlag(setDraftFlag(POST, true), false)).data.draft,
    undefined
  );
});
