import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingDown, TrendingUp, Minus, Moon, SmilePlus, Frown, Meh, Smile, Laugh, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSpecialistStudents } from "@/hooks/useSpecialistStudents";
import { useSpecialtyGuard } from "@/hooks/useSpecialtyGuard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, type Variants } from "framer-motion";

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

const moodIcons = [Frown, Frown, Meh, Smile, Laugh];
const moodLabels = ["Péssimo", "Ruim", "Neutro", "Bom", "Ótimo"];
const moodColors = ["text-destructive", "text-amber-400", "text-muted-foreground", "text-emerald-400", "text-[hsl(var(--gold))]"];

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] backdrop-blur-md p-5", className)}>
    {children}
  </div>
);

interface CheckinSummary {
  studentId: string;
  studentName: string;
  latestMood: number;
  latestStress: number;
  latestSleepHours: number | null;
  latestSleepQuality: number | null;
  latestNotes: string | null;
  latestDate: string;
  totalCheckins: number;
  avgMood: number;
  avgStress: number;
}

const StressBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 rounded-full bg-[hsl(var(--glass-highlight))] overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", value <= 2 ? "bg-emerald-400" : value <= 3 ? "bg-amber-400" : "bg-destructive")}
        style={{ width: `${(value / 5) * 100}%` }}
      />
    </div>
    <span className="text-xs font-bold tabular-nums text-foreground">{value}/5</span>
  </div>
);

const EspecialistaPsicologico = () => {
  const { user } = useAuth();
  const location = useLocation();
  useSpecialtyGuard(location.pathname);
  const { data: students, isLoading: studentsLoading } = useSpecialistStudents();

  const studentIds = (students ?? []).map((s) => s.id);

  const { data: summaries, isLoading: checkinsLoading } = useQuery({
    queryKey: ["psych-checkins-summary", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from("psych_checkins")
        .select("*")
        .in("user_id", studentIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const nameMap = new Map((students ?? []).map((s) => [s.id, s.name]));

      // Group by student
      const grouped = new Map<string, typeof data>();
      for (const row of data ?? []) {
        if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
        grouped.get(row.user_id)!.push(row);
      }

      const results: CheckinSummary[] = [];
      for (const [studentId, rows] of grouped) {
        const latest = rows[0];
        const avgMood = Math.round(rows.reduce((s, r) => s + r.mood, 0) / rows.length * 10) / 10;
        const avgStress = Math.round(rows.reduce((s, r) => s + r.stress, 0) / rows.length * 10) / 10;

        results.push({
          studentId,
          studentName: nameMap.get(studentId) ?? "Aluno",
          latestMood: latest.mood,
          latestStress: latest.stress,
          latestSleepHours: latest.sleep_hours ? Number(latest.sleep_hours) : null,
          latestSleepQuality: latest.sleep_quality,
          latestNotes: latest.notes,
          latestDate: latest.created_at,
          totalCheckins: rows.length,
          avgMood,
          avgStress,
        });
      }

      // Also add students with no check-ins
      for (const s of students ?? []) {
        if (!grouped.has(s.id)) {
          results.push({
            studentId: s.id,
            studentName: s.name,
            latestMood: 0,
            latestStress: 0,
            latestSleepHours: null,
            latestSleepQuality: null,
            latestNotes: null,
            latestDate: "",
            totalCheckins: 0,
            avgMood: 0,
            avgStress: 0,
          });
        }
      }

      return results.sort((a, b) => b.avgStress - a.avgStress);
    },
    enabled: studentIds.length > 0,
  });

  const isLoading = studentsLoading || checkinsLoading;

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" variants={stagger}>
      <motion.div variants={fadeUp}>
        <h1 className="font-cinzel text-2xl font-bold gold-text-gradient">Painel Psicológico</h1>
        <p className="text-sm text-muted-foreground">Acompanhe humor, estresse e sono dos seus alunos</p>
      </motion.div>

      {/* Overview KPIs */}
      {!isLoading && summaries && summaries.length > 0 && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Alunos Monitorados", value: String(summaries.length), icon: User },
            { label: "Com Check-ins", value: String(summaries.filter((s) => s.totalCheckins > 0).length), icon: SmilePlus },
            { label: "Estresse Alto (≥4)", value: String(summaries.filter((s) => s.avgStress >= 4).length), icon: TrendingUp },
            { label: "Humor Baixo (≤2)", value: String(summaries.filter((s) => s.avgMood > 0 && s.avgMood <= 2).length), icon: TrendingDown },
          ].map((k) => (
            <GlassCard key={k.label}>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-[hsl(var(--gold)/0.15)]">
                  <k.icon size={16} className="text-[hsl(var(--gold))]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
            </GlassCard>
          ))}
        </motion.div>
      )}

      {/* Student cards */}
      <motion.div variants={fadeUp} className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : !summaries || summaries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum aluno vinculado</p>
        ) : (
          summaries.map((s) => {
            const MoodIcon = s.latestMood > 0 ? moodIcons[s.latestMood - 1] : Meh;
            const hasData = s.totalCheckins > 0;

            return (
              <GlassCard key={s.studentId} className="hover:border-[hsl(var(--glass-highlight))] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <User size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{s.studentName}</p>
                      {hasData ? (
                        <p className="text-xs text-muted-foreground">
                          {s.totalCheckins} check-ins · Último: {new Date(s.latestDate).toLocaleDateString("pt-BR")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem check-ins registrados</p>
                      )}
                    </div>
                  </div>

                  {hasData && (
                    <div className="flex items-center gap-4">
                      {/* Mood */}
                      <div className="text-center">
                        <MoodIcon size={20} className={moodColors[s.latestMood - 1]} />
                        <p className="text-[10px] text-muted-foreground mt-0.5">{moodLabels[s.latestMood - 1]}</p>
                      </div>

                      {/* Sleep */}
                      {s.latestSleepHours != null && (
                        <div className="text-center">
                          <div className="flex items-center gap-1">
                            <Moon size={14} className="text-[hsl(var(--forja-teal))]" />
                            <span className="text-sm font-bold text-foreground">{s.latestSleepHours}h</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Sono</p>
                        </div>
                      )}

                      {/* Stress */}
                      <div className="w-24">
                        <p className="text-[10px] text-muted-foreground mb-1">Estresse</p>
                        <StressBar value={s.latestStress} />
                      </div>
                    </div>
                  )}
                </div>

                {hasData && s.latestNotes && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground italic">"{s.latestNotes}"</p>
                  </div>
                )}
              </GlassCard>
            );
          })
        )}
      </motion.div>
    </motion.div>
  );
};

export default EspecialistaPsicologico;
