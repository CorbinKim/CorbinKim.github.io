# corbinkim.github.io

Personal portfolio for **Corbin Kim** — incoming Ph.D. student at NextG Lab,
NC State University. A minimal, single-page site (hero, timeline, writing,
projects, publications, awards) live at **https://corbinkim.github.io**.

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) 16
- [Sass](https://sass-lang.com/) for styling
- Deployed to GitHub Pages via GitHub Actions

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> build/
npm run preview    # preview the production build
```

## Editing content

All copy lives in plain data modules — no component edits needed:

- `src/data/site.js` — name, role, tagline, social links, Medium handle
- `src/data/resume.js` — timeline, awards, publications
- `src/data/projects.js` — selected projects

Layout and styles are in `src/home/Home.jsx` and `src/home/Home.scss`. The
**Writing** section (`src/home/Writing.jsx`) lists the posts in
`src/blog/posts/` (see below).

## Writing posts

### The editor: `/admin/`

`https://corbinkim.github.io/admin/` is a Medium-style editor (title, subtitle,
tags, images, code, tables, LaTeX math). Write, press **Publish**, and the page
commits the post and its images to `main` through the GitHub API; the existing
deploy workflow then rebuilds the site (about a minute). There is no server of
its own: the editor is part of the static site.

The page itself is public (a static site cannot hide a page; it is not linked
from the portfolio and is marked `noindex`), **but it can do nothing without
your token**: only your GitHub account can create a token for this repository,
so seeing the sign-in screen is harmless. The editor also refuses to run inside
another site's frame (clickjacking) and has a strict Content-Security-Policy.
It can be used locally too: `npm run dev`, then <http://localhost:5173/admin/>.

If you ever want the sign-in screen itself hidden (only your GitHub account may
even open the page), the editor can be built on its own and hosted behind a
GitHub login: see [docs/editor-hosting.md](docs/editor-hosting.md)
(`npm run build:admin`). This is optional.

One-time setup: create a **fine-grained personal access token** limited to this
repository with **Contents: Read and write** (the sign-in screen links to a
pre-filled form) and paste it. Classic tokens are refused: they reach all of
your repositories. The token is only ever sent to `api.github.com`.

- By default it is kept in the tab's `sessionStorage` and forgotten when the tab
  closes.
- Tick **Keep me signed in on this device** and choose a password of your own
  (10+ characters; not your GitHub password). The token is then stored only as
  AES-256-GCM ciphertext (key from PBKDF2-SHA256, 600,000 iterations) and every
  new tab or restart asks for that password instead of the token. The password
  is never stored. This protects the token at rest; while the editor is unlocked
  the token is in that tab's `sessionStorage`. _Sign out_ locks it again; _Use a
  different token_ on the unlock screen forgets the saved copy.
- Safari clears site data after about a week without a visit, after which you
  paste the token again.

Good to know:

- A **formatting toolbar** above the body replaces Markdown syntax. Beyond text
  styles it has: **Image** (several files at once; you can also paste or drop
  pictures into the text), **Table** (pick rows × columns on a grid), **Callout**
  (note / tip / important / warning / caution boxes), **Toggle** (a collapsible
  block), **Footnote** (numbered automatically, in the order they appear), and
  a **cover image** under the title (shown on the post, on its card and in link
  previews). Earlier items: text style
  (paragraph / headings), bold, italic, strikethrough, inline code, bulleted /
  numbered / checklist, link, **Image** (pick one or several files; they are
  uploaded and inserted), **Table** (hover a grid to pick rows × columns, then
  Tab between cells), inline and block math, code block, quote and divider. The
  `/` menu and the usual shortcuts (⌘B, ⌘I) work as well.
- **Picture size and alignment.** Hover a picture and drag a corner square to
  resize it (a percentage label follows the pointer; it snaps to 33 / 50 / 75 /
  100 % when you get close, and Esc cancels). Click a picture to get the size
  menu (33 / 50 / 75 / 100 %, or the width you dragged) and the left / centre /
  right buttons. Both are stored in the image URL's fragment
  (`/img/blog/x/a.png#w=50,align=center`), so the Markdown stays plain and the
  live preview and the site show the same.
- A **live preview** sits next to the editor (on screens wider than about
  1100 px; below that the _Preview_ button shows it full screen). It renders the
  story with the portfolio's own stylesheets and the same Markdown transforms as
  the site, as the **Article** page and as the **Writing card** in the list, so
  it matches what readers get. Hide or show it with the top-bar button; the
  choice is remembered.
- Drafts autosave in this browser (localStorage + IndexedDB for images);
  nothing is written to the public site until you publish. Safari may clear site
  data after about a week without a visit, so use _Download as Markdown_ for
  anything you want to keep, or turn on **draft sync**: unpublished stories are
  copied to a private repository so you can continue on another device (see
  [docs/draft-sync.md](docs/draft-sync.md)).
- New stories are plain Markdown files (`src/blog/posts/<slug>.md`, images in
  `public/img/blog/<slug>/`). A pasted image becomes a figure with a caption
  when you give it one.
- Existing `.md` posts can be edited visually. A hand-written `.mdx` post opens
  visually too when it is plain Markdown (math, code, tables ... but no JSX
  components, `import`/`export` lines or `{expressions}`) and keeps its `.mdx`
  extension; one that uses those opens in Markdown mode only, with a note
  saying why. An edit that does not touch the text leaves the file's body
  exactly as written.
- _Update_ asks before overwriting a post that changed on GitHub in the
  meantime. Every row of the **Published** list has a **Delete…**
  button (also in the open post's ⋯ menu as _Delete post from the site_): after
  a confirmation it removes the post and its images in one commit (it stays in
  git history, so it can be restored).
- **Change a post's link.** The link (slug) is chosen when a story is first
  published. When you **Update** a post the dialog shows it in an editable field
  (**Use the title for the link** fills it from the current title). Changing it
  moves the post file and its picture folder (`public/img/blog/<slug>/`) in the
  same commit, points the post's picture links at the new folder and records the
  old address in `redirect_from` in the front matter. The build then writes a
  small page at every old address that sends visitors (and, through its
  canonical link, search engines) to the new one, so old links keep working.
  GitHub Pages cannot send real 301 redirects, so this is a page-level redirect.
  Changing the link again keeps every earlier address; going back to an earlier
  one removes it from the list.
- **Hide a post instead of deleting it.** The **Hide from the site** switch under
  the tags (or **Hide…** on a row of the Published list, **Show…** to undo it)
  sets `draft: true` in the post's front matter: the site then leaves it out of
  the Writing list, its own page, the feed, the sitemap and search. Hiding from
  the list changes that one line only, so showing the post again gives back the
  exact original file. A new story can be published hidden too. This is not a
  privacy setting: the text stays in the public repository (and in the site's
  JavaScript), so keep anything secret out of it.

### What the site adds around a post

The build (`tools/site-feeds.js`) writes, besides the app: a real page for every
post at `blog/<slug>/` with its own title, description and Open Graph /
Twitter tags (so Slack, KakaoTalk, iMessage and X show a proper preview with the
cover image), `feed.xml` (RSS, full text for Markdown posts), `sitemap.xml` and
`search-index.json` for the **search box** in the Writing section (matches
titles, excerpts, tags and the text itself).

**Comments** are off by default. To turn them on (giscus, stored as GitHub
Discussions of this repository): enable Discussions in the repo settings,
install <https://github.com/apps/giscus>, copy the four values from
<https://giscus.app>, and set `comments` in `src/data/site.js`. Note that
giscus' script then runs on your post pages, on the same origin as the editor;
if you enable comments, consider hosting the editor separately
([docs/editor-hosting.md](docs/editor-hosting.md)).

### Or by hand

Add `src/blog/posts/<slug>.md` (plain Markdown) or `.mdx` (may use JSX) with
this frontmatter, commit, and push:

```yaml
---
title: "My post"
date: "2026-10-11"
excerpt: "One line shown in the Writing list."
tags: ["Notes"]
cover: "/img/blog/my-post/cover.png" # optional
---
```

`$inline$` and `$$display$$` math render with KaTeX. A post with `draft: true`
is hidden from the list and the `/blog/:slug` route, but it is still compiled
into the public bundle and visible in the public repo: it is not private.

### Developing the editor

```bash
npm test                         # unit tests (node:test)
node test/mock-github-server.js 8787   # local mock of the GitHub API
VITE_ADMIN_API_BASE=http://127.0.0.1:8787 npm run dev   # point /admin/ at it
```

`VITE_ADMIN_API_BASE` only works under `npm run dev`; production builds always
talk to `api.github.com`. The editor lives in `src/admin/` and is a separate
Vite entry (`admin/index.html`), so none of it is in the portfolio's own
JavaScript bundle.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
site and publishes `build/` to GitHub Pages. Repo **Settings → Pages → Source**
must be set to **GitHub Actions**.
