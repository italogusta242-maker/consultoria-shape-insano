import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, Star, Users, TrendingUp, User, Activity, MessageSquare, UserCog, Dumbbell, Salad, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SpecialistModalProps {
  specialistId: string;
  specialistName: string;
  specialistRole: string;
  avatarUrl: string | null;
  isOnline: boolean;
  open: boolean;
  onClose: () => void;
  initialTab?: string;
}

interface RealMetrics {
  studentCount: number;
  students: { id: string; name: string; status: string; plan: string; lastActivity: string }[];
  messagesLast30d: number;
  avgResponseTimeMin: number | null;
  trainingPlansCreated: number;
  dietPlansCreated: number;
  anamnesisReviewed: number;
  recentMessages: { id: string; studentName: string; content: string; time: string; isFromSpecialist: boolean }[];
}

const MetricCard = ({ label, value, sub, icon: Icon, alert }: { label: string; value: string; sub?: string; icon: any; alert?: boolean }) => (
  <div className={`p-3 rounded-lg border ${alert ? "border-destructive/30 bg-destructive/5" : "border-border bg-secondary/30"}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon size={14} className={alert ? "text-destructive" : "text-muted-foreground"} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
    <p className={`text-lg font-bold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

const SpecialistMetricsModal = ({ specialistId, specialistName, specialistRole, avatarUrl, isOnline, open, onClose, initialTab = "metricas" }: SpecialistModalProps) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RealMetrics | null>(null);

  useEffect(() => {
    if (!open || !specialistId) return;
    setLoading(true);

    const fetchMetrics = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Parallel queries
      const [studentsRes, msgsRes, trainingRes, dietRes, anamneseRes, conversationsRes] = await Promise.all([
        // Students linked
        supabase
          .from("student_specialists")
          .select("student_id")
          .eq("specialist_id", specialistId),
        // Messages sent by specialist last 30d
        supabase
          .from("chat_messages")
          .select("id, created_at, content, conversation_id, sender_id")
          .eq("sender_id", specialistId)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(500),
        // Training plans created by specialist
        supabase
          .from("training_plans")
          .select("id")
          .eq("specialist_id", specialistId),
        // Diet plans created by specialist
        supabase
          .from("diet_plans")
          .select("id")
          .eq("specialist_id", specialistId),
        // Anamneses reviewed
        supabase
          .from("anamnese")
          .select("id")
          .eq("reviewed_by", specialistId)
          .eq("reviewed", true),
        // All conversations the specialist participates in
        supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", specialistId),
      ]);

      const studentIds = (studentsRes.data || []).map((s) => s.student_id);

      // Get student profiles
      let students: RealMetrics["students"] = [];
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, status")
          .in("id", studentIds);

        // Check who has active plans
        const { data: activePlans } = await supabase
          .from("training_plans")
          .select("user_id")
          .in("user_id", studentIds)
          .eq("active", true);

        const usersWithPlan = new Set((activePlans || []).map((p) => p.user_id));

        students = (profiles || []).map((p) => ({
          id: p.id,
          name: p.nome || "Sem nome",
          status: p.status || "ativo",
          plan: usersWithPlan.has(p.id) ? "Ativo" : "Sem plano",
          lastActivity: "",
        }));
      }

      // Get recent messages for the "Mensagens" tab
      const convIds = (conversationsRes.data || []).map((c) => c.conversation_id);
      let recentMessages: RealMetrics["recentMessages"] = [];
      if (convIds.length > 0) {
        const { data: recentMsgs } = await supabase
          .from("chat_messages")
          .select("id, content, created_at, sender_id, conversation_id")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (recentMsgs && recentMsgs.length > 0) {
          const senderIds = [...new Set(recentMsgs.map((m) => m.sender_id))];
          const { data: senderProfiles } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", senderIds);

          const nameMap: Record<string, string> = {};
          (senderProfiles || []).forEach((p) => { nameMap[p.id] = p.nome || "Sem nome"; });

          recentMessages = recentMsgs.map((m) => ({
            id: m.id,
            studentName: nameMap[m.sender_id] || "Desconhecido",
            content: m.content,
            time: formatRelativeTime(m.created_at),
            isFromSpecialist: m.sender_id === specialistId,
          }));
        }
      }

      // Calculate avg response time (simplified: time between student msg and specialist reply in same conversation)
      let avgResponseTimeMin: number | null = null;
      // We'll skip complex response time calc for now - can be added later

      setMetrics({
        studentCount: studentIds.length,
        students,
        messagesLast30d: (msgsRes.data || []).length,
        avgResponseTimeMin,
        trainingPlansCreated: (trainingRes.data || []).length,
        dietPlansCreated: (dietRes.data || []).length,
        anamnesisReviewed: (anamneseRes.data || []).length,
        recentMessages,
      });
      setLoading(false);
    };

    fetchMetrics();
  }, [open, specialistId]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt={specialistName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                {getInitials(specialistName)}
              </div>
            )}
            <div>
              <DialogTitle className="font-cinzel text-lg">{specialistName}</DialogTitle>
              <p className="text-xs text-muted-foreground">{specialistRole}</p>
            </div>
            <span className={`ml-auto w-3 h-3 rounded-full ${isOnline ? "bg-emerald-400" : "bg-muted-foreground"}`} />
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary mr-2" size={20} />
            <p className="text-sm text-muted-foreground">Carregando métricas...</p>
          </div>
        ) : metrics ? (
          <Tabs defaultValue={initialTab} className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="usuario" className="gap-2"><User size={14} /> Usuário</TabsTrigger>
              <TabsTrigger value="metricas" className="gap-2"><Activity size={14} /> Métricas</TabsTrigger>
              <TabsTrigger value="mensagens" className="gap-2"><MessageSquare size={14} /> Mensagens</TabsTrigger>
            </TabsList>

            {/* ABA USUÁRIO */}
            <TabsContent value="usuario" className="space-y-4 mt-4">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <UserCog size={14} /> Ficha do Profissional
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Nome</p>
                    <p className="font-medium text-foreground">{specialistName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Especialidade</p>
                    <p className="font-medium text-foreground">{specialistRole}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Alunos vinculados</p>
                    <p className="font-medium text-foreground">{metrics.studentCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <p className={`font-medium ${isOnline ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {isOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-medium text-foreground mt-6 mb-3 flex items-center gap-2">
                <Users size={14} className="text-primary" /> Alunos Associados ({metrics.studentCount})
              </h4>
              {metrics.students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum aluno vinculado.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {metrics.students.map((aluno) => (
                    <div key={aluno.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-card">
                      <div>
                        <p className="text-sm font-medium text-foreground">{aluno.name}</p>
                        <p className="text-xs text-muted-foreground">Plano: {aluno.plan}</p>
                      </div>
                      <Badge className={
                        aluno.status === "ativo" ? "bg-emerald-500/20 text-emerald-400" :
                        aluno.status === "inativo" ? "bg-destructive/20 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }>
                        {aluno.status === "pendente_onboarding" ? "Pendente" : aluno.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA MÉTRICAS */}
            <TabsContent value="metricas" className="space-y-5 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Status de Conexão</p>
                  <div className="flex items-center gap-2">
                    {isOnline ? (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-muted-foreground" />
                    )}
                    <span className="font-bold text-foreground">{isOnline ? "Online Agora" : "Offline"}</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Alunos Vinculados</p>
                  <p className="font-bold text-foreground text-lg">{metrics.studentCount}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp size={14} /> Produtividade
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard icon={MessageSquare} label="Mensagens (30d)" value={`${metrics.messagesLast30d}`} />
                  <MetricCard icon={Dumbbell} label="Treinos criados" value={`${metrics.trainingPlansCreated}`} />
                  <MetricCard icon={Salad} label="Dietas criadas" value={`${metrics.dietPlansCreated}`} />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <FileText size={14} /> Análises
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    icon={FileText}
                    label="Anamneses revisadas"
                    value={`${metrics.anamnesisReviewed}`}
                    sub={metrics.anamnesisReviewed === 0 ? "⚠ Nenhuma revisão" : undefined}
                    alert={metrics.anamnesisReviewed === 0}
                  />
                  <MetricCard
                    icon={Users}
                    label="Alunos sem plano"
                    value={`${metrics.students.filter(s => s.plan === "Sem plano").length}`}
                    sub={metrics.students.filter(s => s.plan === "Sem plano").length > 0 ? "⚠ Pendente" : "✓ Todos com plano"}
                    alert={metrics.students.filter(s => s.plan === "Sem plano").length > 0}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ABA MENSAGENS */}
            <TabsContent value="mensagens" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Últimas mensagens nas conversas deste especialista:</p>
              {metrics.recentMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem recente.</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {metrics.recentMessages.map((msg) => (
                    <div key={msg.id} className="p-4 rounded-md border border-border bg-card">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{msg.studentName}</span>
                          {msg.isFromSpecialist && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Especialista</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{msg.time}</span>
                      </div>
                      <p className="text-sm text-muted-foreground bg-secondary/30 p-2 rounded line-clamp-2">
                        "{msg.content}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD === 1) return "Ontem";
  return `${diffD}d atrás`;
}

export default SpecialistMetricsModal;
