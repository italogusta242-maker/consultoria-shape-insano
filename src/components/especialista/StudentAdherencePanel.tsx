import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Droplets, UtensilsCrossed, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toLocalDate } from "@/lib/dateUtils";

interface Props {
  studentId: string;
  studentName: string;
}

export default function StudentAdherencePanel({ studentId, studentName }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-adherence", studentId],
    queryFn: async () => {
      const today = toLocalDate(new Date());

      // Today's habits (meals completed today)
      const { data: todayHabit } = await supabase
        .from("daily_habits")
        .select("water_liters, completed_meals")
        .eq("user_id", studentId)
        .eq("date", today)
        .maybeSingle();

      // Flame streak: count consecutive workout days
      const { data: workouts } = await supabase
        .from("workouts")
        .select("finished_at")
        .eq("user_id", studentId)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(60);

      let streak = 0;
      if (workouts && workouts.length > 0) {
        const uniqueDates = [
          ...new Set(workouts.map((w) => toLocalDate(new Date(w.finished_at!)))),
        ].sort((a, b) => b.localeCompare(a));

        const todayStr = today;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toLocalDate(yesterday);

        if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
          streak = 1;
          for (let i = 1; i < uniqueDates.length; i++) {
            const prev = new Date(uniqueDates[i - 1]);
            const curr = new Date(uniqueDates[i]);
            const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) streak++;
            else break;
          }
        }
      }

      const rawWater = todayHabit?.water_liters;
      const waterParsed = rawWater != null ? Number(rawWater) : 0;

      return {
        waterToday: isNaN(waterParsed) ? 0 : Math.round(waterParsed * 10) / 10,
        mealsToday: todayHabit?.completed_meals?.length ?? 0,
        streak,
      };
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full rounded-lg" />;
  if (!data) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3">
        Sem dados de adesão
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
        <Droplets size={14} className="text-blue-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground">{data.waterToday}L</p>
          <p className="text-[10px] text-muted-foreground">Água hoje</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
        <UtensilsCrossed size={14} className="text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-foreground">{data.mealsToday}</p>
          <p className="text-[10px] text-muted-foreground">Refeições hoje</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
        <Flame size={14} className={data.streak > 0 ? "text-orange-400 shrink-0" : "text-muted-foreground shrink-0"} />
        <div>
          <p className="text-sm font-bold text-foreground">{data.streak}🔥</p>
          <p className="text-[10px] text-muted-foreground">Chama</p>
        </div>
      </div>
    </div>
  );
}
