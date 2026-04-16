import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudentSubscription } from "@/hooks/useStudentSubscription";

interface Props {
  studentId: string;
  /** "full" shows start → end + days remaining; "short" shows compact dd/MM → dd/MM/yy */
  variant?: "full" | "short";
  className?: string;
}

const fmtFull = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtShort = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const SubscriptionBadge = ({ studentId, variant = "full", className }: Props) => {
  const { data } = useStudentSubscription(studentId);
  if (!data?.startDate) return null;

  const { startDate, endDate, daysRemaining } = data;
  const isUrgent = daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;

  const tone = isExpired
    ? "bg-destructive/10 text-destructive border-destructive/30"
    : isUrgent
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : "bg-[hsl(var(--glass-bg))] text-muted-foreground border-[hsl(var(--glass-border))]";

  if (variant === "short") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border whitespace-nowrap",
          tone,
          className,
        )}
        title={
          endDate
            ? `Plano: ${fmtFull(startDate)} → ${fmtFull(endDate)}${
                daysRemaining !== null ? ` · ${daysRemaining} dias restantes` : ""
              }`
            : `Plano iniciado em ${fmtFull(startDate)}`
        }
      >
        <Calendar size={9} />
        {fmtShort(startDate)}
        {endDate && <> → {fmtShort(endDate)}</>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border",
        tone,
        className,
      )}
    >
      <Calendar size={11} />
      <span className="tabular-nums">
        {fmtFull(startDate)}
        {endDate && <> → {fmtFull(endDate)}</>}
      </span>
      {daysRemaining !== null && (
        <span className="opacity-80">
          ·{" "}
          {isExpired
            ? "Expirado"
            : `${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"} restantes`}
        </span>
      )}
    </span>
  );
};

export default SubscriptionBadge;
