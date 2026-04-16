import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const BUILD_VERSION = String(Date.now());

// Emits /version.json so the running app can detect newer deploys and
// auto-purge stale caches when the embedded version no longer matches.
const buildVersionPlugin = (): Plugin => ({
  name: "build-version-json",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ version: BUILD_VERSION }),
    });
  },
  configureServer(server) {
    server.middlewares.use("/version.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ version: BUILD_VERSION }));
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    buildVersionPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "insano-icon-192.png", "insano-icon-512.png"],
      manifest: {
        name: "Shape Insano",
        short_name: "Shape Insano",
        start_url: "/",
        display: "standalone",
        background_color: "#FF6B00",
        theme_color: "#FF6B00",
        icons: [
          { src: "/insano-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/insano-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/insano-icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/insano-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff2}"],
        // Never precache version.json — it must always be fetched fresh
        globIgnores: ["**/version.json"],
        importScripts: ["/push-handler.js"],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          ui: ['lucide-react', 'date-fns', 'zod', 'react-hook-form'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          motion: ['framer-motion']
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
