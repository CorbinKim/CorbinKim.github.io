import React from "react";
import {Link} from "react-router-dom";
import "./Blog.scss";
import {site} from "../data/site";
import {posts} from "./postRegistry";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default function BlogList() {
  return (
    <main className="mt mt-blog">
      <nav className="mt-nav">
        <Link className="mt-wordmark" to="/">{site.name}</Link>
        <div className="mt-tabs">
          <Link to="/">Portfolio</Link>
        </div>
      </nav>

      <section className="mt-section mt-blog-list">
        <h1 className="mt-h2">Blog</h1>
        <p className="mt-sub">Paper reviews and notes on wireless ML.</p>

        {posts.length === 0 && (
          <p className="mt-muted">No posts yet — check back soon.</p>
        )}

        <ul className="mt-post-list">
          {posts.map(p => (
            <li key={p.slug}>
              <Link className="mt-post-card" to={"/blog/" + p.slug}>
                {p.date && <span className="mt-badge mt-badge--neutral">{formatDate(p.date)}</span>}
                <h2 className="mt-post-title">{p.title}</h2>
                {p.excerpt && <p className="mt-post-excerpt">{p.excerpt}</p>}
                {p.tags.length > 0 && (
                  <span className="mt-post-tags">
                    {p.tags.map(t => <span key={t} className="mt-badge mt-badge--neutral">{t}</span>)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-footer">
        <small>© {site.name} · NextG Wireless Lab, NC State University</small>
      </footer>
    </main>
  );
}
