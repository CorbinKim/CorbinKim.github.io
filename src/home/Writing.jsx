import React from "react";
import {Link} from "react-router-dom";
import {posts} from "../blog/postRegistry";

/* Renders the site's own .mdx posts (see ../blog/postRegistry.js) inline
   inside the dark card-promo-strip at the bottom of the portfolio (see
   Home.scss .mt-strip). No separate /blog index page — this list IS the
   index; only individual posts get their own route (/blog/:slug). */

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
              <span className="mt-date">{formatDate(p.date)}</span>
              <div>
                <Link to={"/blog/" + p.slug}>{p.title}</Link>
                {p.excerpt && <p className="mt-writing-excerpt">{p.excerpt}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
