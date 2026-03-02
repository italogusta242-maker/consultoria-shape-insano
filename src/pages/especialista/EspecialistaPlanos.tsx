import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMySpecialty } from "@/hooks/useSpecialistStudents";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface PlanRow {
  id: string;
  title: string;
  active: boolean;
  updated_at: string;
  user_id: string;
  studentName: string;
}

const statusStyle: Record<string, { bg: string; text: string }> = {
  ativo: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  pendente: { bg: "bg-amber-500/10", text: "text-amber-400" },
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Agora";
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

const PlanCard = ({ p, highlighted, canEdit }: { p: PlanRow; highlighted: boolean; canEdit: boolean }) => {
  const status = p.active ? "ativo" : "pendente";
  const ss = statusStyle[status];
  const timeAgo = getTimeAgo(p.updated_at);

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-[hsl(var(--glass-bg))] backdrop-blur-md p-4 hover:border-[hsl(var(--glass-highlight))] transition-all duration-200",
        highlighted
          ? "border-[hsl(var(--gold))] ring-1 ring-[hsl(var(--gold)/0.3)]"
          : "border-[hsl(var(--glass-border))]"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">{p.studentName}</p>
          <p className="text-xs text-muted-foreground">{p.title} · Atualizado {timeAgo}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider", ss.bg, ss.text)}>
            {status}
          </span>
          {canEdit ? (
            <Button variant="outline" size="sm" className="text-xs gap-1 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]">
              <Edit size={12} /> Editar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] opacity-50"
              onClick={() => toast.info("Você não tem permissão para editar planos de treino")}
            >
              <Lock size={12} /> Somente leitura
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const EspecialistaPlanos = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const alunoParam = searchParams.get("aluno");
  const { data: mySpecialty } = useMySpecialty();

  // Only personal can edit training plans
  const specLower = (mySpecialty ?? "").toLowerCase();
  const canEditPlans = specLower === "personal" || specLower === "preparador físico" || specLower.includes("personal");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["specialist-plans", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: links, error: linksError } = await supabase
        .from("student_specialists")
        .select("student_id")
        .eq("specialist_id", user.id);
      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      const studentIds = links.map((l) => l.student_id);

      const [plansRes, profilesRes] = await Promise.all([
        supabase.from("training_plans").select("*").in("user_id", studentIds),
        supabase.from("profiles").select("id, nome, email").in("id", studentIds),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const nameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.nome ?? p.email ?? "Sem nome"]));

      return (plansRes.data ?? []).map((p): PlanRow => ({
        id: p.id,
        title: p.title,
        active: p.active,
        updated_at: p.updated_at,
        user_id: p.user_id,
        studentName: nameMap.get(p.user_id) ?? "Aluno",
      }));
    },
    enabled: !!user,
  });

  const filtered = (plans ?? []).filter((p) => {
    if (filterParam === "pendente") return !p.active;
    if (alunoParam) return p.studentName === alunoParam;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold gold-text-gradient">Editor de Planos</h1>
        <p className="text-sm text-muted-foreground">
          {filterParam === "pendente"
            ? "Exibindo planos pendentes de revisão"
            : alunoParam
              ? `Planos de ${alunoParam}`
              : "Gerencie treinos e dietas dos seus alunos"}
        </p>
        {!canEditPlans && mySpecialty && (
          <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
            <Lock size={12} /> Como {mySpecialty}, você tem acesso somente leitura aos planos de treino
          </p>
        )}
      </div>

      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList className="bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] backdrop-blur-md">
          <TabsTrigger value="todos">Todos ({filtered.length})</TabsTrigger>
          <TabsTrigger value="ativo">Ativos</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum plano encontrado</p>
          ) : (
            filtered.map((p) => <PlanCard key={p.id} p={p} highlighted={alunoParam === p.studentName} canEdit={canEditPlans} />)
          )}
        </TabsContent>
        <TabsContent value="ativo" className="space-y-3">
          {filtered.filter((p) => p.active).map((p) => <PlanCard key={p.id} p={p} highlighted={alunoParam === p.studentName} canEdit={canEditPlans} />)}
        </TabsContent>
        <TabsContent value="pendente" className="space-y-3">
          {filtered.filter((p) => !p.active).map((p) => <PlanCard key={p.id} p={p} highlighted={alunoParam === p.studentName} canEdit={canEditPlans} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EspecialistaPlanos;
