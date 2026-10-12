// Live preview: the story as it will look on the site, in an isolated frame.
//
// The frame gets the portfolio's own stylesheets (Home.scss, Blog.scss, KaTeX)
// and the same markup as src/blog/BlogPost.jsx / src/home/Writing.jsx, so what
// you see is what readers get. It is a same-origin <iframe sandbox> WITHOUT
// allow-scripts: nothing in it can run script, while this page can still update
// its DOM (so typing does not reload the frame or lose its scroll position).
// Loaded lazily, with the editor.
import katexCss from "katex/dist/katex.min.css?inline";
import homeCss from "../home/Home.scss?inline";
import blogCss from "../blog/Blog.scss?inline";
import extrasCss from "../blog/Extras.scss?inline";
import indexCss from "../index.css?inline";
import {siteAsset} from "./config.js";
import {h} from "./dom.js";
import {renderBody} from "./markdown.js";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

// Same date handling as the site (a date-only string is a LOCAL date).
function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
const articleDate = iso =>
  parseDate(iso)?.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }) || null;
const cardDate = iso =>
  parseDate(iso)?.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  }) || "";

const badge = text => h("span", {class: "mt-badge mt-badge--neutral"}, text);

function articleView({title, date, tags, body, images, cover}) {
  const bodyEl = h("div", {class: "mt-article-body"});
  // renderBody() output is built from Markdown by rehype (raw HTML dropped);
  // DOMParser does not run scripts, and the frame has scripting disabled.
  const parsed = new DOMParser().parseFromString(renderBody(body), "text/html");
  // Images added to this draft are only blob: URLs in this browser. The site's
  // URL filter (rendering above) drops blob: on purpose, so the story keeps its
  // /img/blog/__draft__/... paths and they are swapped to the local copy here.
  for (const img of parsed.body.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    const local = images?.get(src);
    // published pictures: from the live site when the editor runs elsewhere
    if (local) img.setAttribute("src", local);
    else if (src) img.setAttribute("src", siteAsset(src));
  }
  bodyEl.append(...parsed.body.childNodes);
  const when = articleDate(date);
  return h(
    "main",
    {class: "mt mt-blog"},
    h(
      "article",
      {class: "mt-article"},
      h(
        "header",
        {class: "mt-article-head"},
        when ? badge(when) : null,
        h("h1", null, title || "Untitled story"),
        tags.length ? h("div", {class: "mt-post-tags"}, tags.map(badge)) : null
      ),
      cover
        ? h(
            "figure",
            {class: "mt-article-cover"},
            h("img", {src: images?.get(cover) ?? siteAsset(cover), alt: ""})
          )
        : null,
      bodyEl
    )
  );
}

function cardView({title, date, excerpt, tags, cover, images}) {
  return h(
    "main",
    {class: "mt"},
    h(
      "section",
      {class: "mt-section"},
      h("h2", {class: "mt-h2"}, "Writing"),
      h("p", {class: "mt-sub"}, "Paper reviews and notes on wireless ML."),
      h(
        "ul",
        {class: "mt-writing-list"},
        h(
          "li",
          null,
          h(
            "a",
            {class: "mt-writing-card" + (cover ? " has-cover" : ""), href: "#"},
            cover
              ? h("img", {
                  class: "mt-writing-thumb",
                  src: images?.get(cover) ?? siteAsset(cover),
                  alt: ""
                })
              : null,
            cardDate(date) ? badge(cardDate(date)) : null,
            h("h3", {class: "mt-writing-title"}, title || "Untitled story"),
            excerpt ? h("p", {class: "mt-writing-excerpt"}, excerpt) : null,
            tags.length
              ? h("div", {class: "mt-writing-tags"}, tags.map(badge))
              : null
          )
        )
      )
    )
  );
}

const SRCDOC = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${FONTS}">
<style>${katexCss}</style><style>${indexCss}</style>
<style>${homeCss}</style><style>${blogCss}</style><style>${extrasCss}</style>
<style>a{pointer-events:none}</style>
</head><body><div id="root"></div></body></html>`;

/** @returns {{el: HTMLIFrameElement, update, setTab, syncScroll, destroy}} */
export function createPreview() {
  const frame = h("iframe", {
    class: "preview-frame",
    title: "Preview of the story as it will appear on the site",
    srcdoc: SRCDOC
  });
  // same origin (so this page can update it) but NO allow-scripts
  frame.setAttribute("sandbox", "allow-same-origin");
  let ready = false;
  let tab = "article";
  let state = {
    title: "",
    date: "",
    excerpt: "",
    tags: [],
    cover: "",
    body: "",
    images: new Map()
  };

  function render() {
    if (!ready) return;
    const doc = frame.contentDocument;
    const root = doc?.getElementById("root");
    if (!root) return;
    const scroller = doc.scrollingElement;
    const top = scroller.scrollTop;
    root.replaceChildren(
      tab === "article" ? articleView(state) : cardView(state)
    );
    scroller.scrollTop = top; // typing must not jump the preview
  }

  frame.addEventListener("load", () => {
    ready = true;
    render();
  });

  return {
    el: frame,
    update(next) {
      state = {...state, ...next};
      render();
    },
    setTab(next) {
      tab = next;
      render();
    },
    /** ratio 0..1 of how far the editor page is scrolled */
    syncScroll(ratio) {
      const s = frame.contentDocument?.scrollingElement;
      if (s) s.scrollTop = ratio * (s.scrollHeight - s.clientHeight);
    },
    destroy() {
      frame.remove();
    }
  };
}
