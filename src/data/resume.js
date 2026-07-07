/* CV data, kept in sync with Corbin_Kim___CV.pdf (identity: Corbin Kim). */

// Most recent first (karpathy-style reverse-chronological), each with a logo.
const ncsu = "/img/ncsu-blocks.png"; // NC State block-S logo
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
    note: "TelcoAgent — zero-shot 5G multi-KPM forecasting with 3GPP-grounded explainability, evaluated on a city-scale 5G dataset (200 cells) from a U.S. operator. Advised by Prof. Vijay K. Shah, in collaboration with Samsung R&D Institute India."
  },
  {
    period: "2023 – 2025",
    logo: khu,
    title: "M.S., Electronics & Information Convergence Engineering",
    org: "Kyung Hee University",
    note: "Thesis: Green Intelligence — traffic forecasting for cell sleeping in Open RAN. Focus: radio resource management, Open RAN. (GPA 3.94 / 4.0)"
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
    venue: "Proc. IEEE GLOBECOM",
    authors:
      "G. Kim, D. Ron, S. Singh, S. Moogi, P. Gajjar, V. V. N. K. S. R. Koduri, E. K. Hong, V. K. Shah",
    year: "2026",
    status: "Submitted",
    statusTone: "neutral",
    links: [{label: "arXiv", href: "https://arxiv.org/abs/2606.19821"}]
  },
  {
    title:
      "Green Intelligence: Traffic Forecasting Using O-RAN AI/ML Framework",
    venue:
      "Proc. 16th Int. Conf. on Ubiquitous and Future Networks (ICUFN), Lisbon",
    authors: "G. Kim, S. J. Lee, E. K. Hong",
    year: "2025",
    status: "Published",
    statusTone: "success",
    links: [
      {
        label: "IEEE Xplore",
        href: "https://ieeexplore.ieee.org/document/11170027/"
      }
    ]
  }
];
