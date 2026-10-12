import React, {useEffect} from "react";
import {Link, useParams} from "react-router-dom";
import "./Blog.scss";
import "./Extras.scss";
import {site} from "../data/site";
import Comments from "./Comments";
import {getPost} from "./postRegistry";

function formatDate(iso) {
  if (!iso) return null;
  // "2026-09-21" alone is parsed as UTC midnight, which is the previous evening
  // in US time zones: read a date-only string as a local date instead.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export default function BlogPost() {
  const {slug} = useParams();
  const post = getPost(slug);

  // tab title / history entry: the story's own title (the static page for this
  // URL already carries it for crawlers, see tools/site-feeds.js)
  useEffect(() => {
    if (!post) return undefined;
    const before = document.title;
    document.title = `${post.title} | ${site.name}`;
    return () => {
      document.title = before;
    };
  }, [post]);

  if (!post) {
    return (
      <main className="mt mt-blog">
        <nav className="mt-nav">
          <Link className="mt-wordmark" to="/">
            {site.name}
          </Link>
          <Link className="mt-nav-back" to="/#writing">
            ← Back
          </Link>
        </nav>
        <section className="mt-section">
          <h1 className="mt-h2">Post not found</h1>
          <p className="mt-sub">
            <Link to="/#writing">Back to Writing</Link>
          </p>
        </section>
      </main>
    );
  }

  const {Component} = post;

  return (
    <main className="mt mt-blog">
      <nav className="mt-nav">
        <Link className="mt-wordmark" to="/">
          {site.name}
        </Link>
        <Link className="mt-nav-back" to="/#writing">
          ← Back
        </Link>
      </nav>

      <article className="mt-article">
        <header className="mt-article-head">
          {post.date && (
            <span className="mt-badge mt-badge--neutral">
              {formatDate(post.date)}
            </span>
          )}
          <h1>{post.title}</h1>
          {post.tags.length > 0 && (
            <div className="mt-post-tags">
              {post.tags.map(t => (
                <span key={t} className="mt-badge mt-badge--neutral">
                  {t}
                </span>
              ))}
            </div>
          )}
        </header>

        {post.cover && (
          <figure className="mt-article-cover">
            <img src={post.cover} alt="" />
          </figure>
        )}

        <div className="mt-article-body">
          <Component />
        </div>
      </article>

      <Comments slug={post.slug} />

      <footer className="mt-footer">
        <small>© {site.name} · NextG Wireless Lab, NC State University</small>
      </footer>
    </main>
  );
}
