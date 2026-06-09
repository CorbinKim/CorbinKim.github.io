/* CV data, kept in sync with Corbin_Kim___CV.pdf (identity: Corbin Kim). */

export const basics = {
  name: "Corbin Kim",
  label: "Incoming Ph.D. Student, NC State University",
  email: "gkim26@ncsu.edu",
  location: "Raleigh, North Carolina",
  summary:
    "I'm an incoming Ph.D. student (Fall 2026) at the NextG Wireless Lab, NC " +
    "State University (ECE), where I have been a visiting scholar. My research " +
    "applies agentic AI — time-series foundation models, knowledge graphs, and " +
    "LLM agents — to forecasting and self-management of 5G and next-generation " +
    "Radio Access Networks. I hold an M.S. from Kyung Hee University and " +
    "contribute to the O-RAN SC AI/ML Framework (AIMLFW)."
};

// Most recent first (karpathy-style reverse-chronological), each with a logo.
const ncsu = "/img/ncsu.png";
const khu = "/img/khuLogo.png";

export const timeline = [
  {
    period: "Fall 2026 —",
    logo: ncsu,
    title: "Ph.D. Student, Electrical & Computer Engineering",
    org: "NC State University · NextG Wireless Lab",
    note: "Incoming. Continuing agentic-AI research toward self-managing Radio Access Networks, advised by Prof. Vijay K. Shah."
  },
  {
    period: "2025 – 2026",
    logo: ncsu,
    title: "Visiting Scholar, Electrical & Computer Engineering",
    org: "NC State University · NextG Wireless Lab",
    note: "TelcoAgent — an LLM-based framework for zero-shot multi-KPM forecasting with 3GPP-grounded explainable reasoning, evaluated on a city-scale 5G dataset (200 cells) from a U.S. operator. Advised by Prof. Vijay K. Shah, in collaboration with Samsung R&D Institute India."
  },
  {
    period: "2023 – 2025",
    logo: khu,
    title: "M.S., Electronics & Information Convergence Engineering",
    org: "Kyung Hee University",
    note: "Thesis: Green Intelligence — traffic forecasting for cell sleeping in Open RAN. Focus: radio resource management, Open RAN. (GPA 3.94 / 4.0)"
  },
  {
    period: "2023 – 2025",
    logo: khu,
    title: "Graduate Research Assistant",
    org: "Kyung Hee University",
    note: "SKT AI Fellowship — 5G Green AI: a cell-off recommendation time window built from SKT commercial network data and validated on the Busan testbed, measuring energy-saving ROI."
  },
  {
    period: "2017 – 2023",
    logo: khu,
    title: "B.S., Electronic Engineering",
    org: "Kyung Hee University"
  }
];

export const awards = [
  {
    date: "Jan 2025",
    title: "Best Paper Award",
    awarder: "KICS Symposium — O-RAN testbed implementation"
  },
  {
    date: "Nov 2024",
    title: "Outstanding Research Award",
    awarder: "SKT — 5G Green AI Algorithm"
  },
  {
    date: "Oct 2024",
    title: "Best Paper Award",
    awarder: "KICS Symposium — traffic prediction"
  }
];

export const publications = [
  {
    title:
      "TelcoAgent: A Scalable 5G Multi-KPM Forecasting With 3GPP-Grounded Explainability",
    venue: "Proc. IEEE GLOBECOM (under review)",
    authors:
      "G. Kim, D. Ron, S. Singh, S. Moogi, P. Gajjar, V. V. N. K. S. R. Koduri, E. K. Hong, V. K. Shah",
    year: "2026"
  },
  {
    title:
      "Green Intelligence: Traffic Forecasting Using O-RAN AI/ML Framework",
    venue:
      "Proc. 16th Int. Conf. on Ubiquitous and Future Networks (ICUFN), Lisbon",
    authors: "G. Kim, S. J. Lee, E. K. Hong",
    year: "2025"
  }
];
