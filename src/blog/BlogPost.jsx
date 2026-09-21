import React from "react";
import {Link, useParams} from "react-router-dom";
import "./Blog.scss";
import {site} from "../data/site";
import {getPost} from "./postRegistry";

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export default function BlogPost() {
  const {slug} = useParams();
  const post = getPost(slug);

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

        <div className="mt-article-body">
          <Component />
        </div>
      </article>

      <footer className="mt-footer">
        <small>© {site.name} · NextG Wireless Lab, NC State University</small>
      </footer>
    </main>
  );
}
