import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Video, Loader2, X, ChevronDown, Dumbbell, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export interface ExerciseItem {
  name: string;
  sets: number;
  reps: string;
  weight: number | null;
  rest: string;
  videoId: string | null;
  setsData: never[];
  freeText?: boolean;
  description?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (exercises: ExerciseItem[]) => void;
}

const MUSCLE_GROUPS = [
  "peito", "costas", "ombros", "bíceps", "tríceps",
  "quadríceps", "posteriores", "glúteos", "panturrilhas", "abdominais",
  "trapezio", "antebraços", "inferior-das-costas", "abdutores", "adutores", "pescoço",
];

const capitalizeGroup = (g: string) => g.charAt(0).toUpperCase() + g.slice(1);
const normalizeGroup = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const EQUIPMENT_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "peso-do-corpo", label: "Peso do Corpo" },
  { value: "halteres", label: "Halteres" },
  { value: "barra", label: "Barra" },
  { value: "maquina", label: "Máquina" },
  { value: "cabo", label: "Cabos" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "faixas", label: "Faixas/Elástico" },
  { value: "bola-de-exercicio", label: "Bola de Exercício" },
  { value: "bola-medicinal", label: "Bola Medicinal" },
  { value: "rolo-de-espuma", label: "Rolo de Espuma" },
  { value: "outros", label: "Outros" },
];

const LEVEL_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediário", label: "Intermediário" },
  { value: "avançado", label: "Avançado" },
];

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match?.[1] ?? null;
}

export default function ExerciseSelector({ open, onClose, onAdd }: Props) {
  const [selectedGroup, setSelectedGroup] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscleGroup, setNewMuscleGroup] = useState("peito");
  const [newSets, setNewSets] = useState(3);
  const [newReps, setNewReps] = useState("10");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const queryClient = useQueryClient();

  const { data: exercises } = useQuery({
    queryKey: ["exercise-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("*")
        .order("muscle_group")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const hasSearch = search.trim().length >= 2;
    const searchLower = search.toLowerCase().trim();
    const results = (exercises ?? []).filter((e) => {
      const matchGroup =
        !selectedGroup || normalizeGroup((e.muscle_group ?? "").toString()) === normalizeGroup(selectedGroup);
      const matchSearch = !hasSearch || e.name.toLowerCase().includes(searchLower);
      const matchEquipment = !equipmentFilter || (e.equipment ?? "").toLowerCase().includes(equipmentFilter.toLowerCase());
      const matchLevel = !levelFilter || (e.level ?? "").toLowerCase().includes(levelFilter.toLowerCase());
      return matchGroup && matchSearch && matchEquipment && matchLevel;
    });
    if (hasSearch) {
      results.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStartsWith = aName.startsWith(searchLower) ? 0 : 1;
        const bStartsWith = bName.startsWith(searchLower) ? 0 : 1;
        if (aStartsWith !== bStartsWith) return aStartsWith - bStartsWith;
        const aIdx = aName.indexOf(searchLower);
        const bIdx = bName.indexOf(searchLower);
        if (aIdx !== bIdx) return aIdx - bIdx;
        return aName.length - bName.length;
      });
    }
    return results;
  }, [exercises, selectedGroup, search, equipmentFilter, levelFilter]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      return [...prev, name];
    });
  };

  const createExerciseMutation = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Nome é obrigatório");
      const videoId = newVideoUrl ? extractYouTubeId(newVideoUrl) : null;
      const { error } = await supabase.from("exercise_library").insert({
        name: newName.trim(),
        muscle_group: newMuscleGroup,
        default_sets: newSets,
        default_reps: newReps,
        video_id: videoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exercício criado!");
      queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
      setNewName("");
      setNewVideoUrl("");
      setNewReps("10");
      setNewSets(3);
      setShowNewForm(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleConfirm = () => {
    const exMap = new Map((exercises ?? []).map(ex => [ex.name, ex]));
    const items: ExerciseItem[] = [];
    for (const name of selected) {
      const ex = exMap.get(name);
      if (ex) {
        items.push({
          name: ex.name,
          sets: ex.default_sets,
          reps: ex.default_reps,
          weight: null,
          rest: "1'30\"",
          videoId: ex.video_id ?? null,
          setsData: [],
        });
      }
    }
    onAdd(items);
    setSelected([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-[hsl(var(--card))] border-[hsl(var(--glass-border))] flex flex-col overflow-hidden">
        <div className="p-5 pb-0">
          <DialogHeader>
            <DialogTitle className="gold-text-gradient font-cinzel text-lg">Adicionar Exercícios</DialogTitle>
          </DialogHeader>
        </div>

        {/* Muscle group chips - horizontal scroll */}
        <div className="px-5 pt-3">
          <div className="overflow-x-auto scrollbar-none pb-1">
            <div className="flex gap-1.5 w-max">
              <Badge
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all text-[11px] px-2 py-0.5 shrink-0",
                  selectedGroup === ""
                    ? "bg-[hsl(var(--gold))] text-[hsl(var(--obsidian))] border-[hsl(var(--gold))]"
                    : "border-[hsl(var(--glass-border))] text-muted-foreground hover:border-[hsl(var(--glass-highlight))]"
                )}
                onClick={() => setSelectedGroup("")}
              >
                Todas
              </Badge>
              {MUSCLE_GROUPS.map((g) => (
                <Badge
                  key={g}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-all text-[11px] px-2 py-0.5 shrink-0",
                    selectedGroup === g
                      ? "bg-[hsl(var(--gold))] text-[hsl(var(--obsidian))] border-[hsl(var(--gold))]"
                      : "border-[hsl(var(--glass-border))] text-muted-foreground hover:border-[hsl(var(--glass-highlight))]"
                  )}
                  onClick={() => setSelectedGroup(g)}
                >
                  {capitalizeGroup(g)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="px-5 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar exercício..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
              className="flex-1 h-8 text-xs rounded-md border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-2 text-foreground [&>option]:bg-[hsl(var(--card))] [&>option]:text-foreground"
            >
              {EQUIPMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>🏋️ {o.label}</option>
              ))}
            </select>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="flex-1 h-8 text-xs rounded-md border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-2 text-foreground [&>option]:bg-[hsl(var(--card))] [&>option]:text-foreground"
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>📊 {o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* New exercise form */}
        <div className="px-5">
        {showNewForm ? (
          <div className="rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Novo Exercício</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewForm(false)}>
                <X size={14} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Nome</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Supino Inclinado"
                  className="h-8 text-xs bg-background border-[hsl(var(--glass-border))]"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Grupo Muscular</label>
                <select
                  value={newMuscleGroup}
                  onChange={(e) => setNewMuscleGroup(e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-[hsl(var(--glass-border))] bg-background px-2 text-foreground [&>option]:bg-[hsl(var(--card))] [&>option]:text-foreground"
                >
                  {MUSCLE_GROUPS.map((g) => (
                    <option key={g} value={g}>{capitalizeGroup(g)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Séries padrão</label>
                <Input
                  type="number"
                  value={newSets}
                  onChange={(e) => setNewSets(Number(e.target.value))}
                  className="h-8 text-xs bg-background border-[hsl(var(--glass-border))]"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Reps padrão</label>
                <Input
                  value={newReps}
                  onChange={(e) => setNewReps(e.target.value)}
                  className="h-8 text-xs bg-background border-[hsl(var(--glass-border))]"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Video size={10} /> Link do YouTube (opcional)
              </label>
              <Input
                value={newVideoUrl}
                onChange={(e) => setNewVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="h-8 text-xs bg-background border-[hsl(var(--glass-border))]"
              />
            </div>
            <Button
              size="sm"
              className="w-full gap-1 gold-gradient text-[hsl(var(--obsidian))] font-medium"
              onClick={() => createExerciseMutation.mutate()}
              disabled={!newName.trim() || createExerciseMutation.isPending}
            >
              {createExerciseMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Salvar Exercício
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 border-dashed border-[hsl(var(--glass-border))] text-muted-foreground"
            onClick={() => {
              setShowNewForm(true);
              setNewMuscleGroup(selectedGroup);
            }}
          >
            <Plus size={14} /> Criar Novo Exercício
          </Button>
        )}
        </div>

        {/* Exercise list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          <div className="space-y-1">
            {filtered.map((ex) => {
              const isExpanded = expandedId === ex.id;
              return (
                <div key={ex.id} className={cn(
                  "rounded-lg transition-colors",
                  selected.includes(ex.name) ? "bg-[hsl(var(--gold)/0.1)]" : ""
                )}>
                  <label
                    className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-[hsl(var(--glass-bg))] rounded-lg"
                  >
                    <Checkbox
                      checked={selected.includes(ex.name)}
                      onCheckedChange={() => toggle(ex.name)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{ex.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ex.default_sets} séries × {ex.default_reps} reps
                        {ex.equipment && <span className="ml-1">· {ex.equipment}</span>}
                        {ex.level && <span className="ml-1">· {ex.level}</span>}
                        {ex.video_id && <span className="ml-1 text-[hsl(var(--forja-teal))]">· 🎬</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : ex.id);
                      }}
                      className={cn(
                        "w-7 h-7 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] flex items-center justify-center transition-transform duration-200 shrink-0",
                        isExpanded && "rotate-180"
                      )}
                    >
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </label>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-2">
                          {/* GIF preview */}
                          {ex.gif_url && (
                            <div className="rounded-lg overflow-hidden border border-[hsl(var(--glass-border))] bg-background">
                              <img
                                src={ex.gif_url}
                                alt={`Demonstração: ${ex.name}`}
                                className="w-full max-h-48 object-contain"
                                loading="lazy"
                              />
                            </div>
                          )}

                          {/* Metadata badges */}
                          <div className="flex flex-wrap gap-1.5">
                            {ex.equipment && (
                              <Badge variant="outline" className="text-[10px] border-[hsl(var(--glass-border))]">
                                🏋️ {ex.equipment}
                              </Badge>
                            )}
                            {ex.level && (
                              <Badge variant="outline" className="text-[10px] border-[hsl(var(--glass-border))]">
                                📊 {ex.level}
                              </Badge>
                            )}
                            {ex.category && (
                              <Badge variant="outline" className="text-[10px] border-[hsl(var(--glass-border))]">
                                {ex.category}
                              </Badge>
                            )}
                            {ex.secondary_muscles && (
                              <Badge variant="outline" className="text-[10px] border-[hsl(var(--glass-border))]">
                                Secundários: {ex.secondary_muscles}
                              </Badge>
                            )}
                          </div>

                          {/* Instructions */}
                          {ex.instructions && (
                            <div className="bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] rounded-lg p-2.5">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Info size={10} /> Instruções
                              </p>
                              <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                                {ex.instructions}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-6">Nenhum exercício encontrado</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[hsl(var(--glass-border))]">
          <span className="text-xs text-muted-foreground">
            {selected.length} exercício(s) selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-[hsl(var(--glass-border))]">
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={selected.length === 0}
              onClick={handleConfirm}
              className="gold-gradient text-[hsl(var(--obsidian))] font-medium gap-1"
            >
              <Plus size={14} /> Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
