import React, {useEffect, useMemo, useState} from "react";
import {Link} from "react-router-dom";
import {posts} from "../blog/postRegistry";
import "../blog/Extras.scss";

/* Renders the site's own .mdx posts (see ../blog/postRegistry.js) inline
   on the portfolio, one hairline-bordered card per post so posts read as
   distinct entries (see Home.scss .mt-writing-card). No separate /blog
   index page — this list IS the index; only individual posts get their
   own route (/blog/:slug). */

function formatDate(iso) {
  if (!iso) return "";
  // date-only strings are UTC midnight: parse them as local dates (see BlogPost)
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  });
}

// Search: title, excerpt and tags match at once; the full text comes from
// /search-index.json (written at build time, fetched the first time you type).
function useSearch() {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(null);

  useEffect(() => {
    if (!query.trim() || index) return undefined;
    let cancelled = false;
    fetch("/search-index.json")
      .then(r => (r.ok ? r.json() : []))
      .then(data => !cancelled && setIndex(Array.isArray(data) ? data : []))
      .catch(() => !cancelled && setIndex([])); // e.g. `vite dev`: no index
    return () => {
      cancelled = true;
    };
  }, [query, index]);

  const text = useMemo(
    () =>
      Object.fromEntries(
        (index || []).map(i => [i.slug, i.text.toLowerCase()])
      ),
    [index]
  );
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = terms.length
    ? posts.filter(p => {
        const head = `${p.title} ${p.excerpt} ${p.tags.join(
          " "
        )}`.toLowerCase();
        return terms.every(
          t => head.includes(t) || (text[p.slug] || "").includes(t)
        );
      })
    : posts;
  return {query, setQuery, shown, searching: terms.length > 0};
}

export default function Writing() {
  const {query, setQuery, shown, searching} = useSearch();
  return (
    <>
      <h2 className="mt-h2">Writing</h2>
      <p className="mt-sub">Paper reviews and notes on wireless ML.</p>

      {posts.length === 0 && (
        <p className="mt-muted">No posts yet — check back soon.</p>
      )}

      {posts.length >= 2 && (
        <div className="mt-writing-search">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search writing"
            aria-label="Search writing"
          />
          {searching && (
            <span className="mt-writing-count" role="status">
              {shown.length} of {posts.length}
            </span>
          )}
        </div>
      )}

      {searching && shown.length === 0 && (
        <p className="mt-muted">No posts match “{query.trim()}”.</p>
      )}

      {shown.length > 0 && (
        <ul className="mt-writing-list">
          {shown.map(p => (
            <li key={p.slug}>
              <Link
                className={"mt-writing-card" + (p.cover ? " has-cover" : "")}
                to={"/blog/" + p.slug}
              >
                {p.cover && (
                  <img
                    className="mt-writing-thumb"
                    src={p.cover}
                    alt=""
                    loading="lazy"
                  />
                )}
                {p.date && (
                  <span className="mt-badge mt-badge--neutral">
                    {formatDate(p.date)}
                  </span>
                )}
                <h3 className="mt-writing-title">{p.title}</h3>
                {p.excerpt && <p className="mt-writing-excerpt">{p.excerpt}</p>}
                {p.tags.length > 0 && (
                  <div className="mt-writing-tags">
                    {p.tags.map(t => (
                      <span key={t} className="mt-badge mt-badge--neutral">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
