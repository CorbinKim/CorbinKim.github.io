/* Site-wide identity + social links for the karpathy-style home.
   Ported from the archived Astro site.ts (identity: Corbin Kim). */

export const site = {
  name: "Corbin Kim",
  role: "Ph.D. Candidate @ NextG Lab, NC State University",
  tagline:
    "Large language models for self-managing Radio Access Networks.",
  email: "gkim26@ncsu.edu",
  url: "https://corbinkim.github.io",
};

// Medium handle WITHOUT the leading "@". The Writing section live-fetches
// this user's RSS feed. Change this if your handle differs.
export const mediumUsername = "corbinkim";

export const social = [
  {label: "GitHub", href: "https://github.com/CorbinKim"},
  {label: "LinkedIn", href: "https://www.linkedin.com/in/corbinkim/"},
  {label: "Medium", href: `https://medium.com/@${mediumUsername}`},
  {label: "Email", href: "mailto:gkim26@ncsu.edu"},
];
