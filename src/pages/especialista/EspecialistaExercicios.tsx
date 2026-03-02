/**
 * @purpose Exercise library + Training templates management for preparador físico.
 * @dependencies exercise_library table, training_templates table, supabase.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Loader2, Trash2, Dumbbell, BookOpen, Video, Edit, X, Check, Image, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import TrainingTemplatesList from "@/components/especialista/TrainingTemplatesList";

const MUSCLE_GROUPS = [
  "peito", "costas", "ombros", "bíceps", "tríceps",
  "quadríceps", "posteriores", "glúteos", "panturrilhas", "abdominais",
  "trapezio", "antebraços", "inferior-das-costas", "abdutores", "adutores", "pescoço",
];

const capitalizeGroup = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match?.[1] ?? null;
}

interface ExerciseForm {
  name: string;
  muscle_group: string;
  default_sets: string;
  default_reps: string;
  video_url: string;
  gif_url: string;
  instructions: string;
  equipment: string;
  level: string;
}

const emptyForm: ExerciseForm = {
  name: "", muscle_group: "Peito", default_sets: "3", default_reps: "10", video_url: "", gif_url: "", instructions: "", equipment: "", level: "",
};

const EspecialistaExercicios = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ExerciseForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ExerciseForm>(emptyForm);
  const [previewGif, setPreviewGif] = useState<{ name: string; url: string } | null>(null);

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercise-library", search, filterGroup, filterLevel],
    queryFn: async () => {
      let query = supabase.from("exercise_library").select("*").order("muscle_group").order("name");
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      if (filterGroup) query = query.eq("muscle_group", filterGroup);
      if (filterLevel) query = query.eq("level", filterLevel);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: ExerciseForm) => {
      const videoId = input.video_url ? extractYouTubeId(input.video_url) : null;
      const { error } = await supabase.from("exercise_library").insert({
        name: input.name,
        muscle_group: input.muscle_group,
        default_sets: parseInt(input.default_sets) || 3,
        default_reps: input.default_reps || "10",
        video_id: videoId,
        gif_url: input.gif_url || null,
        instructions: input.instructions || null,
        equipment: input.equipment || null,
        level: input.level || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício adicionado!");
      queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ExerciseForm }) => {
      const videoId = input.video_url ? extractYouTubeId(input.video_url) : null;
      const { error } = await supabase.from("exercise_library").update({
        name: input.name,
        muscle_group: input.muscle_group,
        default_sets: parseInt(input.default_sets) || 3,
        default_reps: input.default_reps || "10",
        video_id: videoId,
        gif_url: input.gif_url || null,
        instructions: input.instructions || null,
        equipment: input.equipment || null,
        level: input.level || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício atualizado!");
      queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercise_library").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício removido");
      queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    createMutation.mutate(form);
  };

  const startEdit = (ex: any) => {
    setEditingId(ex.id);
    setEditForm({
      name: ex.name,
      muscle_group: ex.muscle_group,
      default_sets: String(ex.default_sets),
      default_reps: ex.default_reps,
      video_url: ex.video_id ? `https://youtube.com/watch?v=${ex.video_id}` : "",
      gif_url: ex.gif_url || "",
      instructions: ex.instructions || "",
      equipment: ex.equipment || "",
      level: ex.level || "",
    });
  };

  const ExerciseFormFields = ({ formState, setFormState }: { formState: ExerciseForm; setFormState: (f: ExerciseForm) => void }) => (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Nome *</Label>
        <Input value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} className="bg-background border-border" placeholder="Ex: Supino Inclinado" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Grupo Muscular</Label>
          <select
            value={formState.muscle_group}
            onChange={(e) => setFormState({ ...formState, muscle_group: e.target.value })}
            className="w-full h-9 text-sm rounded-md border border-border bg-background px-2 text-foreground"
          >
            {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{capitalizeGroup(g)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Séries</Label>
            <Input type="number" value={formState.default_sets} onChange={(e) => setFormState({ ...formState, default_sets: e.target.value })} className="bg-background border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reps</Label>
            <Input value={formState.default_reps} onChange={(e) => setFormState({ ...formState, default_reps: e.target.value })} className="bg-background border-border" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Equipamento</Label>
          <Input value={formState.equipment} onChange={(e) => setFormState({ ...formState, equipment: e.target.value })} className="bg-background border-border" placeholder="Ex: Barra, Halter" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nível</Label>
          <select
            value={formState.level}
            onChange={(e) => setFormState({ ...formState, level: e.target.value })}
            className="w-full h-9 text-sm rounded-md border border-border bg-background px-2 text-foreground"
          >
            <option value="">—</option>
            <option value="Iniciante">Iniciante</option>
            <option value="Intermediário">Intermediário</option>
            <option value="Avançado">Avançado</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1"><Image size={12} /> URL do GIF (opcional)</Label>
        <Input value={formState.gif_url} onChange={(e) => setFormState({ ...formState, gif_url: e.target.value })} className="bg-background border-border" placeholder="https://..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1"><Video size={12} /> Link do YouTube (opcional)</Label>
        <Input value={formState.video_url} onChange={(e) => setFormState({ ...formState, video_url: e.target.value })} className="bg-background border-border" placeholder="https://youtube.com/watch?v=..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Instruções (opcional)</Label>
        <Textarea value={formState.instructions} onChange={(e) => setFormState({ ...formState, instructions: e.target.value })} className="bg-background border-border min-h-[60px]" placeholder="Passo a passo da execução..." />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold gold-text-gradient">Base de Treinos</h1>
        <p className="text-sm text-muted-foreground">Gerencie exercícios e templates de treino</p>
      </div>

      <Tabs defaultValue="exercicios" className="space-y-4">
        <TabsList className="bg-secondary/30 border border-border/50">
          <TabsTrigger value="exercicios" className="gap-1.5 data-[state=active]:bg-accent/20 data-[state=active]:text-accent">
            <Dumbbell size={14} />
            Exercícios
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 data-[state=active]:bg-accent/20 data-[state=active]:text-accent">
            <BookOpen size={14} />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* ─── EXERCÍCIOS TAB ─── */}
        <TabsContent value="exercicios" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar exercício..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background border-border" />
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" size="sm"><Plus size={16} /> Novo Exercício</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-cinzel">Adicionar Exercício</DialogTitle>
                </DialogHeader>
                <ExerciseFormFields formState={form} setFormState={setForm} />
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          {/* Muscle group filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "cursor-pointer transition-all text-xs px-2.5 py-1",
                filterGroup === null
                  ? "bg-[hsl(var(--gold))] text-[hsl(var(--obsidian))] border-[hsl(var(--gold))]"
                  : "border-[hsl(var(--glass-border))] text-muted-foreground hover:border-[hsl(var(--glass-highlight))]"
              )}
              onClick={() => setFilterGroup(null)}
            >
              Todos
            </Badge>
            {MUSCLE_GROUPS.map((g) => (
              <Badge
                key={g}
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all text-xs px-2.5 py-1",
                  filterGroup === g
                    ? "bg-[hsl(var(--gold))] text-[hsl(var(--obsidian))] border-[hsl(var(--gold))]"
                    : "border-[hsl(var(--glass-border))] text-muted-foreground hover:border-[hsl(var(--glass-highlight))]"
                )}
                onClick={() => setFilterGroup(g)}
              >
                {capitalizeGroup(g)}
              </Badge>
            ))}
          </div>

          {/* Level filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {["iniciante", "intermediario", "avancado"].map((lvl) => {
              const label = lvl === "avancado" ? "Avançado" : lvl === "intermediario" ? "Intermediário" : "Iniciante";
              return (
                <Badge
                  key={lvl}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-all text-xs px-2.5 py-1",
                    filterLevel === lvl
                      ? "bg-[hsl(var(--gold))] text-[hsl(var(--obsidian))] border-[hsl(var(--gold))]"
                      : "border-[hsl(var(--glass-border))] text-muted-foreground hover:border-[hsl(var(--glass-highlight))]"
                  )}
                  onClick={() => setFilterLevel(filterLevel === lvl ? null : lvl)}
                >
                  {label}
                </Badge>
              );
            })}
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 sm:p-3 text-muted-foreground font-medium">Exercício</th>
                        <th className="text-left p-2 sm:p-3 text-muted-foreground font-medium">Grupo</th>
                        <th className="text-center p-2 sm:p-3 text-muted-foreground font-medium">Séries</th>
                        <th className="text-center p-2 sm:p-3 text-muted-foreground font-medium">Reps</th>
                        <th className="text-center p-2 sm:p-3 text-muted-foreground font-medium hidden sm:table-cell">Mídia</th>
                        <th className="p-2 sm:p-3 hidden sm:table-cell"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(exercises ?? []).map((ex) => (
                        <tr key={ex.id} className="border-b border-border/50 hover:bg-secondary/30">
                          {editingId === ex.id ? (
                            <>
                              <td colSpan={6} className="p-3">
                                <div className="space-y-3">
                                  <ExerciseFormFields formState={editForm} setFormState={setEditForm} />
                                  <div className="flex gap-2">
                                    <Button size="sm" className="gap-1" onClick={() => updateMutation.mutate({ id: ex.id, input: editForm })} disabled={updateMutation.isPending}>
                                      {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check size={14} />} Salvar
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                      <X size={14} /> Cancelar
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 sm:p-3">
                                <p className="font-medium text-foreground">{ex.name}</p>
                                {ex.equipment && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{ex.equipment}</p>
                                )}
                              </td>
                              <td className="p-2 sm:p-3">
                                <Badge variant="outline" className="text-[10px] border-[hsl(var(--glass-border))] text-muted-foreground">
                                  {capitalizeGroup(ex.muscle_group)}
                                </Badge>
                                {ex.level && (
                                  <Badge variant="outline" className="text-[10px] border-[hsl(var(--glass-border))] text-muted-foreground ml-1">
                                    {ex.level}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-2 sm:p-3 text-center text-foreground">{ex.default_sets}</td>
                              <td className="p-2 sm:p-3 text-center text-foreground">{ex.default_reps}</td>
                              <td className="p-2 sm:p-3 text-center hidden sm:table-cell">
                                <div className="flex items-center justify-center gap-1.5">
                                  {ex.gif_url && (
                                    <button
                                      onClick={() => setPreviewGif({ name: ex.name, url: ex.gif_url! })}
                                      className="inline-flex items-center gap-1 text-[hsl(var(--forja-teal))] hover:underline text-xs"
                                    >
                                      <Image size={12} /> GIF
                                    </button>
                                  )}
                                  {ex.video_id && (
                                    <a
                                      href={`https://youtube.com/watch?v=${ex.video_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[hsl(var(--forja-teal))] hover:underline text-xs"
                                    >
                                      <Video size={12} /> YT
                                    </a>
                                  )}
                                  {!ex.gif_url && !ex.video_id && (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 sm:p-3 hidden sm:table-cell">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => startEdit(ex)}>
                                    <Edit size={14} />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(ex.id)}>
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {(exercises ?? []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">Nenhum exercício cadastrado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TEMPLATES TAB ─── */}
        <TabsContent value="templates">
          <TrainingTemplatesList />
        </TabsContent>
      </Tabs>

      {/* GIF Preview Dialog */}
      <Dialog open={!!previewGif} onOpenChange={() => setPreviewGif(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-cinzel text-sm">{previewGif?.name}</DialogTitle>
          </DialogHeader>
          {previewGif && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={previewGif.url}
                alt={previewGif.name}
                className="rounded-lg max-h-[300px] w-auto"
              />
              <a href={previewGif.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ExternalLink size={12} /> Abrir em nova aba
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EspecialistaExercicios;
