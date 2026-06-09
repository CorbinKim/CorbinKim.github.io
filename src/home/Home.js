import React from "react";
import "./Home.scss";
import {site, social} from "../data/site";
import {timeline, awards, publications} from "../data/resume";
import {projects} from "../data/projects";
import Writing from "./Writing";

export default function Home() {
  return (
    <main className="ap">
      {/* Hero */}
      <header className="ap-hero">
        <img
          className="ap-avatar"
          src={process.env.PUBLIC_URL + "/profile.png"}
          alt={site.name}
        />
        <h1 className="ap-name">{site.name}</h1>
        <p className="ap-role">{site.role}</p>
        <p className="ap-tagline">{site.tagline}</p>
        <nav className="ap-social">
          {social.map((s, i) => (
            <a
              key={s.label}
              className={i === 0 ? "is-primary" : "is-ghost"}
              href={s.href}
              target={s.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      {/* Timeline — karpathy-style entries with logos (replaces the bio) */}
      <section className="ap-band ap-band--parchment" id="timeline">
        <div className="ap-wrap">
          <h2 className="ap-h2">Timeline</h2>
          <ul className="ap-timeline">
            {timeline.map((t) => (
              <li key={t.period + t.title}>
                <div className="ap-period">{t.period}</div>
                {t.logo ? (
                  <img className="ap-tl-logo" src={t.logo} alt={t.org} />
                ) : (
                  <div className="ap-tl-logo" />
                )}
                <div className="ap-entry">
                  <span className="ap-entry-title">{t.title}</span>
                  <span className="ap-entry-org">{t.org}</span>
                  {t.note && <p className="ap-entry-note">{t.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Writing — near-black accent band (the Apple "pulse") */}
      <section className="ap-band ap-band--dark" id="writing">
        <div className="ap-wrap">
          <Writing />
        </div>
      </section>

      {/* Projects — parchment, utility cards */}
      <section className="ap-band ap-band--parchment" id="projects">
        <div className="ap-wrap">
          <h2 className="ap-h2">Projects</h2>
          <ul className="ap-cards">
            {projects.map((p) => (
              <li key={p.name}>
                <span className="ap-card-title">{p.name}</span>
                <span className="ap-card-desc">{p.desc}</span>
                {p.links && p.links.length > 0 && (
                  <span className="ap-card-links">
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
        </div>
      </section>

      {/* Publications — white */}
      <section className="ap-band" id="publications">
        <div className="ap-wrap">
          <h2 className="ap-h2">Publications</h2>
          <ul className="ap-list">
            {publications.map((p) => (
              <li key={p.title}>
                <span className="ap-pub-title">{p.title}</span>
                <span className="ap-pub-meta">
                  {p.authors}. <em>{p.venue}</em>
                  {p.year ? `, ${p.year}` : ""}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Awards — parchment */}
      <section className="ap-band ap-band--parchment" id="awards">
        <div className="ap-wrap">
          <h2 className="ap-h2">Awards</h2>
          <ul className="ap-list">
            {awards.map((a) => (
              <li key={a.title + a.date} className="ap-award">
                <span className="ap-date">{a.date}</span>
                <span>
                  <strong>{a.title}</strong> — {a.awarder}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="ap-footer">
        <a href={`mailto:${site.email}`}>{site.email}</a>
      </footer>
    </main>
  );
}
