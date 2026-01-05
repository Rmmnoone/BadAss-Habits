// ==========================
// Version 2 — src/main.tsx
// - Uses App.tsx as the single source of truth for routing
// - Avoids duplicate BrowserRouter/AuthProvider wrapping
// - Fixes /habits redirect issue (AppRoutes was handling routes instead of App.tsx)
// ==========================
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ==========================
// End of Version 2 — src/main.tsx
// ==========================
