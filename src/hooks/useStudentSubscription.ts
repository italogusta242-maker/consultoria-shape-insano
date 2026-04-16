import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentSubscriptionInfo {
  startDate: Date | null;
  endDate: Date | null;
  daysRemaining: number | null;
}

/**
 * Fetches the active subscription for a student and computes start/end dates
 * based on the linked subscription_plan duration.
 */
export const useStudentSubscription = (studentId: string | null | undefined) => {
  return useQuery({
    queryKey: ["student-subscription-info", studentId],
    queryFn: async (): Promise<StudentSubscriptionInfo> => {
      if (!studentId) return { startDate: null, endDate: null, daysRemaining: null };

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("started_at, subscription_plan_id")
        .eq("user_id", studentId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.started_at) {
        return { startDate: null, endDate: null, daysRemaining: null };
      }

      const startDate = new Date(sub.started_at);
      let endDate: Date | null = null;

      if (sub.subscription_plan_id) {
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("duration_months")
          .eq("id", sub.subscription_plan_id)
          .maybeSingle();
        if (plan?.duration_months) {
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + plan.duration_months);
        }
      }

      const daysRemaining = endDate
        ? Math.ceil((endDate.getTime() - Date.now()) / 86400000)
        : null;

      return { startDate, endDate, daysRemaining };
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  });
};
