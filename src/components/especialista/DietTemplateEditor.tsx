/**
 * @purpose Full meal/food editor for creating and editing diet templates with FoodAutocomplete.
 * @dependencies FoodAutocomplete, supabase, react-query.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Apple, Clock, ChevronDown, ChevronUp } from "lucide-react";
import FoodAutocomplete from "./FoodAutocomplete";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Meal, MealFood, DietGoal } from "@/types/diet";

interface TemplateFoodItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: string;
  unit: string;
  baseMacros?: { protein: number; carbs: number; fat: number; calories: number; basePortion: number };
  substitute?: {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
}

interface TemplateMeal {
  name: string;
  time: string;
  foods: TemplateFoodItem[];
}

interface EditingTemplate {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  meals: Meal[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  editingTemplate?: EditingTemplate | null;
}

const MEAL_PRESETS = [
  "Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde",
  "Pré-Treino", "Pós-Treino", "Jantar", "Ceia",
];

const UNITS = ["g", "ml", "un", "colher", "xícara", "fatia", "porção"];

/** Parse portion string from food_database into quantity + unit. */
function parsePortion(portion: string): { quantity: number; unit: string } {
  const p = portion.trim().toLowerCase();
  const unitMap: Record<string, string> = {
    unidade: "un", unidades: "un", un: "un",
    g: "g", gramas: "g", grama: "g",
    ml: "ml",
    colher: "colher", colheres: "colher",
    xícara: "xícara", xicaras: "xícara", xicara: "xícara",
    fatia: "fatia", fatias: "fatia",
    porção: "porção", porcao: "porção", porções: "porção",
  };
  const namedMatch = p.match(/^([\d.,]+)\s+([a-záàâãéèêíïóôõöúç]+)/);
  if (namedMatch) {
    const qty = parseFloat(namedMatch[1].replace(",", ".")) || 1;
    const word = namedMatch[2];
    const unit = unitMap[word] || "g";
    return { quantity: qty, unit };
  }
  const simpleMatch = p.match(/^([\d.,]+)\s*(g|ml|un)$/);
  if (simpleMatch) {
    return { quantity: parseFloat(simpleMatch[1].replace(",", ".")) || 100, unit: simpleMatch[2] };
  }
  const numMatch = p.match(/([\d.,]+)/);
  return { quantity: numMatch ? parseFloat(numMatch[1].replace(",", ".")) || 100 : 100, unit: "g" };
}

const GOAL_OPTIONS: { value: DietGoal; label: string }[] = [
  { value: "deficit", label: "Déficit" },
  { value: "bulking", label: "Bulking" },
  { value: "manutenção", label: "Manutenção" },
  { value: "recomposição", label: "Recomposição" },
];

function createEmptyFood(): TemplateFoodItem {
  return { name: "", portion: "", calories: 0, protein: 0, carbs: 0, fat: 0, quantity: "", unit: "g" };
}

function createEmptyMeal(name: string, time: string): TemplateMeal {
  return { name, time, foods: [createEmptyFood()] };
}

function calcMealMacros(foods: TemplateFoodItem[]) {
  let protein = 0, carbs = 0, fat = 0, calories = 0;
  for (const f of foods) {
    if (f.baseMacros && f.baseMacros.basePortion > 0) {
      const ratio = (parseFloat(f.quantity) || 0) / f.baseMacros.basePortion;
      protein += f.baseMacros.protein * ratio;
      carbs += f.baseMacros.carbs * ratio;
      fat += f.baseMacros.fat * ratio;
    } else {
      protein += f.protein;
      carbs += f.carbs;
      fat += f.fat;
    }
  }
  calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
  return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), calories };
}

export default function DietTemplateEditor({ open, onClose, editingTemplate }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!editingTemplate;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState<string>("manutenção");
  const [meals, setMeals] = useState<TemplateMeal[]>([]);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(0);

  useEffect(() => {
    if (open && editingTemplate) {
      setName(editingTemplate.name);
      setDescription(editingTemplate.description ?? "");
      setGoal(editingTemplate.goal);
      setMeals(
        editingTemplate.meals.map((m) => ({
          name: m.name,
          time: m.time,
          foods: m.foods.map((f) => {
            const portionStr = f.portion || "";
            const match = portionStr.match(/^([\d.,]+)\s*(.*)$/);
            const qty = match ? match[1] : portionStr;
            const unitRaw = match ? match[2].trim() : "";
            const unit = UNITS.includes(unitRaw) ? unitRaw : (unitRaw || "g");
            return {
              name: f.name,
              portion: f.portion,
              calories: f.calories,
              protein: f.protein,
              carbs: f.carbs,
              fat: f.fat,
              quantity: qty,
              unit,
              substitute: f.substitute || null,
            };
          }),
        }))
      );
      setExpandedMeal(0);
    } else if (open && !editingTemplate) {
      setName("");
      setDescription("");
      setGoal("manutenção");
      setMeals([createEmptyMeal("Café da Manhã", "07:00")]);
      setExpandedMeal(0);
    }
  }, [open, editingTemplate]);

  const addMeal = () => {
    const usedNames = new Set(meals.map((m) => m.name));
    const next = MEAL_PRESETS.find((p) => !usedNames.has(p)) || `Refeição ${meals.length + 1}`;
    setMeals([...meals, createEmptyMeal(next, "12:00")]);
    setExpandedMeal(meals.length);
  };

  const removeMeal = (idx: number) => {
    setMeals(meals.filter((_, i) => i !== idx));
    if (expandedMeal === idx) setExpandedMeal(null);
  };

  const updateMealField = (idx: number, field: "name" | "time", value: string) => {
    const next = [...meals];
    next[idx] = { ...next[idx], [field]: value };
    setMeals(next);
  };

  const addFood = (mealIdx: number) => {
    const next = [...meals];
    next[mealIdx] = { ...next[mealIdx], foods: [...next[mealIdx].foods, createEmptyFood()] };
    setMeals(next);
  };

  const removeFood = (mealIdx: number, foodIdx: number) => {
    const next = [...meals];
    next[mealIdx] = { ...next[mealIdx], foods: next[mealIdx].foods.filter((_, i) => i !== foodIdx) };
    setMeals(next);
  };

  const updateFoodField = (mealIdx: number, foodIdx: number, field: string, value: string) => {
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    foods[foodIdx] = { ...foods[foodIdx], [field]: value };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  const handleFoodSelect = (mealIdx: number, foodIdx: number, dbFood: { id: string; name: string; portion: string; calories: number; protein: number; carbs: number; fat: number; category: string }) => {
    const parsed = parsePortion(dbFood.portion);
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    foods[foodIdx] = {
      ...foods[foodIdx],
      name: dbFood.name,
      portion: dbFood.portion,
      calories: dbFood.calories,
      protein: dbFood.protein,
      carbs: dbFood.carbs,
      fat: dbFood.fat,
      quantity: String(parsed.quantity),
      unit: parsed.unit,
      baseMacros: {
        protein: dbFood.protein,
        carbs: dbFood.carbs,
        fat: dbFood.fat,
        calories: dbFood.calories,
        basePortion: parsed.quantity,
      },
    };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  // Totals
  const allMealMacros = meals.map((m) => calcMealMacros(m.foods));
  const totalMacros = allMealMacros.reduce(
    (acc, m) => ({ protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat, calories: acc.calories + m.calories }),
    { protein: 0, carbs: 0, fat: 0, calories: 0 }
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!name.trim()) throw new Error("Nome é obrigatório");
      if (meals.length === 0) throw new Error("Adicione ao menos uma refeição");

      // Convert to storage format
        const storageMeals: Meal[] = meals.map((m, mi) => ({
        name: m.name,
        time: m.time,
        foods: m.foods.filter((f) => f.name.trim()).map((f): MealFood => ({
          name: f.name,
          portion: f.quantity ? `${f.quantity}${f.unit}` : f.portion,
          calories: f.baseMacros ? Math.round(f.baseMacros.calories * ((parseFloat(f.quantity) || 0) / f.baseMacros.basePortion)) : f.calories,
          protein: f.baseMacros ? Math.round(f.baseMacros.protein * ((parseFloat(f.quantity) || 0) / f.baseMacros.basePortion)) : f.protein,
          carbs: f.baseMacros ? Math.round(f.baseMacros.carbs * ((parseFloat(f.quantity) || 0) / f.baseMacros.basePortion)) : f.carbs,
          fat: f.baseMacros ? Math.round(f.baseMacros.fat * ((parseFloat(f.quantity) || 0) / f.baseMacros.basePortion)) : f.fat,
          substitute: f.substitute || null,
        })),
      }));

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        goal,
        total_calories: totalMacros.calories,
        total_protein: totalMacros.protein,
        total_carbs: totalMacros.carbs,
        total_fat: totalMacros.fat,
        meals: storageMeals as any,
        specialist_id: user.id,
      };

      if (isEditing && editingTemplate) {
        const { error } = await supabase.from("diet_templates").update(payload).eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("diet_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Template atualizado!" : "Template criado!");
      queryClient.invalidateQueries({ queryKey: ["diet-templates"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 bg-[hsl(var(--card))] border-[hsl(var(--glass-border))] overflow-hidden">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="gold-text-gradient font-cinzel text-xl">
              {isEditing ? "Editar Template" : "Novo Template de Dieta"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <ScrollArea className="h-[calc(90vh-140px)] px-6">
          <div className="space-y-5 pb-6">
            {/* Name + Goal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome do Template *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Cutting Moderado 1600kcal"
                  className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Objetivo</label>
                <Select value={goal} onValueChange={setGoal}>
                  <SelectTrigger className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do objetivo do template..."
                rows={2}
                className="text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] resize-none"
              />
            </div>

            {/* Total Macros Summary */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{totalMacros.calories}</p>
                <p className="text-[10px] text-muted-foreground">kcal total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400">{totalMacros.protein}g</p>
                <p className="text-[10px] text-muted-foreground">Proteína</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-400">{totalMacros.carbs}g</p>
                <p className="text-[10px] text-muted-foreground">Carbos</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-rose-400">{totalMacros.fat}g</p>
                <p className="text-[10px] text-muted-foreground">Gordura</p>
              </div>
            </div>

            {/* Meals */}
            {meals.map((meal, mi) => {
              const isExpanded = expandedMeal === mi;
              const mealMacros = allMealMacros[mi];
              return (
                <div
                  key={mi}
                  className="rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] overflow-hidden"
                >
                  {/* Meal header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-[hsl(var(--glass-highlight))] transition-colors"
                    onClick={() => setExpandedMeal(isExpanded ? null : mi)}
                  >
                    <div className="flex items-center gap-2">
                      <Apple size={14} className="text-emerald-400" />
                      <span className="text-sm font-medium text-foreground">{meal.name}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={10} /> {meal.time}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {mealMacros.calories} kcal
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); removeMeal(mi); }}
                      >
                        <Trash2 size={12} className="text-destructive" />
                      </Button>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 pt-0 space-y-3 border-t border-[hsl(var(--glass-border))]">
                      {/* Meal name + time */}
                      <div className="grid grid-cols-2 gap-2 pt-3">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Nome da Refeição</label>
                          <Select value={meal.name} onValueChange={(v) => updateMealField(mi, "name", v)}>
                            <SelectTrigger className="h-8 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MEAL_PRESETS.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Horário</label>
                          <Input
                            type="time"
                            value={meal.time}
                            onChange={(e) => updateMealField(mi, "time", e.target.value)}
                            className="h-8 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                          />
                        </div>
                      </div>

                      {/* Macros (auto-calculated) */}
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: "Proteína (g)", value: mealMacros.protein },
                          { label: "Carbos (g)", value: mealMacros.carbs },
                          { label: "Gordura (g)", value: mealMacros.fat },
                          { label: "Calorias", value: mealMacros.calories },
                        ].map((m) => (
                          <div key={m.label}>
                            <label className="text-[10px] text-muted-foreground">{m.label}</label>
                            <Input
                              value={m.value}
                              readOnly
                              className="h-7 text-xs bg-muted/30 border-[hsl(var(--glass-border))] text-muted-foreground"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Foods */}
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Alimentos</p>
                        {meal.foods.map((food, fi) => (
                          <div key={fi} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <FoodAutocomplete
                                value={food.name}
                                onChange={(n) => updateFoodField(mi, fi, "name", n)}
                                onSelect={(dbFood) => handleFoodSelect(mi, fi, dbFood)}
                                className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                              />
                              <Input
                                placeholder="Qtd"
                                value={food.quantity}
                                onChange={(e) => updateFoodField(mi, fi, "quantity", e.target.value)}
                                className="h-7 text-xs w-16 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                              />
                              <Select value={food.unit} onValueChange={(v) => updateFoodField(mi, fi, "unit", v)}>
                                <SelectTrigger className="h-7 text-xs w-20 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.map((u) => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => removeFood(mi, fi)}
                              >
                                <Trash2 size={10} className="text-destructive" />
                              </Button>
                            </div>
                            {/* Substitute row */}
                            <div className="flex items-center gap-2 pl-4">
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Subst:</span>
                              <FoodAutocomplete
                                value={food.substitute?.name || ""}
                                onChange={(n) => {
                                  const next = [...meals];
                                  const foods = [...next[mi].foods];
                                  if (!n) {
                                    foods[fi] = { ...foods[fi], substitute: null };
                                  } else {
                                    foods[fi] = { ...foods[fi], substitute: { ...(foods[fi].substitute || { name: "", portion: "", calories: 0, protein: 0, carbs: 0, fat: 0 }), name: n } };
                                  }
                                  next[mi] = { ...next[mi], foods };
                                  setMeals(next);
                                }}
                                onSelect={(dbFood) => {
                                  const next = [...meals];
                                  const foods = [...next[mi].foods];
                                  foods[fi] = {
                                    ...foods[fi],
                                    substitute: {
                                      name: dbFood.name,
                                      portion: dbFood.portion,
                                      calories: dbFood.calories,
                                      protein: dbFood.protein,
                                      carbs: dbFood.carbs,
                                      fat: dbFood.fat,
                                    },
                                  };
                                  next[mi] = { ...next[mi], foods };
                                  setMeals(next);
                                }}
                                className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                              />
                              {food.substitute && (
                                <>
                                  <Input
                                    placeholder="Porção"
                                    value={food.substitute.portion}
                                    onChange={(e) => {
                                      const next = [...meals];
                                      const foods = [...next[mi].foods];
                                      foods[fi] = {
                                        ...foods[fi],
                                        substitute: { ...foods[fi].substitute!, portion: e.target.value },
                                      };
                                      next[mi] = { ...next[mi], foods };
                                      setMeals(next);
                                    }}
                                    className="h-7 text-xs w-20 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                                  />
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    P{food.substitute.protein}g C{food.substitute.carbs}g G{food.substitute.fat}g
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addFood(mi)}
                          className="text-xs gap-1 text-emerald-400"
                        >
                          <Plus size={12} /> Adicionar Alimento
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add meal */}
            <Button
              variant="outline"
              size="sm"
              onClick={addMeal}
              className="w-full gap-1.5 border-dashed border-[hsl(var(--glass-border))]"
            >
              <Plus size={14} /> Adicionar Refeição
            </Button>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-[hsl(var(--glass-border))] flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="border-[hsl(var(--glass-border))]">
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || meals.length === 0 || saveMutation.isPending}
            className="gold-gradient text-[hsl(var(--obsidian))] font-medium gap-1.5"
          >
            <Save size={14} /> {isEditing ? "Salvar Alterações" : "Criar Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
