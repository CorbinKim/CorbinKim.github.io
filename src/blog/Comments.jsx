import React, {useEffect, useRef} from "react";
import {comments} from "../data/site";

/* giscus (GitHub Discussions) under a post; renders nothing until `comments` is
   configured in src/data/site.js. One thread per post path. */
export default function Comments({slug}) {
  const host = useRef(null);

  useEffect(() => {
    const el = host.current;
    if (!comments || !el) return undefined;
    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    const attrs = {
      repo: comments.repo,
      "repo-id": comments.repoId,
      category: comments.category,
      "category-id": comments.categoryId,
      mapping: "pathname",
      strict: "1",
      "reactions-enabled": "1",
      "emit-metadata": "0",
      "input-position": "bottom",
      theme: "light",
      lang: "en",
      loading: "lazy"
    };
    for (const [k, v] of Object.entries(attrs))
      script.setAttribute("data-" + k, v);
    el.appendChild(script);
    return () => {
      while (el.firstChild) el.removeChild(el.firstChild);
    };
  }, [slug]);

  if (!comments) return null;
  return (
    <section className="mt-comments" aria-label="Comments">
      <div ref={host} />
    </section>
  );
}
