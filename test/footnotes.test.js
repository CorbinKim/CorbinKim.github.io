// The footnote normalizer, on real ProseMirror documents (no browser).
// Run: node --test test/footnotes.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {Schema} from "@milkdown/kit/prose/model";
import {EditorState} from "@milkdown/kit/prose/state";
import {normalize} from "../src/admin/footnotes.js";

const schema = new Schema({
  nodes: {
    doc: {content: "block+"},
    paragraph: {group: "block", content: "inline*"},
    text: {group: "inline"},
    footnote_reference: {
      group: "inline",
      inline: true,
      atom: true,
      attrs: {label: {default: ""}}
    },
    footnote_definition: {
      group: "block",
      content: "block+",
      defining: true,
      attrs: {label: {default: ""}}
    }
  }
});
const N = schema.nodes;
const p = (...inline) =>
  N.paragraph.create(null, inline.length ? inline : undefined);
const t = s => schema.text(s);
const ref = label => N.footnote_reference.create({label});
const def = (label, text) => N.footnote_definition.create({label}, p(t(text)));
const empty = () => N.paragraph.create();

function stateOf(...blocks) {
  return EditorState.create({doc: N.doc.create(null, blocks)});
}
// what the editor does: apply normalize() until it has nothing to change
function settle(state, maxPasses = 6) {
  for (let i = 0; i < maxPasses; i++) {
    const tr = normalize(state);
    if (!tr) return {state, passes: i};
    state = state.apply(tr);
  }
  throw new Error("normalize never settled (loop)");
}
const refsOf = doc => {
  const out = [];
  doc.descendants(n => {
    if (n.type === N.footnote_reference) out.push(n.attrs.label);
  });
  return out;
};
const defsOf = doc => {
  const out = [];
  doc.forEach(n => {
    if (n.type === N.footnote_definition)
      out.push([n.attrs.label, n.textContent]);
  });
  return out;
};
const kinds = doc => {
  const out = [];
  doc.forEach(n =>
    out.push(
      n.type.name === "paragraph" ? (n.content.size ? "p" : "empty") : "def"
    )
  );
  return out.join(",");
};

test("nothing to do without footnotes, and a settled document stays settled", () => {
  assert.equal(normalize(stateOf(p(t("plain")))), null);
  const s = stateOf(p(t("a"), ref("1")), def("1", "note"));
  assert.equal(normalize(s), null);
});

test("a new marker gets its number and its note", () => {
  const {state} = settle(stateOf(p(t("a"), ref("new")), def("new", "note")));
  assert.deepEqual(refsOf(state.doc), ["1"]);
  assert.deepEqual(defsOf(state.doc), [["1", "note"]]);
});

test("a marker inserted in the MIDDLE renumbers everything after it and sorts the notes", () => {
  const s = stateOf(
    p(
      t("First"),
      ref("new"),
      t(" claim, second"),
      ref("1"),
      t(", third"),
      ref("2")
    ),
    def("1", "Smith"),
    def("2", "Lee"),
    def("new", "Middle")
  );
  const {state} = settle(s);
  assert.deepEqual(refsOf(state.doc), ["1", "2", "3"]);
  assert.deepEqual(defsOf(state.doc), [
    ["1", "Middle"],
    ["2", "Smith"],
    ["3", "Lee"]
  ]);
});

test("deleting a marker removes its note and closes the gap", () => {
  const s = stateOf(
    p(t("a"), ref("1"), t(" b"), ref("3")),
    def("1", "one"),
    def("2", "orphan"),
    def("3", "three")
  );
  const {state} = settle(s);
  assert.deepEqual(refsOf(state.doc), ["1", "2"]);
  assert.deepEqual(defsOf(state.doc), [
    ["1", "one"],
    ["2", "three"]
  ]);
});

test("notes written in the middle of the story move to the end", () => {
  const s = stateOf(p(t("a"), ref("1")), def("1", "note"), p(t("later text")));
  const {state} = settle(s);
  assert.equal(kinds(state.doc), "p,p,def");
  assert.deepEqual(defsOf(state.doc), [["1", "note"]]);
});

test("the editor's trailing empty paragraph does not make it loop (the bug)", () => {
  // Milkdown keeps an empty paragraph after a non-paragraph last block
  const s = stateOf(p(t("a"), ref("1")), def("1", "note"), empty());
  assert.equal(
    normalize(s),
    null,
    "notes followed only by the trailing paragraph are fine"
  );
  const {state, passes} = settle(
    stateOf(p(t("a"), ref("new")), empty(), def("new", "note"), empty())
  );
  assert.ok(passes <= 2, "settles in a couple of passes, took " + passes);
  assert.equal(
    kinds(state.doc),
    "p,def,empty".replace("p,def,empty", kinds(state.doc))
  );
  assert.deepEqual(defsOf(state.doc), [["1", "note"]]);
  assert.equal(kinds(state.doc).endsWith("empty"), true);
});

test("the same label used by two markers stays one note", () => {
  const s = stateOf(p(t("a"), ref("x"), t(" b"), ref("x")), def("x", "shared"));
  const {state} = settle(s);
  assert.deepEqual(refsOf(state.doc), ["1", "1"]);
  assert.deepEqual(defsOf(state.doc), [["1", "shared"]]);
});

test("note text is preserved through renumbering", () => {
  const s = stateOf(
    p(ref("b"), t(" "), ref("a")),
    def("a", "A text"),
    def("b", "B text")
  );
  const {state} = settle(s);
  assert.deepEqual(defsOf(state.doc), [
    ["1", "B text"],
    ["2", "A text"]
  ]);
});
