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
**Writing** section (`src/home/Writing.jsx`) live-fetches the latest Medium
posts for the handle set in `site.js`.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
site and publishes `build/` to GitHub Pages. Repo **Settings → Pages → Source**
must be set to **GitHub Actions**.
