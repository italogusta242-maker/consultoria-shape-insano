import { motion } from "framer-motion";
import { AlertTriangle, Shield } from "lucide-react";
import type { FlameState } from "@/hooks/useFlameState";

interface FlameBannerProps {
  state: FlameState;
}

/**
 * Top banner that appears only for trégua and extinta states.
 * Uses the same vivid gradient language as the "INICIAR TREINO" button,
 * with white text for maximum contrast in both light and dark modes.
 */
const FlameBanner = ({ state }: FlameBannerProps) => {
  if (state === "normal" || state === "ativa") return null;

  const isTregua = state === "tregua";

  const background = isTregua
    ? "linear-gradient(135deg, hsl(210, 80%, 52%), hsl(200, 90%, 60%))"
    : "linear-gradient(135deg, hsl(270, 65%, 52%), hsl(280, 75%, 62%))";

  const shadow = isTregua
    ? "0 10px 28px -10px hsl(210, 80%, 52%, 0.55)"
    : "0 10px 28px -10px hsl(270, 65%, 52%, 0.55)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl px-4 py-3 flex items-start gap-3 relative z-10"
      style={{ background, boxShadow: shadow, border: "1px solid hsl(0 0% 100% / 0.18)" }}
    >
      {isTregua ? (
        <Shield size={20} style={{ color: "#fff", flexShrink: 0, marginTop: 2 }} />
      ) : (
        <AlertTriangle size={20} style={{ color: "#fff", flexShrink: 0, marginTop: 2 }} />
      )}
      <div>
        <p className="font-cinzel text-sm font-bold tracking-tight" style={{ color: "#fff" }}>
          {isTregua ? "TRÉGUA — CHAMA CONGELADA" : "TUA CHAMA SE EXTINGUIU"}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 100% / 0.88)" }}>
          {isTregua
            ? "Você faltou um treino. Treine hoje ou sua Chama de Honra será extinta!"
            : "Complete seu treino e check-in para reacender a Chama de Honra."}
        </p>
      </div>
    </motion.div>
  );
};

export default FlameBanner;
