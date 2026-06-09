/* Selected projects, kept in sync with Corbin_Kim___CV.pdf. */

export const projects = [
  {
    name: "TelcoAgent",
    desc:
      "An LLM-based framework for scalable 5G multi-KPM forecasting with 3GPP-grounded " +
      "explainability — a 3GPP-derived knowledge graph grounds both zero-shot forecasting " +
      "and explainable causal reasoning, evaluated on a city-scale 5G dataset (200 cells) " +
      "from a U.S. operator. Under review at IEEE GLOBECOM 2026.",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/NextG-Wireless-Lab-NC-State/TelcoAgent"
      }
    ]
  },
  {
    name: "O-RAN AIMLFW",
    desc:
      "Contributor to the O-RAN SC AI/ML Framework — designed MLOps pipelines for AI/ML " +
      "workflows in Open RAN, built and validated a traffic-forecasting use case for " +
      "energy-efficient operation, and improved AIMLFW integration with Open RAN testbeds.",
    links: [
      {label: "O-RAN SC", href: "https://wiki.o-ran-sc.org/display/AIMLFW"}
    ]
  },
  {
    name: "Green AI for RAN",
    desc:
      "SKT AI Fellowship — traffic forecasting for base-station cell sleeping in Open RAN. " +
      "Built a cell-off recommendation time window from SKT commercial network data and " +
      "validated it on the Busan testbed, measuring energy-saving ROI.",
    links: []
  }
];
