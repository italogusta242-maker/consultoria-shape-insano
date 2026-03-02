import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line,
} from "recharts";
import { useKpiHistory, type PeriodFilter } from "@/hooks/useAdminReports";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const tooltipStyle = {
  contentStyle: { background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,16%)", borderRadius: 8, color: "hsl(0,0%,90%)" },
  labelStyle: { color: "hsl(43,30%,85%)" },
  itemStyle: { color: "hsl(0,0%,90%)" },
};

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "1A" },
  { value: "all", label: "Todos" },
];

type Props = {
  title: string;
  icon: LucideIcon;
  dataKey: string;
  goalKey: string;
  barColor: string;
  goals: Record<string, number>;
  monthlyGoals: Record<string, Record<string, number>>;
  formatter: (v: number, name: string) => [string, string];
  yTickFormatter?: (v: number) => string;
};

export default function EvolutionChart({
  title, icon: Icon, dataKey, goalKey, barColor,
  goals, monthlyGoals, formatter, yTickFormatter,
}: Props) {
  const [period, setPeriod] = useState<PeriodFilter>("6m");
  const kpiHistory = useKpiHistory(period);

  const historyData = (kpiHistory.data ?? []).map((d: any) => {
    const mk = d.monthKey || "";
    return {
      ...d,
      [goalKey]: monthlyGoals[dataKey]?.[mk] ?? goals[dataKey] ?? 0,
    };
  });

  const defaultYFmt = yTickFormatter ?? ((v: number) => `${(v / 1000).toFixed(0)}k`);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon size={14} className="text-muted-foreground" /> {title}
          </CardTitle>
          <div className="flex items-center gap-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
                  period === opt.value
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {kpiHistory.isLoading ? (
          <Skeleton className="w-full" style={{ height: 220 }} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" />
              <XAxis dataKey="month" stroke="hsl(43,10%,55%)" fontSize={11} />
              <YAxis stroke="hsl(43,10%,55%)" fontSize={11} tickFormatter={defaultYFmt} />
              <Tooltip {...tooltipStyle} formatter={formatter} />
              <Bar dataKey={dataKey} fill={barColor} radius={[6, 6, 0, 0]} opacity={0.85} barSize={32} />
              <Line
                type="monotone"
                dataKey={goalKey}
                stroke="hsl(40,100%,60%)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(40,100%,60%)", stroke: "hsl(40,100%,60%)" }}
                activeDot={{ r: 6, fill: "hsl(40,100%,60%)", stroke: "hsl(0,0%,10%)", strokeWidth: 2 }}
                name="Meta"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
