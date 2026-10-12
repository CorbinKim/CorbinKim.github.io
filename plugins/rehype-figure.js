// Dependency-free rehype plugin (plain ESM).
//
//   <p><img src alt title="Caption"></p>
//     -> <figure><img src alt loading="lazy" decoding="async"/>
//          <figcaption>Caption</figcaption></figure>
//
// * A paragraph whose only content is one image (or one link wrapping one
//   image) AND which has a non-empty title becomes a <figure>. This is exactly
//   what `![alt](url "caption")` produces.
// * Size and alignment travel in the image URL's fragment, which the editor's
//   toolbar writes and static hosts ignore:  ![](/a.png#w=50,align=center "Cap")
//   w = 10..100 (percent of the article column), align = left | center | right.
//   The fragment is removed from src and turned into inline styles (on the
//   <figure> when captioned, else on the <img>), so no stylesheet is needed.
// * Every other <img> only gets loading="lazy" decoding="async" (existing
//   values are never overwritten).
// * Anything inside an existing <figure> (hand-written in legacy .mdx, where
//   it is an `mdxJsxFlowElement` named "figure", or a real hast <figure>
//   element when rehype-raw is used) is left alone, so nothing is
//   double-wrapped.
const isWhitespace = node => node.type === "text" && !node.value.trim();
const isElement = (node, name) =>
  node.type === "element" && (name ? node.tagName === name : true);
const isFigure = node =>
  isElement(node, "figure") ||
  ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
    node.name === "figure");

// img, or a > img  (ignoring whitespace-only text around it)
function soleImage(p) {
  const kids = p.children.filter(n => !isWhitespace(n));
  if (kids.length !== 1) return null;
  const [only] = kids;
  if (isElement(only, "img")) return {wrapper: only, img: only};
  if (isElement(only, "a")) {
    const inner = only.children.filter(n => !isWhitespace(n));
    if (inner.length === 1 && isElement(inner[0], "img")) {
      return {wrapper: only, img: inner[0]};
    }
  }
  return null;
}

// Milkdown's image-block node serializes as `![1.00](url "caption")`: it stores
// its resize ratio (toFixed(2)) in the alt slot. That is not alt text, so
// replace it with "" (the figcaption, when present, already describes it).
const MILKDOWN_RATIO = /^\d+\.\d{2}$/;

// "#w=50&align=center" -> {w: 50, align: "center"}; null when the fragment holds
// no recognised option (then src is left exactly as written).
// "w=50,align=center" (the editor writes commas: they need no Markdown escaping;
// "&" and ";" are accepted when written by hand)
function parseOptions(text) {
  const out = {};
  for (const pair of text.split(/[,&;]/)) {
    const i = pair.indexOf("=");
    if (i > 0) out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

const OPTION_FRAGMENT = /#(?=[^#]*\b(?:w|align)=)([^#]*)$/;
function takeOptions(img) {
  const props = img.properties;
  const src = props && props.src;
  if (typeof src !== "string") return null;
  const m = OPTION_FRAGMENT.exec(src);
  if (!m) return null;
  const params = parseOptions(m[1]);
  const options = {};
  const w = /^\d{1,3}$/.test(params.w || "") ? Number(params.w) : 0;
  if (w >= 10 && w <= 100) options.w = w;
  const align = params.align;
  if (align === "left" || align === "center" || align === "right")
    options.align = align;
  if (!options.w && !options.align) return null;
  props.src = src.slice(0, m.index); // the fragment is for the editor/this plugin only
  return options;
}

const MARGINS = {
  left: "margin-left:0;margin-right:auto",
  center: "margin-left:auto;margin-right:auto",
  right: "margin-left:auto;margin-right:0"
};

// width/alignment as a style string; `block` (an <img>) also needs display:block
function optionStyle({w, align}, block) {
  const parts = [];
  if (block) parts.push("display:block");
  if (w) parts.push(`width:${w}%`);
  else if (!block) parts.push("width:fit-content");
  parts.push("max-width:100%");
  if (align) parts.push(MARGINS[align]);
  return parts.join(";");
}

function addStyle(el, style) {
  const props = (el.properties = el.properties || {});
  props.style = props.style ? `${props.style};${style}` : style;
}

function lazy(img) {
  const props = (img.properties = img.properties || {});
  if (typeof props.alt === "string" && MILKDOWN_RATIO.test(props.alt.trim())) {
    props.alt = "";
  }
  if (props.loading == null) props.loading = "lazy";
  if (props.decoding == null) props.decoding = "async";
}

function walk(node, inFigure) {
  if (!node.children) return;
  const here = inFigure || isFigure(node);
  node.children.forEach((child, i) => {
    if (!here && isElement(child, "p")) {
      const found = soleImage(child);
      const title = found && found.img.properties && found.img.properties.title;
      if (found && typeof title === "string" && title.trim()) {
        const options = takeOptions(found.img);
        lazy(found.img);
        delete found.img.properties.title; // becomes the caption, not a tooltip
        node.children[i] = {
          type: "element",
          tagName: "figure",
          properties: options ? {style: optionStyle(options, false)} : {},
          children: [
            found.wrapper,
            {
              type: "element",
              tagName: "figcaption",
              properties: {},
              children: [{type: "text", value: title.trim()}]
            }
          ]
        };
        return; // figure is final; nothing inside needs another pass
      }
    }
    // An uncaptioned picture alone in its paragraph keeps the size/alignment as
    // styles on the <img>; any other image only loses the editor's fragment.
    if (!here && isElement(child, "p")) {
      const found = soleImage(child);
      if (found && !found.img.properties.title) {
        const options = takeOptions(found.img);
        if (options) addStyle(found.img, optionStyle(options, true));
      }
    }
    if (isElement(child, "img")) {
      takeOptions(child);
      lazy(child);
    }
    walk(child, here);
  });
}

export default function rehypeFigure() {
  return tree => {
    walk(tree, false);
  };
}
