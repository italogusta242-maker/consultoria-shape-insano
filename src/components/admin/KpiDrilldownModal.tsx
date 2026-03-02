import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { Info } from "lucide-react";

const tooltipStyle = {
  contentStyle: { background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,16%)", borderRadius: 8 },
  labelStyle: { color: "hsl(43,30%,85%)" },
};

type MetricKey = "mrr" | "ltv" | "cac" | "churn" | "tcv";

interface Props {
  open: boolean;
  onClose: () => void;
  metricKey: MetricKey;
  currentValue: number;
  formattedValue: string;
  goal: number;
  goalLabel: string;
  progress: number;
}

const formulas: Record<MetricKey, { title: string; formula: string; explanation: string }> = {
  mrr: {
    title: "MRR — Receita Recorrente Mensal",
    formula: "MRR = Σ plan_price (assinaturas ativas)",
    explanation: "Soma dos valores de todas as assinaturas com status 'active' no momento atual. Representa a receita mensal previsível do negócio.",
  },
  ltv: {
    title: "LTV — Lifetime Value Médio",
    formula: "LTV = ARPU / (Churn Rate / 100)",
    explanation: "O valor médio que um cliente gera ao longo de toda a sua permanência. ARPU é a receita média por usuário (MRR / assinaturas ativas) e Churn Rate é a taxa de cancelamento mensal.",
  },
  cac: {
    title: "CAC — Custo de Aquisição de Cliente",
    formula: "CAC = Investimento em Marketing / Novos Clientes no Mês",
    explanation: "Total gasto em marketing (tabela marketing_spend) dividido pelo número de novas assinaturas iniciadas no mês corrente.",
  },
  churn: {
    title: "Churn Rate — Taxa de Cancelamento",
    formula: "Churn = (Cancelamentos no Mês / Ativos no Início do Mês) × 100",
    explanation: "Percentual de assinaturas canceladas no mês atual em relação ao total de assinaturas que estavam ativas no início do período.",
  },
  tcv: {
    title: "TCV — Valor Total de Contrato",
    formula: "TCV = Σ (planos trimestrais valor integral) + Σ (planos mensais × 3)",
    explanation: "Soma do valor de todos os contratos ativos. Planos trimestrais (R$ 567 e R$ 597) são contabilizados pelo valor integral. Planos mensais são projetados multiplicando o valor por 3 (trimestre).",
  },
};

// Fetch logs (source data) for each metric
function useMetricLogs(metricKey: MetricKey) {
  return useQuery({
    queryKey: ["kpi-drilldown-logs", metricKey],
    queryFn: async () => {
      if (metricKey === "mrr") {
        const { data } = await supabase
          .from("subscriptions")
          .select("id, user_id, plan_price, started_at, status")
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(20);
        return (data ?? []).map((r: any) => ({
          id: r.id.slice(0, 8),
          label: `Assinatura ${r.id.slice(0, 8)}`,
          value: `R$ ${Number(r.plan_price).toFixed(2)}`,
          date: format(new Date(r.started_at), "dd/MM/yyyy"),
          status: r.status,
        }));
      }
      if (metricKey === "churn") {
        const monthStart = startOfMonth(new Date());
        const { data } = await supabase
          .from("subscriptions")
          .select("id, cancel_reason, canceled_at, plan_price")
          .not("canceled_at", "is", null)
          .gte("canceled_at", monthStart.toISOString())
          .order("canceled_at", { ascending: false })
          .limit(20);
        return (data ?? []).map((r: any) => ({
          id: r.id.slice(0, 8),
          label: r.cancel_reason || "Sem motivo",
          value: `R$ ${Number(r.plan_price).toFixed(2)}`,
          date: r.canceled_at ? format(new Date(r.canceled_at), "dd/MM/yyyy") : "—",
          status: "canceled",
        }));
      }
      if (metricKey === "cac") {
        const monthStart = startOfMonth(new Date());
        const { data } = await supabase
          .from("marketing_spend")
          .select("id, channel, amount, month")
          .gte("month", format(monthStart, "yyyy-MM-dd"))
          .order("month", { ascending: false })
          .limit(20);
        return (data ?? []).map((r: any) => ({
          id: r.id.slice(0, 8),
          label: `Canal: ${r.channel}`,
          value: `R$ ${Number(r.amount).toFixed(2)}`,
          date: format(new Date(r.month), "MM/yyyy"),
          status: "spend",
        }));
      }
      // LTV: show active subscriptions with computed individual LTV
      if (metricKey === "ltv") {
        const { data } = await supabase
          .from("subscriptions")
          .select("id, plan_price, started_at, status")
          .eq("status", "active")
          .order("plan_price", { ascending: false })
          .limit(20);
        return (data ?? []).map((r: any) => ({
          id: r.id.slice(0, 8),
          label: `Assinatura ${r.id.slice(0, 8)}`,
          value: `R$ ${Number(r.plan_price).toFixed(2)}/mês`,
          date: format(new Date(r.started_at), "dd/MM/yyyy"),
          status: r.status,
        }));
      }
      // TCV: show paid invites (source of truth for closer sales)
      const { data } = await supabase
        .from("invites")
        .select("id, plan_value, payment_status, status, created_at, name, subscription_plan_id")
        .in("payment_status", ["paid", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []).map((r: any) => {
        const value = Number(r.plan_value) || 0;
        return {
          id: r.id.slice(0, 8),
          label: r.name || r.id.slice(0, 8),
          value: `R$ ${value.toFixed(2)}`,
          date: format(new Date(r.created_at), "dd/MM/yyyy"),
          status: r.status === "used" ? "active" : r.payment_status,
        };
      });
    },
  });
}

// Fetch 6-month evolution for the metric
function useMetricEvolution(metricKey: MetricKey) {
  return useQuery({
    queryKey: ["kpi-drilldown-evolution", metricKey],
    queryFn: async () => {
      const months: { label: string; start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        months.push({ label: format(d, "MMM"), start: startOfMonth(d), end: endOfMonth(d) });
      }

      const { data: subs } = await supabase
        .from("subscriptions")
        .select("plan_price, started_at, canceled_at, status");

      const allSubs = subs ?? [];

      if (metricKey === "mrr") {
        return months.map(({ label, start, end }) => {
          let mrr = 0;
          for (const s of allSubs) {
            const sa = new Date(s.started_at);
            const ca = s.canceled_at ? new Date(s.canceled_at) : null;
            if (sa <= end && (!ca || ca >= start)) mrr += Number(s.plan_price);
          }
          return { month: label, value: mrr };
        });
      }

      if (metricKey === "churn") {
        return months.map(({ label, start, end }) => {
          let activeStart = 0;
          let canceled = 0;
          for (const s of allSubs) {
            const sa = new Date(s.started_at);
            const ca = s.canceled_at ? new Date(s.canceled_at) : null;
            if (sa <= start && (!ca || ca >= start)) activeStart++;
            if (ca && ca >= start && ca <= end) canceled++;
          }
          const rate = activeStart > 0 ? Math.round((canceled / activeStart) * 1000) / 10 : 0;
          return { month: label, value: rate };
        });
      }

      if (metricKey === "cac") {
        const { data: spend } = await supabase.from("marketing_spend").select("amount, month");
        return months.map(({ label, start, end }) => {
          const monthSpend = (spend ?? [])
            .filter((s: any) => { const d = new Date(s.month); return d >= start && d <= end; })
            .reduce((sum: number, s: any) => sum + Number(s.amount), 0);
          const newSubs = allSubs.filter((s) => {
            const sa = new Date(s.started_at);
            return sa >= start && sa <= end;
          }).length;
          return { month: label, value: newSubs > 0 ? Math.round(monthSpend / newSubs) : 0 };
        });
      }

      // LTV
      if (metricKey === "ltv") {
        return months.map(({ label, start, end }) => {
          let activeCount = 0;
          let totalPrice = 0;
          let canceledCount = 0;
          let activeStartCount = 0;
          for (const s of allSubs) {
            const sa = new Date(s.started_at);
            const ca = s.canceled_at ? new Date(s.canceled_at) : null;
            if (sa <= end && (!ca || ca >= start)) { activeCount++; totalPrice += Number(s.plan_price); }
            if (sa <= start && (!ca || ca >= start)) activeStartCount++;
            if (ca && ca >= start && ca <= end) canceledCount++;
          }
          const arpu = activeCount > 0 ? totalPrice / activeCount : 0;
          const churnRate = activeStartCount > 0 ? (canceledCount / activeStartCount) : 0;
          const ltv = churnRate > 0 ? Math.round(arpu / churnRate) : 0;
          return { month: label, value: ltv };
        });
      }

      // TCV: use invites as source of truth (cumulative)
      const { data: invites } = await supabase
        .from("invites")
        .select("plan_value, payment_status, created_at")
        .in("payment_status", ["paid", "confirmed"]);
      const validInvites = invites ?? [];

      return months.map(({ label, start, end }) => {
        let tcv = 0;
        for (const inv of validInvites) {
          const invDate = new Date(inv.created_at);
          if (invDate <= end) {
            tcv += Number(inv.plan_value) || 0;
          }
        }
        return { month: label, value: tcv };
      });
    },
  });
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400",
    canceled: "bg-destructive/20 text-destructive",
    spend: "bg-amber-500/20 text-amber-400",
  };
  return map[status] || "bg-secondary text-muted-foreground";
};

export default function KpiDrilldownModal({ open, onClose, metricKey, currentValue, formattedValue, goal, goalLabel, progress }: Props) {
  const logs = useMetricLogs(metricKey);
  const evolution = useMetricEvolution(metricKey);
  const info = formulas[metricKey];

  const valueFormatter = (v: number) => {
    if (metricKey === "churn") return `${v}%`;
    return v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-lg">{info.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Current value + progress */}
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-3xl font-bold text-foreground">{formattedValue}</p>
              <p className="text-xs text-muted-foreground">Valor Atual</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-muted-foreground">{goalLabel}</p>
              <p className="text-xs text-muted-foreground">Meta Definida</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-primary">{progress}%</p>
              <p className="text-xs text-muted-foreground">Progresso</p>
            </div>
          </div>

          {/* Formula */}
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2 border border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Info size={14} className="text-primary" /> Fórmula
            </div>
            <p className="text-sm font-mono text-primary">{info.formula}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{info.explanation}</p>
          </div>

          {/* Evolution chart */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Evolução (6 meses)</h4>
            {evolution.isLoading ? (
              <Skeleton className="w-full h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={evolution.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" />
                  <XAxis dataKey="month" stroke="hsl(43,10%,55%)" fontSize={12} />
                  <YAxis stroke="hsl(43,10%,55%)" fontSize={12} tickFormatter={valueFormatter} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [valueFormatter(v), info.title.split("—")[0].trim()]} />
                  <Line type="monotone" dataKey="value" stroke="hsl(43,76%,53%)" strokeWidth={2} dot={{ fill: "hsl(43,76%,53%)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Source logs */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Logs de Origem (últimos registros)</h4>
            {logs.isLoading ? (
              <Skeleton className="w-full h-[150px]" />
            ) : (logs.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados disponíveis</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-2.5 text-muted-foreground font-medium text-xs">ID</th>
                      <th className="text-left p-2.5 text-muted-foreground font-medium text-xs">Descrição</th>
                      <th className="text-left p-2.5 text-muted-foreground font-medium text-xs">Valor</th>
                      <th className="text-left p-2.5 text-muted-foreground font-medium text-xs">Data</th>
                      <th className="text-left p-2.5 text-muted-foreground font-medium text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs.data ?? []).map((log, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="p-2.5 font-mono text-xs text-muted-foreground">{log.id}</td>
                        <td className="p-2.5 text-foreground">{log.label}</td>
                        <td className="p-2.5 text-foreground font-medium">{log.value}</td>
                        <td className="p-2.5 text-muted-foreground">{log.date}</td>
                        <td className="p-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
