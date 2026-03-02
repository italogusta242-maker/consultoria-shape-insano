import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-banner-dismissed";

const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show if dismissed recently (7 days)
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Detect iOS
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isiOS);

    if (isiOS) {
      // On iOS there's no beforeinstallprompt, show manual instructions
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setShow(false));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-3 right-3 z-50 md:left-auto md:right-6 md:bottom-6 md:max-w-sm"
        >
          <div className="rounded-xl border border-accent/30 bg-card shadow-lg shadow-black/40 p-4">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                <img
                  src="/insano-icon-192.png"
                  alt="Shape Insano"
                  className="w-8 h-8 rounded-lg"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-cinzel text-sm font-bold text-foreground">
                  Instale o App
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {isIOS
                    ? "Toque em Compartilhar e \"Adicionar à Tela Inicial\""
                    : "Acesse mais rápido direto da tela inicial"}
                </p>
              </div>
              {isIOS ? (
                <div className="shrink-0 p-2 rounded-lg bg-accent/15">
                  <Share size={18} className="text-accent" />
                </div>
              ) : (
                <button
                  onClick={handleInstall}
                  className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: "#FF6B00" }}
                >
                  Instalar
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallBanner;
