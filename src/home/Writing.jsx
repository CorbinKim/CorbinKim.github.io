import React, {useEffect, useState} from "react";
import {mediumUsername} from "../data/site";

/* Live-fetches the latest Medium posts via the public rss2json bridge.
   Falls back to a "Read on Medium" link if the feed is empty or unreachable.
   Rendered inside the near-black Writing band (see Home.scss .ap-band--dark). */

const FEED = `https://medium.com/feed/@${mediumUsername}`;
const ENDPOINT = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
  FEED
)}`;
const MAX_POSTS = 6;

function formatDate(pubDate) {
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
      .then(r => r.json())
      .then(data => {
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
    <>
      <h2 className="ap-h2">Writing</h2>

      {state === "loading" && <p className="ap-muted">Loading latest posts…</p>}

      {state === "ok" && (
        <ul className="ap-writing-list">
          {posts.map(p => (
            <li key={p.guid || p.link}>
              <span className="ap-date">{formatDate(p.pubDate)}</span>
              <a href={p.link} target="_blank" rel="noopener noreferrer">
                {p.title}
              </a>
            </li>
          ))}
        </ul>
      )}

      {(state === "empty" || state === "error") && (
        <p className="ap-muted">
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
        <p className="ap-more">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            All posts on Medium →
          </a>
        </p>
      )}
    </>
  );
}
