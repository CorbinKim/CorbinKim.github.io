// Pure byte-level helpers for uploaded images (no DOM, node-testable).
//
// 1. sniffImage(): decide the type from the bytes, not from the file name or the
//    MIME type the browser guessed, so "evil.png" that is really HTML/SVG is
//    rejected.
// 2. sanitizeJpeg(): a phone photo carries GPS position, device model and often
//    a thumbnail in its EXIF block, and the repo is public. Drop every metadata
//    segment, but keep the EXIF *orientation* (without it a portrait photo shows
//    up sideways) by writing back a minimal EXIF block that holds only that tag.

/** @returns {{ext: string, type: string} | null} */
export function sniffImage(bytes) {
  const b = bytes;
  const at = (i, ...v) => v.every((x, k) => b[i + k] === x);
  const ascii = (i, s) => [...s].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length < 12) return null;
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return {ext: ".png", type: "image/png"};
  if (at(0, 0xff, 0xd8, 0xff)) return {ext: ".jpg", type: "image/jpeg"};
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a"))
    return {ext: ".gif", type: "image/gif"};
  if (ascii(0, "RIFF") && ascii(8, "WEBP"))
    return {ext: ".webp", type: "image/webp"};
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis")))
    return {ext: ".avif", type: "image/avif"};
  return null;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

function readOrientation(seg) {
  // seg = the APP1 payload after the 2-byte length: "Exif\0\0" + TIFF
  if (!EXIF_HEADER.every((v, i) => seg[i] === v)) return null;
  const t = seg.subarray(6);
  if (t.length < 14) return null;
  const little = t[0] === 0x49 && t[1] === 0x49;
  if (!little && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
  const view = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const u16 = o => view.getUint16(o, little);
  const u32 = o => view.getUint32(o, little);
  if (u16(2) !== 42) return null;
  const ifd = u32(4);
  if (ifd + 2 > t.length) return null;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) return null;
    // tag 0x0112 Orientation, type 3 (SHORT), count 1
    if (u16(e) === 0x0112 && u16(e + 2) === 3 && u32(e + 4) === 1) {
      const v = u16(e + 8);
      return v >= 2 && v <= 8 ? v : null; // 1 = normal: nothing to keep
    }
  }
  return null;
}

function minimalExif(orientation) {
  // "Exif\0\0" + little-endian TIFF with one IFD0 entry (Orientation)
  const tiff = [
    0x49,
    0x49,
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00, // header, IFD0 at 8
    0x01,
    0x00, // one entry
    0x12,
    0x01,
    0x03,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00, // tag, SHORT, count 1
    orientation,
    0x00,
    0x00,
    0x00, // value
    0x00,
    0x00,
    0x00,
    0x00 // no next IFD
  ];
  const payload = [...EXIF_HEADER, ...tiff];
  const len = payload.length + 2;
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
}

/** Returns a copy of a JPEG without EXIF/XMP/IPTC/comments (orientation kept).
 *  Throws if the file is not a well-formed JPEG segment stream. */
export function sanitizeJpeg(bytes) {
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8))
    throw new Error("Not a JPEG file.");
  const out = [bytes.subarray(0, 2)];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error("Damaged JPEG (bad marker).");
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      // EOI, or SOS: entropy-coded image data follows; copy the rest verbatim
      out.push(bytes.subarray(i));
      i = bytes.length;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(bytes.subarray(i, i + 2)); // standalone marker, no length
      i += 2;
      continue;
    }
    if (i + 4 > bytes.length) throw new Error("Damaged JPEG (truncated).");
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length)
      throw new Error("Damaged JPEG (bad segment length).");
    const seg = bytes.subarray(i, i + 2 + len);
    if (marker === 0xe1) {
      const orientation = readOrientation(seg.subarray(4));
      if (orientation) out.push(minimalExif(orientation));
      // any other APP1 (XMP, full EXIF) is dropped
    } else if (marker === 0xed || marker === 0xfe) {
      // APP13 (Photoshop/IPTC) and COM comments are dropped
    } else {
      out.push(seg); // JFIF, ICC profile, tables, frame header, ...
    }
    i += 2 + len;
  }
  const total = out.reduce((n, p) => n + p.length, 0);
  const result = new Uint8Array(total);
  let o = 0;
  for (const p of out) {
    result.set(p, o);
    o += p.length;
  }
  return result;
}
