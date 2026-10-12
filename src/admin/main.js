// Entry of the /admin/ page (see admin/index.html and vite.config.js).
import "./admin.css";
import {start} from "./app.js";

// Clickjacking guard. GitHub Pages cannot send X-Frame-Options or a
// frame-ancestors policy, so the page refuses to run when another site embeds
// it in a frame (the editor holds a publish-capable token).
if (window.top !== window.self) {
  document.body.textContent = "This page cannot be shown inside another page.";
} else {
  start(document.getElementById("admin-root"));
}
