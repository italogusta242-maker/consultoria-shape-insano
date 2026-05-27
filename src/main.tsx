import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isStaleChunkError, recoverFromStaleChunk } from "./components/ErrorBoundary";
import { initThemeOnBoot } from "./hooks/useTheme";

// Apply saved theme before first paint to avoid a flash of wrong palette.
initThemeOnBoot();

// Force service worker update on load (guarded — reg.update() throws "newestWorker is null"
// when a registration exists but has no installing/waiting/active worker yet).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      if (reg.installing || reg.waiting || reg.active) {
        reg.update().catch(() => { /* ignore transient SW update errors */ });
      }
    }
  }).catch(() => { /* ignore */ });
}

// Global guard: if a dynamic import fails outside React's render cycle
// (e.g. inside an async useEffect or route prefetch), auto-recover by
// purging caches and reloading. Avoids the "Algo deu errado" screen after deploys.
window.addEventListener("unhandledrejection", (event) => {
  if (isStaleChunkError(event.reason)) {
    event.preventDefault();
    recoverFromStaleChunk();
  }
});

window.addEventListener("error", (event) => {
  if (isStaleChunkError(event.error || event.message)) {
    event.preventDefault();
    recoverFromStaleChunk();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
