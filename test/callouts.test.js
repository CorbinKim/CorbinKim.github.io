// Run: node --test test/callouts.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {unified} from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkCallouts from "../plugins/remark-callouts.js";
import {readAlert} from "../plugins/callout-syntax.js";

const render = md =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkCallouts)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(md)
  ).replace(/\n/g, "");

const parse = md =>
  unified().use(remarkParse).use(remarkGfm).parse(md).children[0];

test("a note becomes a titled callout box", () => {
  assert.equal(
    render("> [!NOTE]\n> Remember this."),
    '<div class="callout callout-note"><p class="callout-title">Note</p><p>Remember this.</p></div>'
  );
});

test("every kind, case-insensitive", () => {
  for (const [k, label] of [
    ["TIP", "Tip"],
    ["important", "Important"],
    ["Warning", "Warning"],
    ["CAUTION", "Caution"]
  ])
    assert.match(
      render(`> [!${k}]\n> x`),
      new RegExp(
        `callout-${k.toLowerCase()}"><p class="callout-title">${label}</p><p>x</p>`
      )
    );
});

test("marker on its own line followed by several paragraphs and rich text", () => {
  assert.equal(
    render(
      "> [!TIP]\n>\n> First **bold** paragraph.\n>\n> Second with `code` and $x$."
    ),
    '<div class="callout callout-tip"><p class="callout-title">Tip</p><p>First <strong>bold</strong> paragraph.</p><p>Second with <code>code</code> and $x$.</p></div>'
  );
});

test("a toggle becomes <details><summary>", () => {
  assert.equal(
    render("> [!TOGGLE] Why?\n>\n> Because.\n>\n> - one\n> - two"),
    '<details class="toggle"><summary>Why?</summary><p>Because.</p><ul><li>one</li><li>two</li></ul></details>'
  );
});

test("a toggle without a title falls back to Details", () => {
  assert.equal(
    render("> [!TOGGLE]\n>\n> Body."),
    '<details class="toggle"><summary>Details</summary><p>Body.</p></details>'
  );
});

test("ordinary blockquotes and unknown markers are untouched", () => {
  assert.equal(
    render("> just a quote"),
    "<blockquote><p>just a quote</p></blockquote>"
  );
  assert.equal(
    render("> [!FOO]\n> bar"),
    "<blockquote><p>[!FOO]bar</p></blockquote>".replace(
      "[!FOO]bar",
      "[!FOO]bar"
    )
  );
  assert.equal(
    render("> text [!NOTE] later"),
    "<blockquote><p>text [!NOTE] later</p></blockquote>"
  );
});

test("nested: a callout inside a list item and a quote inside a callout", () => {
  assert.match(
    render("- item\n\n  > [!WARNING]\n  > careful"),
    /<li><p>item<\/p><div class="callout callout-warning">/
  );
  assert.match(
    render("> [!NOTE]\n>\n> > inner quote"),
    /callout-note"><p class="callout-title">Note<\/p><blockquote><p>inner quote<\/p><\/blockquote>/
  );
});

test("readAlert does not modify its input and reports kind + content", () => {
  const bq = parse("> [!NOTE]\n> text");
  const before = JSON.stringify(bq);
  const alert = readAlert(bq);
  assert.equal(JSON.stringify(bq), before);
  assert.equal(alert.kind, "note");
  assert.equal(alert.children.length, 1);
  assert.equal(readAlert(parse("> plain")), null);
});
