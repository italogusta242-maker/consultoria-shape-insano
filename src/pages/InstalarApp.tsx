import { useState, useEffect } from "react";
import { Download, Smartphone, Check, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import InsanoLogo from "@/components/InsanoLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstalarApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12 bg-background">
      <InsanoLogo size={80} />

      {installed ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-cinzel text-foreground">App Instalado!</h1>
          <p className="text-muted-foreground">Abra o Shape Insano pela sua tela inicial.</p>
        </div>
      ) : isIOS ? (
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          <Smartphone className="w-16 h-16 text-primary" />
          <h1 className="text-2xl font-bold font-cinzel text-foreground">Instalar no iPhone</h1>
          <div className="space-y-4 text-muted-foreground text-sm">
            <p>1. Toque no ícone <Share className="inline w-4 h-4" /> <strong>Compartilhar</strong> no Safari</p>
            <p>2. Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></p>
            <p>3. Confirme tocando em <strong>"Adicionar"</strong></p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          <Download className="w-16 h-16 text-primary" />
          <h1 className="text-2xl font-bold font-cinzel text-foreground">Instalar App</h1>
          <p className="text-muted-foreground">
            Instale o Shape Insano como um app no seu celular para acesso rápido e experiência completa.
          </p>
          <Button
            size="lg"
            onClick={handleInstall}
            disabled={!deferredPrompt}
            className="w-full"
          >
            <Download className="w-5 h-5 mr-2" />
            {deferredPrompt ? "Instalar Agora" : "Aguardando..."}
          </Button>
          {!deferredPrompt && (
            <p className="text-xs text-muted-foreground">
              Se o botão não aparecer, use o menu do navegador → "Instalar app" ou "Adicionar à tela inicial".
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default InstalarApp;
