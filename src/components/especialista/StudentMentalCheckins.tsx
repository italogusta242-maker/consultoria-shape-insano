/**
 * @purpose Shows mood, stress and sleep history for a student over the last 30 days.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toLocalDate } from "@/lib/dateUtils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain } from "lucide-react";

interface Props {
  studentId: string;
}

export default function StudentMentalCheckins({ studentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-mental-checkins", studentId],
    queryFn: async () => {
      const thirtyAgo = new Date();
      thirtyAgo.setDate(thirtyAgo.getDate() - 30);

      const { data: checkins, error } = await supabase
        .from("psych_checkins")
        .select("created_at, mood, stress, sleep_hours, sleep_quality, notes")
        .eq("user_id", studentId)
        .gte("created_at", thirtyAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!checkins || checkins.length === 0) return [];

      return checkins.map((c) => {
        const d = new Date(c.created_at);
        return {
          date: `${d.getDate()}/${d.getMonth() + 1}`,
          fullDate: d.toLocaleDateString("pt-BR"),
          humor: c.mood,
          estresse: c.stress,
          sono: c.sleep_hours ? Number(c.sleep_hours) : null,
          notes: c.notes,
        };
      });
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;

  if (!data || data.length === 0) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3 flex flex-col items-center gap-1">
        <Brain size={16} className="opacity-50" />
        Sem check-ins mentais nos últimos 30 dias
      </div>
    );
  }

  const avgMood = (data.reduce((s, d) => s + d.humor, 0) / data.length).toFixed(1);
  const avgStress = (data.reduce((s, d) => s + d.estresse, 0) / data.length).toFixed(1);
  const sleepEntries = data.filter((d) => d.sono !== null);
  const avgSleep = sleepEntries.length > 0
    ? (sleepEntries.reduce((s, d) => s + (d.sono ?? 0), 0) / sleepEntries.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/30 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-foreground">{avgMood}</p>
          <p className="text-[9px] text-muted-foreground">Humor Médio</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-foreground">{avgStress}</p>
          <p className="text-[9px] text-muted-foreground">Estresse Médio</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-foreground">{avgSleep}h</p>
          <p className="text-[9px] text-muted-foreground">Sono Médio</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              interval={data.length > 15 ? 4 : 0}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 5]}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={25}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 12]}
              tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={25}
              unit="h"
            />
            <Tooltip
              contentStyle={{
                background: "hsl(0, 0%, 10%)",
                border: "1px solid hsl(0, 0%, 16%)",
                borderRadius: "8px",
                fontSize: "11px",
                color: "hsl(43, 30%, 85%)",
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { humor: "Humor", estresse: "Estresse", sono: "Sono (h)" };
                return [name === "sono" ? `${value}h` : value, labels[name] ?? name];
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="humor"
              stroke="hsl(140, 60%, 50%)"
              strokeWidth={2}
              dot={{ r: 2, fill: "hsl(140, 60%, 50%)" }}
              name="humor"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="estresse"
              stroke="hsl(0, 70%, 55%)"
              strokeWidth={2}
              dot={{ r: 2, fill: "hsl(0, 70%, 55%)" }}
              name="estresse"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sono"
              stroke="hsl(220, 70%, 60%)"
              strokeWidth={2}
              dot={{ r: 2, fill: "hsl(220, 70%, 60%)" }}
              name="sono"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(140, 60%, 50%)" }} />
          Humor
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(0, 70%, 55%)" }} />
          Estresse
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(220, 70%, 60%)" }} />
          Sono
        </div>
      </div>
    </div>
  );
}
