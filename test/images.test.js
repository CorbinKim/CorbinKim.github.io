// Run: node --test test/images.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import {sanitizeJpeg, sniffImage} from "../src/admin/images.js";
import {
  imageFileName,
  isBlankBody,
  toSiteMd
} from "../src/admin/postprocess.js";

const ascii = s => [...s].map(c => c.charCodeAt(0));
const pad = (a, n = 16) => [
  ...a,
  ...new Array(Math.max(0, n - a.length)).fill(0)
];

test("sniffImage identifies by bytes, not by name", () => {
  assert.equal(
    sniffImage(
      Uint8Array.from(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )?.ext,
    ".png"
  );
  assert.equal(
    sniffImage(Uint8Array.from(pad([0xff, 0xd8, 0xff, 0xe0])))?.ext,
    ".jpg"
  );
  assert.equal(sniffImage(Uint8Array.from(pad(ascii("GIF89a"))))?.ext, ".gif");
  assert.equal(
    sniffImage(
      Uint8Array.from(pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]))
    )?.ext,
    ".webp"
  );
  assert.equal(
    sniffImage(Uint8Array.from(pad([0, 0, 0, 0x1c, ...ascii("ftypavif")])))
      ?.ext,
    ".avif"
  );
  // an SVG or HTML payload renamed to .png is rejected
  assert.equal(
    sniffImage(Uint8Array.from(pad(ascii('<svg onload="x()"></svg>')))),
    null
  );
  assert.equal(
    sniffImage(Uint8Array.from(pad(ascii("<!doctype html><script>")))),
    null
  );
  assert.equal(sniffImage(new Uint8Array(4)), null);
});

test("imageFileName: a sniffed extension overrides the file name", () => {
  assert.equal(
    imageFileName({name: "photo.png", type: "image/png"}, "abcd1234", ".jpg"),
    "photo-abcd1234.jpg"
  );
  assert.equal(
    imageFileName({name: "x.svg.png", type: ""}, "abcd1234", ".png"),
    "x-svg-abcd1234.png"
  );
});

// ---- JPEG metadata stripping ------------------------------------------------------

function seg(marker, payload) {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}
function tiffWith({orientation, gps}) {
  // little-endian TIFF: IFD0 with Make, Orientation, GPSInfo pointer
  const entries = [];
  const extra = [];
  const make = ascii("PhoneCo\0");
  const entry = (tag, type, count, value) => [
    tag & 255,
    tag >> 8,
    type,
    0,
    count & 255,
    0,
    0,
    0,
    ...value
  ];
  const n = 1 + (orientation ? 1 : 0) + (gps ? 1 : 0);
  const base = 8 + 2 + n * 12 + 4; // where extra data starts
  entries.push(...entry(0x010f, 2, make.length, [base & 255, base >> 8, 0, 0]));
  extra.push(...make);
  if (orientation) entries.push(...entry(0x0112, 3, 1, [orientation, 0, 0, 0]));
  if (gps) {
    const gpsOff = base + extra.length;
    entries.push(...entry(0x8825, 4, 1, [gpsOff & 255, gpsOff >> 8, 0, 0]));
    // GPS IFD: one entry (GPSLatitudeRef 'N')
    extra.push(1, 0, 1, 0, 2, 0, 2, 0, 0, 0, 0x4e, 0, 0, 0, 0, 0, 0, 0);
  }
  return [
    0x49,
    0x49,
    0x2a,
    0,
    8,
    0,
    0,
    0,
    n,
    0,
    ...entries,
    0,
    0,
    0,
    0,
    ...extra
  ];
}
function makeJpeg({orientation, gps, xmp = true, comment = true} = {}) {
  const exif = [
    ...ascii("Exif\0\0".replace(/\\0/g, "\0")),
    ...tiffWith({orientation, gps})
  ];
  return Uint8Array.from([
    0xff,
    0xd8,
    ...seg(0xe0, [...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...seg(0xe1, exif),
    ...(xmp
      ? seg(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta GPS/>"))
      : []),
    ...seg(0xed, ascii("Photoshop 3.0\0IPTC")),
    ...(comment ? seg(0xfe, ascii("taken at home")) : []),
    ...seg(0xdb, new Array(65).fill(7)),
    ...seg(0xda, [1, 1, 0, 0, 63, 0]),
    1,
    2,
    3,
    0xff,
    0x00,
    4,
    5, // "entropy coded data" incl. a stuffed 0xFF
    0xff,
    0xd9
  ]);
}
const has = (bytes, s) => Buffer.from(bytes).includes(Buffer.from(s, "latin1"));

test("sanitizeJpeg removes GPS, device info, XMP, IPTC and comments", () => {
  const src = makeJpeg({orientation: 6, gps: true});
  assert.ok(
    has(src, "PhoneCo") &&
      has(src, "xmpmeta") &&
      has(src, "IPTC") &&
      has(src, "taken at home")
  );
  const out = sanitizeJpeg(src);
  for (const needle of [
    "PhoneCo",
    "xmpmeta",
    "IPTC",
    "taken at home",
    "Photoshop"
  ])
    assert.ok(!has(out, needle), `still contains ${needle}`);
  assert.ok(has(out, "JFIF"), "JFIF header kept");
  // image data and tables untouched
  assert.deepEqual([...out.slice(-9)], [1, 2, 3, 0xff, 0x00, 4, 5, 0xff, 0xd9]);
  assert.ok(out.length < src.length);
});

test("sanitizeJpeg keeps the EXIF orientation (and only that)", () => {
  const out = sanitizeJpeg(makeJpeg({orientation: 6, gps: true}));
  assert.ok(has(out, "Exif"), "a minimal EXIF block is written back");
  const i = Buffer.from(out).indexOf(Buffer.from("Exif\0\0", "latin1"));
  const tiff = out.slice(i + 6);
  assert.deepEqual([...tiff.slice(0, 8)], [0x49, 0x49, 0x2a, 0, 8, 0, 0, 0]);
  assert.equal(tiff[8], 1); // exactly one IFD entry
  assert.deepEqual([...tiff.slice(10, 14)], [0x12, 0x01, 0x03, 0x00]); // Orientation, SHORT
  assert.equal(tiff[18], 6); // value
});

test("sanitizeJpeg drops EXIF entirely when orientation is absent or normal", () => {
  assert.ok(!has(sanitizeJpeg(makeJpeg({gps: true})), "Exif"));
  assert.ok(!has(sanitizeJpeg(makeJpeg({orientation: 1, gps: true})), "Exif"));
});

test("sanitizeJpeg: a JPEG without metadata comes back byte-identical", () => {
  const plain = Uint8Array.from([
    0xff,
    0xd8,
    ...seg(0xe0, [...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...seg(0xdb, new Array(65).fill(7)),
    ...seg(0xda, [1, 1, 0, 0, 63, 0]),
    9,
    9,
    0xff,
    0xd9
  ]);
  assert.deepEqual([...sanitizeJpeg(plain)], [...plain]);
});

test("sanitizeJpeg rejects damaged input instead of guessing", () => {
  assert.throws(() => sanitizeJpeg(Uint8Array.from([1, 2, 3])), /Not a JPEG/);
  assert.throws(
    () =>
      sanitizeJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1])),
    /Damaged/
  );
  assert.throws(
    () => sanitizeJpeg(Uint8Array.from([0xff, 0xd8, 0x00, 0x00])),
    /Damaged/
  );
});

// ---- toSiteMd regressions found in review ---------------------------------------------

test("toSiteMd keeps <br /> that is code inside a fence nested in a list", () => {
  const md =
    "- a\n  - b\n\n    ```html\n    <p>a</p>\n    <br />\n    <p>b</p>\n    ```\n";
  assert.equal(toSiteMd(md), md);
});

test("toSiteMd keeps an indented <br /> line and removes the column-0 one", () => {
  assert.equal(
    toSiteMd("- a\n  <br />\n\n<br />\n\nb\n"),
    "- a\n  <br />\n\nb\n"
  );
});

test("toSiteMd drops an image block that never got an image", () => {
  assert.equal(toSiteMd("a\n\n![1.00]()\n\nb\n"), "a\n\nb\n");
  assert.equal(toSiteMd("![]()\n"), "\n");
  assert.ok(isBlankBody("![1.00]()\n"));
  assert.ok(!isBlankBody("![1.00](/a.png)\n"));
});
