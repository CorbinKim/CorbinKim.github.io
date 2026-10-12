# Optional: hosting the editor behind a GitHub login

By default the editor is served from the public site at
`https://corbinkim.github.io/admin/`. That page is harmless without your
fine-grained token (see the README), but anyone who guesses the address can see
the sign-in screen. **If you want even that hidden**, build the editor on its
own and host it where a login stands in front of it. A static GitHub Pages site
cannot hide a page, so this uses Cloudflare Pages + Cloudflare Access (free):

```
corbinkim.github.io          public portfolio + blog (+ the /admin/ page, which you
                             can leave in place or remove)   (GitHub Pages)
<project>.pages.dev          the editor, only your GitHub account gets in
                                                              (Cloudflare Pages + Access)
              └─ the editor still needs your fine-grained GitHub token to publish
```

Two locks: **Access** (your GitHub account) in front of the page, and the
**fine-grained token** (one repository, Contents: write) behind the Publish
button. Publishing still commits to this repository through the GitHub API, so
the portfolio is rebuilt by the existing GitHub Pages workflow. As a bonus the
token now lives on a different origin than the portfolio, so scripts on the
portfolio can never read it.

`npm run dev` serves the editor locally at `http://localhost:5173/admin/` and
needs none of the setup below.

**To remove the public copy** once the hosted one works, delete the `admin:` line
from `build.rollupOptions.input` (and the `adminCspMeta` plugin) in
`vite.config.js`; the next GitHub Pages deploy then no longer contains
`/admin/`.

## What the repository provides

| Command | Output |
| --- | --- |
| `npm run build` | `build/` the public site (including the `/admin/` page) |
| `npm run build:admin` | `build-admin/` the editor only, plus `_headers` (CSP, no framing, no referrer, noindex), `_redirects` (`/` to `/admin/`), `robots.txt` |
| `npm run preview:admin` | serve `build-admin/` locally |

Pictures of already published posts exist only on the live site, so the hosted
editor loads them from `https://corbinkim.github.io/img/...` (display only; the
post text keeps its `/img/...` paths). That origin is allowed in the editor's
`img-src`, the editor's only other contacts are `api.github.com` and Google
Fonts (same as the portfolio).

## One-time setup

The steps below follow Cloudflare's documentation as of October 2026
([GitHub login method][idp], [Pages `_headers`][hdr], [Pages and Access][pa]).
Dashboard labels move around; if something differs, the linked page is right.

### 1. Cloudflare Pages project (the editor)

1. Create a free Cloudflare account. In the dashboard open **Workers & Pages →
   Create → Pages → Connect to Git** and pick this repository. When GitHub asks
   which repositories the Cloudflare app may read, choose **only this one**.
2. Build settings:
   - **Production branch:** `main`
   - **Build command:** `npm ci && npm run build:admin`
   - **Build output directory:** `build-admin`
   - **Root directory:** leave empty
   - **Environment variable (optional):** `NODE_VERSION` = `22.16.0`
     (Pages' build image already defaults to Node 22.16.0; Vite 8 needs 20.19+.)
3. Pick a project name that is not guessable, for example `cb-write-7k2q`: the
   address will be `https://<project>.pages.dev`. (This is not security, only
   less noise; Access in step 3 is the lock.)
4. Optional, saves builds: under **Settings → Build → Build watch paths** set
   *Include* to the paths that change the editor, so a publish (which only
   touches `src/blog/posts/*` and `public/img/*`) does not rebuild it:
   `admin/*`, `src/admin/*`, `src/home/*`, `src/blog/Blog.scss`, `src/index.css`,
   `plugins/*`, `vite.admin.config.js`, `package.json`, `package-lock.json`.

Do not open the new address yet: it is public until step 3.

### 2. GitHub as the login method

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth app**.
   - **Application name:** anything (users see it on the login page)
   - **Homepage URL:** `https://<your-team-name>.cloudflareaccess.com`
   - **Authorization callback URL:**
     `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`

   Your team name is in the Cloudflare dashboard under **Zero Trust → Settings →
   Team name and domain** (Zero Trust asks you to choose it the first time; its
   free plan covers up to 50 users, and Cloudflare may ask for a payment method
   on file even though nothing is charged, check the sign-up screen).
2. Register the app, copy the **Client ID**, generate a **client secret**.
3. Cloudflare → **Zero Trust → Integrations → Identity providers → Add new
   identity provider → GitHub**. Paste the Client ID (*App ID*) and the secret,
   **Save**, then **Finish setup** and authorize read-only access to your email
   addresses. Use **Test** next to GitHub to confirm it works (if GitHub has
   two-factor authentication on, log in to GitHub first).

### 3. Put Access in front of the editor

Cloudflare's own steps for protecting a `*.pages.dev` address:

1. **Workers & Pages →** your project **→ Settings → Enable access policy**
   (this protects the preview deployments and creates an Access application).
2. Select **Manage** on that policy. Under **Access controls → Applications**
   open your project's application, **Configure**. Under **Public hostname**,
   delete the wildcard `*` in the **Subdomain** field and **Save** (you may need
   to change the *Application name* to avoid an error). Go back to the project's
   **Settings → General** and select **Enable access policy** again.
3. Confirm that two Access applications exist: one for `<project>.pages.dev`
   (production) and one for the previews, `*.<project>.pages.dev`.
4. Edit the production application's **Allow** policy so that it includes only
   **your email address** (the primary email of your GitHub account; Access
   receives it from GitHub). Access applications deny everyone who does not
   match an Allow policy.
5. In the application's login settings select **only GitHub** (clear the other
   methods), turn on **Apply instant authentication** (skips the Cloudflare
   page and goes straight to GitHub), and leave **Authenticate with Cloudflare
   One Client** off.
6. Do the same email rule for the preview application, since preview addresses
   (`<hash>.<project>.pages.dev`) serve the same editor.

### 4. Check it

- Open `https://<project>.pages.dev/` in a **private window**: you must be sent
  to GitHub, and after signing in you land in the editor (`/admin/`).
- Try it with another GitHub account (or ask a friend): it must say you are not
  allowed.
- Open a preview address (`https://<some-hash>.<project>.pages.dev/`, shown in
  the project's deployments): it must be protected too.
- Then create the fine-grained token (see the README) and Publish a throwaway
  post once.

## Day to day

- Open `https://<project>.pages.dev/`, sign in with GitHub (usually one click),
  unlock with your password, write, Publish.
- The token is a 90-day token: when it expires GitHub says so and the editor
  asks for a new one. To lock someone out instantly, revoke the token on GitHub
  (**Settings → Developer settings → Fine-grained tokens**).
- A change to the editor's code redeploys the editor on the next push to `main`.
  A published post does not (build watch paths, step 1.4).
- The public `https://corbinkim.github.io/admin/` keeps working until you remove
  it (see the top of this page).

## Limits

- Access protects the **page**. Anyone who obtains your token could still call the
  GitHub API directly, which is why it is limited to one repository and expires.
- A signed-in browser session on your computer can use the editor: lock it with
  **Sign out** on shared machines.
- Cloudflare Access sessions last as long as the application's session duration
  (default 24 hours); shorten it in the application settings if you want.

[idp]: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/github/
[hdr]: https://developers.cloudflare.com/pages/configuration/headers/
[pa]: https://developers.cloudflare.com/pages/platform/known-issues/
