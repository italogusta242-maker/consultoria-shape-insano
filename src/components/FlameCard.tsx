import { motion } from "framer-motion";
import { Flame, Shield, CircleAlert } from "lucide-react";
import type { FlameState } from "@/hooks/useFlameState";

interface FlameCardProps {
  state: FlameState;
  streak: number;
  adherence: number;
  className?: string;
}

const stateConfig = {
  normal: {
    title: "Chama de Honra",
    subtitle: (a: number) => `Adesão: ${a}%`,
    icon: Flame,
    progressColor: "hsl(25, 100%, 50%)",
    gradientStart: "hsl(40, 100%, 55%)",
    iconColor: "hsl(25, 100%, 50%)",
    numberColor: "hsl(0, 0%, 95%)",
    labelColor: "hsl(0, 0%, 55%)",
    subtitleColor: "hsl(0, 0%, 45%)",
    label: "CHAMA DE HONRA",
    cardBg: "hsl(var(--card))",
    cardBorder: "hsl(var(--border))",
  },
  ativa: {
    title: "Chama de Honra",
    subtitle: (a: number) => `Adesão: ${a}%`,
    icon: Flame,
    progressColor: "hsl(25, 100%, 50%)",
    gradientStart: "hsl(40, 100%, 55%)",
    iconColor: "hsl(25, 100%, 50%)",
    numberColor: "hsl(0, 0%, 95%)",
    labelColor: "hsl(25, 100%, 50%)",
    subtitleColor: "hsl(0, 0%, 55%)",
    label: "CHAMA DE HONRA",
    cardBg: "hsl(var(--card))",
    cardBorder: "hsl(25, 100%, 50%, 0.3)",
  },
  tregua: {
    title: "Trégua",
    subtitle: () => "Treine hoje para manter a chama!",
    icon: Shield,
    progressColor: "hsl(210, 60%, 50%)",
    gradientStart: "hsl(195, 80%, 55%)",
    iconColor: "hsl(210, 60%, 50%)",
    numberColor: "hsl(0, 0%, 95%)",
    labelColor: "hsl(210, 60%, 50%)",
    subtitleColor: "hsl(210, 30%, 50%)",
    label: "TRÉGUA",
    cardBg: "hsl(var(--truce-card))",
    cardBorder: "hsl(var(--truce-border))",
  },
  extinta: {
    title: "Chama Extinta",
    subtitle: () => "Sem atividade registrada",
    icon: CircleAlert,
    progressColor: "hsl(270, 25%, 28%)",
    gradientStart: "hsl(280, 30%, 38%)",
    iconColor: "hsl(270, 30%, 40%)",
    numberColor: "hsl(0, 0%, 60%)",
    labelColor: "hsl(270, 35%, 50%)",
    subtitleColor: "hsl(270, 15%, 40%)",
    label: "CHAMA EXTINTA",
    cardBg: "hsl(var(--dishonor-card))",
    cardBorder: "hsl(var(--dishonor-border))",
  },
};

const RADIUS = 48;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const FlameCard = ({ state, streak, adherence, className = "" }: FlameCardProps) => {
  const config = stateConfig[state];
  const Icon = config.icon;
  const progress = Math.min(adherence, 100);
  const strokeDashoffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-6 flex flex-col items-center ${className}`}
      style={{
        background: config.cardBg,
        borderColor: config.cardBorder,
      }}
    >
      <h3 className="font-cinzel text-sm font-bold mb-4" style={{ color: config.subtitleColor }}>{config.title}</h3>

      {/* Circular progress ring */}
      <div className="relative w-40 h-40 mb-4">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <defs>
            <linearGradient id={`flame-grad-${state}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={config.gradientStart} />
              <stop offset="100%" stopColor={config.progressColor} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="60" cy="60" r={RADIUS}
            fill="none"
            stroke="hsl(0, 0%, 22%)"
            strokeWidth={STROKE}
          />
          {/* Progress arc with gradient */}
          <motion.circle
            cx="60" cy="60" r={RADIUS}
            fill="none"
            stroke={`url(#flame-grad-${state})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative">
            {/* Glow effect for ativa */}
            {state === "ativa" && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(25, 100%, 50%, 0.4) 0%, transparent 70%)",
                  width: 48, height: 48, top: -10, left: -10,
                }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.9, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {/* Frost effect for tregua */}
            {state === "tregua" && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(210, 70%, 60%, 0.3) 0%, transparent 70%)",
                  width: 44, height: 44, top: -8, left: -8,
                  filter: "blur(4px)",
                }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {/* Smoke/ash effect for extinta */}
            {state === "extinta" && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(270, 15%, 30%, 0.3) 0%, transparent 70%)",
                  width: 44, height: 44, top: -8, left: -8,
                  filter: "blur(3px)",
                }}
                animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <motion.div
              animate={
                state === "ativa"
                  ? { scale: [1, 1.08, 0.96, 1.04, 1], rotate: [0, -3, 3, -2, 0] }
                  : state === "tregua"
                  ? { scale: [1, 0.98, 1], filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"] }
                  : state === "extinta"
                  ? { opacity: [0.5, 0.3, 0.5] }
                  : {}
              }
              transition={{
                duration: state === "ativa" ? 1.8 : state === "tregua" ? 3 : 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Icon
                size={28}
                style={{
                  color: config.iconColor,
                  filter: state === "tregua" ? "drop-shadow(0 0 4px hsl(210, 80%, 60%))" 
                    : state === "ativa" ? "drop-shadow(0 0 6px hsl(25, 100%, 50%))" 
                    : undefined,
                }}
              />
            </motion.div>
          </div>
          <span className="font-cinzel text-3xl font-bold mt-1" style={{ color: config.numberColor }}>
            {streak}
          </span>
          <span className="text-[10px] font-semibold tracking-widest" style={{ color: config.numberColor, opacity: 0.8 }}>
            DIAS
          </span>
        </div>
      </div>

      {/* Label */}
      <p className="font-cinzel text-xs font-semibold tracking-wider" style={{ color: config.labelColor }}>
        {config.label}
      </p>

      {/* Subtitle */}
      <p className="text-[11px] mt-1" style={{ color: config.subtitleColor }}>
        {config.subtitle(adherence)}
      </p>
    </motion.div>
  );
};

export default FlameCard;
