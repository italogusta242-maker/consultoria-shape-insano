import { Bell, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PushPermissionBannerProps {
  pushState: "loading" | "granted" | "denied" | "prompt" | "unsupported";
  onRequestPermission: () => void;
}

const PushPermissionBanner = ({ pushState, onRequestPermission }: PushPermissionBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  // Only show for "prompt" state (not yet asked)
  if (pushState !== "prompt" || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mx-4 mt-2 mb-1 p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center gap-3"
      >
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <Bell size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">
            Ative as notificações push
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Receba alertas de mensagens, treinos e atualizações no celular
          </p>
        </div>
        <button
          onClick={onRequestPermission}
          className="px-3 py-1.5 text-xs font-semibold bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors shrink-0"
        >
          Ativar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default PushPermissionBanner;
