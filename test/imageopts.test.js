// Run: node --test test/imageopts.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {
  dragWidth,
  editorStyle,
  handleSides,
  imageBase,
  joinImageSrc,
  snapWidth,
  splitImageSrc
} from "../src/admin/imageopts.js";

test("split: path with and without options", () => {
  assert.deepEqual(splitImageSrc("/img/a.png"), {
    base: "/img/a.png",
    w: 0,
    align: ""
  });
  assert.deepEqual(splitImageSrc("/img/a.png#w=50&align=center"), {
    base: "/img/a.png",
    w: 50,
    align: "center"
  });
  assert.deepEqual(splitImageSrc("/img/a.png#align=right"), {
    base: "/img/a.png",
    w: 0,
    align: "right"
  });
  assert.deepEqual(splitImageSrc("/img/a.png#w=75"), {
    base: "/img/a.png",
    w: 75,
    align: ""
  });
});

test("split: invalid values are dropped, other fragments are not ours", () => {
  assert.deepEqual(splitImageSrc("/a.png#w=5&align=up"), {
    base: "/a.png",
    w: 0,
    align: ""
  });
  assert.deepEqual(splitImageSrc("/a.png#w=500"), {
    base: "/a.png",
    w: 0,
    align: ""
  });
  assert.deepEqual(splitImageSrc("/a.png#section"), {
    base: "/a.png#section",
    w: 0,
    align: ""
  });
  assert.deepEqual(splitImageSrc(undefined), {base: "", w: 0, align: ""});
});

test("join: only set options are written, in a fixed order", () => {
  assert.equal(joinImageSrc("/a.png", {}), "/a.png");
  assert.equal(joinImageSrc("/a.png", {w: 50}), "/a.png#w=50");
  assert.equal(joinImageSrc("/a.png", {align: "left"}), "/a.png#align=left");
  assert.equal(
    joinImageSrc("/a.png", {align: "right", w: 33}),
    "/a.png#w=33,align=right"
  );
  assert.equal(joinImageSrc("/a.png", {w: 0, align: ""}), "/a.png");
});

test("split and join are inverse", () => {
  for (const s of [
    "/a.png",
    "/a.png#w=33",
    "/a.png#align=center",
    "/a.png#w=100,align=left"
  ])
    assert.equal(
      (({base, ...o}) => joinImageSrc(base, o))(splitImageSrc(s)),
      s
    );
});

test("imageBase strips only our fragment", () => {
  assert.equal(
    imageBase("/img/blog/__draft__/x-1a2b.png#w=50,align=center"),
    "/img/blog/__draft__/x-1a2b.png"
  );
  assert.equal(imageBase("/a.png#top"), "/a.png#top");
});

test("editorStyle mirrors the site's rendering", () => {
  assert.equal(
    editorStyle({w: 50, align: "center"}),
    "width:50%;max-width:100%;margin-left:auto;margin-right:auto"
  );
  assert.equal(
    editorStyle({w: 0, align: "right"}),
    "width:fit-content;max-width:100%;margin-left:auto;margin-right:0"
  );
  assert.equal(editorStyle({w: 75, align: ""}), "width:75%;max-width:100%");
});

// ---- dragging a corner ----------------------------------------------------------------

test("snapWidth keeps the range and snaps to the presets", () => {
  assert.equal(snapWidth(52), 50);
  assert.equal(snapWidth(47), 50);
  assert.equal(snapWidth(34.4), 33);
  assert.equal(snapWidth(73), 75);
  assert.equal(snapWidth(97), 100);
  assert.equal(snapWidth(62), 62); // not near a preset: kept as dragged
  assert.equal(snapWidth(5), 10); // never below what the site accepts
  assert.equal(snapWidth(140), 100);
  assert.equal(snapWidth(NaN), 0);
});

test("dragWidth follows the held corner", () => {
  const base = {startPx: 600, containerPx: 600};
  // right corner dragged 150px to the left on a full-width picture -> 75%
  assert.equal(
    dragWidth({...base, dx: -150, side: "right", centered: false}),
    75
  );
  // left corner dragged right shrinks too (right-aligned picture)
  assert.equal(
    dragWidth({...base, dx: 300, side: "left", centered: false}),
    50
  );
  // growing past the column is capped
  assert.equal(
    dragWidth({...base, dx: 200, side: "right", centered: false}),
    100
  );
  // centered: both edges move, so the width changes twice as fast
  assert.equal(
    dragWidth({...base, dx: -150, side: "right", centered: true}),
    50
  );
  assert.equal(dragWidth({...base, dx: 150, side: "left", centered: true}), 50);
  // an in-between value stays exact
  assert.equal(
    dragWidth({...base, dx: -228, side: "right", centered: false}),
    62
  );
});

test("dragWidth refuses a picture with no measurable size", () => {
  assert.equal(
    dragWidth({startPx: 0, containerPx: 600, dx: 10, side: "right"}),
    0
  );
  assert.equal(
    dragWidth({startPx: 300, containerPx: 0, dx: 10, side: "right"}),
    0
  );
});

test("handleSides: the free side(s) of the picture", () => {
  assert.deepEqual(handleSides(""), ["right"]);
  assert.deepEqual(handleSides("left"), ["right"]);
  assert.deepEqual(handleSides("right"), ["left"]);
  assert.deepEqual(handleSides("center"), ["left", "right"]);
});
