/**
 * @purpose List, filter, search and manage diet templates with full meal editor.
 * @dependencies DietTemplateEditor, supabase, react-query.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Trash2, Eye, Edit, Flame, TrendingUp, Scale, RefreshCw, Plus, Search } from "lucide-react";
import DietTemplateEditor from "./DietTemplateEditor";
import type { Meal, MealFood } from "@/types/diet";

interface DietTemplate {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: Meal[];
  created_at: string;
}

const GOAL_CONFIG: Record<string, { label: string; icon: typeof Flame; color: string }> = {
  deficit: { label: "Déficit", icon: Flame, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  bulking: { label: "Bulking", icon: TrendingUp, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  manutenção: { label: "Manutenção", icon: Scale, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  recomposição: { label: "Recomposição", icon: RefreshCw, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

const DietTemplatesList = () => {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<DietTemplate | null>(null);
  const [filterGoal, setFilterGoal] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DietTemplate | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["diet-templates", filterGoal],
    queryFn: async () => {
      let query = supabase
        .from("diet_templates")
        .select("*")
        .order("goal")
        .order("total_calories");
      if (filterGoal) query = query.eq("goal", filterGoal);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        meals: (typeof t.meals === "string" ? JSON.parse(t.meals) : t.meals) as Meal[],
      })) as DietTemplate[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diet_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template removido");
      queryClient.invalidateQueries({ queryKey: ["diet-templates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEditTemplate = (tpl: DietTemplate) => {
    setEditingTemplate(tpl);
    setEditorOpen(true);
  };

  const goalKeys = Object.keys(GOAL_CONFIG);

  // Apply search filter
  const filtered = (templates ?? []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Header with filters + search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterGoal === null ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterGoal(null)}
              className="text-xs"
            >
              Todos
            </Button>
            {goalKeys.map((g) => {
              const cfg = GOAL_CONFIG[g];
              const Icon = cfg.icon;
              return (
                <Button
                  key={g}
                  variant={filterGoal === g ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterGoal(g)}
                  className="text-xs gap-1.5"
                >
                  <Icon size={13} />
                  {cfg.label}
                </Button>
              );
            })}
          </div>

          <Button size="sm" className="gap-1.5" onClick={handleNewTemplate}>
            <Plus size={14} /> Novo Template
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar template por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-10">Nenhum template encontrado.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tpl) => {
            const cfg = GOAL_CONFIG[tpl.goal] ?? GOAL_CONFIG["manutenção"];
            const Icon = cfg.icon;
            return (
              <Card key={tpl.id} className="bg-card border-border hover:border-accent/40 transition-colors group">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-foreground truncate">{tpl.name}</h3>
                      {tpl.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] gap-1 ${cfg.color}`}>
                      <Icon size={10} />
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Macro summary */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-secondary/30 rounded-md p-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase">Kcal</p>
                      <p className="text-sm font-bold text-accent">{tpl.total_calories}</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md p-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase">Prot</p>
                      <p className="text-sm font-bold text-foreground">{tpl.total_protein}g</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md p-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase">Carb</p>
                      <p className="text-sm font-bold text-foreground">{tpl.total_carbs}g</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md p-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase">Gord</p>
                      <p className="text-sm font-bold text-foreground">{tpl.total_fat}g</p>
                    </div>
                  </div>

                  {/* Meal count */}
                  <p className="text-[11px] text-muted-foreground">
                    {tpl.meals.length} refeições · {tpl.meals.reduce((acc, m) => acc + m.foods.length, 0)} alimentos
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs gap-1.5"
                      onClick={() => setSelectedTemplate(tpl)}
                    >
                      <Eye size={13} />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs gap-1.5"
                      onClick={() => handleEditTemplate(tpl)}
                    >
                      <Edit size={13} />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(tpl.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="font-cinzel text-lg">{selectedTemplate.name}</DialogTitle>
                {selectedTemplate.description && (
                  <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                )}
              </DialogHeader>

              <div className="grid grid-cols-4 gap-2 text-center mt-2">
                <div className="bg-secondary/30 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">KCAL</p>
                  <p className="text-base font-bold text-accent">{selectedTemplate.total_calories}</p>
                </div>
                <div className="bg-secondary/30 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">PROT</p>
                  <p className="text-base font-bold text-foreground">{selectedTemplate.total_protein}g</p>
                </div>
                <div className="bg-secondary/30 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">CARB</p>
                  <p className="text-base font-bold text-foreground">{selectedTemplate.total_carbs}g</p>
                </div>
                <div className="bg-secondary/30 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">GORD</p>
                  <p className="text-base font-bold text-foreground">{selectedTemplate.total_fat}g</p>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                {selectedTemplate.meals.map((meal, mi) => (
                  <div key={mi} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">{meal.name}</h4>
                      <span className="text-[10px] text-muted-foreground">{meal.time}</span>
                    </div>
                    <div className="bg-secondary/20 rounded-lg p-3 space-y-1.5">
                      {meal.foods.map((food, fi) => (
                        <div key={fi} className="flex items-center justify-between text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground">{food.name}</span>
                            <span className="text-muted-foreground ml-1.5">({food.portion})</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-[10px] shrink-0 ml-2">
                            <span>{food.calories}kcal</span>
                            <span>P{food.protein}g</span>
                            <span>C{food.carbs}g</span>
                            <span>G{food.fat}g</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-3 text-[10px] text-muted-foreground px-1">
                      <span>Subtotal: {meal.foods.reduce((a, f) => a + f.calories, 0)} kcal</span>
                      <span>P{meal.foods.reduce((a, f) => a + f.protein, 0).toFixed(1)}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Template Editor */}
      <DietTemplateEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingTemplate(null); }}
        editingTemplate={editingTemplate ? {
          id: editingTemplate.id,
          name: editingTemplate.name,
          description: editingTemplate.description,
          goal: editingTemplate.goal,
          meals: editingTemplate.meals,
        } : null}
      />
    </div>
  );
};

export default DietTemplatesList;
