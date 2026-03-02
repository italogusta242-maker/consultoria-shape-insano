import { useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Apple, Edit, User, Plus, AlertCircle, UserX, UtensilsCrossed, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSpecialistStudents } from "@/hooks/useSpecialistStudents";
import { useSpecialtyGuard } from "@/hooks/useSpecialtyGuard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, type Variants } from "framer-motion";
import DietPlanEditor from "@/components/especialista/DietPlanEditor";
import StudentAdherencePanel from "@/components/especialista/StudentAdherencePanel";

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

interface Meal {
  name: string;
  time: string;
  foods: { name: string; quantity: string; unit: string }[];
  notes: string;
  macros: { protein: number; carbs: number; fat: number; calories: number };
}

interface DietPlanRow {
  id: string;
  title: string;
  active: boolean;
  updated_at: string;
  user_id: string;
  studentName: string;
  mealsCount: number;
  meals: Meal[];
  goal: string;
}

const GOAL_OPTIONS = [
  { key: null, label: "Todos" },
  { key: "deficit", label: "Déficit" },
  { key: "bulking", label: "Bulking" },
  { key: "manutenção", label: "Manutenção" },
  { key: "recomposição", label: "Recomposição" },
] as const;

const goalColors: Record<string, { bg: string; text: string }> = {
  deficit: { bg: "bg-red-500/10", text: "text-red-400" },
  bulking: { bg: "bg-blue-500/10", text: "text-blue-400" },
  "manutenção": { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  "recomposição": { bg: "bg-purple-500/10", text: "text-purple-400" },
};

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

const EspecialistaDieta = () => {
  const { user } = useAuth();
  const location = useLocation();
  useSpecialtyGuard(location.pathname);
  const [searchParams] = useSearchParams();
  const alunoParam = searchParams.get("aluno");
  const { data: students } = useSpecialistStudents();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DietPlanRow | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGoal, setFilterGoal] = useState<string | null>(null);

  const studentIds = (students ?? []).map((s) => s.id);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["specialist-diet-plans", user?.id, studentIds],
    queryFn: async () => {
      if (!user || studentIds.length === 0) return [];

      const [plansRes, profilesRes] = await Promise.all([
        supabase.from("diet_plans").select("*").in("user_id", studentIds).order("updated_at", { ascending: false }),
        supabase.from("profiles").select("id, nome, email").in("id", studentIds),
      ]);
      if (plansRes.error) throw plansRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const nameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.nome ?? p.email ?? "Sem nome"]));

      // Keep only the most recent plan per student
      const latestPerStudent = new Map<string, typeof plansRes.data[number]>();
      for (const p of plansRes.data ?? []) {
        if (!latestPerStudent.has(p.user_id)) {
          latestPerStudent.set(p.user_id, p);
        }
      }

      return Array.from(latestPerStudent.values()).map((p): DietPlanRow => {
        const mealsArr = Array.isArray(p.meals) ? p.meals : [];
        return {
          id: p.id,
          title: p.title,
          active: p.active,
          updated_at: p.updated_at,
          user_id: p.user_id,
          studentName: nameMap.get(p.user_id) ?? "Aluno",
          mealsCount: mealsArr.length,
          meals: mealsArr as unknown as Meal[],
          goal: (p as any).goal ?? "manutenção",
        };
      });
    },
    enabled: !!user && studentIds.length > 0,
  });

  // Calculate diet adherence: % of meals completed in last 7 days
  const { data: adherenceMap } = useQuery({
    queryKey: ["diet-adherence-bars", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return new Map<string, number>();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("daily_habits")
        .select("user_id, completed_meals")
        .in("user_id", studentIds)
        .gte("date", sevenDaysAgo.toISOString().split("T")[0]);
      if (error) throw error;

      // Get expected meals count per student from their active diet
      const expectedMeals = new Map<string, number>();
      (plans ?? []).filter((p) => p.active).forEach((p) => {
        expectedMeals.set(p.user_id, p.mealsCount);
      });

      // Calculate adherence per student
      const totals = new Map<string, { done: number; expected: number }>();
      (data ?? []).forEach((h) => {
        const prev = totals.get(h.user_id) ?? { done: 0, expected: 0 };
        const mealsExpected = expectedMeals.get(h.user_id) ?? 0;
        prev.done += (h.completed_meals ?? []).length;
        prev.expected += mealsExpected;
        totals.set(h.user_id, prev);
      });

      const result = new Map<string, number>();
      totals.forEach((v, k) => {
        result.set(k, v.expected > 0 ? Math.min(100, Math.round((v.done / v.expected) * 100)) : 0);
      });
      return result;
    },
    enabled: studentIds.length > 0 && !!plans,
  });

  // Find students without any active diet
  const studentsWithActiveDiet = new Set((plans ?? []).filter((p) => p.active).map((p) => p.user_id));
  const studentsWithoutDiet = (students ?? []).filter((s) => !studentsWithActiveDiet.has(s.id));

  const filtered = (plans ?? []).filter((p) => {
    if (alunoParam) return p.studentName === alunoParam;
    if (filterGoal && p.goal !== filterGoal) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return p.studentName.toLowerCase().includes(term) || p.title.toLowerCase().includes(term);
    }
    return true;
  });

  const filteredStudentsWithoutDiet = searchTerm.trim()
    ? studentsWithoutDiet.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : studentsWithoutDiet;

  const studentOptions = (students ?? []).map((s) => ({ id: s.id, name: s.name }));

  const handleEdit = (plan: DietPlanRow) => {
    setEditingPlan(plan);
    setEditorOpen(true);
  };

  const handleNew = (studentId?: string) => {
    if (studentId) {
      const student = students?.find((s) => s.id === studentId);
      setEditingPlan(null);
      setEditorOpen(true);
      // We'll pre-select via the editor
    } else {
      setEditingPlan(null);
      setEditorOpen(true);
    }
  };

  const renderDietCard = (p: DietPlanRow) => {
    const status = p.active ? "ativo" : "pendente";
    const ss = statusStyle[status];
    const isExpanded = expandedCard === p.id;

    return (
      <div
        key={p.id}
        className={cn(
          "group relative rounded-xl border bg-[hsl(var(--glass-bg))] backdrop-blur-md hover:border-[hsl(var(--glass-highlight))] transition-all duration-200",
          alunoParam === p.studentName
            ? "border-[hsl(var(--gold))] ring-1 ring-[hsl(var(--gold)/0.3)]"
            : "border-[hsl(var(--glass-border))]"
        )}
      >
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 cursor-pointer gap-2"
          onClick={() => setExpandedCard(isExpanded ? null : p.id)}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
              <Apple size={16} className="text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{p.studentName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {p.title} · {p.mealsCount} refeições · Atualizado {getTimeAgo(p.updated_at)}
              </p>
              {p.goal && goalColors[p.goal] && (
                <span className={cn("inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", goalColors[p.goal].bg, goalColors[p.goal].text)}>
                  {p.goal}
                </span>
              )}
              {(() => {
                const adh = adherenceMap?.get(p.user_id) ?? 0;
                return (
                  <div className="flex items-center gap-2 mt-1 max-w-[180px]">
                    <UtensilsCrossed size={12} className="text-[hsl(25,100%,50%)]" />
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${adh}%`,
                          background: "linear-gradient(90deg, hsl(40, 100%, 55%), hsl(25, 100%, 50%))",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{adh}%</span>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider whitespace-nowrap", ss.bg, ss.text)}>
              {status}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] whitespace-nowrap"
              onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
            >
              <Edit size={12} /> Editar
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-[hsl(var(--glass-border))] pt-3">
            <StudentAdherencePanel studentId={p.user_id} studentName={p.studentName} />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <motion.div className="space-y-6" initial="hidden" animate="show" variants={stagger}>
        <motion.div variants={fadeUp} className="flex items-end justify-between">
          <div>
            <h1 className="font-cinzel text-2xl font-bold gold-text-gradient">Editor de Dietas</h1>
            <p className="text-sm text-muted-foreground">
              {alunoParam ? `Dietas de ${alunoParam}` : "Gerencie planos alimentares dos seus alunos"}
            </p>
          </div>
          <Button size="sm" className="gap-1 gold-gradient text-background font-medium" onClick={() => handleNew()}>
            <Plus size={14} /> Nova Dieta
          </Button>
        </motion.div>

        {/* Search bar */}
        <motion.div variants={fadeUp} className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar aluno ou dieta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </motion.div>

        {/* Goal filter chips */}
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.key ?? "all"}
              onClick={() => setFilterGoal(g.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                filterGoal === g.key
                  ? "bg-accent/20 border-accent text-accent"
                  : "bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] text-muted-foreground hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </motion.div>

        {studentsWithoutDiet.length > 0 && (
          <motion.div
            variants={fadeUp}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2 cursor-pointer hover:border-amber-400/50 transition-colors"
            onClick={() => setActiveTab("pendente")}
          >
            <AlertCircle size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-foreground">
              {studentsWithoutDiet.length} aluno{studentsWithoutDiet.length > 1 ? "s" : ""} sem dieta ativa
            </p>
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] backdrop-blur-md">
              <TabsTrigger value="todos">Todos ({filtered.length + filteredStudentsWithoutDiet.length})</TabsTrigger>
              <TabsTrigger value="ativo">Ativos</TabsTrigger>
              <TabsTrigger value="pendente">
                Pendentes
                {studentsWithoutDiet.length > 0 && (
                  <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                    {studentsWithoutDiet.length + filtered.filter((p) => !p.active).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="todos" className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : (
                <>
                  {/* Students with diets */}
                  {filtered.map((p) => renderDietCard(p))}
                  {/* Students without diets */}
                  {filteredStudentsWithoutDiet.map((s) => (
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
                            <p className="text-xs text-muted-foreground">Sem plano alimentar</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="text-xs gap-1 gold-gradient text-background font-medium"
                          onClick={() => handleNew(s.id)}
                        >
                          <Plus size={12} /> Criar Dieta
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && filteredStudentsWithoutDiet.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhuma dieta encontrada</p>
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
                  <p className="text-center text-muted-foreground py-8">Nenhuma dieta ativa</p>
                ) : (
                  items.map((p) => renderDietCard(p))
                );
              })()}
            </TabsContent>

            <TabsContent value="pendente" className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
              ) : (
                <>
                  {filteredStudentsWithoutDiet.map((s) => (
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
                            <p className="text-xs text-muted-foreground">Sem plano alimentar</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="text-xs gap-1 gold-gradient text-background font-medium"
                          onClick={() => handleNew(s.id)}
                        >
                          <Plus size={12} /> Criar Dieta
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filtered.filter((p) => !p.active).map((p) => renderDietCard(p))}
                  {filteredStudentsWithoutDiet.length === 0 && filtered.filter((p) => !p.active).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Nenhum pendente 🎉</p>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      <DietPlanEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingPlan(null); }}
        students={studentOptions}
        editingPlan={editingPlan ? {
          id: editingPlan.id,
          title: editingPlan.title,
          user_id: editingPlan.user_id,
          meals: editingPlan.meals,
        } : null}
      />
    </>
  );
};

export default EspecialistaDieta;
