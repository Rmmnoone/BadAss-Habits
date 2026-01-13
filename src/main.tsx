// ==========================
// Version 4 — src/main.tsx
// - Registers PWA service worker once (browser only)
// - Keeps App.tsx as routing source of truth
// ==========================
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./pwa/registerSW";

if (typeof window !== "undefined") {
  registerServiceWorker();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ==========================
// End of Version 4 — src/main.tsx
// ==========================
