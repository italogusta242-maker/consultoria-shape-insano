import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Clock, UserCheck, Activity, MessageCircle, Dumbbell, Apple, Handshake } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { KpiDetailModal, type KpiDetailItem } from "@/components/ui/kpi-detail-modal";

type AppRole = Database["public"]["Enums"]["app_role"];

const TRACKED_ROLES: AppRole[] = ["nutricionista", "personal", "closer"];

const roleLabels: Record<string, string> = {
  nutricionista: "Nutricionista",
  personal: "Preparador Físico",
  closer: "Closer",
};

const roleIcons: Record<string, typeof Apple> = {
  nutricionista: Apple,
  personal: Dumbbell,
  closer: Handshake,
};

type ProfModalKey = "total" | "online" | "interacoes" | "entregas" | null;

const CSProfissionais = () => {
  const [activeModal, setActiveModal] = useState<ProfModalKey>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cs-professionals-tracking"],
    queryFn: async () => {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", TRACKED_ROLES);

      const roles = rolesData || [];
      const staffIds = [...new Set(roles.map((r) => r.user_id))];

      if (staffIds.length === 0) return [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [profilesRes, linksRes, plansRes, dietsRes, msgsTodayRes, msgsLastRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, created_at, avatar_url").in("id", staffIds),
        supabase.from("student_specialists").select("specialist_id, specialty, student_id"),
        supabase.from("training_plans").select("specialist_id"),
        supabase.from("diet_plans").select("specialist_id"),
        supabase
          .from("chat_messages")
          .select("sender_id, created_at")
          .in("sender_id", staffIds)
          .gte("created_at", todayStart.toISOString()),
        supabase
          .from("chat_messages")
          .select("sender_id, created_at")
          .in("sender_id", staffIds)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const profiles = profilesRes.data ?? [];
      const links = linksRes.data ?? [];
      const plans = plansRes.data ?? [];
      const diets = dietsRes.data ?? [];
      const msgsToday = msgsTodayRes.data ?? [];
      const msgsLast = msgsLastRes.data ?? [];

      return profiles.map((p) => {
        const userRoles = roles.filter(r => r.user_id === p.id).map(r => r.role);
        const myLinks = links.filter((l) => l.specialist_id === p.id);
        const studentCount = new Set(myLinks.map((l) => l.student_id)).size;
        const planCount = plans.filter((pl) => pl.specialist_id === p.id).length;
        const dietCount = diets.filter((d) => d.specialist_id === p.id).length;
        const totalDeliveries = planCount + dietCount;
        const todayMsgCount = msgsToday.filter((m) => m.sender_id === p.id).length;
        const lastMsgs = msgsLast.filter((m) => m.sender_id === p.id);
        const lastActivity = lastMsgs.length > 0 ? lastMsgs[0].created_at : null;
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const isOnline = lastActivity ? new Date(lastActivity).getTime() > twoHoursAgo : false;
        const lastTime = lastActivity ? new Date(lastActivity).getTime() : new Date(p.created_at).getTime();
        const hoursOffline = Math.floor((Date.now() - lastTime) / (1000 * 60 * 60));

        return {
          id: p.id,
          nome: p.nome,
          email: p.email,
          avatarUrl: p.avatar_url,
          roles: userRoles,
          studentCount,
          totalDeliveries,
          planCount,
          dietCount,
          todayMsgCount,
          lastActivity,
          isOnline,
          hoursOffline,
        };
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const profs = data || [];
  const staffOnline = profs.filter(p => p.isOnline).length;
  const totalMsgsToday = profs.reduce((acc, curr) => acc + curr.todayMsgCount, 0);
  const totalDeliveries = profs.reduce((acc, curr) => acc + curr.totalDeliveries, 0);

  const formatLastAccess = (lastActivity: string | null, hoursOffline: number) => {
    if (!lastActivity) return "Sem atividade";
    if (hoursOffline < 1) return "Agora";
    if (hoursOffline < 24) return `${hoursOffline}h atrás`;
    const days = Math.floor(hoursOffline / 24);
    return `${days}d atrás`;
  };

  const getModalItems = (): KpiDetailItem[] => {
    switch (activeModal) {
      case "total":
        return profs.map(p => ({
          id: p.id,
          title: p.nome || "Sem nome",
          subtitle: `${p.email} · ${p.roles.map(r => roleLabels[r] || r).join(", ")} · ${p.studentCount} alunos`,
          badge: p.isOnline ? "Online" : "Offline",
          badgeVariant: p.isOnline ? "success" as const : "default" as const,
        }));
      case "online":
        return profs.filter(p => p.isOnline).map(p => ({
          id: p.id,
          title: p.nome || "Sem nome",
          subtitle: `${p.roles.map(r => roleLabels[r] || r).join(", ")} · ${p.todayMsgCount} msgs hoje`,
          badge: "Online",
          badgeVariant: "success" as const,
        }));
      case "interacoes":
        return profs.filter(p => p.todayMsgCount > 0).sort((a, b) => b.todayMsgCount - a.todayMsgCount).map(p => ({
          id: p.id,
          title: p.nome || "Sem nome",
          subtitle: `${p.roles.map(r => roleLabels[r] || r).join(", ")}`,
          badge: `${p.todayMsgCount} msgs`,
          badgeVariant: p.todayMsgCount > 10 ? "success" as const : "warning" as const,
        }));
      case "entregas":
        return profs.filter(p => p.totalDeliveries > 0).sort((a, b) => b.totalDeliveries - a.totalDeliveries).map(p => ({
          id: p.id,
          title: p.nome || "Sem nome",
          subtitle: `${p.planCount} treinos · ${p.dietCount} dietas`,
          badge: `${p.totalDeliveries} total`,
          badgeVariant: "success" as const,
        }));
      default:
        return [];
    }
  };

  const modalTitles: Record<string, string> = {
    total: "Todos os Profissionais",
    online: "Profissionais Online",
    interacoes: "Interações de Hoje",
    entregas: "Entregas Totais",
  };

  const modalDescriptions: Record<string, string> = {
    total: `${profs.length} profissionais cadastrados no sistema`,
    online: `${staffOnline} profissionais ativos nas últimas 2 horas`,
    interacoes: `${totalMsgsToday} mensagens enviadas hoje`,
    entregas: `${totalDeliveries} planos criados no total`,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Equipe Profissional</h1>
        <p className="text-sm text-muted-foreground">Monitoramento de entregas, interações e atividade dos profissionais</p>
      </div>

      {/* KPIs - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]"
          onClick={() => setActiveModal("total")}
        >
          <CardContent className="p-4 flex flex-col gap-1 text-center">
            <UserCheck size={20} className="mx-auto text-blue-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{profs.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profissionais</p>
          </CardContent>
        </Card>
        <Card
          className="bg-card border-border relative overflow-hidden cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]"
          onClick={() => setActiveModal("online")}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <CardContent className="p-4 flex flex-col gap-1 text-center">
            <Activity size={20} className="mx-auto text-emerald-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{staffOnline}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Online Agora</p>
          </CardContent>
        </Card>
        <Card
          className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]"
          onClick={() => setActiveModal("interacoes")}
        >
          <CardContent className="p-4 flex flex-col gap-1 text-center">
            <MessageCircle size={20} className="mx-auto text-amber-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalMsgsToday}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Interações Hoje</p>
          </CardContent>
        </Card>
        <Card
          className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]"
          onClick={() => setActiveModal("entregas")}
        >
          <CardContent className="p-4 flex flex-col gap-1 text-center">
            <Clock size={20} className="mx-auto text-purple-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalDeliveries}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entregas Totais</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Profissionais */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left p-4 text-muted-foreground font-medium text-xs">Profissional</th>
                  <th className="text-left p-3 text-muted-foreground font-medium text-xs hidden md:table-cell">Função</th>
                  <th className="text-center p-3 text-muted-foreground font-medium text-xs">Status</th>
                  <th className="text-center p-3 text-muted-foreground font-medium text-xs hidden sm:table-cell">Alunos</th>
                  <th className="text-center p-3 text-muted-foreground font-medium text-xs">Entregas</th>
                  <th className="text-center p-3 text-muted-foreground font-medium text-xs">Chat Hoje</th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs hidden lg:table-cell">Último Acesso</th>
                </tr>
              </thead>
              <tbody>
                {profs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                      Nenhum profissional encontrado.
                    </td>
                  </tr>
                )}
                {profs.map((prof) => {
                  const RoleIcon = roleIcons[prof.roles[0]] || UserCheck;
                  return (
                    <tr key={prof.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {prof.avatarUrl ? (
                              <img src={prof.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-secondary font-bold text-muted-foreground text-sm">
                                {prof.nome ? prof.nome.charAt(0).toUpperCase() : "?"}
                              </div>
                            )}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${prof.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{prof.nome || "Sem nome"}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{prof.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {prof.roles.map((role) => {
                            const Icon = roleIcons[role] || UserCheck;
                            return (
                              <span key={role} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                <Icon size={10} />
                                {roleLabels[role] || role}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {prof.isOnline ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {formatLastAccess(prof.lastActivity, prof.hoursOffline)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 hidden sm:table-cell text-center">
                        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
                          {prof.studentCount}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-foreground">{prof.totalDeliveries}</span>
                          <span className="text-[9px] text-muted-foreground">{prof.planCount}T / {prof.dietCount}D</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-sm font-bold ${prof.todayMsgCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {prof.todayMsgCount}
                        </span>
                      </td>
                      <td className="p-4 hidden lg:table-cell text-right">
                        {prof.lastActivity ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-foreground">
                              {new Date(prof.lastActivity).toLocaleDateString("pt-BR")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(prof.lastActivity).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem atividade</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <KpiDetailModal
        open={activeModal !== null}
        onOpenChange={(open) => !open && setActiveModal(null)}
        title={activeModal ? modalTitles[activeModal] || "" : ""}
        description={activeModal ? modalDescriptions[activeModal] || "" : ""}
        items={getModalItems()}
      />
    </div>
  );
};

export default CSProfissionais;
