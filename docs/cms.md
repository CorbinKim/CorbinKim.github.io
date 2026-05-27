---
layout: page
title: CMS
description: >
  Browser-based writing workflow for this GitHub Pages blog.
hide_description: true
sitemap: false
---

# CMS Writing Workflow

Paper reviews are written directly from this blog's `/admin/` page using Sveltia CMS.
Obsidian is only for private research notes, and Notion is not part of the publishing pipeline.

## Publishing path

1. Open `https://corbinkim.github.io/admin/`.
2. Choose **Sign in with Token**.
3. Create a fine-grained GitHub token for `CorbinKim/CorbinKim.github.io` with repository contents read/write access.
4. Paste the token into the CMS login prompt.
5. Create a document in **Paper Reviews**.
6. Fill in title, date, description, tags, optional hero image, and body.
7. Save from Sveltia CMS. The CMS commits Markdown into `paper/_posts`.
8. GitHub Pages builds the Jekyll site from the committed Markdown.

## Configuration

Sveltia CMS reads `admin/config.yml`. This file defines:

- `paper/_posts` as **Paper Reviews**.
- `_posts` as **Blog Posts**.
- `assets/img/blog/uploads` as the media upload folder.
- Jekyll-compatible YAML front matter and `YYYY-MM-DD-title.md` filenames.

The token is stored in the browser's local storage by Sveltia CMS. Use a fine-grained token limited to this repository, and delete/rotate it from GitHub if it is no longer needed.

## Local check

Run Jekyll without writing into the tracked `_site` directory:

```bash
bundle exec jekyll build --destination /tmp/corbinkim-jekyll-build
```

Or preview locally:

```bash
bundle exec jekyll serve
```
4. Fill in title, date, description, tags, optional hero image, and body.
5. Publish from Decap CMS. The CMS commits Markdown into `paper/_posts`.
6. GitHub Pages builds the Jekyll site from the committed Markdown.

## OAuth setup

GitHub Pages is static hosting, so Decap CMS needs an OAuth proxy for GitHub login.
Use a Cloudflare Worker or equivalent Decap-compatible OAuth service.

After deploying the OAuth proxy, replace this value in `admin/config.yml`:

```yaml
base_url: https://REPLACE_WITH_DECAP_OAUTH_WORKER_URL
```

The GitHub OAuth application callback URL should point to the proxy callback endpoint:

```text
https://<your-worker-domain>/callback
```

## Local check

Run Jekyll without writing into the tracked `_site` directory:

```bash
bundle exec jekyll build --destination /tmp/corbinkim-jekyll-build
```

For local CMS testing:

```bash
npx decap-server
bundle exec jekyll serve
```
