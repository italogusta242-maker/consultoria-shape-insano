import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";

interface Props {
  studentId: string;
}

export default function StudentEvolutionChart({ studentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-evolution", studentId],
    queryFn: async () => {
      const { data: assessments, error } = await supabase
        .from("monthly_assessments")
        .select("created_at, peso, altura")
        .eq("user_id", studentId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (assessments ?? [])
        .filter((a) => a.peso)
        .map((a) => ({
          date: new Date(a.created_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          peso: parseFloat(a.peso!.replace(",", ".")),
        }));
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;

  if (!data || data.length < 2) {
    return (
      <div className="text-center text-xs text-muted-foreground py-3 flex flex-col items-center gap-1">
        <TrendingUp size={16} className="opacity-50" />
        {data?.length === 1 ? "Apenas 1 registro. Necessário 2+ para o gráfico." : "Sem dados de peso nas reavaliações"}
      </div>
    );
  }

  const firstWeight = data[0].peso;
  const lastWeight = data[data.length - 1].peso;
  const diff = lastWeight - firstWeight;
  const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Evolução de Peso ({data.length} registros)
        </p>
        <span className={`text-xs font-bold ${diff <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
          {diffStr} kg
        </span>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--glass-border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={35}
              tickFormatter={(v) => `${v}kg`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--glass-border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value} kg`, "Peso"]}
            />
            <Line
              type="monotone"
              dataKey="peso"
              stroke="hsl(var(--gold))"
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(var(--gold))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
