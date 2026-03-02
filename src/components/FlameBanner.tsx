import { motion } from "framer-motion";
import { Flame, AlertTriangle, Shield } from "lucide-react";
import type { FlameState } from "@/hooks/useFlameState";

interface FlameBannerProps {
  state: FlameState;
}

/**
 * Top banner that appears only for trégua and extinta states.
 */
const FlameBanner = ({ state }: FlameBannerProps) => {
  if (state === "normal" || state === "ativa") return null;

  const isTregua = state === "tregua";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl px-4 py-3 flex items-start gap-3 relative z-10"
      style={{
        background: isTregua
          ? "linear-gradient(135deg, hsl(210, 25%, 12%), hsl(210, 20%, 8%))"
          : "linear-gradient(135deg, hsl(260, 20%, 12%), hsl(260, 15%, 8%))",
        border: `1px solid ${isTregua ? "hsl(210, 40%, 25%)" : "hsl(260, 30%, 25%)"}`,
      }}
    >
      {isTregua ? (
        <Shield size={20} style={{ color: "hsl(210, 60%, 50%)", flexShrink: 0, marginTop: 2 }} />
      ) : (
        <AlertTriangle size={20} style={{ color: "hsl(270, 50%, 55%)", flexShrink: 0, marginTop: 2 }} />
      )}
      <div>
        <p className="font-cinzel text-sm font-bold" style={{ color: isTregua ? "hsl(210, 60%, 60%)" : "hsl(270, 50%, 60%)" }}>
          {isTregua ? "TRÉGUA — CHAMA CONGELADA" : "TUA CHAMA SE EXTINGUIU"}
        </p>
        <p className="text-xs mt-0.5" style={{ color: isTregua ? "hsl(210, 20%, 55%)" : "hsl(260, 15%, 50%)" }}>
          {isTregua
            ? "Você faltou um treino. Treine hoje ou sua Chama de Honra será extinta!"
            : "Complete seu treino e check-in para reacender a Chama de Honra."}
        </p>
      </div>
    </motion.div>
  );
};

export default FlameBanner;
