/**
 * @purpose Split-view page: anamnese left + diet/training editor right (desktop only).
 * @dependencies useStudentAnamnese, DietPlanEditor, TrainingPlanEditor, supabase.
 */
import { useState, useMemo } from "react";
import { getDisplayableImageUrl } from "@/lib/imageUtils";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMySpecialty } from "@/hooks/useSpecialistStudents";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, Loader2, User, Dumbbell, Apple, Brain, ClipboardCheck, Camera, Save, ChevronLeft, ChevronRight, History, ChevronDown, ChevronUp, ImagePlus, Maximize2, Minimize2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import DietPlanEditor from "@/components/especialista/DietPlanEditor";
import TrainingPlanEditor from "@/components/especialista/TrainingPlanEditor";
import StudentPhotosPanel from "@/components/especialista/StudentPhotosPanel";
import PlanVersionTimeline from "@/components/especialista/PlanVersionTimeline";
import LegacyPhotosUpload from "@/components/especialista/LegacyPhotosUpload";

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

const Field = ({ label, value, blurred = false }: { label: string; value: string; blurred?: boolean }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
    <p className={`text-foreground font-medium ${blurred ? "blur-sm select-none opacity-40" : ""}`}>
      {blurred ? "••••••••••" : value}
    </p>
  </div>
);

const EspecialistaAnamneseSplit = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: mySpecialty } = useMySpecialty();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profLoading } = useQuery({
    queryKey: ["split-profile", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, nascimento, sexo, peso, altura, meta_peso, body_fat")
        .eq("id", studentId!)
        .maybeSingle();
      return data;
    },
    enabled: !!studentId,
  });

  const [selectedAnamneseIdx, setSelectedAnamneseIdx] = useState(0);
  const [selectedMonthlyIdx, setSelectedMonthlyIdx] = useState(0);
  const [showMonthlySection, setShowMonthlySection] = useState(true);
  const [viewMode, setViewMode] = useState<"split" | "editor-only">("split");

  const { data: allAnamneses, isLoading: anaLoading } = useQuery({
    queryKey: ["split-all-anamneses", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("anamnese")
        .select("*")
        .eq("user_id", studentId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!studentId,
  });

  const anamnese = allAnamneses?.[selectedAnamneseIdx] ?? null;

  // Fetch monthly assessments
  const { data: monthlyAssessments, isLoading: monthlyLoading } = useQuery({
    queryKey: ["split-monthly-assessments", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_assessments")
        .select("*")
        .eq("user_id", studentId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!studentId,
  });

  const selectedMonthly = monthlyAssessments?.[selectedMonthlyIdx] ?? null;

  const markReviewedMutation = useMutation({
    mutationFn: async () => {
      if (!anamnese?.id || !user) return;
      const { error } = await supabase
        .from("anamnese")
        .update({ reviewed: true, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", anamnese.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["split-all-anamneses"] });
      queryClient.invalidateQueries({ queryKey: ["unreviewed-anamneses"] });
    },
  });

  const markMonthlyReviewedMutation = useMutation({
    mutationFn: async (assessmentId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("monthly_assessments")
        .update({ reviewed: true, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", assessmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["split-monthly-assessments"] });
      toast.success("Reavaliação marcada como revisada");
    },
  });

  const goBack = () => navigate("/especialista/alunos");

  /** Auto-mark anamnese as reviewed when a plan is created */
  const handlePlanCreated = () => {
    if (anamnese && !anamnese.reviewed) {
      markReviewedMutation.mutate();
    }
    goBack();
  };

  const studentName = profile?.nome ?? "Aluno";
  const studentOptions = profile ? [{ id: profile.id, name: studentName }] : [];
  const isNutri = mySpecialty === "nutricionista";

  // Fetch existing training plan for this student
  const { data: existingTrainingPlan } = useQuery({
    queryKey: ["split-training-plan", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_plans")
        .select("id, title, groups, total_sessions, updated_at, active, avaliacao_postural, objetivo_mesociclo, pontos_melhoria, valid_until, specialist_id")
        .eq("user_id", studentId!)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!studentId,
  });

  // Fetch existing diet plan for this student
  const { data: existingDietPlan } = useQuery({
    queryKey: ["split-diet-plan", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("diet_plans")
        .select("id, title, meals, goal, goal_description, updated_at, active, valid_until, specialist_id")
        .eq("user_id", studentId!)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!studentId,
  });

  // Fetch training plan versions
  const { data: trainingVersions } = useQuery({
    queryKey: ["split-training-versions", existingTrainingPlan?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_plan_versions")
        .select("id, version_number, saved_at, title")
        .eq("plan_id", existingTrainingPlan!.id)
        .order("version_number", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!existingTrainingPlan?.id,
  });

  // Fetch diet plan versions
  const { data: dietVersions } = useQuery({
    queryKey: ["split-diet-versions", existingDietPlan?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("diet_plan_versions")
        .select("id, version_number, saved_at, title")
        .eq("plan_id", existingDietPlan!.id)
        .order("version_number", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!existingDietPlan?.id,
  });

  const [versionTimelineOpen, setVersionTimelineOpen] = useState(false);
  const [versionTimelineType, setVersionTimelineType] = useState<"training" | "diet">("training");
  const [versionTimelinePlanId, setVersionTimelinePlanId] = useState<string | undefined>();

  const [editingPlan, setEditingPlan] = useState<any>(null);

  const openVersionTimeline = (type: "training" | "diet", planId: string) => {
    setVersionTimelineType(type);
    setVersionTimelinePlanId(planId);
    setVersionTimelineOpen(true);
  };

  const handleRestoreVersion = (version: any) => {
    if (versionTimelineType === "training" && existingTrainingPlan) {
      setEditingPlan({
        id: existingTrainingPlan.id,
        title: version.title,
        user_id: studentId,
        groups: version.groups ?? existingTrainingPlan.groups,
        total_sessions: version.total_sessions ?? existingTrainingPlan.total_sessions,
      });
    } else if (versionTimelineType === "diet" && existingDietPlan) {
      setEditingPlan({
        id: existingDietPlan.id,
        title: version.title,
        user_id: studentId,
        meals: version.meals ?? existingDietPlan.meals,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["split-training-plan"] });
    queryClient.invalidateQueries({ queryKey: ["split-diet-plan"] });
  };

  const [bodyFat, setBodyFat] = useState<string>("");
  const bodyFatInitialized = useState(false);
  const [legacyPhotosOpen, setLegacyPhotosOpen] = useState(false);

  // Sync bodyFat state when profile loads
  if (profile && !bodyFatInitialized[0]) {
    setBodyFat(profile.body_fat != null ? String(profile.body_fat) : "");
    bodyFatInitialized[1](true);
  }

  // Calculate IMC
  const calcIMC = () => {
    if (!profile?.peso || !profile?.altura) return null;
    const peso = parseFloat(profile.peso.replace(",", "."));
    const alturaRaw = profile.altura.replace(",", ".");
    let alturaM = parseFloat(alturaRaw);
    if (alturaM > 3) alturaM = alturaM / 100; // cm -> m
    if (isNaN(peso) || isNaN(alturaM) || alturaM === 0) return null;
    return (peso / (alturaM * alturaM)).toFixed(1);
  };

  const saveBodyFatMutation = useMutation({
    mutationFn: async () => {
      if (!studentId) return;
      const val = bodyFat.trim() === "" ? null : parseFloat(bodyFat.replace(",", "."));
      const { error } = await supabase
        .from("profiles")
        .update({ body_fat: val })
        .eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("BF% salvo com sucesso");
      queryClient.invalidateQueries({ queryKey: ["split-profile", studentId] });
    },
    onError: () => toast.error("Erro ao salvar BF%"),
  });

  const isLoading = profLoading || anaLoading;

  // Helper to extract dados_extras fields
  const extras = (anamnese?.dados_extras as Record<string, any>) ?? {};
  const extraVal = (key: string, fallbackField?: string): string => {
    const v = extras[key];
    if (v != null && v !== "") {
      if (Array.isArray(v)) return v.join(", ") || "—";
      return String(v);
    }
    // Fallback to direct anamnese column
    if (fallbackField && anamnese) {
      const fb = (anamnese as any)[fallbackField];
      if (fb != null && fb !== "") return String(fb);
    }
    return "—";
  };

  /** Combines a main field with its "outro/desc" counterpart */
  const extraValWithOther = (mainKey: string, otherKey: string, fallbackField?: string): string => {
    const main = extraVal(mainKey, fallbackField);
    const other = extras[otherKey];
    const otherStr = other != null && other !== "" ? String(other) : "";

    if (main !== "—" && otherStr) {
      // If the main string is literally just "Outros" or "Outras" or "Sim", 
      // replace it or format it nicely. Otherwise, append it.
      if (/^(outr[oa]s?|sim)$/i.test(main.trim())) {
        return otherStr; // Display just the specification
      }
      return `${main}: ${otherStr}`;
    }
    if (main === "—" && otherStr) return otherStr;
    return main;
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-48px)] -m-6">
      {/* LEFT: Anamnese */}
      {viewMode === "split" && (
      <div className="w-1/2 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
              <ArrowLeft size={16} />
            </Button>
            <div>
              <h2 className="font-cinzel text-lg font-bold text-foreground">{studentName}</h2>
              <p className="text-xs text-muted-foreground">Análise de Anamnese</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setViewMode("editor-only")}
          >
            <Maximize2 size={14} /> Expandir Editor
          </Button>
        </div>

        {/* Anamnese Timeline */}
        {allAnamneses && allAnamneses.length > 1 && (
          <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-3 overflow-x-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70 shrink-0 mr-1">Histórico:</span>
            {allAnamneses.map((a, idx) => {
              const d = new Date(a.created_at);
              const label = format(d, "dd MMM yyyy", { locale: ptBR });
              const isSelected = idx === selectedAnamneseIdx;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAnamneseIdx(idx)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${isSelected
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card border border-border text-foreground/80 hover:text-foreground hover:border-primary/50"
                    }`}
                >
                  {label}
                  {idx === 0 && <span className="ml-1 text-[11px] font-normal opacity-80">(atual)</span>}
                </button>
              );
            })}
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : (
              <>
                <Section icon={User} title="Dados Pessoais">
                  <Field label="Nome" value={profile?.nome ?? "—"} />
                  <Field label="Nascimento" value={profile?.nascimento ?? "—"} />
                  <Field label="Sexo" value={profile?.sexo ?? "—"} />
                  <Field label="Peso" value={profile?.peso ?? "—"} />
                  <Field label="Altura" value={profile?.altura ?? "—"} />
                  <Field label="Meta Peso" value={profile?.meta_peso ?? "—"} />
                </Section>

                {/* IMC / BF% editable section */}
                <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-3">
                  <h4 className="font-cinzel text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="text-accent">%</span> IMC / BF%
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">IMC (calculado)</p>
                      <p className="text-foreground font-bold text-lg">{calcIMC() ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">BF% (gordura corporal)</p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Ex: 18.5"
                          value={bodyFat}
                          onChange={(e) => setBodyFat(e.target.value)}
                          className="h-9 w-24 text-sm"
                        />
                        <span className="text-muted-foreground text-sm">%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-3"
                          onClick={() => saveBodyFatMutation.mutate()}
                          disabled={saveBodyFatMutation.isPending}
                        >
                          {saveBodyFatMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fotos da última reavaliação */}
                {studentId && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
                          <Camera size={14} className="text-[hsl(var(--gold))]" />
                        </div>
                        <h4 className="font-cinzel text-sm font-bold text-foreground">Fotos</h4>
                      </div>
                      {anamnese && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] gap-1 h-7"
                          onClick={() => setLegacyPhotosOpen(true)}
                        >
                          <ImagePlus size={10} /> Anexar Fotos
                        </Button>
                      )}
                    </div>
                    <StudentPhotosPanel studentId={studentId} />
                    {anamnese && (
                      <LegacyPhotosUpload
                        studentId={studentId}
                        anamneseId={anamnese.id}
                        open={legacyPhotosOpen}
                        onOpenChange={setLegacyPhotosOpen}
                      />
                    )}
                  </div>
                )}

                {anamnese ? (
                  <>
                    <div className="border-t border-border/50" />
                    <Section icon={Dumbbell} title="Objetivo & Treino">
                      <Field label="Objetivo" value={extraValWithOther("objetivo", "objetivo_outro", "objetivo")} />
                      <Field label="Fisiculturismo" value={extraVal("fisiculturismo")} />
                      <Field label="Pratica Musculação" value={extraVal("pratica_musculacao")} />
                      <Field label="Local de Treino" value={extraVal("local_treino", "local_treino")} />
                      <Field label="Frequência Semanal" value={extraVal("frequencia", "frequencia_treino")} />
                      <Field label="Dias da Semana" value={extraVal("dias_semana")} />
                      <Field label="Horário do Treino" value={extraVal("horario_treino")} />
                      <Field label="Tempo de Treino" value={extraVal("tempo_treino", "disponibilidade_treino")} />
                      <Field label="Faz Cardio" value={extraVal("faz_cardio")} />
                      <Field label="Tempo de Cardio" value={extraVal("tempo_cardio")} />
                      <Field label="Experiência" value={extraVal("experiencia_treino", "experiencia_treino")} />
                      <Field label="Motivação" value={extraVal("motivacao", "motivacao")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={Dumbbell} title="Academia">
                      <Field label="Grupos Prioritários" value={extraVal("grupos_prioritarios")} />
                      <Field label="Tem Dor/Lesão" value={extraVal("tem_dor", "lesoes")} />
                      <Field label="Exercício que Não Gosta" value={extraValWithOther("exercicio_nao_gosta", "exercicio_nao_gosta_desc")} />
                      <Field label="Máquinas Indisponíveis" value={extraValWithOther("maquinas_nao_tem", "maquina_outra", "equipamentos")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={ClipboardCheck} title="Saúde">
                      <Field label="Doenças" value={extraValWithOther("doencas", "doenca_outra", "condicoes_saude")} />
                      <Field label="Histórico Familiar" value={extraValWithOther("historico_familiar", "historico_familiar_desc")} />
                      <Field label="Medicamentos" value={extraValWithOther("medicamentos", "medicamento_outro", "medicamentos")} />
                      <Field label="Alergias" value={extraValWithOther("alergias", "alergia_outra")} />
                      <Field label="Uso de Hormônios" value={extraVal("uso_hormonios")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={Apple} title="Perfil Nutricional">
                      <Field label="Nível de Atividade" value={extraVal("nivel_atividade")} />
                      <Field label="Refeições por Dia" value={extraVal("refeicoes_dia")} />
                      <Field label="Horários das Refeições" value={extraVal("horario_refeicoes")} />
                      <Field label="Calorias Diárias" value={extraVal("calorias")} />
                      <Field label="Tempo nesse Consumo" value={extraVal("tempo_calorias")} />
                      <Field label="Passos / Calorias" value={extraVal("passos_calorias")} />
                      <Field label="Restrições" value={extraVal("restricoes", "restricoes_alimentares")} />
                      <Field label="Frutas Preferidas" value={extraValWithOther("frutas", "fruta_outra")} />
                      <Field label="Suplementos" value={extraValWithOther("suplementos", "suplemento_outro", "suplementos")} />
                      <Field label="Dieta Atual" value={extraVal("dieta_atual", "dieta_atual")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={Brain} title="Estilo de Vida">
                      <Field label="Horário do Sono" value={extraVal("horario_sono")} />
                      <Field label="Qualidade do Sono" value={extraVal("qualidade_sono")} />
                      <Field label="Horas de Sono" value={extraVal("horas_sono", "sono_horas")} />
                      <Field label="Nível de Estresse" value={extraVal("nivel_estresse", "nivel_estresse")} />
                      <Field label="Alimentos Diários" value={extraVal("alimentos_diarios")} />
                      <Field label="Alimentos que Não Come" value={extraVal("alimentos_nao_come")} />
                      <Field label="Água Diária" value={extraValWithOther("agua", "agua_outra", "agua_diaria")} />
                      <Field label="Líquido nas Refeições" value={extraVal("liquido_refeicao")} />
                      <Field label="Qual Líquido" value={extraVal("liquido_qual")} />
                      <Field label="Investimento em Dieta" value={extraVal("investimento_dieta")} />
                      <Field label="Freq. Evacuação" value={extraVal("frequencia_evacuacao")} />
                      <Field label="Sintomas Digestão" value={extraVal("sintomas_digestao")} />
                      <Field label="Escala de Bristol" value={extraVal("escala_bristol")} />
                      <Field label="Ocupação" value={extraVal("ocupacao", "ocupacao")} />
                      <Field label="Faixa Salarial" value={extraVal("faixa_salarial")} />
                      <Field label="Influenciador Favorito" value={extraVal("influenciador_favorito")} />
                    </Section>

                    <p className="text-[10px] text-muted-foreground text-right pt-2">
                      Preenchida em: {new Date(anamnese.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    Nenhuma anamnese encontrada para este aluno.
                  </div>
                )}

                {/* Monthly Assessments Section */}
                {monthlyAssessments && monthlyAssessments.length > 0 && (
                  <div className="border-t border-border/50 pt-4 space-y-3">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowMonthlySection(!showMonthlySection)}>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
                          <ClipboardCheck size={14} className="text-[hsl(var(--gold))]" />
                        </div>
                        <h4 className="font-cinzel text-sm font-bold text-foreground">Reavaliações Mensais</h4>
                        <Badge variant="secondary" className="text-[10px]">{monthlyAssessments.length}</Badge>
                      </div>
                      {showMonthlySection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>

                    {showMonthlySection && (
                      <>
                        {/* Timeline selector */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {monthlyAssessments.map((ma, idx) => {
                            const d = new Date(ma.created_at);
                            const label = format(d, "dd MMM yyyy", { locale: ptBR });
                            const isSelected = idx === selectedMonthlyIdx;
                            return (
                              <button
                                key={ma.id}
                                onClick={() => setSelectedMonthlyIdx(idx)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${isSelected
                                  ? "bg-primary text-primary-foreground shadow-md"
                                  : "bg-card border border-border text-foreground/80 hover:border-primary/50"
                                }`}
                              >
                                {label}
                                {!ma.reviewed && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-amber-400" />}
                              </button>
                            );
                          })}
                        </div>

                        {selectedMonthly && (
                          <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-4">
                            {/* Review status */}
                            <div className="flex items-center justify-between">
                              <Badge variant={selectedMonthly.reviewed ? "secondary" : "destructive"} className="text-[10px]">
                                {selectedMonthly.reviewed ? "✅ Revisada" : "⏳ Pendente de revisão"}
                              </Badge>
                              {!selectedMonthly.reviewed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs gap-1 h-7"
                                  onClick={() => markMonthlyReviewedMutation.mutate(selectedMonthly.id)}
                                  disabled={markMonthlyReviewedMutation.isPending}
                                >
                                  {markMonthlyReviewedMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                  Marcar como revisada
                                </Button>
                              )}
                            </div>

                            {/* Data fields */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                              <Field label="Peso" value={selectedMonthly.peso ?? "—"} />
                              <Field label="Altura" value={selectedMonthly.altura ?? "—"} />
                              <Field label="Modalidade" value={selectedMonthly.modalidade ?? "—"} />
                              <Field label="Nível de Fadiga" value={selectedMonthly.nivel_fadiga != null ? `${selectedMonthly.nivel_fadiga}/10` : "—"} />
                              <Field label="Objetivo Atual" value={selectedMonthly.objetivo_atual ?? "—"} />
                              <Field label="Frequência" value={selectedMonthly.frequencia_compromisso ?? "—"} />
                              <Field label="Tempo Disponível" value={selectedMonthly.tempo_disponivel ?? "—"} />
                              <Field label="Dias Disponíveis" value={selectedMonthly.dias_disponiveis?.join(", ") ?? "—"} />
                              <Field label="Adesão Treinos" value={selectedMonthly.adesao_treinos != null ? `${selectedMonthly.adesao_treinos}%` : "—"} />
                              <Field label="Motivo Adesão Treinos" value={selectedMonthly.motivo_adesao_treinos ?? "—"} />
                              <Field label="Adesão Cardio" value={selectedMonthly.adesao_cardios != null ? `${selectedMonthly.adesao_cardios}%` : "—"} />
                              <Field label="Adesão Dieta" value={selectedMonthly.adesao_dieta ?? "—"} />
                              <Field label="Horário Treino" value={selectedMonthly.horario_treino ?? "—"} />
                              <Field label="Refeições/Horários" value={selectedMonthly.refeicoes_horarios ?? "—"} />
                              <Field label="Alongamentos Corretos" value={selectedMonthly.alongamentos_corretos === true ? "Sim" : selectedMonthly.alongamentos_corretos === false ? "Não" : "—"} />
                              <Field label="Competição Fisiculturismo" value={selectedMonthly.competicao_fisiculturismo ?? "—"} />
                              <Field label="Restrição Alimentar" value={selectedMonthly.restricao_alimentar ?? "—"} />
                              <Field label="Alimentos Proibidos" value={selectedMonthly.alimentos_proibidos ?? "—"} />
                              <Field label="Prioridades Físicas" value={selectedMonthly.prioridades_fisicas ?? "—"} />
                              <Field label="Notas de Progressão" value={selectedMonthly.notas_progressao ?? "—"} />
                            </div>

                            {/* Progression booleans */}
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Progressão Muscular</p>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { key: "progresso_peitoral", label: "Peitoral" },
                                  { key: "progresso_costas", label: "Costas" },
                                  { key: "progresso_deltoide", label: "Deltóide" },
                                  { key: "progresso_triceps", label: "Tríceps" },
                                  { key: "progresso_biceps", label: "Bíceps" },
                                  { key: "progresso_quadriceps", label: "Quadríceps" },
                                  { key: "progresso_posteriores", label: "Posteriores" },
                                  { key: "progresso_gluteos", label: "Glúteos" },
                                  { key: "progresso_panturrilha", label: "Panturrilha" },
                                ].map(({ key, label }) => {
                                  const val = (selectedMonthly as any)[key];
                                  return (
                                    <Badge
                                      key={key}
                                      variant={val === true ? "default" : val === false ? "destructive" : "secondary"}
                                      className="text-[10px]"
                                    >
                                      {label}: {val === true ? "✓" : val === false ? "✗" : "—"}
                                    </Badge>
                                  );
                                })}
                              </div>
                              {selectedMonthly.progresso_abdomen && (
                                <p className="text-xs text-muted-foreground mt-1">Abdômen: {selectedMonthly.progresso_abdomen}</p>
                              )}
                              {selectedMonthly.progresso_antebraco && (
                                <p className="text-xs text-muted-foreground">Antebraço: {selectedMonthly.progresso_antebraco}</p>
                              )}
                            </div>

                            {/* Photos */}
                            {(selectedMonthly.foto_frente || selectedMonthly.foto_costas || selectedMonthly.foto_lado_direito || selectedMonthly.foto_lado_esquerdo || selectedMonthly.foto_perfil_lado) && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Fotos</p>
                                <div className="grid grid-cols-5 gap-2">
                                  {[
                                    { url: selectedMonthly.foto_frente, label: "Frente" },
                                    { url: selectedMonthly.foto_costas, label: "Costas" },
                                    { url: selectedMonthly.foto_lado_direito, label: "Lado D" },
                                    { url: selectedMonthly.foto_lado_esquerdo, label: "Lado E" },
                                    { url: selectedMonthly.foto_perfil_lado, label: "Perfil" },
                                  ].filter(p => p.url).map(({ url, label }) => (
                                    <div key={label} className="space-y-1">
                                      <div className="rounded-md w-full aspect-[3/4] border border-border overflow-hidden bg-muted">
                                        <img 
                                          src={getDisplayableImageUrl(url!)} 
                                          alt={label} 
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <p className="text-[9px] text-center text-muted-foreground">{label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Suggestions */}
                            {(selectedMonthly.sugestao_dieta || selectedMonthly.sugestao_melhoria || selectedMonthly.motivo_nao_dieta) && (
                              <div className="space-y-2">
                                {selectedMonthly.sugestao_dieta && <Field label="Sugestão Dieta" value={selectedMonthly.sugestao_dieta} />}
                                {selectedMonthly.motivo_nao_dieta && <Field label="Motivo Não Seguir Dieta" value={selectedMonthly.motivo_nao_dieta} />}
                                {selectedMonthly.sugestao_melhoria && <Field label="Sugestão de Melhoria" value={selectedMonthly.sugestao_melhoria} />}
                              </div>
                            )}

                            {selectedMonthly.maquinas_indisponiveis && selectedMonthly.maquinas_indisponiveis.length > 0 && (
                              <Field label="Máquinas Indisponíveis" value={selectedMonthly.maquinas_indisponiveis.join(", ")} />
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Plan History Section */}
                <div className="border-t border-border/50 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
                      <History size={14} className="text-[hsl(var(--gold))]" />
                    </div>
                    <h4 className="font-cinzel text-sm font-bold text-foreground">Histórico de Planos</h4>
                  </div>

                  {/* Training Plan History */}
                  {existingTrainingPlan && (
                    <div className="rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Dumbbell size={14} className="text-[hsl(var(--gold))]" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">{existingTrainingPlan.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Atualizado {new Date(existingTrainingPlan.updated_at).toLocaleDateString("pt-BR")}
                              {trainingVersions && trainingVersions.length > 0 && ` · ${trainingVersions.length} versões`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] gap-1 h-7 border-[hsl(var(--glass-border))]"
                          onClick={() => openVersionTimeline("training", existingTrainingPlan.id)}
                          disabled={!trainingVersions?.length}
                        >
                          <History size={10} /> Versões
                        </Button>
                      </div>
                      {trainingVersions && trainingVersions.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {trainingVersions.slice(0, 5).map((v) => (
                            <span
                              key={v.id}
                              className="shrink-0 px-2 py-1 rounded-full text-[10px] font-medium bg-secondary border border-border text-muted-foreground"
                            >
                              v{v.version_number} · {format(new Date(v.saved_at), "dd/MM", { locale: ptBR })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Diet Plan History */}
                  {existingDietPlan && (
                    <div className="rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Apple size={14} className="text-emerald-400" />
                          <div>
                            <p className="text-xs font-semibold text-foreground">{existingDietPlan.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Atualizado {new Date(existingDietPlan.updated_at).toLocaleDateString("pt-BR")}
                              {dietVersions && dietVersions.length > 0 && ` · ${dietVersions.length} versões`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] gap-1 h-7 border-[hsl(var(--glass-border))]"
                          onClick={() => openVersionTimeline("diet", existingDietPlan.id)}
                          disabled={!dietVersions?.length}
                        >
                          <History size={10} /> Versões
                        </Button>
                      </div>
                      {dietVersions && dietVersions.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {dietVersions.slice(0, 5).map((v) => (
                            <span
                              key={v.id}
                              className="shrink-0 px-2 py-1 rounded-full text-[10px] font-medium bg-secondary border border-border text-muted-foreground"
                            >
                              v{v.version_number} · {format(new Date(v.saved_at), "dd/MM", { locale: ptBR })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!existingTrainingPlan && !existingDietPlan && (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum plano ativo encontrado</p>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
      )}

      {/* RIGHT: Editor — auto-open */}
      <div className={`${viewMode === "editor-only" ? "w-full" : "w-1/2"} flex flex-col overflow-hidden`}>
        {viewMode === "editor-only" && (
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
              <ArrowLeft size={16} />
            </Button>
            <h2 className="font-cinzel text-sm font-bold text-foreground flex-1">{studentName}</h2>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setViewMode("split")}
            >
              <Minimize2 size={14} /> Mostrar Anamnese
            </Button>
          </div>
        )}
        {isNutri ? (
          <DietPlanEditor
            open={true}
            onClose={handlePlanCreated}
            students={studentOptions}
            editingPlan={editingPlan || (existingDietPlan ? {
              id: existingDietPlan.id,
              title: existingDietPlan.title,
              user_id: studentId!,
              meals: Array.isArray(existingDietPlan.meals) ? existingDietPlan.meals : [],
            } : null)}
            embedded
            preSelectedStudent={studentId}
          />
        ) : (
          <TrainingPlanEditor
            open={true}
            onClose={handlePlanCreated}
            students={studentOptions}
            editingPlan={editingPlan || (existingTrainingPlan ? {
              id: existingTrainingPlan.id,
              title: existingTrainingPlan.title,
              user_id: studentId!,
              groups: Array.isArray(existingTrainingPlan.groups) ? existingTrainingPlan.groups : [],
              total_sessions: existingTrainingPlan.total_sessions,
              avaliacao_postural: existingTrainingPlan.avaliacao_postural,
              pontos_melhoria: existingTrainingPlan.pontos_melhoria,
              objetivo_mesociclo: existingTrainingPlan.objetivo_mesociclo,
            } : null)}
            embedded
            preSelectedStudent={studentId}
          />
        )}
      </div>

      <PlanVersionTimeline
        planId={versionTimelinePlanId}
        type={versionTimelineType}
        open={versionTimelineOpen}
        onClose={() => setVersionTimelineOpen(false)}
        onRestore={handleRestoreVersion}
      />
    </div>
  );
};

export default EspecialistaAnamneseSplit;
