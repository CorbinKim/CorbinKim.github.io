// Shared by the site's remark plugin and the editor: how a callout / toggle is
// written in plain Markdown. It is GitHub's alert syntax, a blockquote whose
// first line is a marker, so it still reads fine anywhere:
//
//   > [!NOTE]            kinds: NOTE TIP IMPORTANT WARNING CAUTION
//   > Text of the callout.
//
//   > [!TOGGLE] Title    a collapsible block (<details>); the rest is the body
//   > Hidden until opened.
export const KINDS = ["note", "tip", "important", "warning", "caution"];
export const LABELS = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution"
};

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|TOGGLE)\][ \t]*\r?\n?/i;

/** @param blockquote an mdast blockquote
 *  @returns {{kind: string, children: object[]} | null}  kind is one of KINDS or
 *  "toggle". children are the blockquote's content without the marker; for a
 *  toggle the FIRST child is the title paragraph (empty when there is no title).
 *  The input is not modified. */
export function readAlert(blockquote) {
  const first = blockquote.children && blockquote.children[0];
  if (!first || first.type !== "paragraph") return null;
  const lead = first.children && first.children[0];
  if (!lead || lead.type !== "text") return null;
  const m = MARKER.exec(lead.value);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const rest = lead.value.slice(m[0].length);
  const inline = [
    ...(rest ? [{...lead, value: rest}] : []),
    ...first.children.slice(1)
  ];
  const paragraph = inline.length ? {...first, children: inline} : null;
  const others = blockquote.children.slice(1);
  if (kind === "toggle")
    return {
      kind,
      children: [paragraph || {type: "paragraph", children: []}, ...others]
    };
  return {kind, children: [...(paragraph ? [paragraph] : []), ...others]};
}
