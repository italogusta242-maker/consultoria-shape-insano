/**
 * @purpose Split-view page: anamnese left + diet/training editor right (desktop only).
 * @dependencies useStudentAnamnese, DietPlanEditor, TrainingPlanEditor, supabase.
 */
import { useState, useMemo } from "react";
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
import { ArrowLeft, CheckCircle, Loader2, User, Dumbbell, Apple, Brain, ClipboardCheck, Camera, Save, ChevronLeft, ChevronRight, History, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import DietPlanEditor from "@/components/especialista/DietPlanEditor";
import TrainingPlanEditor from "@/components/especialista/TrainingPlanEditor";
import StudentPhotosPanel from "@/components/especialista/StudentPhotosPanel";
import PlanVersionTimeline from "@/components/especialista/PlanVersionTimeline";

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
  const extraVal = (key: string): string => {
    const v = extras[key];
    if (v == null || v === "") return "—";
    if (Array.isArray(v)) return v.join(", ") || "—";
    return String(v);
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-48px)] -m-6">
      {/* LEFT: Anamnese */}
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
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    isSelected
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
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-[hsl(var(--gold)/0.15)]">
                        <Camera size={14} className="text-[hsl(var(--gold))]" />
                      </div>
                      <h4 className="font-cinzel text-sm font-bold text-foreground">Fotos</h4>
                    </div>
                    <StudentPhotosPanel studentId={studentId} />
                  </div>
                )}

                {anamnese ? (
                  <>
                    <div className="border-t border-border/50" />
                    <Section icon={Dumbbell} title="Objetivo & Treino">
                      <Field label="Objetivo" value={extraVal("objetivo")} />
                      <Field label="Fisiculturismo" value={extraVal("fisiculturismo")} />
                      <Field label="Pratica Musculação" value={extraVal("pratica_musculacao")} />
                      <Field label="Local de Treino" value={extraVal("local_treino")} />
                      <Field label="Frequência Semanal" value={extraVal("frequencia")} />
                      <Field label="Dias da Semana" value={extraVal("dias_semana")} />
                      <Field label="Horário do Treino" value={extraVal("horario_treino")} />
                      <Field label="Tempo de Treino" value={extraVal("tempo_treino")} />
                      <Field label="Faz Cardio" value={extraVal("faz_cardio")} />
                      <Field label="Tempo de Cardio" value={extraVal("tempo_cardio")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={Dumbbell} title="Academia">
                      <Field label="Grupos Prioritários" value={extraVal("grupos_prioritarios")} />
                      <Field label="Tem Dor/Lesão" value={extraVal("tem_dor")} />
                      <Field label="Exercício que Não Gosta" value={extraVal("exercicio_nao_gosta")} />
                      <Field label="Máquinas Indisponíveis" value={extraVal("maquinas_nao_tem")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={ClipboardCheck} title="Saúde">
                      <Field label="Doenças" value={extraVal("doencas")} />
                      <Field label="Histórico Familiar" value={extraVal("historico_familiar")} />
                      <Field label="Medicamentos" value={extraVal("medicamentos")} />
                      <Field label="Alergias" value={extraVal("alergias")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={Apple} title="Perfil Nutricional">
                      <Field label="Nível de Atividade" value={extraVal("nivel_atividade")} />
                      <Field label="Refeições por Dia" value={extraVal("refeicoes_dia")} />
                      <Field label="Horários das Refeições" value={extraVal("horario_refeicoes")} />
                      <Field label="Calorias Diárias" value={extraVal("calorias")} />
                      <Field label="Tempo nesse Consumo" value={extraVal("tempo_calorias")} />
                      <Field label="Restrições" value={extraVal("restricoes")} />
                      <Field label="Frutas Preferidas" value={extraVal("frutas")} />
                      <Field label="Suplementos" value={extraVal("suplementos")} />
                    </Section>

                    <div className="border-t border-border/50" />
                    <Section icon={Brain} title="Estilo de Vida">
                      <Field label="Horário do Sono" value={extraVal("horario_sono")} />
                      <Field label="Qualidade do Sono" value={extraVal("qualidade_sono")} />
                      <Field label="Alimentos Diários" value={extraVal("alimentos_diarios")} />
                      <Field label="Alimentos que Não Come" value={extraVal("alimentos_nao_come")} />
                      <Field label="Água Diária" value={extraVal("agua")} />
                      <Field label="Líquido nas Refeições" value={extraVal("liquido_refeicao")} />
                      <Field label="Qual Líquido" value={extraVal("liquido_qual")} />
                      <Field label="Investimento em Dieta" value={extraVal("investimento_dieta")} />
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

      {/* RIGHT: Editor — auto-open */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        {isNutri ? (
          <DietPlanEditor
            open={true}
            onClose={handlePlanCreated}
            students={studentOptions}
            editingPlan={editingPlan ?? (existingDietPlan ? {
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
            editingPlan={editingPlan ?? (existingTrainingPlan ? {
              id: existingTrainingPlan.id,
              title: existingTrainingPlan.title,
              user_id: studentId!,
              groups: Array.isArray(existingTrainingPlan.groups) ? existingTrainingPlan.groups : [],
              total_sessions: existingTrainingPlan.total_sessions,
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
