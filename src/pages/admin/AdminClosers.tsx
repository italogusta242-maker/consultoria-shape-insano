import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Briefcase, Users, TrendingUp, Loader2, Eye, DollarSign,
  CheckCircle2, Clock, XCircle, AlertTriangle, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeGlobalPresence, getOnlineUserIds } from "@/services/presenceService";

interface CloserProfile {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Invite {
  id: string;
  name: string | null;
  email: string;
  status: string;
  payment_status: string | null;
  plan_value: number | null;
  created_at: string;
  created_by: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusBadge = (status: string, paymentStatus: string | null) => {
  if (status === "used" && (paymentStatus === "paid" || paymentStatus === "confirmed")) {
    return <Badge variant="default" className="gap-1 text-[10px]"><CheckCircle2 size={10} /> Pago & Ativo</Badge>;
  }
  if (status === "used") {
    return <Badge variant="outline" className="gap-1 text-[10px]"><CheckCircle2 size={10} /> Ativado</Badge>;
  }
  if (status === "expired") {
    return <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle size={10} /> Expirado</Badge>;
  }
  if (paymentStatus === "paid" || paymentStatus === "confirmed") {
    return <Badge variant="default" className="gap-1 text-[10px]"><DollarSign size={10} /> Pago</Badge>;
  }
  return <Badge variant="secondary" className="gap-1 text-[10px]"><Clock size={10} /> Pendente</Badge>;
};

const AdminClosers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [closers, setClosers] = useState<CloserProfile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [detailCloser, setDetailCloser] = useState<CloserProfile | null>(null);

  useEffect(() => {
    const load = async () => {
      // Get all closers
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "closer");

      if (!roles || roles.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email, avatar_url")
        .in("id", userIds);

      setClosers(
        (profiles || []).map((p) => ({
          userId: p.id,
          name: p.nome || p.email || "Sem nome",
          email: p.email || "",
          avatarUrl: p.avatar_url,
        }))
      );

      // Get all invites created by closers
      const { data: inv } = await supabase
        .from("invites")
        .select("id, name, email, status, payment_status, plan_value, created_at, created_by")
        .in("created_by", userIds)
        .order("created_at", { ascending: false });

      setInvites(inv || []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeGlobalPresence(user.id, (state) => {
      setOnlineIds(getOnlineUserIds(state));
    });
    return unsub;
  }, [user]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const getCloserMetrics = (closerId: string) => {
    const closerInvites = invites.filter((i) => i.created_by === closerId);
    const total = closerInvites.length;
    const activated = closerInvites.filter((i) => i.status === "used").length;
    const paid = closerInvites.filter(
      (i) => i.payment_status === "paid" || i.payment_status === "confirmed"
    ).length;
    const revenue = closerInvites
      .filter((i) => i.payment_status === "paid" || i.payment_status === "confirmed")
      .reduce((sum, i) => sum + (i.plan_value || 0), 0);
    const pending = closerInvites.filter((i) => i.status === "pending").length;
    const expired = closerInvites.filter((i) => i.status === "expired").length;
    const conversion = total > 0 ? Math.round((activated / total) * 100) : 0;

    return { total, activated, paid, revenue, pending, expired, conversion };
  };

  // Global metrics
  const globalMetrics = {
    totalClosers: closers.length,
    onlineClosers: closers.filter((c) => onlineIds.includes(c.userId)).length,
    totalInvites: invites.length,
    totalActivated: invites.filter((i) => i.status === "used").length,
    totalRevenue: invites
      .filter((i) => i.payment_status === "paid" || i.payment_status === "confirmed")
      .reduce((sum, i) => sum + (i.plan_value || 0), 0),
    globalConversion: invites.length > 0
      ? Math.round((invites.filter((i) => i.status === "used").length / invites.length) * 100)
      : 0,
  };

  const detailInvites = detailCloser
    ? invites.filter((i) => i.created_by === detailCloser.userId)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Closers</h1>
        <p className="text-sm text-muted-foreground">Gestão de closers, métricas de vendas e conversão</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Closers", value: globalMetrics.totalClosers, icon: Users },
          { label: "Online", value: globalMetrics.onlineClosers, icon: TrendingUp },
          { label: "Convites", value: globalMetrics.totalInvites, icon: Receipt },
          { label: "Ativados", value: globalMetrics.totalActivated, icon: CheckCircle2 },
          { label: "Receita", value: fmt(globalMetrics.totalRevenue), icon: DollarSign },
          { label: "Conversão", value: `${globalMetrics.globalConversion}%`, icon: TrendingUp },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-4">
              <kpi.icon size={16} className="text-muted-foreground mb-2" />
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Closer Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-primary mr-2" size={20} />
          <p className="text-sm text-muted-foreground">Carregando closers...</p>
        </div>
      ) : closers.length === 0 ? (
        <div className="text-center py-10">
          <Briefcase size={32} className="text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">Nenhum closer cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {closers.map((closer) => {
            const isOnline = onlineIds.includes(closer.userId);
            const m = getCloserMetrics(closer.userId);

            return (
              <Card key={closer.userId} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {closer.avatarUrl ? (
                        <img src={closer.avatarUrl} alt={closer.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                          {getInitials(closer.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{closer.name}</p>
                        <p className="text-xs text-muted-foreground">{closer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      <span className="text-[10px] text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="bg-secondary/30 rounded-md px-3 py-2 text-center">
                      <p className="text-muted-foreground">Convites</p>
                      <p className="text-foreground font-bold text-sm">{m.total}</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md px-3 py-2 text-center">
                      <p className="text-muted-foreground">Ativados</p>
                      <p className="text-foreground font-bold text-sm">{m.activated}</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md px-3 py-2 text-center">
                      <p className="text-muted-foreground">Conversão</p>
                      <p className="text-foreground font-bold text-sm">{m.conversion}%</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md px-3 py-2 text-center">
                      <p className="text-muted-foreground">Receita</p>
                      <p className="text-primary font-bold text-sm">{fmt(m.revenue)}</p>
                    </div>
                  </div>

                  {/* Extra info */}
                  <div className="flex gap-2 text-[10px]">
                    {m.pending > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Clock size={9} /> {m.pending} pendente{m.pending > 1 ? "s" : ""}
                      </Badge>
                    )}
                    {m.expired > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <AlertTriangle size={9} /> {m.expired} expirado{m.expired > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => setDetailCloser(closer)}>
                      <Eye size={12} /> Ver Convites
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailCloser} onOpenChange={(open) => !open && setDetailCloser(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cinzel flex items-center gap-2">
              <Briefcase size={18} />
              Convites de {detailCloser?.name}
            </DialogTitle>
          </DialogHeader>

          {detailInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum convite criado</p>
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
                  {detailInvites.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{inv.email}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {inv.plan_value ? fmt(inv.plan_value) : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(inv.status, inv.payment_status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {detailCloser && (() => {
            const m = getCloserMetrics(detailCloser.userId);
            return (
              <div className="grid grid-cols-4 gap-3 mt-4">
                <Card className="bg-secondary/30 border-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{m.total}</p>
                    <p className="text-[10px] text-muted-foreground">Total Convites</p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30 border-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{m.activated}</p>
                    <p className="text-[10px] text-muted-foreground">Ativados</p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30 border-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{m.conversion}%</p>
                    <p className="text-[10px] text-muted-foreground">Conversão</p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30 border-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-lg font-bold text-primary">{fmt(m.revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">Receita Gerada</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClosers;
