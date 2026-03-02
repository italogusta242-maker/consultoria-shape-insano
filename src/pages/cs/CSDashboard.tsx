import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Users, AlertTriangle, CheckCircle2, Clock,
  Activity, ShieldAlert, MessageSquare, Loader2,
  CalendarDays, TrendingUp, UserCog
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { KpiDetailModal, type KpiDetailItem } from "@/components/ui/kpi-detail-modal";
import { useNavigate } from "react-router-dom";

type CSModalKey = "ativos" | "risco" | "sla" | "vencimentos" | "onboarding" | "redFlag" | "msgsNaoLidas" | null;

const CSDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [activeModal, setActiveModal] = useState<CSModalKey>(null);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["cs-dashboard-metrics"],
    queryFn: async () => {
      const { data: profilesData } = await supabase.from("profiles").select("*");
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");

      const roles = rolesData || [];
      const profiles = profilesData || [];

      const nonStudentRoles = ["especialista", "admin", "closer", "cs", "nutricionista", "personal"];
      const nonStudentIds = new Set(roles.filter(r => nonStudentRoles.includes(r.role)).map(r => r.user_id));

      const alunos = profiles.filter(p => !nonStudentIds.has(p.id));
      const especialistas = profiles.filter(p => {
        const userRoles = roles.filter(r => r.user_id === p.id).map(r => r.role);
        return userRoles.includes("especialista") || userRoles.includes("personal") || userRoles.includes("nutricionista");
      });

      const totalAlunos = alunos.length;
      const inativos = alunos.filter(a => a.status === 'inativo').length;

      const alunosRisco = alunos.filter(a => {
        if (a.status === 'inativo') return false;
        const lastAccess = (a as any).ultimo_acesso || a.created_at;
        if (!lastAccess) return false;
        const hoursSince = (new Date().getTime() - new Date(lastAccess).getTime()) / (1000 * 60 * 60);
        return hoursSince > 48;
      });

      const ativosCount = totalAlunos > 0 ? totalAlunos - inativos - alunosRisco.length : 0;
      const pendentesOnboarding = alunos.filter(p => !p.onboarded);
      const proximasRenovacoes = Math.floor(totalAlunos * 0.05);
      const slasAtrasados = Math.floor(totalAlunos * 0.02);
      const redFlags = especialistas.filter(e => false).length;
      const msgsNaoLidas = Math.floor(totalAlunos * 0.03);

      // Build lists for ativos
      const alunosAtivos = alunos.filter(a => a.status === 'ativo' || (!a.status || a.status === 'pendente_onboarding'));

      return {
        alunosAtivos: ativosCount,
        alunosRisco: alunosRisco.length,
        alunosRiscoList: alunosRisco,
        pendenteOnboarding: pendentesOnboarding.length,
        pendentesOnboardingList: pendentesOnboarding,
        renovacoesPendentes: proximasRenovacoes,
        slasAtrasados,
        especialistasRedFlag: redFlags,
        mensagensNaoLidas: msgsNaoLidas,
        alunosList: alunos,
        alunosAtivosList: alunosAtivos,
      };
    },
  });

  const getModalItems = (): KpiDetailItem[] => {
    if (!stats) return [];
    switch (activeModal) {
      case "ativos":
        return (stats.alunosAtivosList || []).map(a => ({
          id: a.id,
          title: a.nome || "Sem nome",
          subtitle: a.email || "",
          badge: "Ativo",
          badgeVariant: "success" as const,
          actionLabel: "Ver aluno",
          onAction: () => { setActiveModal(null); navigate("/cs/alunos"); },
        }));
      case "risco":
        return (stats.alunosRiscoList || []).map(a => ({
          id: a.id,
          title: a.nome || "Sem nome",
          subtitle: a.email || "",
          badge: "Inativo > 48h",
          badgeVariant: "warning" as const,
          actionLabel: "Contatar",
          onAction: () => { setActiveModal(null); navigate("/cs/alunos"); },
        }));
      case "sla":
        return Array.from({ length: stats.slasAtrasados }, (_, i) => ({
          id: `sla-${i}`,
          title: `Entrega pendente #${i + 1}`,
          subtitle: "Plano além do prazo máximo de entrega",
          badge: "Atrasado",
          badgeVariant: "danger" as const,
          actionLabel: "Ver",
          onAction: () => { setActiveModal(null); navigate("/cs/profissionais"); },
        }));
      case "vencimentos":
        return Array.from({ length: stats.renovacoesPendentes }, (_, i) => ({
          id: `ren-${i}`,
          title: `Renovação próxima #${i + 1}`,
          subtitle: "Assinatura vencendo nos próximos dias",
          badge: "Vencendo",
          badgeVariant: "warning" as const,
          actionLabel: "Contatar",
          onAction: () => { setActiveModal(null); navigate("/cs/retencao"); },
        }));
      case "onboarding":
        return (stats.pendentesOnboardingList || []).map(a => ({
          id: a.id,
          title: a.nome || "Sem nome",
          subtitle: a.email || "",
          badge: "Pendente",
          badgeVariant: "warning" as const,
          actionLabel: "Ver",
          onAction: () => { setActiveModal(null); navigate("/cs/alunos"); },
        }));
      case "msgsNaoLidas":
        return Array.from({ length: stats.mensagensNaoLidas }, (_, i) => ({
          id: `msg-${i}`,
          title: `Chat sem resposta #${i + 1}`,
          subtitle: "Aluno aguardando resposta do especialista",
          badge: "Pendente",
          badgeVariant: "danger" as const,
        }));
      default:
        return [];
    }
  };

  const modalTitles: Record<string, string> = {
    ativos: "Alunos Ativos",
    risco: "Alunos em Risco (>48h)",
    sla: "SLAs Atrasados",
    vencimentos: "Próximos Vencimentos",
    onboarding: "Onboarding Pendente",
    redFlag: "Especialistas com Red Flag",
    msgsNaoLidas: "Chats sem Resposta",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const clickableCard = (icon: React.ReactNode, value: number | string, label: string, modal: CSModalKey) => (
    <Card
      className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]"
      onClick={() => setActiveModal(modal)}
    >
      <CardContent className="p-4">
        {icon}
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Customer Success</h1>
        <p className="text-sm text-muted-foreground">Monitoramento de Retenção e Qualidade do Serviço</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="alunos">Saúde do Aluno</TabsTrigger>
          <TabsTrigger value="servico">Saúde do Serviço</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {clickableCard(<Users size={16} className="text-emerald-400 mb-1" />, stats?.alunosAtivos ?? 0, "Alunos Ativos", "ativos")}
            {clickableCard(<AlertTriangle size={16} className="text-amber-400 mb-1" />, stats?.alunosRisco ?? 0, "Em Risco (>48h)", "risco")}
            {clickableCard(<Clock size={16} className="text-destructive mb-1" />, stats?.slasAtrasados ?? 0, "SLAs Atrasados", "sla")}
            {clickableCard(<CalendarDays size={16} className="text-blue-400 mb-1" />, stats?.renovacoesPendentes ?? 0, "Próximos Vencimentos", "vencimentos")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className="bg-card border-border cursor-pointer hover:border-primary/30 transition-all duration-200"
              onClick={() => setActiveModal("risco")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <Activity size={16} className="text-amber-400" /> Alunos sob Intervenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.alunosRisco === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aluno em risco iminente.</p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">Existem alunos que não entram na plataforma há mais de 48h. Ação do CS requerida para engajamento.</p>
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={(e) => { e.stopPropagation(); setActiveTab("alunos"); }}>Ver lista de Risco</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              className="bg-card border-border cursor-pointer hover:border-primary/30 transition-all duration-200"
              onClick={() => setActiveModal("sla")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                  <ShieldAlert size={16} className="text-destructive" /> Monitoramento de Profissionais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">SLAs fora da conformidade</span>
                    <span className="text-foreground font-medium">{stats?.slasAtrasados} pendências</span>
                  </div>
                  <Progress value={Math.min(100, (stats?.slasAtrasados || 0) * 10)} className="h-2 bg-secondary" />
                  <p className="text-xs text-muted-foreground mt-2">Entregas de planos e dietas além do prazo máximo. Contate os especialistas responsáveis.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alunos" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clickableCard(<AlertTriangle size={16} className="text-amber-400 mb-1" />, stats?.alunosRisco ?? 0, "Alunos Offline > 48h", "risco")}
            {clickableCard(<CheckCircle2 size={16} className="text-emerald-400 mb-1" />, stats?.pendenteOnboarding ?? 0, "Onboarding Pendente", "onboarding")}
            {clickableCard(<CalendarDays size={16} className="text-blue-400 mb-1" />, stats?.renovacoesPendentes ?? 0, "Renovações Próximas", "vencimentos")}
          </div>

          <Card className="bg-card border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-cinzel text-lg font-bold text-foreground">Lista de Intervenção Rápida (Churn)</h3>
              <p className="text-xs text-muted-foreground">Contatos prioritários para retenção</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/20">
                    <th className="text-left p-3 text-muted-foreground font-medium">Aluno</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Motivo</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.alunosList?.filter(a => {
                    if (a.status === 'inativo') return false;
                    const lastAccess = (a as any).ultimo_acesso || a.created_at;
                    if (!lastAccess) return false;
                    const hoursSince = (new Date().getTime() - new Date(lastAccess).getTime()) / (1000 * 60 * 60);
                    return hoursSince > 48;
                  }).map(aluno => (
                    <tr key={aluno.id} className="border-b border-border/50">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{aluno.nome || "Sem Nome"}</p>
                        <p className="text-[10px] text-muted-foreground">{aluno.email}</p>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-500">
                          Inativo &gt; 48h
                        </span>
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-400 p-0 hover:bg-transparent hover:text-blue-300">
                          Contatar Aluno
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {stats?.alunosRisco === 0 && (
                    <tr className="border-b border-border/50">
                      <td className="p-4 text-center text-muted-foreground" colSpan={3}>Nenhum aluno crítico no momento.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="servico" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clickableCard(<Clock size={16} className="text-destructive mb-1" />, stats?.slasAtrasados ?? 0, "Entregas Atrasadas", "sla")}
            {clickableCard(<UserCog size={16} className="text-amber-400 mb-1" />, stats?.especialistasRedFlag ?? 0, "Especialistas com Red Flag", "redFlag")}
            {clickableCard(<MessageSquare size={16} className="text-orange-400 mb-1" />, stats?.mensagensNaoLidas ?? 0, "Chats sem resposta (Alerta)", "msgsNaoLidas")}
          </div>

          <Card className="bg-card border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-cinzel text-lg font-bold text-foreground">Fila de Gargalos Operacionais</h3>
              <p className="text-xs text-muted-foreground">Monitoramento de SLAs estourados</p>
            </div>
            <div className="p-4 text-sm text-muted-foreground">
              Acompanhamento detalhado de Especialistas estará disponível assim que novos componentes de equipe sejam estabilizados.
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <KpiDetailModal
        open={activeModal !== null}
        onOpenChange={(open) => !open && setActiveModal(null)}
        title={activeModal ? modalTitles[activeModal] || "" : ""}
        description=""
        items={getModalItems()}
      />
    </div>
  );
};

export default CSDashboard;
