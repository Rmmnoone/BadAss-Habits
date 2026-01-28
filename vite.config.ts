//----------------------------------//
//    Version 8 - vite.config.ts    //
// - ✅ InjectManifest (USES src/sw.ts)
// - Manual registration preserved (injectRegister: null)
// - Predictable precache rules (injectManifest.globPatterns)
// - Fixes missing push notifications by ensuring SW has push handler
//----------------------------------//
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We register manually in src/main.tsx
      injectRegister: null,
      registerType: "autoUpdate",

      // ✅ IMPORTANT: use your custom SW (src/sw.ts)
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      // ✅ Dev SW (useful for local testing)
      devOptions: {
        enabled: true,
        type: "module",
      },

      manifest: {
        name: "BadAss Habits",
        short_name: "BadAss Habits",
        description: "Habit tracker with schedules, streaks, and reminders.",
        theme_color: "#05061A",
        background_color: "#05061A",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },

      // ✅ InjectManifest options (NOT workbox)
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});

//----------------------------------//
// End of Version 8 - vite.config.ts //
//----------------------------------//
