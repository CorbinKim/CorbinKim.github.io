import React from "react";
import "./Home.scss";
import {site, social} from "../data/site";
import {basics, timeline, awards, publications} from "../data/resume";
import {projects} from "../data/projects";
import Writing from "./Writing";

export default function Home() {
  return (
    <main className="kp">
      {/* Header */}
      <header className="kp-header">
        <img
          className="kp-avatar"
          src={process.env.PUBLIC_URL + "/profile.png"}
          alt={site.name}
        />
        <h1>{site.name}</h1>
        <p className="kp-role">{site.role}</p>
        <p className="kp-tagline">{site.tagline}</p>
        <nav className="kp-social">
          {social.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <span className="kp-dot">·</span>}
              <a
                href={s.href}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {s.label}
              </a>
            </React.Fragment>
          ))}
        </nav>
      </header>

      <hr />

      {/* Bio */}
      <section className="kp-section">
        <p className="kp-bio">{basics.summary}</p>
      </section>

      <hr />

      {/* Timeline */}
      <section className="kp-section" id="timeline">
        <h2>Timeline</h2>
        <ul className="kp-timeline">
          {timeline.map((t) => (
            <li key={t.period + t.title}>
              <div className="kp-period">{t.period}</div>
              <div className="kp-entry">
                <span className="kp-entry-title">{t.title}</span>
                <span className="kp-entry-org">{t.org}</span>
                {t.note && <span className="kp-entry-note">{t.note}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <hr />

      {/* Writing — live Medium feed */}
      <Writing />

      <hr />

      {/* Projects */}
      <section className="kp-section" id="projects">
        <h2>Projects</h2>
        <ul className="kp-blocks">
          {projects.map((p) => (
            <li key={p.name}>
              <span className="kp-block-title">{p.name}</span>
              <span className="kp-block-desc">{p.desc}</span>
              {p.links && p.links.length > 0 && (
                <span className="kp-block-links">
                  {p.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {l.label}
                    </a>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <hr />

      {/* Publications */}
      <section className="kp-section" id="publications">
        <h2>Publications</h2>
        <ul className="kp-list">
          {publications.map((p) => (
            <li key={p.title}>
              <span className="kp-pub-title">{p.title}</span>
              <span className="kp-pub-meta">
                {p.authors}. <em>{p.venue}</em>
                {p.year ? `, ${p.year}` : ""}.
              </span>
            </li>
          ))}
        </ul>
      </section>

      <hr />

      {/* Awards */}
      <section className="kp-section" id="awards">
        <h2>Awards</h2>
        <ul className="kp-list">
          {awards.map((a) => (
            <li key={a.title + a.date}>
              <span className="kp-date">{a.date}</span>
              <span>
                <strong>{a.title}</strong> — {a.awarder}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="kp-footer">
        <a href={`mailto:${site.email}`}>{site.email}</a>
      </footer>
    </main>
  );
}
