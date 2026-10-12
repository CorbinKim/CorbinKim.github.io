// Run: node --test test/mdxcheck.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {isPlainMdx} from "../src/admin/mdxcheck.js";

test("plain Markdown with math, code and a table is plain", () => {
  assert.equal(
    isPlainMdx(
      [
        "Intro with $Q \\in \\mathbb{R}^{n \\times d_k}$ inline.",
        "",
        "## Heading",
        "",
        "$$",
        "\\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V",
        "$$",
        "",
        "```python",
        "d = {'a': 1}",
        "```",
        "",
        "| a | b |",
        "| - | - |",
        "| $x_{1}$ | `{y}` |",
        ""
      ].join("\n")
    ),
    true
  );
});

test("a paper-review style post (the site's template) is plain", () => {
  const body = [
    "This is a **template post** — replace it. Inline math like $Q, K, V \\in \\mathbb{R}^{n \\times d_k}$ renders inline.",
    "",
    "## The core equation",
    "",
    "$$",
    "\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V",
    "$$",
    "",
    "The $\\sqrt{d_k}$ term matters.",
    "",
    "```python",
    "import numpy as np",
    "",
    "def attention(Q, K, V):",
    "    return weights @ V",
    "```",
    "",
    "| Component | Time complexity |",
    "| --- | --- |",
    "| $QK^\\top$ | $O(n^2 d_k)$ |",
    ""
  ].join("\n");
  assert.equal(isPlainMdx(body), true);
});

test("JSX components make it Markdown-only", () => {
  assert.equal(
    isPlainMdx("Hi\n\n<Callout>JSX stays intact</Callout>\n"),
    false
  );
  assert.equal(isPlainMdx("Text <b>inline</b> html\n"), false);
  assert.equal(isPlainMdx("<!-- a comment -->\n\ntext\n"), false);
});

test("{expressions} and import / export make it Markdown-only", () => {
  assert.equal(isPlainMdx("Sum is {1 + 1} today\n"), false);
  assert.equal(isPlainMdx('import Fig from "./fig.jsx"\n\nText\n'), false);
  assert.equal(isPlainMdx("export const meta = {a: 1}\n\nText\n"), false);
  assert.equal(isPlainMdx("a } b\n"), false);
});

test("escaped braces (what the visual editor writes) stay plain", () => {
  assert.equal(isPlainMdx("Use \\{x\\} here and \\< there\n"), true);
  // an escaped backslash does not escape the brace after it
  assert.equal(isPlainMdx("odd \\\\{x} case\n"), false);
});

test("empty and odd input", () => {
  assert.equal(isPlainMdx(""), true);
  assert.equal(isPlainMdx(undefined), true);
});
