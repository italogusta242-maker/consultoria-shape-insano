import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, TrendingUp, Users, AlertTriangle, Search,
  CheckCircle2, Clock, XCircle, BarChart3, ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type PaymentStatus = "all" | "pending" | "confirmed" | "overdue" | "cancelled";

const statusMap: Record<string, { label: string; icon: typeof Clock; className: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", icon: Clock, className: "text-yellow-500", badgeVariant: "outline" },
  confirmed: { label: "Confirmado", icon: CheckCircle2, className: "text-green-500", badgeVariant: "default" },
  paid: { label: "Pago", icon: CheckCircle2, className: "text-green-500", badgeVariant: "default" },
  overdue: { label: "Vencido", icon: AlertTriangle, className: "text-red-500", badgeVariant: "destructive" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "text-muted-foreground", badgeVariant: "secondary" },
  refunded: { label: "Reembolsado", icon: XCircle, className: "text-muted-foreground", badgeVariant: "secondary" },
};

const AdminFinanceiroDashboard = () => {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("all");
  const [search, setSearch] = useState("");

  const { data: charges, isLoading } = useQuery({
    queryKey: ["admin_financial_charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, name, email, cpf, plan_value, payment_status, status, created_at, expires_at, product_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["admin_subscriptions_kpi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, status, plan_price, started_at, canceled_at, user_id");
      if (error) throw error;
      return data;
    },
  });

  const kpis = useMemo(() => {
    if (!charges) return { totalRevenue: 0, mrr: 0, avgTicket: 0, overdueCount: 0, churnRate: 0 };
    const confirmed = charges.filter((c) => c.payment_status === "confirmed" || c.payment_status === "paid");
    const totalRevenue = confirmed.reduce((sum, c) => sum + (c.plan_value || 0), 0);
    const avgTicket = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;
    const overdueCount = charges.filter((c) => c.payment_status === "overdue").length;
    const activeSubs = subscriptions?.filter((s) => s.status === "active") || [];
    const mrr = activeSubs.reduce((sum, s) => sum + (s.plan_price || 0), 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const canceledRecent = subscriptions?.filter(
      (s) => s.status === "canceled" && s.canceled_at && s.canceled_at >= thirtyDaysAgo
    ).length || 0;
    const totalSubs = (subscriptions?.length || 0);
    const churnRate = totalSubs > 0 ? (canceledRecent / totalSubs) * 100 : 0;
    return { totalRevenue, mrr, avgTicket, overdueCount, churnRate };
  }, [charges, subscriptions]);

  const filtered = useMemo(() => {
    if (!charges) return [];
    let result = charges;
    if (statusFilter !== "all") {
      result = result.filter((c) => {
        const ps = c.payment_status || "pending";
        if (statusFilter === "confirmed") return ps === "confirmed" || ps === "paid";
        return ps === statusFilter;
      });
    }
    if (search.length >= 2) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.cpf?.includes(q)
      );
    }
    return result;
  }, [charges, statusFilter, search]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const kpiCards = [
    { title: "Receita Total", value: fmt(kpis.totalRevenue), icon: DollarSign, color: "text-primary" },
    { title: "Ticket Médio", value: fmt(kpis.avgTicket), icon: BarChart3, color: "text-primary" },
    { title: "Inadimplentes", value: String(kpis.overdueCount), icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{kpi.title}</span>
                <kpi.icon size={16} className={kpi.color} />
              </div>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Collapsible>
        <Card className="bg-card border-border">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Cobranças</CardTitle>
                <ChevronDown size={16} className="text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input placeholder="Buscar por nome, e-mail ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatus)}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma cobrança encontrada</p>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aluno</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c) => {
                        const ps = c.payment_status || "pending";
                        const st = statusMap[ps] || statusMap.pending;
                        const StIcon = st.icon;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{c.email}</TableCell>
                            <TableCell className="font-semibold text-primary">
                              {c.plan_value ? fmt(c.plan_value) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={st.badgeVariant} className="gap-1 text-xs">
                                <StIcon size={10} />
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-right">
                {filtered.length} cobrança{filtered.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};

export default AdminFinanceiroDashboard;
