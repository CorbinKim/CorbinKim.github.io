/* Selected projects, kept in sync with Corbin_Kim___CV.pdf.
   Each has an illustrative banner (public/img/projects) and a one-line blurb. */

export const projects = [
  {
    name: "TelcoAgent",
    image: "/img/projects/telcoagent.jpg",
    badge: "Under review",
    badgeTone: "attention",
    desc: "LLM-based zero-shot 5G multi-KPM forecasting with 3GPP-grounded explainability. Under review at IEEE GLOBECOM 2026.",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/NextG-Wireless-Lab-NC-State/TelcoAgent"
      }
    ]
  },
  {
    name: "O-RAN AIMLFW",
    image: "/img/projects/aimlfw.png",
    desc: "MLOps pipelines and a traffic-forecasting use case for energy-efficient Open RAN.",
    links: [
      {label: "O-RAN SC", href: "https://wiki.o-ran-sc.org/display/AIMLFW"}
    ]
  },
  {
    name: "SKT Energy Saving",
    image: "/img/projects/skt-energy.jpg",
    desc: "Spatiotemporal traffic forecasting for base-station cell sleeping — energy-saving ROI on SKT's commercial network.",
    links: []
  }
];
