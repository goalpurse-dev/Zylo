import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const container = document.getElementById("root");
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Prerendered pages normally get a fresh client render (the server HTML is
// replaced once the app loads). A page that opts in (publicSeoMetadata.js
// `inlineContent`, stamped as <html data-hydrate="true"> by
// scripts/generateSeoHtml.js) is hydrated instead: its server HTML stays on
// screen and React attaches to it. If the two ever differ, React falls back
// to a client render of that part, which is what every other page does.
// The Home snapshot doubles as the fallback HTML for app routes (see
// SHELL_GUARD in scripts/generateSeoHtml.js): on those, drop Home's markup
// before the app draws.
if (document.documentElement.dataset.shell === "true") {
  container.replaceChildren();
  document.getElementById("shell-hide")?.remove();
}

if (document.documentElement.dataset.hydrate === "true" && container.firstElementChild) {
  ReactDOM.hydrateRoot(container, app, { onRecoverableError: (error) => console.warn("[hydrate]", error?.message ?? error) });
} else {
  ReactDOM.createRoot(container).render(app);
}

