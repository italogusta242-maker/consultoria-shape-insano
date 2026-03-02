import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Calcula o streak (dias consecutivos de treino) do usuário.
 * Conta dias distintos com workout finalizado, de trás pra frente.
 */
export const useStreak = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["streak", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data, error } = await supabase
        .from("workouts")
        .select("finished_at")
        .eq("user_id", user.id)
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(60);

      if (error || !data || data.length === 0) return 0;

      // Get unique dates (YYYY-MM-DD)
      const uniqueDates = [
        ...new Set(
          data.map((w) => {
            const d = new Date(w.finished_at!);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })
        ),
      ].sort((a, b) => b.localeCompare(a)); // desc

      // Count consecutive days from today or yesterday
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      // Streak must start from today or yesterday
      if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) return 0;

      let streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = new Date(uniqueDates[i - 1]);
        const curr = new Date(uniqueDates[i]);
        const diffMs = prev.getTime() - curr.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
};
