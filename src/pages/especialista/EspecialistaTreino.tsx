import { useState, useEffect, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Edit, Plus, AlertCircle, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSpecialistStudents } from "@/hooks/useSpecialistStudents";
import { useSpecialtyGuard } from "@/hooks/useSpecialtyGuard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, type Variants } from "framer-motion";
import TrainingPlanEditor from "@/components/especialista/TrainingPlanEditor";

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

interface TrainingPlanRow {
  id: string;
  title: string;
  active: boolean;
  updated_at: string;
  user_id: string;
  studentName: string;
  totalSessions: number;
  groupsCount: number;
  groups: any[];
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

const PlanCard = ({ p, highlighted, onEdit }: { p: TrainingPlanRow; highlighted: boolean; onEdit: () => void }) => {
  const status = p.active ? "ativo" : "pendente";
  const ss = statusStyle[status];

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
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--forja-teal)/0.15)]">
            <Dumbbell size={16} className="text-[hsl(var(--forja-teal))]" />
          </div>
          <div>
            <p className="font-medium text-foreground">{p.studentName}</p>
            <p className="text-xs text-muted-foreground">
              {p.title} · {p.groupsCount} grupos · {p.totalSessions} sessões · Atualizado {getTimeAgo(p.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider", ss.bg, ss.text)}>
            {status}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]"
            onClick={onEdit}
          >
            <Edit size={12} /> Editar
          </Button>
        </div>
      </div>
    </div>
  );
};

const EspecialistaTreino = () => {
  const { user } = useAuth();
  const location = useLocation();
  useSpecialtyGuard(location.pathname);
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const alunoParam = searchParams.get("aluno");
  const { data: students } = useSpecialistStudents();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("todos");
  
  // Store editPlanId from navigation state
  const editPlanIdRef = useRef<string | null>((location.state as any)?.editPlanId ?? null);
  const autoOpenedRef = useRef(false);

  const studentIds = (students ?? []).map((s) => s.id);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["specialist-training-plans", user?.id, studentIds],
    queryFn: async () => {
      if (!user || studentIds.length === 0) return [];

      const [plansRes, profilesRes] = await Promise.all([
        supabase.from("training_plans").select("*").in("user_id", studentIds),
        supabase.from("profiles").select("id, nome, email").in("id", studentIds),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const nameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.nome ?? p.email ?? "Sem nome"]));

      return (plansRes.data ?? []).map((p): TrainingPlanRow => ({
        id: p.id,
        title: p.title,
        active: p.active,
        updated_at: p.updated_at,
        user_id: p.user_id,
        studentName: nameMap.get(p.user_id) ?? "Aluno",
        totalSessions: p.total_sessions,
        groupsCount: Array.isArray(p.groups) ? p.groups.length : 0,
        groups: Array.isArray(p.groups) ? (p.groups as any[]).map((g: any) => ({
          ...g,
          exercises: Array.isArray(g.exercises) 
            ? [...g.exercises].sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
            : [],
        })) : [],
      }));
    },
    enabled: !!user && studentIds.length > 0,
  });

  // Auto-open editor when editPlanId was in URL
  useEffect(() => {
    const targetId = editPlanIdRef.current;
    if (targetId && plans && plans.length > 0 && !autoOpenedRef.current) {
      const plan = plans.find((p) => p.id === targetId);
      if (plan) {
        autoOpenedRef.current = true;
        editPlanIdRef.current = null;
        setEditingPlan({
          id: plan.id,
          title: plan.title,
          user_id: plan.user_id,
          groups: plan.groups,
          total_sessions: plan.totalSessions,
        });
        setEditorOpen(true);
      }
    }
  }, [plans]);

  // Find students without any active training plan
  const studentsWithActivePlan = new Set((plans ?? []).filter((p) => p.active).map((p) => p.user_id));
  const studentsWithoutPlan = (students ?? []).filter((s) => !studentsWithActivePlan.has(s.id));

  const filtered = (plans ?? []).filter((p) => {
    if (filterParam === "pendente") return !p.active;
    if (alunoParam) return p.studentName === alunoParam;
    return true;
  });

  const studentOptions = (students ?? []).map((s) => ({ id: s.id, name: s.name ?? "Aluno" }));

  const handleEdit = (plan: TrainingPlanRow) => {
    setEditingPlan({
      id: plan.id,
      title: plan.title,
      user_id: plan.user_id,
      groups: plan.groups,
      total_sessions: plan.totalSessions,
    });
    setEditorOpen(true);
  };

  const handleNew = (studentId?: string) => {
    setEditingPlan(null);
    setEditorOpen(true);
  };

  return (
    <>
      <motion.div className="space-y-6" initial="hidden" animate="show" variants={stagger}>
        <motion.div variants={fadeUp} className="flex items-end justify-between">
          <div>
            <h1 className="font-cinzel text-2xl font-bold gold-text-gradient">Editor de Treinos</h1>
            <p className="text-sm text-muted-foreground">
              {filterParam === "pendente"
                ? "Exibindo planos pendentes de revisão"
                : alunoParam
                  ? `Treinos de ${alunoParam}`
                  : "Gerencie planos de treino dos seus alunos"}
            </p>
          </div>
          <Button size="sm" className="gap-1 gold-gradient text-background font-medium" onClick={() => handleNew()}>
            <Plus size={14} /> Novo Treino
          </Button>
        </motion.div>

        {/* Students without training alert */}
        {studentsWithoutPlan.length > 0 && (
          <motion.div
            variants={fadeUp}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2 cursor-pointer hover:border-amber-400/50 transition-colors"
            onClick={() => setActiveTab("pendente")}
          >
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-foreground">
              {studentsWithoutPlan.length} aluno{studentsWithoutPlan.length > 1 ? "s" : ""} sem treino ativo
            </p>
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] backdrop-blur-md">
              <TabsTrigger value="todos">Todos ({filtered.length + studentsWithoutPlan.length})</TabsTrigger>
              <TabsTrigger value="ativo">Ativos</TabsTrigger>
              <TabsTrigger value="pendente">
                Pendentes
                {studentsWithoutPlan.length > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                    {studentsWithoutPlan.length + filtered.filter((p) => !p.active).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="todos" className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : (
                <>
                  {filtered.map((p) => (
                    <PlanCard key={p.id} p={p} highlighted={alunoParam === p.studentName} onEdit={() => handleEdit(p)} />
                  ))}
                  {studentsWithoutPlan.map((s) => (
                    <div
                      key={s.id}
                      className="group relative rounded-xl border border-amber-500/20 bg-[hsl(var(--glass-bg))] backdrop-blur-md hover:border-amber-400/40 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10">
                            <UserX size={16} className="text-amber-400" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">Sem plano de treino</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="text-xs gap-1 gold-gradient text-background font-medium"
                          onClick={() => handleNew(s.id)}
                        >
                          <Plus size={12} /> Criar Treino
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && studentsWithoutPlan.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum treino encontrado</p>
                  )}
                </>
              )}
            </TabsContent>
            <TabsContent value="ativo" className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : (() => {
                const items = filtered.filter((p) => p.active);
                return items.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum treino ativo</p>
                ) : (
                  items.map((p) => (
                    <PlanCard key={p.id} p={p} highlighted={alunoParam === p.studentName} onEdit={() => handleEdit(p)} />
                  ))
                );
              })()}
            </TabsContent>
            <TabsContent value="pendente" className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : (
                <>
                  {studentsWithoutPlan.map((s) => (
                    <div
                      key={s.id}
                      className="group relative rounded-xl border border-amber-500/20 bg-[hsl(var(--glass-bg))] backdrop-blur-md hover:border-amber-400/40 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10">
                            <UserX size={16} className="text-amber-400" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">Sem plano de treino</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="text-xs gap-1 gold-gradient text-background font-medium"
                          onClick={() => handleNew(s.id)}
                        >
                          <Plus size={12} /> Criar Treino
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filtered.filter((p) => !p.active).map((p) => (
                    <PlanCard key={p.id} p={p} highlighted={alunoParam === p.studentName} onEdit={() => handleEdit(p)} />
                  ))}
                  {studentsWithoutPlan.length === 0 && filtered.filter((p) => !p.active).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum pendente 🎉</p>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      <TrainingPlanEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        students={studentOptions}
        editingPlan={editingPlan}
      />
    </>
  );
};

export default EspecialistaTreino;
