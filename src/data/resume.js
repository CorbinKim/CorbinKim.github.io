/* CV data, ported from the archived Astro resume.ts (identity: Corbin Kim). */

export const basics = {
  name: "Corbin Kim",
  label: "Ph.D. Candidate, NC State University",
  email: "gkim26@ncsu.edu",
  location: "Raleigh, North Carolina",
  summary:
    "I'm a Ph.D. Candidate at NextG Lab, NC State University (ECE). My research applies " +
    "Large Language Models to automate wireless resource management in Radio Access " +
    "Networks (RAN), working toward fully autonomous Zero Touch Networks. I'm an active " +
    "contributor to the AIMLFW project within the O-RAN Software Community.",
};

// Most recent first (karpathy-style reverse-chronological).
export const timeline = [
  {
    period: "2026 —",
    title: "Ph.D., Electrical & Computer Engineering",
    org: "NC State University · NextG Lab",
    note: "LLM-driven autonomous RAN management.",
  },
  {
    period: "2023 – 2025",
    title: "M.S., Mobile Communication",
    org: "Kyung Hee University",
    note: "Thesis: Green Intelligence — Traffic Forecasting for Cell Sleeping in Open RAN. (GPA 3.94)",
  },
  {
    period: "2023 – 2025",
    title: "Graduate Research Assistant",
    org: "Kyung Hee University · Adviser: Prof. EenKee Hong",
    note: "O-RAN Global PlugFest 2024 with LG Uplus; O-RAN SC AIMLFW use case; RAN slicing; SKT AI Fellowship (cell-off recommendation on commercial network data).",
  },
  {
    period: "2017 – 2023",
    title: "B.S., Electronic Engineering",
    org: "Kyung Hee University",
  },
];

export const awards = [
  {date: "2025", title: "Best Paper Award", awarder: "KICS — O-RAN testbed implementation"},
  {date: "2024", title: "Outstanding Research Award", awarder: "SKT — 5G Green AI Algorithm"},
  {date: "2024", title: "Best Paper Award", awarder: "KICS — traffic prediction"},
];

export const publications = [
  {
    title: "Traffic Prediction for Carbon Reduction in Green Cellular Networks",
    venue: "IEEE Trans. Green Commun. Netw. (in preparation)",
    authors: "G. Kim, S.J. Lee, E.K. Hong",
  },
  {
    title: "Implementation of Ultra-Low Latency Open RAN Using Distributed Near-RT RIC",
    venue: "Proc. KICS Symposium",
    authors: "G. Kim, S.J. Lee, E.K. Hong",
    year: "2024",
  },
  {
    title: "Securing 5G Core Network Stability Using Open Source",
    venue: "Proc. KICS Symposium",
    authors: "G. Kim, S.Y. Lee, S.J. Lee, E.K. Hong",
    year: "2023",
  },
  {
    title: "Cell Free Massive MIMO Downlink Power Allocation Using Deep Reinforcement Learning",
    venue: "Proc. KICS Symposium",
    authors: "G. Kim, E.K. Hong",
    year: "2023",
  },
];
