// Run: node --test test/siteasset.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {SITE_URL, siteAsset} from "../src/admin/config.js";

test("on the editor's own host, site-absolute pictures come from the live site", () => {
  assert.equal(
    siteAsset("/img/blog/a/b.png", true),
    `${SITE_URL}/img/blog/a/b.png`
  );
  assert.equal(siteAsset("/profile.png", true), `${SITE_URL}/profile.png`);
});

test("everything else is left alone", () => {
  for (const src of [
    "https://x.y/z.png",
    "//cdn.example/z.png",
    "blob:http://h/1",
    "data:image/png;base64,AA",
    "relative/z.png",
    "",
    undefined,
    null
  ])
    assert.equal(siteAsset(src, true), src);
});

test("on the site's own host (or in dev) nothing is rewritten", () => {
  assert.equal(siteAsset("/img/blog/a/b.png", false), "/img/blog/a/b.png");
  assert.equal(siteAsset("/img/blog/a/b.png"), "/img/blog/a/b.png"); // node: not the admin-only build
});
