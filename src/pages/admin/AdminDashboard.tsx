import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, TrendingUp, TrendingDown, AlertTriangle,
  Activity, Loader2, Stethoscope, Briefcase
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import PendingStudentsPanel from "@/components/admin/PendingStudentsPanel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfDay, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KpiDetailModal, type KpiDetailItem } from "@/components/ui/kpi-detail-modal";
import { useNavigate } from "react-router-dom";

// ── Helpers ──
const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type ModalKey = "ativos" | "retencao" | "alertas" | "closer" | "especialistas" | null;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<ModalKey>(null);

  // ── 1. All profiles ──
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, email, status, created_at");
      return data || [];
    },
  });

  // ── 2. Workouts last 30 days ──
  const { data: workouts = [] } = useQuery({
    queryKey: ["admin-workouts-30d"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase.from("workouts").select("id, user_id, started_at").gte("started_at", since);
      return data || [];
    },
  });

  // ── 3. Check-ins last 7 days ──
  const { data: checkins = [] } = useQuery({
    queryKey: ["admin-checkins-7d"],
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data } = await supabase.from("psych_checkins").select("id, user_id, created_at").gte("created_at", since);
      return data || [];
    },
  });

  // ── 4. Closer invites ──
  const { data: closerInvites = [] } = useQuery({
    queryKey: ["admin-closer-invites"],
    queryFn: async () => {
      const { data } = await supabase.from("invites").select("id, email, name, status, plan_value, created_at");
      return data || [];
    },
  });

  // ── 5. Specialists ──
  const { data: specialists = [] } = useQuery({
    queryKey: ["admin-specialists"],
    queryFn: async () => {
      const { data: rolesData } = await supabase.from("user_roles").select("user_id").in("role", ["nutricionista", "personal"]);
      if (!rolesData || rolesData.length === 0) return [];
      const specIds = rolesData.map(r => r.user_id);
      const [profilesRes, studentsRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, email").in("id", specIds),
        supabase.from("student_specialists").select("specialist_id").in("specialist_id", specIds),
      ]);
      const profilesData = profilesRes.data || [];
      const studentsData = studentsRes.data || [];
      return profilesData.map(p => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        studentCount: studentsData.filter(s => s.specialist_id === p.id).length
      }));
    },
  });

  // ── 6. Staff user IDs + roles (for inactivity alerts) ──
  const { data: staffRolesMap = {} as Record<string, string> } = useQuery({
    queryKey: ["admin-staff-roles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["nutricionista", "personal", "cs", "closer"]);
      const map: Record<string, string> = {};
      (data || []).forEach(r => {
        const label = r.role === "nutricionista" ? "Nutricionista" : r.role === "personal" ? "Personal" : r.role === "cs" ? "CS" : "Closer";
        map[r.user_id] = label;
      });
      return map;
    },
  });
  const staffUserIds = Object.keys(staffRolesMap);

  const loading = loadingProfiles;

  // ── Derived KPIs ──
  const activeProfiles = profiles.filter((p) => p.status === "ativo");
  const pendingProfiles = profiles.filter((p) => p.status === "pendente" || p.status === "pendente_onboarding");
  const totalUsers = profiles.length;

  const thirtyDaysAgo = subDays(new Date(), 30);
  const oldUsers = profiles.filter((p) => p.created_at && new Date(p.created_at) < thirtyDaysAgo);
  const retainedUsers = oldUsers.filter((p) => p.status === "ativo");
  const retention = oldUsers.length > 0 ? Math.round((retainedUsers.length / oldUsers.length) * 100) : 0;

  // Alertas: users ativos sem treino há 3+ dias (based on workouts)
  const today = startOfDay(new Date());
  const userLastWorkout = new Map<string, string>();
  for (const w of workouts) {
    const existing = userLastWorkout.get(w.user_id);
    if (!existing || w.started_at > existing) {
      userLastWorkout.set(w.user_id, w.started_at);
    }
  }
  // Alertas: alunos ativos (não-staff) sem treino há 14+ dias
  const studentProfiles = activeProfiles.filter((p) => !staffUserIds.includes(p.id));
  const alertUsers = studentProfiles.filter((p) => {
    const lastW = userLastWorkout.get(p.id);
    if (!lastW) return true; // nunca treinou
    const diff = differenceInDays(today, parseISO(lastW));
    return diff >= 14;
  });

  const kpiData: { label: string; value: string; icon: typeof Users; modal: ModalKey }[] = [
    { label: "Usuários Ativos", value: String(activeProfiles.length), icon: Users, modal: "ativos" },
    { label: "Retenção 30d", value: `${retention}%`, icon: TrendingUp, modal: "retencao" },
    { label: "Alertas", value: String(alertUsers.length), icon: AlertTriangle, modal: "alertas" },
  ];

  // ── Engagement chart ──
  const engagementData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const dayLabel = dayLabels[date.getDay()];
    const dayWorkouts = workouts.filter((w) => { const d = new Date(w.started_at); return d >= dayStart && d < dayEnd; });
    const dayCheckins = checkins.filter((c) => { const d = new Date(c.created_at); return d >= dayStart && d < dayEnd; });
    return {
      day: dayLabel,
      treinos: new Set(dayWorkouts.map((w) => w.user_id)).size,
      checkins: new Set(dayCheckins.map((c) => c.user_id)).size,
    };
  });

  // ── Status distribution ──
  const statusDistribution = [
    { name: "Ativos", value: activeProfiles.length, color: "hsl(140, 60%, 40%)" },
    { name: "Pendentes", value: pendingProfiles.length, color: "hsl(40, 80%, 50%)" },
    { name: "Inativos", value: profiles.filter((p) => p.status === "inativo" || p.status === "cancelado").length, color: "hsl(0, 70%, 45%)" },
  ];

  // ── Alert details ──
  const alertDetails = alertUsers
    .map((p) => {
      const lastW = userLastWorkout.get(p.id);
      const daysSince = lastW ? differenceInDays(today, parseISO(lastW)) : 999;
      const lastAccess = lastW ? format(parseISO(lastW), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : null;
      return { id: p.id, name: p.nome || "Sem nome", email: p.email || "", days: daysSince, lastAccess, role: "Aluno" };
    })
    .sort((a, b) => b.days - a.days);

  // ── Modal items builders ──
  const getModalItems = (): KpiDetailItem[] => {
    switch (activeModal) {
      case "ativos":
        return activeProfiles.map(p => ({
          id: p.id,
          title: p.nome || "Sem nome",
          subtitle: p.email || "",
          badge: "Ativo",
          badgeVariant: "success" as const,
          actionLabel: "Ver perfil",
          onAction: () => { setActiveModal(null); navigate(`/admin/usuarios`); },
        }));
      case "retencao":
        return oldUsers.map(p => ({
          id: p.id,
          title: p.nome || "Sem nome",
          subtitle: `Cadastro: ${new Date(p.created_at).toLocaleDateString("pt-BR")}`,
          badge: p.status === "ativo" ? "Retido" : p.status === "inativo" ? "Perdido" : p.status,
          badgeVariant: p.status === "ativo" ? "success" as const : "danger" as const,
          actionLabel: "Ver",
          onAction: () => { setActiveModal(null); navigate(`/admin/usuarios`); },
        }));
      case "alertas":
        return alertDetails.map(a => ({
          id: a.id,
          title: a.name,
          subtitle: a.lastAccess ? `Último acesso: ${a.lastAccess}` : "Sem registro de acesso",
          badge: a.days >= 7 ? "Crítico" : "Atenção",
          badgeVariant: a.days >= 7 ? "danger" as const : "warning" as const,
          actionLabel: "Contatar",
          onAction: () => { setActiveModal(null); navigate(`/admin/usuarios`); },
        }));
      case "closer":
        return closerInvites.map(i => ({
          id: i.id,
          title: i.name || i.email,
          subtitle: `${i.email} · R$ ${(i.plan_value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          badge: i.status === "used" ? "Convertido" : i.status === "pending" ? "Pendente" : "Expirado",
          badgeVariant: i.status === "used" ? "success" as const : i.status === "pending" ? "warning" as const : "danger" as const,
        }));
      case "especialistas":
        return specialists.map(s => ({
          id: s.id,
          title: s.nome || "Sem nome",
          subtitle: `${s.email || ""} · ${s.studentCount} alunos vinculados`,
          badge: `${s.studentCount} alunos`,
          badgeVariant: "default" as const,
          actionLabel: "Gerenciar",
          onAction: () => { setActiveModal(null); navigate(`/admin/especialistas`); },
        }));
      default:
        return [];
    }
  };

  const getModalTitle = (): string => {
    switch (activeModal) {
      case "ativos": return "Usuários Ativos";
      case "retencao": return "Retenção 30 Dias";
      case "alertas": return "Alertas de Inatividade";
      case "closer": return "Performance do Closer";
      case "especialistas": return "Balanço de Especialistas";
      default: return "";
    }
  };

  const getModalDescription = (): string => {
    switch (activeModal) {
      case "ativos": return `${activeProfiles.length} usuários com status ativo na plataforma`;
      case "retencao": return `${retainedUsers.length} de ${oldUsers.length} usuários cadastrados há 30+ dias ainda ativos`;
      case "alertas": return `${alertUsers.length} usuários ativos sem treinar há 3+ dias`;
      case "closer": return `${closerInvites.length} convites · ${closerInvites.filter(i => i.status === 'used').length} convertidos`;
      case "especialistas": return `${specialists.length} especialistas cadastrados`;
      default: return "";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Quartel General</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada da plataforma SHAPE INSANO</p>
      </div>

      <PendingStudentsPanel />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {kpiData.map((kpi) => (
          <Card
            key={kpi.label}
            className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]"
            onClick={() => setActiveModal(kpi.modal)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <kpi.icon size={18} className="text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Engajamento — Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,16%)" />
                <XAxis dataKey="day" stroke="hsl(43,10%,55%)" fontSize={12} />
                <YAxis stroke="hsl(43,10%,55%)" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,16%)", borderRadius: 8, color: "hsl(0,0%,90%)" }} labelStyle={{ color: "hsl(43,30%,85%)" }} itemStyle={{ color: "hsl(0,0%,90%)" }} />
                <Area type="monotone" dataKey="treinos" stroke="hsl(25,100%,50%)" fill="hsl(25,100%,50%,0.15)" strokeWidth={2} name="Treinos" />
                <Area type="monotone" dataKey="checkins" stroke="hsl(210,70%,50%)" fill="hsl(210,70%,50%,0.1)" strokeWidth={2} name="Check-ins" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(25,100%,50%)" }} /> Treinos</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "hsl(210,70%,50%)" }} /> Check-ins</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusDistribution.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,16%)", borderRadius: 8, color: "hsl(0,0%,90%)" }} labelStyle={{ color: "hsl(43,30%,85%)" }} itemStyle={{ color: "hsl(0,0%,90%)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2 w-full">
              {statusDistribution.map((l) => (
                <div key={l.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-muted-foreground">{l.name}</span>
                  <span className="ml-auto font-medium text-foreground">{l.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card
            className="bg-card border-border cursor-pointer hover:border-primary/30 transition-all duration-200"
            onClick={() => navigate("/admin/closers")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Briefcase size={16} className="text-primary" />
                Performance dos Closers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-foreground">{closerInvites.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Convites</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-foreground">{closerInvites.filter(i => i.status === 'used').length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Ativados</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {closerInvites.length > 0 ? Math.round((closerInvites.filter(i => i.status === 'used').length / closerInvites.length) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border cursor-pointer hover:border-primary/30 transition-all duration-200"
            onClick={() => setActiveModal("especialistas")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Stethoscope size={16} className="text-primary" />
                Balanço de Especialistas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {specialists.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhum especialista cadastrado.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {specialists.sort((a, b) => b.studentCount - a.studentCount).map(spec => (
                    <div key={spec.id} className="flex justify-between items-center p-2 bg-secondary/30 rounded">
                      <span className="text-sm font-medium text-foreground">{spec.nome || "Sem Nome"}</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-lg font-semibold">{spec.studentCount} alunos</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card
            className="bg-card border-border cursor-pointer hover:border-primary/30 transition-all duration-200"
            onClick={() => setActiveModal("alertas")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle size={16} className="text-destructive" />
                Alertas de Inatividade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum alerta no momento 🎉</p>
              ) : (
                <div className="space-y-3">
                  {alertDetails.slice(0, 8).map((alert, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <Users size={14} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{alert.name} <span className="text-xs text-muted-foreground font-normal">• {alert.role}</span></p>
                          <p className="text-xs text-muted-foreground">
                            {alert.days >= 999
                              ? "Sem registro de acesso"
                              : `Último acesso há ${alert.days} ${alert.days === 1 ? "dia" : "dias"}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alert.days >= 7 ? "bg-destructive/20 text-destructive" : "bg-amber-500/20 text-amber-400"}`}>
                        {alert.days >= 999 ? "N/A" : `${alert.days}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      <KpiDetailModal
        open={activeModal !== null}
        onOpenChange={(open) => !open && setActiveModal(null)}
        title={getModalTitle()}
        description={getModalDescription()}
        items={getModalItems()}
        emptyMessage="Nenhum dado encontrado."
      />
    </div>
  );
};

export default AdminDashboard;
