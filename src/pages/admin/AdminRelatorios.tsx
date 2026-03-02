import { useState, useEffect, lazy, Suspense } from "react";
import AdminFinanceiroDashboard from "./AdminFinanceiroDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  ReferenceLine, Legend,
} from "recharts";
import { TrendingUp, DollarSign, Users, Activity, Target, Settings2, Check, Wallet } from "lucide-react";
import {
  useMRR, useChurnRate, useCAC, useRevenueHistory,
  useRetentionHistory, useChurnReasons, useAcquisitionChannels, useDemographics,
  useTCV,
} from "@/hooks/useAdminReports";
import EvolutionChart from "@/components/admin/EvolutionChart";
import { useMetricGoals, useUpdateMetricGoal, useMonthlyGoals, useUpsertMonthlyGoal } from "@/hooks/useMetricGoals";
import { toast } from "sonner";

const tooltipStyle = {
  contentStyle: { background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,16%)", borderRadius: 8, color: "hsl(0,0%,90%)" },
  labelStyle: { color: "hsl(43,30%,85%)" },
  itemStyle: { color: "hsl(0,0%,90%)" },
};

const fmt = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`;

const KpiSkeleton = () => (
  <Card className="bg-card border-border">
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-4 w-8" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-3 w-14" />
    </CardContent>
  </Card>
);

const ChartSkeleton = ({ h = 300 }: { h?: number }) => (
  <Skeleton className="w-full" style={{ height: h }} />
);

// Goals config modal
const GoalsConfigModal = ({ goals, monthlyGoals }: { goals: Record<string, number>; monthlyGoals: Record<string, Record<string, number>> }) => {
  const update = useUpdateMetricGoal();
  const upsertMonthly = useUpsertMonthlyGoal();
  const [tab, setTab] = useState<"global" | "mensal">("mensal");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [globalValues, setGlobalValues] = useState<Record<string, string>>({
    mrr: String(goals.mrr ?? 0),
    ltv: String(goals.ltv ?? 0),
    cac: String(goals.cac ?? 0),
    churn: String(goals.churn ?? 0),
    tcv: String(goals.tcv ?? 0),
  });

  const [monthlyValues, setMonthlyValues] = useState<Record<string, string>>({});

  // Load monthly values when month changes
  useEffect(() => {
    const vals: Record<string, string> = {};
    for (const key of ["mrr", "ltv", "cac", "churn", "tcv"]) {
      vals[key] = String(monthlyGoals[key]?.[selectedMonth] ?? goals[key] ?? 0);
    }
    setMonthlyValues(vals);
  }, [selectedMonth, monthlyGoals, goals]);

  const labels: Record<string, string> = {
    mrr: "MRR (R$)",
    ltv: "LTV Médio (R$)",
    cac: "CAC (R$)",
    churn: "Churn Rate (%)",
    tcv: "TCV (R$)",
  };

  const saveGlobal = async () => {
    for (const key of Object.keys(globalValues)) {
      const v = Number(globalValues[key]);
      if (!isNaN(v) && v !== goals[key]) {
        await update.mutateAsync({ metric_key: key, goal_value: v });
      }
    }
    toast.success("Metas globais atualizadas!");
  };

  const saveMonthly = async () => {
    for (const key of Object.keys(monthlyValues)) {
      const v = Number(monthlyValues[key]);
      if (!isNaN(v)) {
        await upsertMonthly.mutateAsync({ metric_key: key, month: selectedMonth, goal_value: v });
      }
    }
    toast.success(`Metas de ${formatMonthLabel(selectedMonth)} atualizadas!`);
  };

  // Generate months from Sep 2025 to 12 months ahead
  const monthOptions: string[] = [];
  const startDate = new Date(2025, 8); // Sep 2025
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 12);
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    monthOptions.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          <Settings2 size={14} /> Definir Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cinzel">Metas de Métricas</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="mensal">Por Mês</TabsTrigger>
            <TabsTrigger value="global">Global (padrão)</TabsTrigger>
          </TabsList>

          <TabsContent value="mensal" className="space-y-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {Object.entries(labels).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <Input
                  type="number"
                  value={monthlyValues[key] ?? ""}
                  onChange={(e) => setMonthlyValues((p) => ({ ...p, [key]: e.target.value }))}
                  className="bg-background border-border"
                  placeholder={`Padrão: ${goals[key] ?? ""}`}
                />
              </div>
            ))}
            <Button onClick={saveMonthly} disabled={upsertMonthly.isPending} className="w-full gap-2">
              <Check size={14} /> Salvar Metas de {formatMonthLabel(selectedMonth)}
            </Button>
          </TabsContent>

          <TabsContent value="global" className="space-y-4">
            <p className="text-xs text-muted-foreground">Metas padrão para meses sem meta específica definida.</p>
            {Object.entries(labels).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <Input
                  type="number"
                  value={globalValues[key]}
                  onChange={(e) => setGlobalValues((p) => ({ ...p, [key]: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
            ))}
            <Button onClick={saveGlobal} disabled={update.isPending} className="w-full gap-2">
              <Check size={14} /> Salvar Metas Globais
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year}`;
}

const KpiDrilldownModal = lazy(() => import("@/components/admin/KpiDrilldownModal"));

// SVG semi-circle gauge component for KPIs
const KpiGauge = ({ label, formatted, secondaryFormatted, goalLabel, pct, color }: {
  label: string; value?: number; formatted: string; secondaryFormatted?: string; goal?: number; goalLabel: string;
  pct: number; color: string; invertProgress?: boolean;
}) => {
  const clampedPct = Math.max(0, Math.min(pct, 100));
  const status = pct >= 100 ? "✅ Meta atingida" : pct >= 80 ? "🔥 Quase lá" : pct >= 50 ? "⚡ Em progresso" : "⚠️ Atenção";

  // SVG arc math
  const cx = 60, cy = 60, r = 48, strokeWidth = 10;
  const totalAngle = Math.PI; // 180 degrees
  const filledAngle = totalAngle * (clampedPct / 100);

  const bgArc = describeArc(cx, cy, r, Math.PI, 0);
  const fillArc = clampedPct > 0 ? describeArc(cx, cy, r, Math.PI, Math.PI - filledAngle) : "";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[120px] h-[72px]">
        <svg viewBox="0 0 120 72" className="w-full h-full">
          <path d={bgArc} fill="none" stroke="hsl(0,0%,16%)" strokeWidth={strokeWidth} strokeLinecap="round" />
          {clampedPct > 0 && (
            <path d={fillArc} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
          <p className="text-lg font-bold text-foreground leading-none">{formatted}</p>
          <p className="text-[9px] text-muted-foreground">{secondaryFormatted ?? `${pct}% da meta`}</p>
        </div>
      </div>
      <p className="text-xs font-medium text-foreground leading-none">{label}</p>
      <p className="text-[10px] text-muted-foreground leading-none">Meta: {goalLabel}</p>
      <p className="text-[10px] leading-none">{status}</p>
    </div>
  );
};

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0;
  // Sweep: clockwise when going from left to right (startAngle > endAngle)
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

const AdminRelatorios = () => {
  const [showPercent, setShowPercent] = useState(false);
  const [drilldownKey, setDrilldownKey] = useState<"mrr" | "ltv" | "cac" | "churn" | "tcv" | null>(null);

  const mrr = useMRR();
  const churn = useChurnRate();
  const cac = useCAC();
  const tcv = useTCV();
  const revenue = useRevenueHistory();
  const retention = useRetentionHistory();
  const churnReasons = useChurnReasons();
  const acquisition = useAcquisitionChannels();
  const demo = useDemographics();
  const goalsQuery = useMetricGoals();
  const monthlyGoalsQuery = useMonthlyGoals();

  const mrrVal = mrr.data?.mrr ?? 0;
  const arpuVal = mrr.data?.arpu ?? 0;
  const churnVal = churn.data?.churnRate ?? 0;
  const ltvVal = churnVal > 0 ? Math.round(arpuVal / (churnVal / 100)) : 0;
  const cacVal = cac.data?.cac ?? 0;
  const tcvVal = tcv.data?.tcv ?? 0;

  const goals = goalsQuery.data ?? { mrr: 0, ltv: 0, cac: 0, churn: 0, tcv: 0 };
  const kpiLoading = mrr.isLoading || churn.isLoading || cac.isLoading || tcv.isLoading;

  const kpis = [
    { key: "mrr", label: "MRR", value: mrrVal, formatted: fmt(mrrVal), icon: DollarSign, goal: goals.mrr ?? 50000, isCurrency: true, invertProgress: false, color: "hsl(43,76%,53%)" },
    { key: "ltv", label: "LTV Médio", value: ltvVal, formatted: fmt(ltvVal), icon: TrendingUp, goal: goals.ltv ?? 3000, isCurrency: true, invertProgress: false, color: "hsl(140,60%,40%)" },
    { key: "cac", label: "CAC", value: cacVal, formatted: fmt(cacVal), icon: Users, goal: goals.cac ?? 200, isCurrency: true, invertProgress: true, color: "hsl(210,70%,50%)" },
    { key: "churn", label: "Churn Rate", value: churnVal, formatted: `${churnVal}%`, icon: Activity, goal: goals.churn ?? 5, isCurrency: false, invertProgress: true, color: "hsl(0,80%,50%)" },
    { key: "tcv", label: "TCV", value: tcvVal, formatted: fmt(tcvVal), icon: Wallet, goal: goals.tcv ?? 100000, isCurrency: true, invertProgress: false, color: "hsl(280,60%,50%)" },
  ];

  const getProgress = (k: typeof kpis[0]) => {
    if (k.goal === 0) return 0;
    if (k.invertProgress) {
      return k.value <= k.goal ? 100 : Math.max(0, Math.round((1 - (k.value - k.goal) / k.goal) * 100));
    }
    return Math.min(100, Math.round((k.value / k.goal) * 100));
  };

  const getProgressColor = (pct: number) => {
    return pct >= 80 ? "hsl(140,60%,40%)" : pct >= 50 ? "hsl(43,76%,53%)" : "hsl(0,80%,50%)";
  };

  const monthlyGoals = monthlyGoalsQuery.data ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Relatórios & Análises</h1>
          <p className="text-sm text-muted-foreground">Performance do negócio e métricas da plataforma</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Nominal</span>
            <Switch checked={showPercent} onCheckedChange={setShowPercent} />
            <span className="text-xs text-muted-foreground">% da Meta</span>
          </div>
          {!goalsQuery.isLoading && <GoalsConfigModal goals={goals} monthlyGoals={monthlyGoals} />}
        </div>
      </div>

      {/* KPI Gauges */}
      {kpiLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {kpis.map((k) => {
            const pct = getProgress(k);
            const goalLabel = k.isCurrency ? fmt(k.goal) : `${k.goal}%`;
            return (
              <Card
                key={k.key}
                className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
                 onClick={() => setDrilldownKey(k.key as any)}
              >
                <CardContent className="p-3">
                  {showPercent ? (
                    <KpiGauge
                      label={k.label}
                      value={k.value}
                      formatted={`${pct}%`}
                      secondaryFormatted={k.formatted}
                      goal={k.goal}
                      goalLabel={goalLabel}
                      pct={pct}
                      color={getProgressColor(pct)}
                      invertProgress={k.invertProgress}
                    />
                  ) : (
                    <KpiGauge
                      label={k.label}
                      value={k.value}
                      formatted={k.formatted}
                      secondaryFormatted={`${pct}% da meta`}
                      goal={k.goal}
                      goalLabel={goalLabel}
                      pct={pct}
                      color={k.color}
                      invertProgress={k.invertProgress}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabs + KPI Evolution Charts */}
      <Tabs defaultValue="financeiro" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="retencao">Retenção</TabsTrigger>
          <TabsTrigger value="aquisicao">Aquisição</TabsTrigger>
          <TabsTrigger value="marketing">Marketing / Qualificação</TabsTrigger>
        </TabsList>

        {/* Financeiro: MRR + TCV evolution + TCV breakdown */}
        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EvolutionChart
              title="MRR - Evolução"
              icon={DollarSign}
              dataKey="mrr"
              goalKey="mrrGoal"
              barColor="hsl(43,76%,53%)"
              goals={goals}
              monthlyGoals={monthlyGoals}
              formatter={(v: number, name: string) => [fmt(v), name === "mrrGoal" ? "Meta" : "MRR"]}
            />
            <EvolutionChart
              title="TCV - Evolução"
              icon={Wallet}
              dataKey="tcv"
              goalKey="tcvGoal"
              barColor="hsl(280,60%,50%)"
              goals={goals}
              monthlyGoals={monthlyGoals}
              formatter={(v: number, name: string) => [fmt(v), name === "tcvGoal" ? "Meta" : "TCV"]}
            />
          </div>
          <AdminFinanceiroDashboard />
        </TabsContent>

        {/* Retenção: LTV + Churn evolution + retention + churn reasons */}
        <TabsContent value="retencao" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EvolutionChart
              title="LTV - Evolução"
              icon={TrendingUp}
              dataKey="ltv"
              goalKey="ltvGoal"
              barColor="hsl(140,60%,40%)"
              goals={goals}
              monthlyGoals={monthlyGoals}
              formatter={(v: number, name: string) => [fmt(v), name === "ltvGoal" ? "Meta" : "LTV"]}
              yTickFormatter={(v) => fmt(v)}
            />
            <EvolutionChart
              title="Churn Rate - Evolução"
              icon={Activity}
              dataKey="churn"
              goalKey="churnGoal"
              barColor="hsl(0,80%,50%)"
              goals={goals}
              monthlyGoals={monthlyGoals}
              formatter={(v: number, name: string) => [`${v}%`, name === "churnGoal" ? "Meta" : "Churn"]}
              yTickFormatter={(v) => `${v}%`}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Retenção Mensal (%)</CardTitle>
              </CardHeader>
              <CardContent>
                {retention.isLoading ? <ChartSkeleton h={250} /> : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={retention.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" />
                      <XAxis dataKey="month" stroke="hsl(43,10%,55%)" fontSize={12} />
                      <YAxis stroke="hsl(43,10%,55%)" fontSize={12} domain={[0, 100]} />
                      <Tooltip {...tooltipStyle} />
                      <ReferenceLine y={100 - (goals.churn ?? 5)} stroke="hsl(140,60%,40%)" strokeDasharray="6 3" label={{ value: `Meta`, fill: "hsl(140,60%,40%)", fontSize: 10 }} />
                      <Line type="monotone" dataKey="retention" stroke="hsl(43,76%,53%)" strokeWidth={2} dot={{ fill: "hsl(43,76%,53%)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Motivos de Churn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {churnReasons.isLoading ? <ChartSkeleton h={200} /> : (
                  (churnReasons.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Sem dados de cancelamento</p>
                  ) : (
                    (churnReasons.data ?? []).map((r) => (
                      <div key={r.reason} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{r.reason}</span>
                          <span className="text-foreground font-medium">{r.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${r.pct}%` }} />
                        </div>
                      </div>
                    ))
                  )
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aquisição */}
        <TabsContent value="aquisicao">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Canais de Aquisição</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col lg:flex-row items-center gap-6">
              {acquisition.isLoading ? <ChartSkeleton h={250} /> : (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={acquisition.data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                        {(acquisition.data ?? []).map((e, i) => (<Cell key={i} fill={e.color} />))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 w-full lg:w-auto">
                    {(acquisition.data ?? []).map((a) => (
                      <div key={a.source} className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                        <span className="text-sm text-foreground">{a.source}</span>
                        <span className="ml-auto text-sm font-bold text-foreground">{a.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketing / Qualificação */}
        <TabsContent value="marketing" className="space-y-4">
          {demo.isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Total Anamneses", value: String((demo.data?.objectiveData ?? []).reduce((s, o) => s + o.value, 0)) },
                  { label: "Objetivo #1", value: demo.data?.objectiveData?.[0]?.name ?? "—" },
                  { label: "Faixa Etária #1", value: demo.data?.ageData?.sort((a, b) => b.total - a.total)?.[0]?.faixa ?? "—" },
                  { label: "Nível #1", value: demo.data?.experienceData?.[0]?.name ?? "—" },
                ].map((k) => (
                  <Card key={k.label} className="bg-card border-border">
                    <CardContent className="p-4">
                      <Target size={16} className="text-muted-foreground mb-2" />
                      <p className="text-lg font-bold text-foreground">{k.value}</p>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Distribuição de Objetivos</CardTitle></CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    {(demo.data?.objectiveData ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6">Sem dados</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={demo.data?.objectiveData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                              {(demo.data?.objectiveData ?? []).map((e, i) => (<Cell key={i} fill={e.color} />))}
                            </Pie>
                            <Tooltip {...tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-3 justify-center">
                          {(demo.data?.objectiveData ?? []).map((o) => (
                            <div key={o.name} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.color }} />
                              <span className="text-xs text-foreground">{o.name} ({o.value}%)</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Faixas Etárias</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={demo.data?.ageData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" />
                        <XAxis dataKey="faixa" stroke="hsl(43,10%,55%)" fontSize={12} />
                        <YAxis stroke="hsl(43,10%,55%)" fontSize={12} />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey="total" fill="hsl(43,76%,53%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Nível de Experiência</CardTitle></CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    {(demo.data?.experienceData ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6">Sem dados</p>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={demo.data?.experienceData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                              {(demo.data?.experienceData ?? []).map((e, i) => (<Cell key={i} fill={e.color} />))}
                            </Pie>
                            <Tooltip {...tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-3 justify-center">
                          {(demo.data?.experienceData ?? []).map((o) => (
                            <div key={o.name} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.color }} />
                              <span className="text-xs text-foreground">{o.name} ({o.value}%)</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Restrições Alimentares</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(demo.data?.restricoesData ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6">Sem dados</p>
                    ) : (
                      (demo.data?.restricoesData ?? []).map((r) => (
                        <div key={r.restricao} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{r.restricao}</span>
                            <span className="text-foreground font-medium">{r.pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${r.pct}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Drill-down modal */}
      {drilldownKey && (() => {
        const k = kpis.find((x) => x.key === drilldownKey)!;
        const pct = getProgress(k);
        const goalLabel = k.isCurrency ? fmt(k.goal) : `${k.goal}%`;
        return (
          <Suspense fallback={null}>
            <KpiDrilldownModal
              open
              onClose={() => setDrilldownKey(null)}
              metricKey={drilldownKey}
              currentValue={k.value}
              formattedValue={k.formatted}
              goal={k.goal}
              goalLabel={goalLabel}
              progress={pct}
            />
          </Suspense>
        );
      })()}
    </div>
  );
};

export default AdminRelatorios;
