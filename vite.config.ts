import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Keep the development cache outside node_modules so a clean npm install
  // cannot remove assets that a running development server is serving.
  cacheDir: ".vite",
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  preview: {
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react") || id.includes("/@radix-ui/"))
            return "ui-vendor";
          if (id.includes("/dexie")) return "storage";
          if (id.includes("/zod/")) return "validation";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        id: "/",
        name: "BAGA — Your lungs. Your habits. Your progress.",
        short_name: "BAGA",
        description:
          "A private, offline-first cigarette diary and lung visualization.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        lang: "en-PH",
        theme_color: "#111614",
        background_color: "#111614",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          { name: "Log cigarette", url: "/?view=log" },
          { name: "My progress", url: "/?view=insights" },
          { name: "Lung Studio", url: "/?view=lungs" },
          { name: "Log a craving", url: "/?view=cravings" },
          { name: "My goals", url: "/?view=goals" },
        ],
      },
      workbox: {
        importScripts: ["/push-worker.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
