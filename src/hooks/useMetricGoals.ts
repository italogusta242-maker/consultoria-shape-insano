import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MetricGoal = {
  metric_key: string;
  goal_value: number;
};

// Legacy: single global goals (used for gauges)
export function useMetricGoals() {
  return useQuery({
    queryKey: ["metric-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metric_goals")
        .select("metric_key, goal_value");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { map[r.metric_key] = Number(r.goal_value); });
      return map;
    },
  });
}

export function useUpdateMetricGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ metric_key, goal_value }: MetricGoal) => {
      const { error } = await supabase
        .from("metric_goals")
        .upsert({ metric_key, goal_value }, { onConflict: "metric_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["metric-goals"] }),
  });
}

// Monthly goals: per metric per month (YYYY-MM)
export type MonthlyGoalEntry = {
  metric_key: string;
  month: string; // YYYY-MM
  goal_value: number;
};

export function useMonthlyGoals() {
  return useQuery({
    queryKey: ["monthly-metric-goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_metric_goals" as any)
        .select("metric_key, month, goal_value");
      if (error) throw error;
      // Map: { "mrr": { "2025-01": 50000, "2025-02": 60000 }, ... }
      const map: Record<string, Record<string, number>> = {};
      (data ?? []).forEach((r: any) => {
        if (!map[r.metric_key]) map[r.metric_key] = {};
        map[r.metric_key][r.month] = Number(r.goal_value);
      });
      return map;
    },
  });
}

export function useUpsertMonthlyGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ metric_key, month, goal_value }: MonthlyGoalEntry) => {
      const { error } = await supabase
        .from("monthly_metric_goals" as any)
        .upsert({ metric_key, month, goal_value } as any, { onConflict: "metric_key,month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly-metric-goals"] }),
  });
}
