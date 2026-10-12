/* Site-wide identity and social links. */

export const site = {
  name: "Corbin Kim",
  role: "Wireless Communications Researcher · NC State University",
  tagline:
    "AI-native RAN intelligence for aerial and terrestrial wireless connectivity",
  email: "gkim26@ncsu.edu",
  url: "https://corbinkim.github.io"
};

// Comments under each post (optional). Uses giscus, which stores them as GitHub
// Discussions of this repository. Leave `null` to show no comments. To turn them
// on: enable Discussions in the repo settings, install https://github.com/apps/giscus
// on the repo, then fill in the four values that https://giscus.app shows you.
// Note: giscus' script then runs on every post page, on the same origin as the
// editor (see docs/editor-hosting.md for hosting the editor elsewhere).
export const comments = null;
// export const comments = {repo: "CorbinKim/CorbinKim.github.io", repoId: "...", category: "Comments", categoryId: "..."};

export const researchInterests = [
  {
    name: "Open RAN and RICs",
    desc: "Designing intelligent controllers for programmable and adaptable radio access networks."
  },
  {
    name: "Agentic AI for RAN",
    desc: "Building LLM-driven agents that reason over network state and automate RAN operations and decision-making."
  },
  {
    name: "Digital Twins",
    desc: "Integrating digital twins to model, evaluate, and improve wireless network decisions."
  },
  {
    name: "UAV-Assisted Connectivity",
    desc: "Exploring intelligent wireless connectivity for aerial and rapidly changing network environments."
  }
];

export const social = [
  {label: "GitHub", href: "https://github.com/CorbinKim"},
  {label: "LinkedIn", href: "https://www.linkedin.com/in/corbinkim/"},
  {label: "Email", href: "mailto:gkim26@ncsu.edu"}
];
