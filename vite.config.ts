//----------------------------------//
//    Version 5 - vite.config.ts    //
// - InjectManifest (custom SW)     //
// - Keeps predictable glob rules   //
// - Removes workbox runtime config //
//   (runtime behavior handled in sw.ts for InjectManifest)
//----------------------------------//
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // we register manually in src/main.tsx

      // ✅ Custom SW (src/sw.ts)
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

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

      // ✅ Make InjectManifest behave predictably
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Optional safety limit (prevents surprises if you add big assets later)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});

//----------------------------------//
// End of Version 5 - vite.config.ts //
//----------------------------------//
