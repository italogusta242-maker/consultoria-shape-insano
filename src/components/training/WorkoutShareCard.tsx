import { forwardRef } from "react";
import insanoLogo from "@/assets/insano-logo.svg";
import type { FlameState } from "@/hooks/useFlameState";

interface WorkoutShareCardProps {
  groupName: string;
  duration: number;
  volume: number;
  completedSets: number;
  totalSets: number;
  streak: number;
  flameState: FlameState;
}

const WorkoutShareCard = forwardRef<HTMLDivElement, WorkoutShareCardProps>(
  ({ groupName, volume, streak }, ref) => {
    const volumeDisplay = volume > 0 ? `${(volume / 1000).toFixed(1)}T` : "—";

    const shortName = (() => {
      const raw = groupName || "TREINO";
      const cleaned = raw.replace(/^[A-Z]\s*[-–]\s*/i, "").replace(/^Treino\s+[A-Z]\s*[-–]\s*/i, "");
      const first = cleaned.split(/[\/,]/)[0].trim();
      return first.toUpperCase() || raw.toUpperCase();
    })();

    return (
      <div
        ref={ref}
        style={{
          width: 280,
          height: 500,
          background: "transparent",
          fontFamily: "'Sora', sans-serif",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
        }}
      >
        {/* TREINO label */}
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 13,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "3px",
            textTransform: "uppercase" as const,
            marginBottom: 2,
            textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          TREINO
        </div>

        {/* Workout Name */}
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 36,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase" as const,
            lineHeight: 1,
            marginBottom: 24,
            textAlign: "center" as const,
            textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          {shortName}
        </div>

        {/* VOLUME label */}
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 12,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "3px",
            textTransform: "uppercase" as const,
            marginBottom: 2,
            textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          VOLUME
        </div>

        {/* Volume value */}
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 44,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1,
            marginBottom: 24,
            textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          {volumeDisplay}
        </div>

        {/* DIAS DE HONRA label */}
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 16,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "4px",
            textTransform: "uppercase" as const,
            marginBottom: 8,
            textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          DIAS DE HONRA
        </div>

        {/* 🔥 + streak as pure text */}
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 48,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1,
            marginBottom: 40,
            textAlign: "center" as const,
            width: "100%",
            textShadow: "0px 2px 8px rgba(0, 0, 0, 0.9)",
          }}
        >
          🔥{streak}
        </div>

        {/* Logo */}
        <img
          src={insanoLogo}
          alt="Shape Insano"
          style={{ width: 34, height: 48, marginBottom: 8, objectFit: "contain" as const }}
        />

        {/* SHAPE INSANO */}
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 13,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "2px",
            textTransform: "uppercase" as const,
            textShadow: "0px 2px 4px rgba(0, 0, 0, 0.8)",
          }}
        >
          SHAPE INSANO
        </div>
      </div>
    );
  }
);

WorkoutShareCard.displayName = "WorkoutShareCard";

export default WorkoutShareCard;
