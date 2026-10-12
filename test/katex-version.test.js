// Run: node --test test/katex-version.test.js
//
// The site draws equations with KaTeX's JavaScript (through rehype-katex, and in
// the editor through Milkdown) and styles them with KaTeX's CSS. If two different
// versions are installed, the markup of one and the stylesheet of the other drift
// apart (equation numbers lost their right-hand position that way). package.json
// pins one copy for everything ("overrides"); this keeps it that way.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const modules = new URL("../node_modules/", import.meta.url).pathname;
const version = dir => {
  const file = path.join(dir, "package.json");
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8")).version
    : null;
};

test("one copy of KaTeX is installed, shared by the site, the preview and the editor", () => {
  const top = version(path.join(modules, "katex"));
  assert.ok(top, "katex is installed");
  const nested = [];
  for (const owner of [
    "rehype-katex",
    "micromark-extension-math",
    "@milkdown/crepe"
  ]) {
    const v = version(path.join(modules, owner, "node_modules", "katex"));
    if (v) nested.push(`${owner} has its own katex ${v}`);
  }
  assert.deepEqual(
    nested,
    [],
    `top-level katex is ${top}: run npm install (see "overrides" in package.json)`
  );
});
