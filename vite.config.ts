import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
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
