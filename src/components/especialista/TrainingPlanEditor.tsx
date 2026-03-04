import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Save,
  GripVertical, FolderOpen, Dumbbell, Eye, FileText, History, Sparkles, Loader2,
} from "lucide-react";
import RestTimePicker from "./RestTimePicker";
import TrainingPreviewModal from "./TrainingPreviewModal";
import PlanVersionTimeline from "./PlanVersionTimeline";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ExerciseSelector, { type ExerciseItem } from "./ExerciseSelector";
import TemplateManager from "./TemplateManager";
import { useWorkoutDraftStore, type WorkoutDraft } from "@/stores/useWorkoutDraftStore";

interface Group {
  name: string;
  exercises: ExerciseItem[];
}

interface StudentOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  students: StudentOption[];
  editingPlan?: {
    id: string;
    title: string;
    user_id: string;
    groups: Group[];
    total_sessions: number;
    avaliacao_postural?: string | null;
    pontos_melhoria?: string | null;
    objetivo_mesociclo?: string | null;
  } | null;
  embedded?: boolean;
  preSelectedStudent?: string;
}

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function TrainingPlanEditor({ open, onClose, students, editingPlan, embedded, preSelectedStudent }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!editingPlan;

  // ===== ZUSTAND: Global state keyed by student_id =====
  const { getDraft, setDraft, patchDraft, clearDraft } = useWorkoutDraftStore();

  // Local state for selected student (not part of per-student draft)
  const [selectedStudent, setSelectedStudent] = useState(
    editingPlan?.user_id ?? preSelectedStudent ?? ""
  );

  // Derive values from per-student draft (single source of truth)
  const draft = selectedStudent ? getDraft(selectedStudent) : null;
  const title = draft?.title ?? "Plano Personalizado";
  const totalSessions = draft?.totalSessions ?? 50;
  const groups = draft?.groups ?? [];
  const avaliacaoPostural = draft?.avaliacaoPostural ?? "";
  const pontosMelhoria = draft?.pontosMelhoria ?? "";
  const objetivoMesociclo = draft?.objetivoMesociclo ?? "";

  // Helper setters that patch the store for the CURRENT student
  const setTitle = (v: string) => { if (selectedStudent) patchDraft(selectedStudent, { title: v }); };
  const setTotalSessions = (v: number) => { if (selectedStudent) patchDraft(selectedStudent, { totalSessions: v }); };
  const setGroups = (v: Group[]) => { if (selectedStudent) patchDraft(selectedStudent, { groups: v }); };
  const setAvaliacaoPostural = (v: string) => { if (selectedStudent) patchDraft(selectedStudent, { avaliacaoPostural: v }); };
  const setPontosMelhoria = (v: string) => { if (selectedStudent) patchDraft(selectedStudent, { pontosMelhoria: v }); };
  const setObjetivoMesociclo = (v: string) => { if (selectedStudent) patchDraft(selectedStudent, { objetivoMesociclo: v }); };

  // UI-only local state (doesn't need to survive unmount)
  const [exerciseSelectorOpen, setExerciseSelectorOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [previewGif, setPreviewGif] = useState<{ name: string; url: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiLogId, setAiLogId] = useState<string | null>(null);
  const [aiFeedbackGiven, setAiFeedbackGiven] = useState<string | null>(null);

  // Initialize store when opening (only if store is empty for this student)
  useEffect(() => {
    if (!open || !selectedStudent) return;

    // If store already has data for this student, it's a remount — keep the data intact
    const existing = getDraft(selectedStudent);
    if (existing && existing.groups.length > 0) return;

    if (editingPlan) {
      setDraft(selectedStudent, {
        title: editingPlan.title,
        totalSessions: editingPlan.total_sessions,
        groups: editingPlan.groups,
        avaliacaoPostural: editingPlan.avaliacao_postural || "",
        pontosMelhoria: editingPlan.pontos_melhoria || "",
        objetivoMesociclo: editingPlan.objetivo_mesociclo || "",
      });
    } else {
      setDraft(selectedStudent, {
        title: "Plano Personalizado",
        totalSessions: 50,
        groups: [{ name: "A - Treino A", exercises: [] }],
        avaliacaoPostural: "",
        pontosMelhoria: "",
        objetivoMesociclo: "",
      });
    }
  }, [open, selectedStudent, editingPlan]);

  const generateWithAI = async () => {
    if (!selectedStudent) {
      toast.error("Selecione um aluno primeiro");
      return;
    }
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-training-plan", {
        body: {
          student_id: selectedStudent,
          objective_hint: objetivoMesociclo || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const plan = data.plan;
      // Write directly to Zustand store keyed by student — survives unmount
      setDraft(selectedStudent, {
        title: plan.title || title,
        totalSessions: plan.total_sessions || totalSessions,
        groups: plan.groups?.length ? plan.groups : groups,
        avaliacaoPostural: plan.avaliacao_postural || avaliacaoPostural,
        pontosMelhoria: plan.pontos_melhoria || pontosMelhoria,
        objetivoMesociclo: plan.objetivo_mesociclo || objetivoMesociclo,
      });

      // Store log_id for feedback
      if (data.log_id) {
        setAiLogId(data.log_id);
        setAiFeedbackGiven(null);
      }

      toast.success("Plano gerado pela IA! Revise e ajuste antes de salvar.");
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast.error(err.message || "Erro ao gerar plano com IA");
    } finally {
      setAiGenerating(false);
    }
  };

  const sendAiFeedback = async (feedback: "like" | "dislike") => {
    if (!aiLogId) return;
    setAiFeedbackGiven(feedback);
    try {
      await supabase.from("ai_generation_logs").update({ feedback }).eq("id", aiLogId);
      toast.success(feedback === "like" ? "👍 Feedback salvo! Este treino será usado como referência." : "👎 Feedback registrado.");
    } catch (err) {
      console.error("Feedback error:", err);
    }
  };

  // Fetch exercise library for GIF previews
  const { data: exerciseLib } = useQuery({
    queryKey: ["exercise-library"],
    queryFn: async () => {
      const { data } = await supabase
        .from("exercise_library")
        .select("name, gif_url");
      return data ?? [];
    },
  });

  const gifMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ex of exerciseLib ?? []) {
      if (ex.gif_url) map.set(ex.name.toLowerCase(), ex.gif_url);
    }
    return map;
  }, [exerciseLib]);

  // Drag-and-drop state
  const [dragGroupIdx, setDragGroupIdx] = useState<number | null>(null);
  const [dragExIdx, setDragExIdx] = useState<number | null>(null);
  const [dragOverExIdx, setDragOverExIdx] = useState<number | null>(null);

  const handleDragStart = (gi: number, ei: number) => {
    setDragGroupIdx(gi);
    setDragExIdx(ei);
  };

  const handleDragOver = (e: React.DragEvent, ei: number) => {
    e.preventDefault();
    setDragOverExIdx(ei);
  };

  const handleDrop = (gi: number, ei: number) => {
    if (dragGroupIdx === gi && dragExIdx !== null && dragExIdx !== ei) {
      const next = [...groups];
      const exercises = [...next[gi].exercises];
      const [moved] = exercises.splice(dragExIdx, 1);
      exercises.splice(ei, 0, moved);
      next[gi] = { ...next[gi], exercises };
      setGroups(next);
    }
    setDragGroupIdx(null);
    setDragExIdx(null);
    setDragOverExIdx(null);
  };

  const handleDragEnd = () => {
    setDragGroupIdx(null);
    setDragExIdx(null);
    setDragOverExIdx(null);
  };

  const addGroup = () => {
    const idx = groups.length;
    const letter = GROUP_LETTERS[idx] || `G${idx + 1}`;
    setGroups([...groups, { name: `${letter} - Treino ${letter}`, exercises: [] }]);
  };

  const removeGroup = (idx: number) => {
    setGroups(groups.filter((_, i) => i !== idx));
  };

  const updateGroupName = (idx: number, name: string) => {
    const next = [...groups];
    next[idx] = { ...next[idx], name };
    setGroups(next);
  };

  const addExercisesToGroup = (exercises: ExerciseItem[]) => {
    const next = [...groups];
    next[activeGroupIndex] = {
      ...next[activeGroupIndex],
      exercises: [...next[activeGroupIndex].exercises, ...exercises],
    };
    setGroups(next);
  };

  const addFreeTextToGroup = (groupIdx: number) => {
    const next = [...groups];
    next[groupIdx] = {
      ...next[groupIdx],
      exercises: [...next[groupIdx].exercises, {
        name: "📝 Texto Livre",
        sets: 0,
        reps: "0",
        weight: null,
        rest: "",
        videoId: null,
        setsData: [],
        freeText: true,
        description: "",
      }],
    };
    setGroups(next);
  };

  const removeExercise = (groupIdx: number, exIdx: number) => {
    const next = [...groups];
    next[groupIdx] = {
      ...next[groupIdx],
      exercises: next[groupIdx].exercises.filter((_, i) => i !== exIdx),
    };
    setGroups(next);
  };

  const updateExercise = (groupIdx: number, exIdx: number, field: string, value: any) => {
    const next = [...groups];
    const exercises = [...next[groupIdx].exercises];
    exercises[exIdx] = { ...exercises[exIdx], [field]: value };
    next[groupIdx] = { ...next[groupIdx], exercises };
    setGroups(next);
  };

  const moveExercise = (groupIdx: number, exIdx: number, dir: -1 | 1) => {
    const target = exIdx + dir;
    const next = [...groups];
    const exercises = [...next[groupIdx].exercises];
    if (target < 0 || target >= exercises.length) return;
    [exercises[exIdx], exercises[target]] = [exercises[target], exercises[exIdx]];
    next[groupIdx] = { ...next[groupIdx], exercises };
    setGroups(next);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const studentId = selectedStudent;
      if (!studentId) throw new Error("Selecione um aluno");
      if (!objetivoMesociclo.trim()) throw new Error("Preencha o objetivo do mesociclo");

      // Inject order_index to preserve exercise order
      const groupsWithOrder = groups.map(g => ({
        ...g,
        exercises: g.exercises.map((ex, idx) => ({ ...ex, order_index: idx })),
      }));

      if (isEditing && editingPlan) {
        const { error } = await supabase
          .from("training_plans")
          .update({
            title,
            groups: groupsWithOrder as any,
            total_sessions: totalSessions,
            specialist_id: user.id,
            avaliacao_postural: avaliacaoPostural || null,
            pontos_melhoria: pontosMelhoria || null,
            objetivo_mesociclo: objetivoMesociclo || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        // Deactivate existing plans
        await supabase
          .from("training_plans")
          .update({ active: false })
          .eq("user_id", studentId)
          .eq("active", true);

        const { error } = await supabase.from("training_plans").insert({
          user_id: studentId,
          specialist_id: user.id,
          title,
          groups: groupsWithOrder as any,
          total_sessions: totalSessions,
          avaliacao_postural: avaliacaoPostural || null,
          pontos_melhoria: pontosMelhoria || null,
          objetivo_mesociclo: objetivoMesociclo || null,
          active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      clearDraft(selectedStudent);
      toast.success(isEditing ? "Plano atualizado!" : "Plano criado!");
      queryClient.invalidateQueries({ queryKey: ["specialist-training-plans"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const editorContent = (
    <>
      <div className={embedded ? "p-4 border-b border-border" : "p-6 pb-0"}>
        {!embedded && (
          <DialogHeader>
            <DialogTitle className="gold-text-gradient font-cinzel text-xl">
              {isEditing ? "Editar Plano de Treino" : "Novo Plano de Treino"}
            </DialogTitle>
          </DialogHeader>
        )}
        {embedded && (
          <h2 className="gold-text-gradient font-cinzel text-lg font-bold">
            {isEditing ? "Editar Plano de Treino" : "Novo Plano de Treino"}
          </h2>
        )}
      </div>

      <ScrollArea className={embedded ? "flex-1" : "h-[calc(90vh-140px)]"}>
        <div className={cn("space-y-5 pb-6", embedded ? "p-4" : "px-6")}>
              {/* Student + Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Aluno</label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={isEditing}>
                    <SelectTrigger className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]">
                      <SelectValue placeholder="Selecione o aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Título do Plano</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                  />
                </div>
              </div>

              {/* Total sessions */}
              <div className="max-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Total de Sessões</label>
                <Input
                  type="number"
                  value={totalSessions}
                  onChange={(e) => setTotalSessions(Number(e.target.value))}
                  className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                />
              </div>

              {/* Análise do Especialista */}
              <div className="space-y-3 rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-4">
                <p className="text-xs font-semibold text-foreground font-cinzel">📋 Análise do Especialista</p>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Avaliação Postural</label>
                  <Textarea
                    value={avaliacaoPostural}
                    onChange={(e) => setAvaliacaoPostural(e.target.value)}
                    placeholder="Ex: Leve depressão de ombros, encurtamento de isquiotibiais..."
                    className="min-h-[60px] text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Pontos de Melhoria</label>
                  <Textarea
                    value={pontosMelhoria}
                    onChange={(e) => setPontosMelhoria(e.target.value)}
                    placeholder="Ex: Ênfase em abdômen, dorsais, peitorais..."
                    className="min-h-[60px] text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Objetivo do Mesociclo <span className="text-primary">*</span></label>
                  <Textarea
                    value={objetivoMesociclo}
                    onChange={(e) => setObjetivoMesociclo(e.target.value)}
                    placeholder="Ex: Desenvolvimento dos peitorais, fortalecimento do CORE..."
                    className="min-h-[80px] text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] resize-none"
                  />
                </div>
              </div>

              {/* RLHF Feedback Banner */}
              {aiLogId && !aiFeedbackGiven && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-400" />
                    <span className="text-xs text-purple-300 font-medium">O treino gerado pela IA ficou bom?</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendAiFeedback("like")}
                      className="gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10 h-8"
                    >
                      👍 Bom
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendAiFeedback("dislike")}
                      className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10 h-8"
                    >
                      👎 Ajustar
                    </Button>
                  </div>
                </div>
              )}
              {aiFeedbackGiven && (
                <div className="rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-2.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {aiFeedbackGiven === "like" ? "👍 Feedback salvo! Este treino será usado como referência." : "👎 Feedback registrado. Vamos melhorar!"}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={generateWithAI}
                  disabled={aiGenerating || !selectedStudent}
                  className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0"
                >
                  {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {aiGenerating ? "Gerando..." : "Gerar com IA"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTemplateManagerOpen(true)}
                  className="gap-1.5 border-[hsl(var(--glass-border))]"
                >
                  <FolderOpen size={14} /> Templates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  disabled={groups.every(g => g.exercises.length === 0)}
                  className="gap-1.5 border-[hsl(var(--glass-border))]"
                >
                  <Eye size={14} /> Preview do Aluno
                </Button>
                {isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryOpen(true)}
                    className="gap-1.5 border-[hsl(var(--glass-border))]"
                  >
                    <History size={14} /> Histórico
                  </Button>
                )}
              </div>

              {/* Groups */}
              {groups.map((group, gi) => (
                <div
                  key={gi}
                  className="rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] overflow-hidden"
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between p-3 border-b border-[hsl(var(--glass-border))]">
                    <Input
                      value={group.name}
                      onChange={(e) => updateGroupName(gi, e.target.value)}
                      className="bg-transparent border-none h-8 text-sm font-medium text-foreground p-0 focus-visible:ring-0"
                    />
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => addFreeTextToGroup(gi)}
                        title="Adicionar texto livre"
                      >
                        <FileText size={14} className="text-[hsl(var(--gold))]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setActiveGroupIndex(gi);
                          setExerciseSelectorOpen(true);
                        }}
                        title="Adicionar exercício"
                      >
                        <Plus size={14} className="text-[hsl(var(--forja-teal))]" />
                      </Button>
                      <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeGroup(gi)}
                          title="Remover grupo"
                        >
                          <Trash2 size={14} className="text-destructive" />
                        </Button>
                    </div>
                  </div>

                  {/* Exercises */}
                  <div className="divide-y divide-[hsl(var(--glass-border))]">
                    {group.exercises.length === 0 && (
                      <p className="text-center text-muted-foreground text-xs py-6">
                        Clique em + para adicionar exercícios
                      </p>
                    )}
                    {group.exercises.map((ex, ei) => (
                      <div
                        key={ei}
                        draggable
                        onDragStart={() => handleDragStart(gi, ei)}
                        onDragOver={(e) => handleDragOver(e, ei)}
                        onDrop={() => handleDrop(gi, ei)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex items-start gap-2 p-3 cursor-grab active:cursor-grabbing transition-all relative",
                          dragGroupIdx === gi && dragExIdx === ei && "opacity-40",
                          dragGroupIdx === gi && dragOverExIdx === ei && dragExIdx !== null && dragExIdx !== ei &&
                            (ei < dragExIdx
                              ? "before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-[hsl(var(--forja-teal))] before:rounded-full"
                              : "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-[hsl(var(--forja-teal))] after:rounded-full")
                        )}
                      >
                        <div className="pt-2">
                          <GripVertical size={14} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          {ex.freeText ? (
                            <>
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-[hsl(var(--gold))] shrink-0" />
                                <span className="text-sm font-medium text-foreground">Texto Livre</span>
                              </div>
                              <Textarea
                                value={ex.description || ""}
                                onChange={(e) => updateExercise(gi, ei, "description", e.target.value)}
                                placeholder="Escreva aqui as instruções para o aluno... Ex: Faça uma corrida sprint de 20 min, depois abdominais e repita o ciclo 3 vezes."
                                className="min-h-[80px] text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] resize-y"
                              />
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const gifUrl = gifMap.get(ex.name.toLowerCase());
                                  return gifUrl ? (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setPreviewGif({ name: ex.name, url: gifUrl }); }}
                                      className="shrink-0 w-10 h-10 rounded-md overflow-hidden border border-[hsl(var(--glass-border))] hover:border-[hsl(var(--forja-teal))] transition-colors"
                                    >
                                      <img src={gifUrl} alt={ex.name} className="w-full h-full object-cover" loading="lazy" />
                                    </button>
                                  ) : (
                                    <Dumbbell size={12} className="text-[hsl(var(--forja-teal))] shrink-0" />
                                  );
                                })()}
                                <span className="text-sm font-medium text-foreground">{ex.name}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Séries</label>
                                  <Input
                                    type="number"
                                    value={ex.sets}
                                    onChange={(e) => updateExercise(gi, ei, "sets", Number(e.target.value))}
                                    className="h-7 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Reps</label>
                                  <Input
                                    value={ex.reps}
                                    onChange={(e) => updateExercise(gi, ei, "reps", e.target.value)}
                                    className="h-7 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Carga (kg)</label>
                                  <Input
                                    type="number"
                                    value={ex.weight ?? ""}
                                    onChange={(e) => updateExercise(gi, ei, "weight", e.target.value ? Number(e.target.value) : null)}
                                    placeholder="-"
                                    className="h-7 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Descanso</label>
                                  <RestTimePicker
                                    value={ex.rest}
                                    onChange={(val) => updateExercise(gi, ei, "rest", val)}
                                  />
                                </div>
                              </div>
                              {/* Descrição / Instruções */}
                              <div className="mt-1.5">
                                <label className="text-[10px] text-muted-foreground">Instruções da série</label>
                                <Textarea
                                  value={(ex as any).description || ""}
                                  onChange={(e) => updateExercise(gi, ei, "description", e.target.value)}
                                  placeholder="Ex: Manter cotovelos colados, subida explosiva..."
                                  className="min-h-[40px] h-10 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] resize-none"
                                />
                              </div>
                            </>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 mt-1"
                          onClick={() => removeExercise(gi, ei)}
                        >
                          <Trash2 size={12} className="text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add group */}
              {groups.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addGroup}
                  className="w-full gap-1.5 border-dashed border-[hsl(var(--glass-border))]"
                >
                  <Plus size={14} /> Adicionar Grupo ({GROUP_LETTERS[groups.length] || "+"})
                </Button>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className={cn("p-4 border-t border-[hsl(var(--glass-border))] flex justify-end gap-2", embedded && "border-border")}>
            <Button variant="outline" onClick={onClose} className="border-[hsl(var(--glass-border))]">
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!selectedStudent || groups.length === 0 || !objetivoMesociclo.trim() || saveMutation.isPending}
              className="gold-gradient text-[hsl(var(--obsidian))] font-medium gap-1.5"
            >
              <Save size={14} /> {isEditing ? "Salvar Alterações" : "Criar Plano"}
            </Button>
          </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full bg-card">
        {editorContent}
        <ExerciseSelector
          open={exerciseSelectorOpen}
          onClose={() => setExerciseSelectorOpen(false)}
          onAdd={addExercisesToGroup}
        />
        <TemplateManager
          open={templateManagerOpen}
          onClose={() => setTemplateManagerOpen(false)}
          currentGroups={groups}
          onLoadTemplate={setGroups}
        />
        {previewGif && (
          <Dialog open={!!previewGif} onOpenChange={() => setPreviewGif(null)}>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-cinzel text-sm">{previewGif.name}</DialogTitle>
              </DialogHeader>
              <img src={previewGif.url} alt={previewGif.name} className="rounded-lg max-h-[300px] w-auto mx-auto" />
            </DialogContent>
          </Dialog>
        )}
        <TrainingPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          groups={groups}
          studentName={students.find(s => s.id === selectedStudent)?.name ?? ""}
          title={title}
          gifMap={gifMap}
        />
        <PlanVersionTimeline
          planId={editingPlan?.id}
          type="training"
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={(v) => {
            if (v.groups) setGroups(v.groups as Group[]);
            if (v.total_sessions) setTotalSessions(v.total_sessions);
            if (v.title) setTitle(v.title);
            setAvaliacaoPostural(v.avaliacao_postural || "");
            setPontosMelhoria(v.pontos_melhoria || "");
            setObjetivoMesociclo(v.objetivo_mesociclo || "");
          }}
        />
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 bg-[hsl(var(--card))] border-[hsl(var(--glass-border))] overflow-hidden">
          {editorContent}
        </DialogContent>
      </Dialog>

      <ExerciseSelector
        open={exerciseSelectorOpen}
        onClose={() => setExerciseSelectorOpen(false)}
        onAdd={addExercisesToGroup}
      />

      <TemplateManager
        open={templateManagerOpen}
        onClose={() => setTemplateManagerOpen(false)}
        currentGroups={groups}
        onLoadTemplate={setGroups}
      />

      {previewGif && (
        <Dialog open={!!previewGif} onOpenChange={() => setPreviewGif(null)}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-cinzel text-sm">{previewGif.name}</DialogTitle>
            </DialogHeader>
            <img src={previewGif.url} alt={previewGif.name} className="rounded-lg max-h-[300px] w-auto mx-auto" />
          </DialogContent>
        </Dialog>
      )}

      <TrainingPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        groups={groups}
        studentName={students.find(s => s.id === selectedStudent)?.name ?? ""}
        title={title}
        gifMap={gifMap}
      />

      <PlanVersionTimeline
        planId={editingPlan?.id}
        type="training"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={(v) => {
          if (v.groups) setGroups(v.groups as Group[]);
          if (v.total_sessions) setTotalSessions(v.total_sessions);
          if (v.title) setTitle(v.title);
          setAvaliacaoPostural(v.avaliacao_postural || "");
          setPontosMelhoria(v.pontos_melhoria || "");
          setObjetivoMesociclo(v.objetivo_mesociclo || "");
        }}
      />
    </>
  );
}
