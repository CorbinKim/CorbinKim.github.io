import React from "react";
import {Link} from "react-router-dom";
import {posts} from "../blog/postRegistry";

/* Renders the site's own .mdx posts (see ../blog/postRegistry.js) inline
   on the portfolio, one hairline-bordered card per post so posts read as
   distinct entries (see Home.scss .mt-writing-card). No separate /blog
   index page — this list IS the index; only individual posts get their
   own route (/blog/:slug). */

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {month: "short", year: "numeric"});
}

export default function Writing() {
  return (
    <>
      <h2 className="mt-h2">Writing</h2>
      <p className="mt-sub">Paper reviews and notes on wireless ML.</p>

      {posts.length === 0 && (
        <p className="mt-muted">No posts yet — check back soon.</p>
      )}

      {posts.length > 0 && (
        <ul className="mt-writing-list">
          {posts.map(p => (
            <li key={p.slug}>
              <Link className="mt-writing-card" to={"/blog/" + p.slug}>
                {p.date && <span className="mt-badge mt-badge--neutral">{formatDate(p.date)}</span>}
                <h3 className="mt-writing-title">{p.title}</h3>
                {p.excerpt && <p className="mt-writing-excerpt">{p.excerpt}</p>}
                {p.tags.length > 0 && (
                  <div className="mt-writing-tags">
                    {p.tags.map(t => <span key={t} className="mt-badge mt-badge--neutral">{t}</span>)}
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
