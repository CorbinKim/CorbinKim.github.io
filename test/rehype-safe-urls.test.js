// Run: node --test rehype-safe-urls.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluate} from "@mdx-js/mdx";
import runtime from "react/jsx-runtime.js";
import ReactDOMServer from "react-dom/server.js";
import React from "react";
import rehypeSafeUrls from "../plugins/rehype-safe-urls.js";

async function html(value) {
  const mod = await evaluate(
    {value, path: "/x/post.md"},
    {...runtime, format: "md", rehypePlugins: [rehypeSafeUrls]}
  );
  return ReactDOMServer.renderToStaticMarkup(React.createElement(mod.default));
}
const hrefs = out => [...out.matchAll(/href="([^"]*)"/g)].map(m => m[1]);

test("keeps http(s), mailto, tel, relative and anchor links", async () => {
  const out = await html(
    "[a](https://x.com/a?b=c#d) [b](http://x.com) [c](mailto:a@b.co) [d](tel:+123) [e](/blog/x) [f](#sec) [g](../up) [h](img/a.png)"
  );
  assert.deepEqual(hrefs(out), [
    "https://x.com/a?b=c#d",
    "http://x.com",
    "mailto:a@b.co",
    "tel:+123",
    "/blog/x",
    "#sec",
    "../up",
    "img/a.png"
  ]);
});

test("drops javascript:, vbscript:, data: (any case / obfuscation)", async () => {
  const out = await html(
    "[a](javascript:alert(1)) [b](JaVaScRiPt:alert(1)) [c](vbscript:x) [d](data:text/html;base64,AAAA) [e](&#106;avascript:alert(1))"
  );
  assert.deepEqual(hrefs(out), []);
});

test("tab / space tricks are percent-encoded by remark, i.e. not a scheme", async () => {
  const out = await html(
    "[f](<java\tscript:alert(1)>) [g](< javascript:alert(1)>)"
  );
  // %09 / %20 cannot be part of a URL scheme, so browsers resolve these as
  // relative paths; the plugin must not break them either way
  assert.deepEqual(hrefs(out), [
    "java%09script:alert(1)",
    "%20javascript:alert(1)"
  ]);
});

test("drops unsafe img src too, keeps safe ones", async () => {
  const out = await html(
    "![a](javascript:alert(1)) ![b](/img/a.png) ![c](https://x.com/c.png) ![d](data:image/png;base64,AAAA)"
  );
  assert.deepEqual(
    [...out.matchAll(/src="([^"]*)"/g)].map(m => m[1]),
    ["/img/a.png", "https://x.com/c.png"]
  );
});
