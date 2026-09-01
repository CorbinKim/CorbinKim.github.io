import React from "react";
import "./Home.scss";
import {site, social, researchInterest} from "../data/site";
import {timeline, awards, publications} from "../data/resume";
import {projects} from "../data/projects";
import Writing from "./Writing";

const NAV = [
  {label: "Research", href: "#research"},
  {label: "Timeline", href: "#timeline"},
  {label: "Writing", href: "#writing"},
  {label: "Projects", href: "#projects"},
  {label: "Publications", href: "#publications"}
];

export default function Home() {
  return (
    <main className="mt">
      <div className="mt-banner">
        <span>FALCON · Intelligent Open RAN for UAV-assisted connectivity</span>
        <a href="#research">Explore my research</a>
      </div>

      <nav className="mt-nav">
        <a className="mt-wordmark" href="#top">Corbin Kim</a>
        <div className="mt-tabs">
          {NAV.map(n => (
            <a key={n.href} href={n.href}>{n.label}</a>
          ))}
        </div>
        <a className="mt-btn mt-btn--primary mt-nav-cta" href={"mailto:" + site.email}>
          Contact
        </a>
      </nav>

      <header className="mt-hero" id="top">
        <img className="mt-avatar" src="/profile.png" alt={site.name} />
        <h1 className="mt-name">{site.name}</h1>
        <p className="mt-role">{site.role}</p>
        <p className="mt-tagline">{site.tagline}</p>
        <div className="mt-cta-row">
          <a className="mt-btn mt-btn--primary" href="#research">Research interests</a>
          <a className="mt-btn mt-btn--secondary" href="#projects">See projects</a>
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

      <section className="mt-section" id="research">
        <h2 className="mt-h2">Research</h2>
        <p className="mt-sub">Building intelligent, programmable wireless networks.</p>
        <ul className="mt-cards">
          {researchInterests.map(r => (
            <li key={r.name}>
              <div className="mt-card-head">
                <span className="mt-card-title">{r.name}</span>
              </div>
              <span className="mt-card-desc">{r.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-band--soft">
        <section className="mt-section" id="timeline">
          <h2 className="mt-h2">Timeline</h2>
          <p className="mt-sub">Where the research has taken me.</p>
          <ul className="mt-timeline">
            {timeline.map(t => (
              <li key={t.period + t.title}>
                <div className="mt-period">{t.period}</div>
                {t.logo ? <img className="mt-tl-logo" src={t.logo} alt={t.org} /> : <div className="mt-tl-logo" />}
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

      <section className="mt-section" id="writing">
        <div className="mt-strip"><Writing /></div>
      </section>

      <section className="mt-section" id="projects">
        <h2 className="mt-h2">Projects</h2>
        <ul className="mt-cards">
          {projects.map(p => (
            <li key={p.name}>
              {p.image && <img className="mt-card-img" src={p.image} alt={p.name} />}
              <div className="mt-card-head"><span className="mt-card-title">{p.name}</span></div>
              <span className="mt-card-desc">{p.desc}</span>
              {p.links && p.links.length > 0 && (
                <span className="mt-card-links">
                  {p.links.map(l => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-section" id="publications">
        <h2 className="mt-h2">Publications</h2>
        <ul className="mt-pubs">
          {publications.map(p => (
            <li key={p.title}>
              <div className="mt-pub-head">
                <span className="mt-pub-title">{p.title}</span>
                {p.status && <span className={"mt-badge mt-badge--" + p.statusTone}>{p.status}</span>}
              </div>
              <span className="mt-pub-meta">{p.authors}. <em>{p.venue}</em>{p.year ? ", " + p.year : ""}.</span>
              {p.links && p.links.length > 0 && (
                <span className="mt-pub-links">
                  {p.links.map(l => <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

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

      <footer className="mt-footer">
        <nav>
          {social.map(s => <a key={s.label} href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{s.label}</a>)}
        </nav>
        <small>© {site.name} · NextG Wireless Lab, NC State University</small>
      </footer>
    </main>
  );
}
