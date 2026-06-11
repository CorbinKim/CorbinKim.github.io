import React from "react";
import "./Home.scss";
import {site, social} from "../data/site";
import {timeline, awards, publications} from "../data/resume";
import {projects} from "../data/projects";
import Writing from "./Writing";

const NAV = [
  {label: "Timeline", href: "#timeline"},
  {label: "Writing", href: "#writing"},
  {label: "Projects", href: "#projects"},
  {label: "Publications", href: "#publications"},
  {label: "Awards", href: "#awards"}
];

export default function Home() {
  return (
    <main className="mt">
      {/* promo-banner: one-line announcement strip ABOVE the nav */}
      <div className="mt-banner">
        <span>TelcoAgent — under review at IEEE GLOBECOM 2026</span>
        <a href="#publications">See publications</a>
      </div>

      {/* sticky top nav: wordmark + pill-tab anchors + contact pill */}
      <nav className="mt-nav">
        <a className="mt-wordmark" href="#top">
          Corbin Kim
        </a>
        <div className="mt-tabs">
          {NAV.map(n => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </div>
        <a
          className="mt-btn mt-btn--primary mt-nav-cta"
          href={`mailto:${site.email}`}
        >
          Contact
        </a>
      </nav>

      {/* Hero — dual-CTA pattern: black pill primary + outlined secondary */}
      <header className="mt-hero" id="top">
        <img className="mt-avatar" src="/profile.png" alt={site.name} />
        <h1 className="mt-name">{site.name}</h1>
        <p className="mt-role">{site.role}</p>
        <p className="mt-tagline">{site.tagline}</p>
        <div className="mt-cta-row">
          <a className="mt-btn mt-btn--primary" href="#writing">
            Read my writing
          </a>
          <a className="mt-btn mt-btn--secondary" href="#projects">
            See projects
          </a>
        </div>
        <nav className="mt-social">
          {social.map(s => (
            <a
              key={s.label}
              className="mt-btn mt-btn--ghost"
              href={s.href}
              target={s.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      {/* Timeline — full-bleed soft band for alternating surface rhythm */}
      <div className="mt-band--soft">
        <section className="mt-section" id="timeline">
          <h2 className="mt-h2">Timeline</h2>
          <p className="mt-sub">Where the research has taken me.</p>
          <ul className="mt-timeline">
            {timeline.map(t => (
              <li key={t.period + t.title}>
                <div className="mt-period">{t.period}</div>
                {t.logo ? (
                  <img className="mt-tl-logo" src={t.logo} alt={t.org} />
                ) : (
                  <div className="mt-tl-logo" />
                )}
                <div className="mt-entry">
                  <span className="mt-entry-title">{t.title}</span>
                  <span className="mt-entry-org">{t.org}</span>
                  {t.note && <p className="mt-entry-note">{t.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Writing — dark card-promo-strip, the page's visual pulse */}
      <section className="mt-section" id="writing">
        <div className="mt-strip">
          <Writing />
        </div>
      </section>

      {/* Projects — showcase cards with status badges */}
      <section className="mt-section" id="projects">
        <h2 className="mt-h2">Projects</h2>
        <ul className="mt-cards">
          {projects.map(p => (
            <li key={p.name}>
              {p.image && (
                <img className="mt-card-img" src={p.image} alt={p.name} />
              )}
              <div className="mt-card-head">
                <span className="mt-card-title">{p.name}</span>
                {p.badge && (
                  <span className={`mt-badge mt-badge--${p.badgeTone}`}>
                    {p.badge}
                  </span>
                )}
              </div>
              <span className="mt-card-desc">{p.desc}</span>
              {p.links && p.links.length > 0 && (
                <span className="mt-card-links">
                  {p.links.map(l => (
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

      {/* Publications — hairline rows with status badges */}
      <section className="mt-section" id="publications">
        <h2 className="mt-h2">Publications</h2>
        <ul className="mt-pubs">
          {publications.map(p => (
            <li key={p.title}>
              <div className="mt-pub-head">
                <span className="mt-pub-title">{p.title}</span>
                {p.status && (
                  <span className={`mt-badge mt-badge--${p.statusTone}`}>
                    {p.status}
                  </span>
                )}
              </div>
              <span className="mt-pub-meta">
                {p.authors}. <em>{p.venue}</em>
                {p.year ? `, ${p.year}` : ""}.
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Awards — why-buy-tile grid with yellow promo badges, soft band */}
      <div className="mt-band--soft">
        <section className="mt-section" id="awards">
          <h2 className="mt-h2">Awards</h2>
          <ul className="mt-tiles">
            {awards.map(a => (
              <li key={a.title + a.date}>
                <span className="mt-badge mt-badge--yellow">{a.date}</span>
                <span className="mt-tile-title">{a.title}</span>
                <span className="mt-tile-desc">{a.awarder}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Footer — footer-region */}
      <footer className="mt-footer">
        <nav>
          {social.map(s => (
            <a
              key={s.label}
              href={s.href}
              target={s.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <small>© {site.name} · NextG Wireless Lab, NC State University</small>
      </footer>
    </main>
  );
}
