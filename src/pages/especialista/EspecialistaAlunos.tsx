import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Flame, User, Dumbbell, Apple, Brain, ClipboardCheck, BarChart3, MoreVertical, AlertCircle, TrendingUp, UtensilsCrossed, Eye, FileText, Edit, Calendar, MessageSquare, ClipboardList, Filter, ArrowUpDown, ArrowUp, ArrowDown, ShieldAlert, Plus } from "lucide-react";
import StudentPerformancePanel from "@/components/especialista/StudentPerformancePanel";
import StudentPhotosPanel from "@/components/especialista/StudentPhotosPanel";
import StudentEvolutionChart from "@/components/especialista/StudentEvolutionChart";
import StudentMentalCheckins from "@/components/especialista/StudentMentalCheckins";
import StudentWorkoutSummary from "@/components/especialista/StudentWorkoutSummary";
import StudentLoadProgression from "@/components/especialista/StudentLoadProgression";
import StudentMealAdherence from "@/components/especialista/StudentMealAdherence";
import StudentDailyMealLog from "@/components/especialista/StudentDailyMealLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import VolumeLimitsEditor from "@/components/especialista/VolumeLimitsEditor";
import { cn } from "@/lib/utils";
import { useSpecialistStudents, useMySpecialty, useStudentAnamnese, type StudentWithDetails } from "@/hooks/useSpecialistStudents";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import DietPlanEditor from "@/components/especialista/DietPlanEditor";
import TrainingPlanEditor from "@/components/especialista/TrainingPlanEditor";

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

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Agora";
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

const useIsAdmin = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin");
      return (data ?? []).length > 0;
    },
    enabled: !!user,
  });
};

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ativo: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  alerta: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  inativo: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
};

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
        <Icon size={14} className="text-[hsl(var(--gold))]" />
      </div>
      <h4 className="font-cinzel text-sm font-bold text-foreground">{title}</h4>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">{children}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
    <p className="text-foreground font-medium">{value}</p>
  </div>
);

const getPermissions = (specialty: string | null) => {
  const s = (specialty ?? "").toLowerCase();
  return {
    canEditTreino: s === "personal" || s === "preparador físico" || s.includes("personal"),
    canEditDieta: s === "nutricionista" || s.includes("nutri"),
    canEditVolume: s === "personal" || s === "preparador físico" || s.includes("personal"),
    canRequestAnamnese: true,
  };
};

// ── Student Training Tab ──
const StudentTrainingTab = ({ studentId, studentName, canEdit, onEditPlan }: { studentId: string; studentName: string; canEdit: boolean; onEditPlan?: (plan: any) => void }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["student-training-plans", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_plans")
        .select("id, title, active, updated_at, groups, total_sessions, avaliacao_postural, pontos_melhoria, objetivo_mesociclo")
        .eq("user_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <Dumbbell size={24} className="opacity-40" />
        <p className="text-sm">Nenhum plano de treino encontrado</p>
      </div>
    );
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--gold)/0.15)]">
            <Dumbbell size={16} className="text-[hsl(var(--gold))]" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{data.title}</p>
            <p className="text-[10px] text-muted-foreground">
              Atualizado {new Date(data.updated_at).toLocaleDateString("pt-BR")} · {groups.length} grupo(s) · {data.total_sessions} sessões
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px]", data.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground")}>
            {data.active ? "Ativo" : "Inativo"}
          </Badge>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1 border-[hsl(var(--gold)/0.3)] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.1)]"
              onClick={() => onEditPlan?.({
                id: data.id,
                title: data.title,
                user_id: studentId,
                groups: groups,
                total_sessions: data.total_sessions,
              })}
            >
              <Edit size={12} /> Editar
            </Button>
          )}
        </div>
      </div>

      {/* Groups */}
      {groups.map((group: any, gi: number) => (
        <div key={gi} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-[hsl(var(--gold))]" />
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">{group.name || `Grupo ${gi + 1}`}</p>
          </div>
          <div className="rounded-lg border border-[hsl(var(--glass-border))] overflow-hidden">
            {(group.exercises ?? []).map((ex: any, ei: number) => (
              <div
                key={ei}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 text-xs",
                  ei % 2 === 0 ? "bg-[hsl(var(--glass-bg))]" : "bg-secondary/20"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--gold))] flex items-center justify-center text-[10px] font-bold shrink-0">
                    {ei + 1}
                  </span>
                  <span className="text-foreground font-medium">{ex.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground tabular-nums shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-secondary/50 text-[10px] font-semibold text-foreground">{ex.sets}x{ex.reps}</span>
                  {ex.rest && <span className="text-[10px]">⏱ {ex.rest}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Student Diet Tab ──
const StudentDietTab = ({ studentId }: { studentId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["student-diet-plans", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diet_plans")
        .select("id, title, active, updated_at, meals")
        .eq("user_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!studentId,
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <Apple size={24} className="opacity-40" />
        <p className="text-sm">Nenhum plano de dieta encontrado</p>
      </div>
    );
  }

  const meals = Array.isArray(data.meals) ? data.meals : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Apple size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">{data.title}</p>
            <p className="text-[10px] text-muted-foreground">
              Atualizado {new Date(data.updated_at).toLocaleDateString("pt-BR")} · {meals.length} refeição(ões)
            </p>
          </div>
        </div>
        <Badge className={cn("text-[10px]", data.active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground")}>
          {data.active ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      {meals.map((meal: any, mi: number) => (
        <div key={mi} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">{meal.name || `Refeição ${mi + 1}`}</p>
            {meal.time && <span className="text-[10px] text-muted-foreground ml-auto">{meal.time}</span>}
          </div>

          {meal.macros && (
            <div className="flex gap-2 px-3">
              {[
                { label: "Kcal", value: meal.macros.calories ?? 0, color: "text-[hsl(var(--gold))]" },
                { label: "P", value: `${meal.macros.protein ?? 0}g`, color: "text-blue-400" },
                { label: "C", value: `${meal.macros.carbs ?? 0}g`, color: "text-amber-400" },
                { label: "G", value: `${meal.macros.fat ?? 0}g`, color: "text-rose-400" },
              ].map((m) => (
                <span key={m.label} className="text-[10px] text-muted-foreground">
                  <span className={cn("font-semibold", m.color)}>{m.value}</span> {m.label}
                </span>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-[hsl(var(--glass-border))] overflow-hidden">
            {(meal.foods ?? []).map((food: any, fi: number) => (
              <div
                key={fi}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-xs",
                  fi % 2 === 0 ? "bg-[hsl(var(--glass-bg))]" : "bg-secondary/20"
                )}
              >
                <span className="text-foreground font-medium">{food.name}</span>
                <span className="text-muted-foreground tabular-nums">{food.quantity}{food.unit}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Student Summary (Resumo) Tab Content ──
const StudentResumoContent = ({ aluno, specialty, anamnese, anamneseLoading }: {
  aluno: StudentWithDetails;
  specialty: string | null;
  anamnese: any;
  anamneseLoading: boolean;
}) => (
  <div className="space-y-5">
    <Section icon={User} title="Dados Pessoais">
      <Field label="Email" value={aluno.email} />
      <Field label="Telefone" value={aluno.telefone ?? "—"} />
      <Field label="Nascimento" value={aluno.nascimento ?? "—"} />
      <Field label="Sexo" value={aluno.sexo ?? "—"} />
    </Section>
    <div className="border-t border-border/50" />
    <Section icon={Dumbbell} title="Perfil Físico">
      <Field label="Peso" value={aluno.peso ?? "—"} />
      <Field label="Altura" value={aluno.altura ?? "—"} />
    </Section>
    {anamneseLoading ? (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    ) : anamnese ? (
      <>
        <div className="border-t border-border/50" />
        <Section icon={Apple} title="Perfil Nutricional (Anamnese)">
          <Field label="Restrições" value={anamnese.restricoes_alimentares ?? "Nenhuma"} />
          <Field label="Dieta Atual" value={anamnese.dieta_atual ?? "—"} />
          <Field label="Suplementos" value={anamnese.suplementos ?? "—"} />
          <Field label="Água Diária" value={anamnese.agua_diaria ?? "—"} />
        </Section>
        <div className="border-t border-border/50" />
        <Section icon={Brain} title="Perfil Psicológico (Anamnese)">
          <Field label="Estresse" value={anamnese.nivel_estresse ?? "—"} />
          <Field label="Sono" value={anamnese.sono_horas ?? "—"} />
          <Field label="Motivação" value={anamnese.motivacao ?? "—"} />
          <Field label="Objetivo" value={anamnese.objetivo ?? "—"} />
        </Section>
        <div className="border-t border-border/50" />
        <Section icon={Dumbbell} title="Treino (Anamnese)">
          <Field label="Experiência" value={anamnese.experiencia_treino ?? "—"} />
          <Field label="Frequência" value={anamnese.frequencia_treino ?? "—"} />
          <Field label="Local" value={anamnese.local_treino ?? "—"} />
          <Field label="Equipamentos" value={anamnese.equipamentos ?? "—"} />
          <Field label="Lesões" value={anamnese.lesoes ?? "—"} />
          <Field label="Disponibilidade" value={anamnese.disponibilidade_treino ?? "—"} />
        </Section>
        <p className="text-[10px] text-muted-foreground text-right">
          Última anamnese: {new Date(anamnese.created_at).toLocaleDateString("pt-BR")}
        </p>
      </>
    ) : (
      <>
        <div className="border-t border-border/50" />
        <p className="text-sm text-muted-foreground text-center py-3">Nenhuma anamnese preenchida</p>
      </>
    )}
    <>
      <div className="border-t border-border/50" />
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
            <BarChart3 size={14} className="text-[hsl(var(--gold))]" />
          </div>
          <h4 className="font-cinzel text-sm font-bold text-foreground">Performance (7 dias)</h4>
        </div>
        <StudentPerformancePanel studentId={aluno.id} studentName={aluno.name} />
      </div>
    </>
    <div className="border-t border-border/50" />
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
          <TrendingUp size={14} className="text-[hsl(var(--gold))]" />
        </div>
        <h4 className="font-cinzel text-sm font-bold text-foreground">Evolução de Peso</h4>
      </div>
      <StudentEvolutionChart studentId={aluno.id} />
    </div>
    <div className="border-t border-border/50" />
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
          <ClipboardCheck size={14} className="text-[hsl(var(--gold))]" />
        </div>
        <h4 className="font-cinzel text-sm font-bold text-foreground">Fotos de Evolução</h4>
      </div>
      <StudentPhotosPanel studentId={aluno.id} />
    </div>
    <div className="border-t border-border/50" />
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
          <Brain size={14} className="text-[hsl(var(--gold))]" />
        </div>
        <h4 className="font-cinzel text-sm font-bold text-foreground">Check-ins Mentais (30 dias)</h4>
      </div>
      <StudentMentalCheckins studentId={aluno.id} />
    </div>
    <div className="border-t border-border/50" />
    {specialty === "nutricionista" ? (
      <>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
              <Apple size={14} className="text-[hsl(var(--gold))]" />
            </div>
            <h4 className="font-cinzel text-sm font-bold text-foreground">Registro Alimentar Diário</h4>
          </div>
          <StudentDailyMealLog studentId={aluno.id} />
        </div>
        <div className="border-t border-border/50" />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
              <UtensilsCrossed size={14} className="text-[hsl(var(--gold))]" />
            </div>
            <h4 className="font-cinzel text-sm font-bold text-foreground">Adesão por Refeição</h4>
          </div>
          <StudentMealAdherence studentId={aluno.id} />
        </div>
      </>
    ) : (
      <>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
              <Dumbbell size={14} className="text-[hsl(var(--gold))]" />
            </div>
            <h4 className="font-cinzel text-sm font-bold text-foreground">Últimos Treinos</h4>
          </div>
          <StudentWorkoutSummary studentId={aluno.id} />
        </div>
        <div className="border-t border-border/50" />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
              <TrendingUp size={14} className="text-[hsl(var(--gold))]" />
            </div>
            <h4 className="font-cinzel text-sm font-bold text-foreground">Progressão de Cargas</h4>
          </div>
          <StudentLoadProgression studentId={aluno.id} />
        </div>
      </>
    )}
  </div>
);

const StudentSummaryDialog = ({ aluno, specialty, onEditTraining, onEditDiet }: { aluno: StudentWithDetails; specialty: string | null; onEditTraining?: (plan: any) => void; onEditDiet?: (plan: any) => void }) => {
  const sc = statusConfig[aluno.status];
  const [open, setOpen] = useState(false);
  const { data: anamnese, isLoading: anamneseLoading } = useStudentAnamnese(open ? aluno.id : null);
  const { data: isAdmin } = useIsAdmin();

  const showTreino = true;
  const showDieta = true;
  const hasTabs = true;

  const handleEditPlanFromSummary = (plan: any) => {
    setOpen(false);
    onEditTraining?.(plan);
  };

  const handleEditDietFromSummary = (plan: any) => {
    setOpen(false);
    onEditDiet?.(plan);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]">
          Ver Resumo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-lg gold-text-gradient">{aluno.name}</DialogTitle>
          <div className="flex gap-2 mt-1">
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", sc.bg, sc.text)}>{aluno.status}</span>
            {aluno.specialty && <Badge variant="outline" className="text-[10px]">{aluno.specialty}</Badge>}
          </div>
        </DialogHeader>

        {hasTabs ? (
          <Tabs defaultValue="resumo" className="mt-2">
            <TabsList className="w-full bg-secondary/50">
              <TabsTrigger value="resumo" className="flex-1 text-xs">Resumo</TabsTrigger>
              {showTreino && <TabsTrigger value="treino" className="flex-1 text-xs">Treino</TabsTrigger>}
              {showDieta && <TabsTrigger value="dieta" className="flex-1 text-xs">Dieta</TabsTrigger>}
            </TabsList>
            <TabsContent value="resumo" className="mt-4">
              <StudentResumoContent aluno={aluno} specialty={specialty} anamnese={anamnese} anamneseLoading={anamneseLoading} />
            </TabsContent>
            {showTreino && (
              <TabsContent value="treino" className="mt-4">
                <StudentTrainingTab studentId={aluno.id} studentName={aluno.name} canEdit={showTreino && !isAdmin ? true : !!isAdmin} onEditPlan={handleEditPlanFromSummary} />
              </TabsContent>
            )}
            {showDieta && (
              <TabsContent value="dieta" className="mt-4">
                <StudentDietTab studentId={aluno.id} />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="mt-4">
            <StudentResumoContent aluno={aluno} specialty={specialty} anamnese={anamnese} anamneseLoading={anamneseLoading} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const StudentCard = ({
  aluno,
  highlighted,
  specialty,
  onVolumeEdit,
  onRequestAnamnese,
  hasDiet,
  dietAdherence,
  hasUnreviewedAnamnese,
  hasPendingAnamneseRequest,
  lastMessageAt,
  daysSinceAssessment,
  churnRisk,
  dietPlanInfo,
  onEditDiet,
  onCreateDiet,
  hasTraining,
  trainingAdherence,
  trainingPlanInfo,
  onEditTraining,
  onCreateTraining,
}: {
  aluno: StudentWithDetails;
  highlighted: boolean;
  specialty: string | null;
  onVolumeEdit: (id: string, name: string) => void;
  onRequestAnamnese: (id: string, name: string) => void;
  hasDiet?: boolean;
  dietAdherence?: number;
  hasUnreviewedAnamnese?: boolean;
  hasPendingAnamneseRequest?: boolean;
  lastMessageAt?: string | null;
  daysSinceAssessment?: number | null;
  churnRisk?: { type: "expiring" | "overdue"; label: string } | null;
  dietPlanInfo?: { id: string; title: string; goal: string; mealsCount: number; updated_at: string; meals: any[]; user_id: string } | null;
  onEditDiet?: (plan: any) => void;
  onCreateDiet?: (studentId: string) => void;
  hasTraining?: boolean;
  trainingAdherence?: number;
  trainingPlanInfo?: { id: string; title: string; groupsCount: number; totalSessions: number; updated_at: string; user_id: string } | null;
  onEditTraining?: (plan: any) => void;
  onCreateTraining?: (studentId: string) => void;
}) => {
  const sc = statusConfig[aluno.status];
  const cardRef = useRef<HTMLDivElement>(null);
  const perms = getPermissions(specialty);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  const handleViewAnamnese = () => {
    navigate(`/especialista/anamnese/${aluno.id}`);
  };

  const isPersonal = specialty === "personal" || specialty === "preparador físico" || (specialty ?? "").toLowerCase().includes("personal");
  const isNutricionista = specialty === "nutricionista";

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative rounded-xl border bg-[hsl(var(--glass-bg))] backdrop-blur-md transition-all duration-200 border-[hsl(var(--glass-border))] hover:border-[hsl(var(--gold))] hover:ring-1 hover:ring-[hsl(var(--gold)/0.3)]",
        highlighted && "border-[hsl(var(--gold))] ring-1 ring-[hsl(var(--gold)/0.3)]"
      )}
    >
      <div
        className="p-3 sm:p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Top row: avatar + name + status + menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary flex items-center justify-center ring-2 ring-[hsl(var(--glass-border))] shrink-0">
            {aluno.avatar_url ? (
              <img src={aluno.avatar_url} alt={aluno.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <User size={16} className="text-muted-foreground" />
            )}
            <div className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-background z-20", sc.dot)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate text-xs sm:text-sm">{aluno.name}</p>
            <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 flex-wrap">
              <span className={cn("px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium uppercase tracking-wider whitespace-nowrap", sc.bg, sc.text)}>
                {aluno.status}
              </span>
              {hasDiet === false && isNutricionista && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-amber-500/10 text-amber-400 whitespace-nowrap">
                  Sem dieta
                </span>
              )}
              {hasTraining === false && isPersonal && (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-amber-500/10 text-amber-400 whitespace-nowrap">
                  Sem treino
                </span>
              )}
              {dietPlanInfo?.goal && goalColors[dietPlanInfo.goal] && (
                <span className={cn("px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium uppercase tracking-wider whitespace-nowrap", goalColors[dietPlanInfo.goal].bg, goalColors[dietPlanInfo.goal].text)}>
                  {dietPlanInfo.goal}
                </span>
              )}
              {hasUnreviewedAnamnese && !hasPendingAnamneseRequest && (
                <span className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                  <FileText size={9} /> Anamnese
                </span>
              )}
              {hasPendingAnamneseRequest && (
                <span className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-destructive/20 text-destructive border border-destructive/30 whitespace-nowrap animate-pulse">
                  <AlertCircle size={9} /> Anamnese não realizada
                </span>
              )}
              {churnRisk && (
                <span className={cn(
                  "flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap",
                  churnRisk.type === "overdue"
                    ? "bg-destructive/20 text-destructive border border-destructive/30 animate-pulse"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                )}>
                  <ShieldAlert size={9} /> {churnRisk.label}
                </span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0 shrink-0" onClick={(e) => e.stopPropagation()}>
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem onClick={handleViewAnamnese}>
                <Eye size={14} className="mr-2" /> Ver Anamnese
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {perms.canRequestAnamnese && (
                <DropdownMenuItem onClick={() => onRequestAnamnese(aluno.id, aluno.name)}>
                  <ClipboardCheck size={14} className="mr-2" /> Solicitar Anamnese
                </DropdownMenuItem>
              )}
              {perms.canEditVolume && (
                <DropdownMenuItem onClick={() => onVolumeEdit(aluno.id, aluno.name)}>
                  <BarChart3 size={14} className="mr-2" /> Editar Volume
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Metrics row: entry date, last interaction, days since assessment */}
        <div className="flex items-center gap-3 mt-2 pl-[44px] sm:pl-[52px] flex-wrap text-[9px] sm:text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1" title="Data de entrada">
            <Calendar size={10} className="shrink-0" />
            {new Date(aluno.created_at).toLocaleDateString("pt-BR")}
          </span>
          <span className="flex items-center gap-1" title="Última interação no chat">
            <MessageSquare size={10} className="shrink-0" />
            {lastMessageAt
              ? (() => {
                  const days = Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / 86400000);
                  if (days === 0) return "Hoje";
                  if (days === 1) return "Há 1 dia";
                  return `Há ${days} dias`;
                })()
              : "Sem interação"}
          </span>
          <span className="flex items-center gap-1" title="Dias desde última avaliação">
            <ClipboardList size={10} className="shrink-0" />
            {daysSinceAssessment != null
              ? daysSinceAssessment === 0
                ? "Avaliação hoje"
                : `${daysSinceAssessment}d sem avaliação`
              : "Sem avaliação"}
          </span>
        </div>

        {/* Diet info row (nutricionista only) */}
        {isNutricionista && dietPlanInfo && (
          <div className="flex items-center gap-3 mt-1.5 pl-[44px] sm:pl-[52px] text-[9px] sm:text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Apple size={10} className="text-emerald-400 shrink-0" />
              {dietPlanInfo.title} · {dietPlanInfo.mealsCount} refeições · {getTimeAgo(dietPlanInfo.updated_at)}
            </span>
          </div>
        )}

        {/* Training info row (personal only) */}
        {isPersonal && trainingPlanInfo && (
          <div className="flex items-center gap-3 mt-1.5 pl-[44px] sm:pl-[52px] text-[9px] sm:text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Dumbbell size={10} className="text-[hsl(var(--gold))] shrink-0" />
              {trainingPlanInfo.title} · {trainingPlanInfo.groupsCount} grupos · {trainingPlanInfo.totalSessions} sessões · {getTimeAgo(trainingPlanInfo.updated_at)}
            </span>
          </div>
        )}

        {/* Bottom row: adherence bar + action buttons */}
        <div className="flex items-center gap-2 sm:gap-3 mt-2 pl-[44px] sm:pl-[52px]">
          {isNutricionista ? (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <UtensilsCrossed size={11} className="text-[hsl(25,100%,50%)] shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${dietAdherence ?? 0}%`,
                    background: "linear-gradient(90deg, hsl(40, 100%, 55%), hsl(25, 100%, 50%))",
                  }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground tabular-nums shrink-0">{dietAdherence ?? 0}%</span>
            </div>
          ) : isPersonal ? (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <Dumbbell size={11} className="text-[hsl(var(--gold))] shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${trainingAdherence ?? 0}%`,
                    background: "linear-gradient(90deg, hsl(var(--gold)), hsl(25, 100%, 50%))",
                  }}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground tabular-nums shrink-0">{trainingAdherence ?? 0}%</span>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-1.5">
            {isNutricionista && onEditDiet && dietPlanInfo && (
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] sm:text-xs gap-1 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] whitespace-nowrap h-7"
                onClick={(e) => { e.stopPropagation(); onEditDiet(dietPlanInfo); }}
              >
                <Edit size={10} /> Editar Dieta
              </Button>
            )}
            {isNutricionista && !dietPlanInfo && onCreateDiet && (
              <Button
                size="sm"
                className="text-[10px] sm:text-xs gap-1 gold-gradient text-background font-medium whitespace-nowrap h-7"
                onClick={(e) => { e.stopPropagation(); onCreateDiet(aluno.id); }}
              >
                <Plus size={10} /> Criar Dieta
              </Button>
            )}
            {isPersonal && onEditTraining && trainingPlanInfo && (
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] sm:text-xs gap-1 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] whitespace-nowrap h-7"
                onClick={(e) => { e.stopPropagation(); onEditTraining(trainingPlanInfo); }}
              >
                <Edit size={10} /> Editar Treino
              </Button>
            )}
            {isPersonal && !trainingPlanInfo && onCreateTraining && (
              <Button
                size="sm"
                className="text-[10px] sm:text-xs gap-1 gold-gradient text-background font-medium whitespace-nowrap h-7"
                onClick={(e) => { e.stopPropagation(); onCreateTraining(aluno.id); }}
              >
                <Plus size={10} /> Criar Treino
              </Button>
            )}
            <StudentSummaryDialog aluno={aluno} specialty={specialty} onEditTraining={onEditTraining} onEditDiet={onEditDiet} />
          </div>
        </div>
      </div>

      {/* Expanded: adherence details */}
      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-[hsl(var(--glass-border))] pt-3">
          <StudentPerformancePanel studentId={aluno.id} studentName={aluno.name} />
        </div>
      )}
    </div>
  );
};

const EspecialistaAlunos = () => {
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get("filter");
  const alunoParam = searchParams.get("aluno");

  const [search, setSearch] = useState("");
  const [volumeEditAluno, setVolumeEditAluno] = useState<{ id: string; name: string } | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const requestAnamneseMutation = useMutation({
    mutationFn: async ({ studentId, studentName }: { studentId: string; studentName: string }) => {
      const { error } = await supabase.from("notifications").insert({
        user_id: studentId,
        type: "anamnese_request",
        title: "📋 Anamnese Solicitada",
        body: "Seu especialista solicitou que você preencha sua anamnese atualizada.",
        metadata: { requested_by: user?.id },
      });
      if (error) throw error;
    },
    onSuccess: (_, { studentName }) => toast.success(`Anamnese solicitada para ${studentName}`),
    onError: () => toast.error("Erro ao solicitar anamnese"),
  });

  const { data: students, isLoading } = useSpecialistStudents();
  const { data: mySpecialty } = useMySpecialty();

  const isPersonal = mySpecialty === "personal" || mySpecialty === "preparador físico" || (mySpecialty ?? "").toLowerCase().includes("personal");
  const isNutricionista = mySpecialty === "nutricionista";

  const studentIds = (students ?? []).map((s) => s.id);

  // Check unreviewed anamneses
  const { data: unreviewedSet } = useQuery({
    queryKey: ["unreviewed-anamneses", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("anamnese")
        .select("user_id")
        .in("user_id", studentIds)
        .eq("reviewed", false);
      if (error) throw error;
      return new Set((data ?? []).map((a) => a.user_id));
    },
    enabled: studentIds.length > 0,
  });

  const unreviewedCount = unreviewedSet?.size ?? 0;

  // Check students who received anamnese request but haven't submitted yet
  const { data: pendingAnamneseSet } = useQuery({
    queryKey: ["pending-anamnese-requests", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return new Set<string>();
      const { data: requests, error: reqErr } = await supabase
        .from("notifications")
        .select("user_id, created_at")
        .in("user_id", studentIds)
        .eq("type", "anamnese_request")
        .order("created_at", { ascending: false });
      if (reqErr) throw reqErr;

      const { data: anamneses, error: anaErr } = await supabase
        .from("anamnese")
        .select("user_id, created_at")
        .in("user_id", studentIds)
        .order("created_at", { ascending: false });
      if (anaErr) throw anaErr;

      const latestAnamnese = new Map<string, string>();
      (anamneses ?? []).forEach((a) => {
        if (!latestAnamnese.has(a.user_id)) latestAnamnese.set(a.user_id, a.created_at);
      });

      const latestRequest = new Map<string, string>();
      (requests ?? []).forEach((r) => {
        if (!latestRequest.has(r.user_id)) latestRequest.set(r.user_id, r.created_at);
      });

      const pending = new Set<string>();
      latestRequest.forEach((reqDate, userId) => {
        const anaDate = latestAnamnese.get(userId);
        if (!anaDate || new Date(reqDate) > new Date(anaDate)) {
          pending.add(userId);
        }
      });
      return pending;
    },
    enabled: studentIds.length > 0,
  });

  // Diet plans for nutricionistas (full data for card + editor)
  const { data: dietPlans } = useQuery({
    queryKey: ["nutri-diet-check", studentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diet_plans")
        .select("id, user_id, title, goal, meals, updated_at, active")
        .in("user_id", studentIds)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isNutricionista && studentIds.length > 0,
  });

  const dietPlanSet = new Set((dietPlans ?? []).map((d) => d.user_id));

  const { data: dietAdherenceMap } = useQuery({
    queryKey: ["alunos-diet-adherence", studentIds],
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

      const expectedMeals = new Map<string, number>();
      (dietPlans ?? []).forEach((p) => {
        const meals = Array.isArray(p.meals) ? p.meals : [];
        expectedMeals.set(p.user_id, meals.length);
      });

      const totals = new Map<string, { done: number; expected: number }>();
      (data ?? []).forEach((h) => {
        const prev = totals.get(h.user_id) ?? { done: 0, expected: 0 };
        prev.done += (h.completed_meals ?? []).length;
        prev.expected += (expectedMeals.get(h.user_id) ?? 0);
        totals.set(h.user_id, prev);
      });

      const result = new Map<string, number>();
      totals.forEach((v, k) => {
        result.set(k, v.expected > 0 ? Math.min(100, Math.round((v.done / v.expected) * 100)) : 0);
      });
      return result;
    },
    enabled: isNutricionista && studentIds.length > 0 && !!dietPlans,
  });

  // Training plans for personal (full data for card)
  const { data: trainingPlans } = useQuery({
    queryKey: ["personal-training-check", studentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_plans")
        .select("id, user_id, title, groups, total_sessions, updated_at, active, avaliacao_postural, pontos_melhoria, objetivo_mesociclo")
        .in("user_id", studentIds)
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isPersonal && studentIds.length > 0,
  });

  const trainingPlanSet = new Set((trainingPlans ?? []).map((t) => t.user_id));

  // Training adherence for personal (workouts in last 7 days / expected frequency)
  const { data: trainingAdherenceMap } = useQuery({
    queryKey: ["alunos-training-adherence", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return new Map<string, number>();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("workouts")
        .select("user_id, finished_at")
        .in("user_id", studentIds)
        .gte("started_at", sevenDaysAgo.toISOString())
        .not("finished_at", "is", null);
      if (error) throw error;

      // Count completed workouts per student in last 7 days
      const workoutCounts = new Map<string, number>();
      (data ?? []).forEach((w) => {
        workoutCounts.set(w.user_id, (workoutCounts.get(w.user_id) ?? 0) + 1);
      });

      // Expected: number of groups in active plan (train each group once per week)
      const expectedPerWeek = new Map<string, number>();
      (trainingPlans ?? []).forEach((p) => {
        const groups = Array.isArray(p.groups) ? p.groups : [];
        expectedPerWeek.set(p.user_id, Math.max(groups.length, 1));
      });

      const result = new Map<string, number>();
      studentIds.forEach((sid) => {
        const done = workoutCounts.get(sid) ?? 0;
        const expected = expectedPerWeek.get(sid) ?? 5; // default 5 if no plan
        result.set(sid, Math.min(100, Math.round((done / expected) * 100)));
      });
      return result;
    },
    enabled: isPersonal && studentIds.length > 0 && !!trainingPlans,
  });

  // Last chat interaction per student
  const { data: lastMessageMap } = useQuery({
    queryKey: ["student-last-messages", user?.id, studentIds],
    queryFn: async () => {
      if (!user || studentIds.length === 0) return new Map<string, string>();
      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      if (!myConvs || myConvs.length === 0) return new Map<string, string>();

      const convIds = myConvs.map(c => c.conversation_id);

      const { data: studentConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds)
        .in("user_id", studentIds);
      if (!studentConvs || studentConvs.length === 0) return new Map<string, string>();

      const studentConvMap = new Map<string, string[]>();
      studentConvs.forEach(sc => {
        const arr = studentConvMap.get(sc.user_id) ?? [];
        arr.push(sc.conversation_id);
        studentConvMap.set(sc.user_id, arr);
      });

      const allConvIds = [...new Set(studentConvs.map(sc => sc.conversation_id))];
      const { data: lastMsgs } = await supabase.rpc("get_last_messages", { conv_ids: allConvIds });

      const result = new Map<string, string>();
      if (lastMsgs) {
        studentConvMap.forEach((cIds, studentId) => {
          let latest: string | null = null;
          cIds.forEach(cid => {
            const msg = lastMsgs.find((m: any) => m.conversation_id === cid);
            if (msg && (!latest || msg.created_at > latest)) {
              latest = msg.created_at;
            }
          });
          if (latest) result.set(studentId, latest);
        });
      }
      return result;
    },
    enabled: !!user && studentIds.length > 0,
  });

  // Last monthly assessment per student
  const { data: lastAssessmentMap } = useQuery({
    queryKey: ["student-last-assessments", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return new Map<string, number>();
      const { data, error } = await supabase
        .from("monthly_assessments")
        .select("user_id, created_at")
        .in("user_id", studentIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const result = new Map<string, number>();
      (data ?? []).forEach(a => {
        if (!result.has(a.user_id)) {
          const days = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000);
          result.set(a.user_id, days);
        }
      });
      return result;
    },
    enabled: studentIds.length > 0,
  });

  // Churn risk: subscription expiry per student
  const { data: churnRiskMap } = useQuery({
    queryKey: ["student-churn-risk", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return new Map<string, { type: "expiring" | "overdue"; label: string }>();
      const [subsRes, plansRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("user_id, started_at, plan_price, status")
          .in("user_id", studentIds)
          .eq("status", "active"),
        supabase
          .from("subscription_plans")
          .select("price, duration_months")
          .eq("active", true),
      ]);
      const subs = subsRes.data ?? [];
      const plans = plansRes.data ?? [];
      const priceToDuration = new Map<number, number>();
      plans.forEach(p => priceToDuration.set(Number(p.price), p.duration_months));

      const result = new Map<string, { type: "expiring" | "overdue"; label: string }>();
      const now = new Date();
      subs.forEach(sub => {
        const duration = priceToDuration.get(sub.plan_price) ?? 1;
        const expiry = new Date(sub.started_at);
        expiry.setMonth(expiry.getMonth() + duration);
        const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
        if (daysUntil < 0) {
          const d = Math.abs(daysUntil);
          result.set(sub.user_id, { type: "overdue", label: `Vencida há ${d}d` });
        } else if (daysUntil <= 10) {
          result.set(sub.user_id, { type: "expiring", label: `Vence em ${daysUntil}d` });
        }
      });
      return result;
    },
    enabled: studentIds.length > 0,
  });

  const [activeFilter, setActiveFilter] = useState<string>("todos");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterGoal, setFilterGoal] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [trainingEditorOpen, setTrainingEditorOpen] = useState(false);
  const [editingTrainingPlan, setEditingTrainingPlan] = useState<any>(null);

  // Build diet plan info map for cards
  const dietPlanInfoMap = new Map<string, { id: string; title: string; goal: string; mealsCount: number; updated_at: string; meals: any[]; user_id: string }>();
  (dietPlans ?? []).forEach((p) => {
    if (!dietPlanInfoMap.has(p.user_id)) {
      const mealsArr = Array.isArray(p.meals) ? p.meals : [];
      dietPlanInfoMap.set(p.user_id, {
        id: p.id,
        title: p.title,
        goal: p.goal,
        mealsCount: mealsArr.length,
        updated_at: p.updated_at,
        meals: mealsArr as any[],
        user_id: p.user_id,
      });
    }
  });

  // Build training plan info map for cards
  const trainingPlanInfoMap = new Map<string, { id: string; title: string; groupsCount: number; totalSessions: number; updated_at: string; user_id: string }>();
  (trainingPlans ?? []).forEach((p) => {
    if (!trainingPlanInfoMap.has(p.user_id)) {
      const groupsArr = Array.isArray(p.groups) ? p.groups : [];
      trainingPlanInfoMap.set(p.user_id, {
        id: p.id,
        title: p.title,
        groupsCount: groupsArr.length,
        totalSessions: p.total_sessions,
        updated_at: p.updated_at,
        user_id: p.user_id,
      });
    }
  });

  const studentOptions = (students ?? []).map((s) => ({ id: s.id, name: s.name }));

  const handleEditDiet = (plan: any) => {
    setEditingPlan(plan);
    setEditorOpen(true);
  };

  const handleCreateDiet = (studentId?: string) => {
    setEditingPlan(null);
    setEditorOpen(true);
  };

  const handleEditTraining = (plan: any) => {
    setEditingTrainingPlan({
      id: plan.id,
      title: plan.title,
      user_id: plan.user_id,
      groups: Array.isArray(plan.groups) ? plan.groups : [],
      total_sessions: plan.totalSessions ?? plan.total_sessions ?? 50,
    });
    setTrainingEditorOpen(true);
  };

  const handleCreateTraining = (studentId: string) => {
    setEditingTrainingPlan(null);
    setTrainingEditorOpen(true);
  };

  const filtered = (students ?? []).filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    if (filterParam === "alerta") return matchesSearch && (a.status === "alerta" || a.status === "inativo");
    if (activeFilter === "ativos") return matchesSearch && a.status === "ativo";
    if (activeFilter === "sem-dieta") return matchesSearch && !dietPlanSet.has(a.id);
    if (activeFilter === "sem-treino") return matchesSearch && !trainingPlanSet.has(a.id);
    if (activeFilter === "anamnese") return matchesSearch && (unreviewedSet?.has(a.id) ?? false);
    if (activeFilter === "churn") return matchesSearch && churnRiskMap?.has(a.id);
    // Goal filter
    if (filterGoal) {
      const info = dietPlanInfoMap.get(a.id);
      if (!info || info.goal !== filterGoal) return false;
    }
    return matchesSearch;
  }).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-cinzel text-xl sm:text-2xl font-bold gold-text-gradient">Meus Alunos</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {filterParam === "alerta"
            ? "Exibindo alunos em alerta ou inativos"
            : "Visualize o perfil completo e acompanhe anamneses"}
        </p>
      </div>

      {/* Unreviewed anamneses alert */}
      {unreviewedCount > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 sm:p-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-xs sm:text-sm font-medium text-foreground">
            {unreviewedCount} aluno{unreviewedCount > 1 ? "s" : ""} com anamnese pendente
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] backdrop-blur-md text-[16px] sm:text-sm"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 h-10 w-10 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] relative z-10"
            >
              <Filter size={16} className="text-[hsl(var(--gold))]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border min-w-[180px] z-50">
            <DropdownMenuItem
              onClick={() => setSortOrder("newest")}
              className={cn(sortOrder === "newest" && "text-[hsl(var(--gold))]")}
            >
              <ArrowDown size={14} className="mr-2" /> Mais recentes primeiro
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortOrder("oldest")}
              className={cn(sortOrder === "oldest" && "text-[hsl(var(--gold))]")}
            >
              <ArrowUp size={14} className="mr-2" /> Mais antigos primeiro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter chips - Students */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <User size={14} className="text-muted-foreground shrink-0" />
        {[
          { key: "todos", label: "Todos", count: (students ?? []).length },
          { key: "ativos", label: "Ativos", count: (students ?? []).filter(s => s.status === "ativo").length },
          ...(isNutricionista ? [{ key: "sem-dieta", label: "Sem dieta", count: (students ?? []).filter(s => !dietPlanSet.has(s.id)).length }] : []),
          ...(isPersonal ? [{ key: "sem-treino", label: "Sem treino", count: (students ?? []).filter(s => !trainingPlanSet.has(s.id)).length }] : []),
          { key: "anamnese", label: "Anamnese pendente", count: unreviewedCount },
          { key: "churn", label: "Risco de Churn", count: churnRiskMap?.size ?? 0 },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => { setActiveFilter(f.key); setFilterGoal(null); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
              activeFilter === f.key && !filterGoal
                ? "bg-[hsl(var(--gold)/0.15)] text-[hsl(var(--gold))] border-[hsl(var(--gold)/0.4)]"
                : "bg-[hsl(var(--glass-bg))] text-muted-foreground border-[hsl(var(--glass-border))] hover:border-[hsl(var(--glass-highlight))]"
            )}
          >
            {f.label}
            <span className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] tabular-nums",
              activeFilter === f.key && !filterGoal ? "bg-[hsl(var(--gold)/0.2)]" : "bg-secondary"
            )}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Goal filter chips (nutricionista only) */}
      {isNutricionista && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <UtensilsCrossed size={14} className="text-muted-foreground shrink-0" />
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.key ?? "all"}
              onClick={() => { setFilterGoal(g.key); if (g.key) setActiveFilter("todos"); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                filterGoal === g.key
                  ? "bg-accent/20 border-accent text-accent"
                  : "bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] text-muted-foreground hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum aluno encontrado</p>
        ) : (
          filtered.map((aluno) => (
            <StudentCard
              key={aluno.id}
              aluno={aluno}
              highlighted={alunoParam === aluno.name}
              specialty={mySpecialty ?? null}
              onVolumeEdit={(id, name) => setVolumeEditAluno({ id, name })}
              onRequestAnamnese={(id, name) => requestAnamneseMutation.mutate({ studentId: id, studentName: name })}
              hasDiet={isNutricionista ? dietPlanSet.has(aluno.id) : undefined}
              dietAdherence={isNutricionista ? dietAdherenceMap?.get(aluno.id) : undefined}
              hasUnreviewedAnamnese={unreviewedSet?.has(aluno.id)}
              hasPendingAnamneseRequest={pendingAnamneseSet?.has(aluno.id)}
              lastMessageAt={lastMessageMap?.get(aluno.id) ?? null}
              daysSinceAssessment={lastAssessmentMap?.get(aluno.id) ?? null}
              churnRisk={churnRiskMap?.get(aluno.id) ?? null}
              dietPlanInfo={isNutricionista ? dietPlanInfoMap.get(aluno.id) ?? null : undefined}
              onEditDiet={isNutricionista ? handleEditDiet : undefined}
              onCreateDiet={isNutricionista ? handleCreateDiet : undefined}
              hasTraining={isPersonal ? trainingPlanSet.has(aluno.id) : undefined}
              trainingAdherence={isPersonal ? trainingAdherenceMap?.get(aluno.id) : undefined}
              trainingPlanInfo={isPersonal ? trainingPlanInfoMap.get(aluno.id) ?? null : undefined}
              onEditTraining={isPersonal ? handleEditTraining : undefined}
              onCreateTraining={isPersonal ? handleCreateTraining : undefined}
            />
          ))
        )}
      </div>

      <VolumeLimitsEditor
        open={!!volumeEditAluno}
        onOpenChange={(open) => !open && setVolumeEditAluno(null)}
        studentId={volumeEditAluno?.id ?? ""}
        studentName={volumeEditAluno?.name ?? ""}
      />

      {isNutricionista && (
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
      )}

      {isPersonal && (
        <TrainingPlanEditor
          open={trainingEditorOpen}
          onClose={() => { setTrainingEditorOpen(false); setEditingTrainingPlan(null); }}
          students={studentOptions}
          editingPlan={editingTrainingPlan}
        />
      )}
    </div>
  );
};

export default EspecialistaAlunos;
