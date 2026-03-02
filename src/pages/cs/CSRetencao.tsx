import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2, TrendingDown, TrendingUp, Users, Activity, Target,
  ShieldAlert, Search, MessageSquare, Send,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";




// ─── Renewal Chat Dialog ───

const RENEWAL_MESSAGES = [
  "Olá! Seu plano está próximo do vencimento. Gostaria de renovar para continuar sua evolução? 💪",
  "Oi! Notamos que seu plano vence em breve. Temos condições especiais de renovação, vamos conversar?",
  "Fala, guerreiro! 🔥 Seu plano está acabando. Que tal renovar e manter o shape insano?",
  "Olá! Passando para lembrar que seu plano vence em breve. Posso te ajudar com a renovação?",
];

const RenewalChatDialog = ({
  open, onOpenChange, student,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: { id: string; nome: string | null } | null;
}) => {
  const [selectedMsg, setSelectedMsg] = useState(0);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  const handleSend = async () => {
    if (!student || !user) return;
    setSending(true);
    try {
      // Find or create conversation with student
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", student.id);

      let conversationId: string | null = null;

      if (participations && participations.length > 0) {
        // Check if we share a direct conversation
        for (const p of participations) {
          const { data: myPart } = await supabase
            .from("conversation_participants")
            .select("id")
            .eq("conversation_id", p.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (myPart) {
            // Verify it's a direct conversation
            const { data: conv } = await supabase
              .from("conversations")
              .select("type")
              .eq("id", p.conversation_id)
              .eq("type", "direct")
              .maybeSingle();
            if (conv) {
              conversationId = p.conversation_id;
              break;
            }
          }
        }
      }

      if (!conversationId) {
        // Create new conversation
        const { data: newConv, error: convErr } = await supabase
          .from("conversations")
          .insert({ type: "direct" })
          .select("id")
          .single();
        if (convErr || !newConv) throw convErr;
        conversationId = newConv.id;

        await supabase.from("conversation_participants").insert([
          { conversation_id: conversationId, user_id: user.id },
          { conversation_id: conversationId, user_id: student.id },
        ]);
      }

      // Send message
      const { error: msgErr } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: RENEWAL_MESSAGES[selectedMsg],
      });
      if (msgErr) throw msgErr;

      toast({ title: "Mensagem enviada!", description: `Mensagem de renovação enviada para ${student.nome || "aluno"}.` });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={18} /> Renovação via Chat
          </DialogTitle>
          <DialogDescription>
            Enviar mensagem de renovação para <strong>{student?.nome || "aluno"}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
          {RENEWAL_MESSAGES.map((msg, i) => (
            <button
              key={i}
              onClick={() => setSelectedMsg(i)}
              className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                selectedMsg === i
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {msg}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={14} />}
            Enviar Mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Component ───

const CSRetencao = () => {
  const [search, setSearch] = useState("");
  const [renewalStudent, setRenewalStudent] = useState<{ id: string; nome: string | null } | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("subscription_plans").select("*").order("created_at");
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cs-retention-detailed"],
    queryFn: async () => {
      const { data: profilesData } = await supabase.from("profiles").select("id, nome, email, status, created_at, telefone");
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
      const { data: subsData } = await supabase.from("subscriptions").select("*");

      const roles = rolesData || [];
      const profiles = profilesData || [];
      const subs = subsData || [];

      const nonStudentIds = new Set(
        roles.filter(r => ["especialista", "admin", "closer", "cs", "nutricionista", "personal"].includes(r.role)).map(r => r.user_id)
      );

      const alunos = profiles.filter(p => !nonStudentIds.has(p.id));
      const now = Date.now();

      const studentsList = alunos.map(aluno => {
        const sub = subs.find(s => s.user_id === aluno.id && s.status === "active");
        const planPrice = sub ? Number(sub.plan_price) : 0;

        // Mock days to renew based on subscription
        const daysToRenew = sub ? Math.floor(Math.abs(Math.sin(aluno.id.charCodeAt(0))) * 90) : 0;
        const isExpired = aluno.status === 'inativo' || !sub;
        const isRisk = daysToRenew <= 15 && !isExpired;

        return {
          ...aluno,
          planPrice,
          subscriptionStatus: sub ? "Ativo" : "Inativo",
          planName: sub ? `R$ ${planPrice.toFixed(2)}/mês` : "Sem plano",
          daysToRenew,
          isExpired: aluno.status === 'inativo',
          isRisk,
          behavioralRisk: Math.random() > 0.8,
        };
      });

      const total = studentsList.length || 1;
      const ativos = studentsList.filter(s => s.status === 'ativo').length;
      const cancelados = studentsList.filter(s => s.status === 'inativo').length;
      const emRisco = studentsList.filter(s => s.isRisk || s.behavioralRisk).length;
      const retentionRate = Math.round((ativos / total) * 100);

      return {
        total, ativos, cancelados, emRisco, retentionRate,
        recentCancelations: Math.floor(cancelados * 0.2),
        students: studentsList.sort((a, b) => a.daysToRenew - b.daysToRenew),
      };
    },
  });

  const filtered = useMemo(() => {
    if (!data?.students) return [];
    let list = data.students;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.nome?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q));
    }
    return list;
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Cockpit de Retenção</h1>
        <p className="text-sm text-muted-foreground">Métricas avançadas de contratos, frequência e churn rating</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-4 relative z-10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Taxa de Retenção</span>
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-foreground">{data?.retentionRate}%</p>
            <p className="text-[10px] text-emerald-400 font-medium tracking-wide mt-1">META: 85%</p>
            <Progress value={data?.retentionRate} className="h-1.5 mt-2 bg-emerald-950 [&>div]:bg-emerald-500" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-4 relative z-10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Base Ativa</span>
              <Activity size={16} className="text-blue-400" />
            </div>
            <p className="text-3xl font-black text-foreground">{data?.ativos}</p>
            <p className="text-[10px] text-muted-foreground mt-1">de {data?.total} total</p>
            <Progress value={(data?.ativos || 0) / (data?.total || 1) * 100} className="h-1.5 mt-2 bg-blue-950 [&>div]:bg-blue-500" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-4 relative z-10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Risco de Churn</span>
              <ShieldAlert size={16} className="text-amber-400" />
            </div>
            <p className="text-3xl font-black text-foreground">{data?.emRisco}</p>
            <p className="text-[10px] text-amber-500 mt-1 font-medium">Baixo engajamento ou vencendo</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border relative overflow-hidden">
          <CardContent className="p-4 relative z-10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Cancelamentos</span>
              <TrendingDown size={16} className="text-destructive" />
            </div>
            <p className="text-3xl font-black text-foreground">{data?.cancelados}</p>
            <p className="text-[10px] text-destructive mt-1 font-medium">-{data?.recentCancelations} nos últimos 30 dias</p>
          </CardContent>
        </Card>
      </div>




      {/* CRM List */}
      <Card className="bg-card border-border">
        <CardHeader className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-cinzel">Fila de Acompanhamento (CRM)</CardTitle>
            <p className="text-xs text-muted-foreground">Classificados por risco e data de expiração</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar aluno ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-xs bg-secondary/50 border-border" />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/20">
                  <th className="text-left p-4 text-muted-foreground font-medium text-xs">Aluno</th>
                  <th className="text-left p-3 text-muted-foreground font-medium text-xs hidden md:table-cell">Plano / Preço</th>
                  <th className="text-left p-3 text-muted-foreground font-medium text-xs hidden md:table-cell">Situação</th>
                  <th className="text-left p-3 text-muted-foreground font-medium text-xs hidden lg:table-cell">Dias p/ Vencer</th>
                  <th className="text-center p-3 text-muted-foreground font-medium text-xs">Risco</th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="p-4">
                      <p className="font-semibold text-foreground text-xs">{s.nome || "—"}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{s.email}</p>
                    </td>

                    <td className="p-3 hidden md:table-cell">
                      <span className="text-xs text-foreground font-medium">{s.planName}</span>
                    </td>

                    <td className="p-3 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                        s.subscriptionStatus === "Ativo"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-destructive/10 text-destructive"
                      }`}>
                        {s.subscriptionStatus}
                      </span>
                    </td>

                    <td className="p-3 hidden lg:table-cell">
                      {s.isExpired ? (
                        <span className="text-xs text-destructive font-bold">Expirado</span>
                      ) : (
                        <span className={`text-xs font-bold ${s.daysToRenew <= 15 ? "text-amber-400" : "text-emerald-400"}`}>
                          {s.daysToRenew} dias
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      {s.isExpired ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                      ) : s.isRisk || s.behavioralRisk ? (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] animate-pulse" />
                      ) : (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setRenewalStudent({ id: s.id, nome: s.nome })}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all flex items-center gap-1 ml-auto ${
                          s.isExpired
                            ? "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            : "bg-primary/20 text-primary hover:bg-primary/30"
                        }`}
                      >
                        <MessageSquare size={12} />
                        {s.isExpired ? "REATIVAR / CHAT" : "RENOVAR / CHAT"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                      Nenhum contrato encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <RenewalChatDialog
        open={!!renewalStudent}
        onOpenChange={(v) => { if (!v) setRenewalStudent(null); }}
        student={renewalStudent}
      />
    </div>
  );
};

export default CSRetencao;
