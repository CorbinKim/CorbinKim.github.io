import React, {useEffect, useState} from "react";
import {mediumUsername} from "../data/site";

/* Live-fetches the latest Medium posts via the public rss2json bridge.
   Falls back to a "Read on Medium" link if the feed is empty or unreachable. */

const FEED = `https://medium.com/feed/@${mediumUsername}`;
const ENDPOINT = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
  FEED
)}`;
const MAX_POSTS = 6;

function formatDate(pubDate) {
  // rss2json returns "YYYY-MM-DD HH:MM:SS" (UTC). Render as "Mon YYYY".
  const d = new Date(pubDate.replace(" ", "T") + "Z");
  if (isNaN(d)) return "";
  return d.toLocaleDateString("en-US", {month: "short", year: "numeric"});
}

export default function Writing() {
  const [posts, setPosts] = useState([]);
  const [state, setState] = useState("loading"); // loading | ok | empty | error

  useEffect(() => {
    let alive = true;
    fetch(ENDPOINT)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data.status !== "ok" || !Array.isArray(data.items)) {
          setState("error");
          return;
        }
        const items = data.items.slice(0, MAX_POSTS);
        setPosts(items);
        setState(items.length ? "ok" : "empty");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, []);

  const profileUrl = `https://medium.com/@${mediumUsername}`;

  return (
    <section className="kp-section" id="writing">
      <h2>Writing</h2>
      {state === "loading" && <p className="kp-muted">Loading latest posts…</p>}

      {state === "ok" && (
        <ul className="kp-list">
          {posts.map((p) => (
            <li key={p.guid || p.link}>
              <span className="kp-date">{formatDate(p.pubDate)}</span>
              <a href={p.link} target="_blank" rel="noopener noreferrer">
                {p.title}
              </a>
            </li>
          ))}
        </ul>
      )}

      {(state === "empty" || state === "error") && (
        <p className="kp-muted">
          {state === "error"
            ? "Couldn't load the feed right now — "
            : "Posts coming soon — "}
          read on{" "}
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            Medium
          </a>
          .
        </p>
      )}

      {state === "ok" && (
        <p className="kp-more">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            All posts on Medium →
          </a>
        </p>
      )}
    </section>
  );
}
