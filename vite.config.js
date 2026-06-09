import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// Static portfolio served at the domain root (corbinkim.github.io).
// classic JSX runtime keeps us compatible with React 16; every component
// already imports React explicitly.
export default defineConfig({
  plugins: [react({jsxRuntime: "classic"})],
  base: "/",
  build: {
    // matches the GitHub Pages deploy workflow (uploads ./build) and .gitignore
    outDir: "build",
    emptyOutDir: true,
  },
});
