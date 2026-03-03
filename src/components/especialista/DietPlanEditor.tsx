import { useState, useEffect, useMemo } from "react";
import { useDraftAutoSave, loadDraft } from "@/hooks/useDraftAutoSave";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Apple, Clock, ChevronDown, ChevronUp, FolderOpen, Eye, AlertTriangle, ArrowLeftRight, Flame, TrendingUp, Scale, RefreshCw, History, Sparkles, Loader2, FileUp } from "lucide-react";
import { useRef } from "react";
import type { DietGoal } from "@/types/diet";
import FoodAutocomplete from "./FoodAutocomplete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DietTemplateManager from "./DietTemplateManager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DietPreviewModal from "./DietPreviewModal";
import PlanVersionTimeline from "./PlanVersionTimeline";

interface FoodMeasure {
  id: string;
  food_id: string;
  description: string;
  gram_equivalent: number;
}

/** A single substitute food item with its own macros */
interface SubstituteItem {
  name: string;
  portion: string;
  quantity?: string;
  unit?: string;
  displayPortion?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Available household measures for this substitute */
  measures?: FoodMeasure[];
  /** Database food ID */
  foodId?: string;
  /** Base macros from DB for proportional calc */
  baseMacros?: { protein: number; carbs: number; fat: number; calories: number; basePortion: number };
}

interface FoodItem {
  name: string;
  quantity: string;
  unit: string;
  /** Database food ID for measure lookup */
  foodId?: string;
  /** Quantity converted to grams (for saving) */
  quantityInGrams?: number;
  /** Human-readable display: e.g. "2 Fatias (60g)" */
  displayPortion?: string;
  /** Base macros per portion from food_database (used for proportional calc) */
  baseMacros?: { protein: number; carbs: number; fat: number; calories: number; basePortion: number };
  /** Available household measures for this food */
  measures?: FoodMeasure[];
  /** @deprecated Use substitutes instead */
  substitute?: SubstituteItem | null;
  /** Multiple substitutes with individual macro calculation */
  substitutes?: SubstituteItem[];
}

interface Meal {
  name: string;
  time: string;
  foods: FoodItem[];
  notes: string;
  macros: { protein: number; carbs: number; fat: number; calories: number };
}

interface StudentOption {
  id: string;
  name: string;
}

interface EditingDiet {
  id: string;
  title: string;
  user_id: string;
  meals: Meal[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  students: StudentOption[];
  editingPlan?: EditingDiet | null;
  /** When true, renders inline without Dialog wrapper */
  embedded?: boolean;
  /** Pre-select this student ID */
  preSelectedStudent?: string;
}

const MEAL_PRESETS = [
  "Café da Manhã",
  "Lanche da Manhã",
  "Almoço",
  "Lanche da Tarde",
  "Pré-Treino",
  "Pós-Treino",
  "Jantar",
  "Ceia",
];

const UNITS = ["g", "ml"];

/** Compute quantityInGrams and displayPortion based on unit, quantity, and measures */
function resolvePortioning(food: FoodItem): { quantityInGrams: number; displayPortion: string } {
  const qty = parseFloat(food.quantity) || 0;
  if (!food.unit || food.unit === "g") return { quantityInGrams: qty, displayPortion: qty ? `${qty}g` : "" };
  if (food.unit === "ml") return { quantityInGrams: qty, displayPortion: qty ? `${qty}ml` : "" };
  // Household measure
  const measure = (food.measures || []).find(m => m.description === food.unit);
  if (measure) {
    const grams = Math.round(qty * measure.gram_equivalent * 10) / 10;
    return { quantityInGrams: grams, displayPortion: `${qty} ${food.unit} ou ${grams}g` };
  }
  return { quantityInGrams: qty, displayPortion: qty ? `${qty} ${food.unit}` : "" };
}

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

function calcCalories(m: Meal["macros"]) {
  return (m?.protein ?? 0) * 4 + (m?.carbs ?? 0) * 4 + (m?.fat ?? 0) * 9;
}

const defaultMacros = { protein: 0, carbs: 0, fat: 0, calories: 0 };

/** Calculate macros proportionally based on basePortion */
function calculateMacros(baseMacros: { protein: number; carbs: number; fat: number; calories: number; basePortion: number }, quantity: number) {
  if (!baseMacros || baseMacros.basePortion <= 0) return defaultMacros;
  const ratio = quantity / baseMacros.basePortion;
  return {
    protein: Math.round(baseMacros.protein * ratio * 10) / 10,
    carbs: Math.round(baseMacros.carbs * ratio * 10) / 10,
    fat: Math.round(baseMacros.fat * ratio * 10) / 10,
    calories: Math.round(baseMacros.calories * ratio),
  };
}

/** Normalize meals: migrate substitute → substitutes, ensure all fields exist, compute macros from foods */
function normalizeMeals(raw: any[]): Meal[] {
  return (raw ?? []).map((m: any) => {
    const foods = (m.foods ?? []).map((f: any) => {
      const substitutes: SubstituteItem[] = (f.substitutes ?? []).map((s: any) => {
        // Preserve AI-generated portion as displayPortion for substitutes
        if (!s.displayPortion && s.portion && typeof s.portion === "string" && /[a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(s.portion)) {
          s.displayPortion = s.portion;
        }
        // Extract quantity+unit from portion if missing
        if (!s.quantity && s.portion && typeof s.portion === "string") {
          const parenM = s.portion.match(/\((\d+(?:[.,]\d+)?)\s*(g|ml)\)/i);
          const ouM = s.portion.match(/ou\s+(\d+(?:[.,]\d+)?)\s*(g|ml)/i);
          const endM = s.portion.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\s*$/i);
          const m = parenM || ouM || endM;
          if (m) { s.quantity = m[1].replace(",", "."); s.unit = m[2].toLowerCase(); }
        }
        return s;
      });
      // Migrate legacy single substitute
      if (f.substitute && !f.substitutes?.length) {
        const legacySub = { ...f.substitute };
        if (!legacySub.displayPortion && legacySub.portion && typeof legacySub.portion === "string" && /[a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(legacySub.portion)) {
          legacySub.displayPortion = legacySub.portion;
        }
        substitutes.push(legacySub);
      }
      // If food comes from AI/PDF with "portion" but no quantity, extract quantity+unit for the editor
      if (!f.quantity && f.portion && typeof f.portion === "string" && f.portion.trim()) {
        if (!f.displayPortion) f.displayPortion = f.portion;
        const portionStr = f.portion;
        // Try to extract grams or ml from parentheses: "(50g)", "(240ml)"
        const parenMatch = portionStr.match(/\((\d+(?:[.,]\d+)?)\s*(g|ml)\)/i);
        // Or trailing: "ou 50g", "ou 240ml"
        const ouMatch = portionStr.match(/ou\s+(\d+(?:[.,]\d+)?)\s*(g|ml)/i);
        // Or end of string: "50g", "240ml"
        const endMatch = portionStr.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\s*$/i);
        const match = parenMatch || ouMatch || endMatch;
        if (match) {
          f.quantity = match[1].replace(",", ".");
          f.unit = match[2].toLowerCase();
        }
      } else if (f.quantity && !f.displayPortion && f.portion && typeof f.portion === "string" && /[a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(f.portion)) {
        // Already has quantity but missing displayPortion — preserve rich portion text
        f.displayPortion = f.portion;
      }
      return { ...f, substitutes, substitute: undefined };
    });

    // If meal already has macros with non-zero calories, keep them
    let macros = m.macros ? { ...defaultMacros, ...m.macros } : { ...defaultMacros };

    // If macros are empty/zero, compute from food-level macros
    if (macros.calories === 0 && foods.length > 0) {
      let protein = 0, carbs = 0, fat = 0, calories = 0;
      for (const f of foods) {
        protein += Number(f.protein) || 0;
        carbs += Number(f.carbs) || 0;
        fat += Number(f.fat) || 0;
        calories += Number(f.calories) || 0;
      }
      // Use computed calories if available, otherwise derive from macros
      macros = {
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        calories: calories > 0 ? Math.round(calories) : Math.round(protein * 4 + carbs * 4 + fat * 9),
      };
    }

    return { ...m, foods, notes: m.notes ?? "", macros };
  });
}

export default function DietPlanEditor({ open, onClose, students, editingPlan, embedded, preSelectedStudent }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!editingPlan;

  const [selectedStudent, setSelectedStudent] = useState("");
  const [title, setTitle] = useState("Plano Alimentar");
  const [goal, setGoal] = useState<DietGoal>("manutenção");
  const [goalDescription, setGoalDescription] = useState("");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(0);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Auto-save draft
  const dietDraftKey = `diet-draft-${editingPlan?.id || selectedStudent || "new"}`;
  const dietDraftData = useMemo(() => ({
    selectedStudent, title, goal, goalDescription, meals,
  }), [selectedStudent, title, goal, goalDescription, meals]);

  const { clearDraft } = useDraftAutoSave(dietDraftKey, dietDraftData, open && meals.length > 0);

  const generateWithAI = async () => {
    if (!selectedStudent) {
      toast.error("Selecione um aluno primeiro");
      return;
    }
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-diet-plan", {
        body: {
          student_id: selectedStudent,
          goal_hint: goalDescription || undefined,
          goal_type: goal,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const plan = data.plan;
      if (plan.title) setTitle(plan.title);
      if (plan.goal) setGoal(plan.goal as DietGoal);
      if (plan.goal_description) setGoalDescription(plan.goal_description);
      if (plan.meals?.length) {
        setMeals(normalizeMeals(plan.meals));
        setExpandedMeal(0);
      }

      toast.success("Plano alimentar gerado pela IA! Revise e ajuste antes de salvar.");
    } catch (err: any) {
      console.error("AI diet generation error:", err);
      toast.error(err.message || "Erro ao gerar plano com IA");
    } finally {
      setAiGenerating(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Envie apenas arquivos PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10MB");
      return;
    }
    setPdfParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/parse-diet-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "Erro ao processar PDF");

      const plan = result.plan;
      if (plan.title) setTitle(plan.title);
      if (plan.goal) setGoal(plan.goal as DietGoal);
      if (plan.meals?.length) {
        setMeals(normalizeMeals(plan.meals));
        setExpandedMeal(0);
      }

      toast.success("Plano importado do PDF! Revise e ajuste antes de salvar.");
    } catch (err: any) {
      console.error("PDF parse error:", err);
      toast.error(err.message || "Erro ao processar PDF");
    } finally {
      setPdfParsing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  // Fetch student profile for caloric goal
  const { data: studentProfile } = useQuery({
    queryKey: ["student-profile-goal", selectedStudent],
    queryFn: async () => {
      if (!selectedStudent) return null;
      const { data } = await supabase
        .from("profiles")
        .select("nome, peso, meta_peso, altura, sexo")
        .eq("id", selectedStudent)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedStudent,
  });

  // Estimate caloric goal from profile (Harris-Benedict simplified)
  const caloricGoal = useMemo(() => {
    if (!studentProfile?.peso) return null;
    const peso = parseFloat(studentProfile.peso);
    const altura = parseFloat(studentProfile.altura || "170");
    const isMale = studentProfile.sexo !== "feminino";
    if (isNaN(peso)) return null;
    // BMR estimation
    const bmr = isMale
      ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * 25
      : 447.593 + 9.247 * peso + 3.098 * altura - 4.330 * 25;
    return Math.round(bmr * 1.55); // Moderate activity
  }, [studentProfile]);

  useEffect(() => {
    if (open && editingPlan) {
      const draft = loadDraft<typeof dietDraftData>(dietDraftKey);
      if (draft && !draftRestored) {
        setDraftRestored(true);
        setSelectedStudent(draft.data.selectedStudent);
        setTitle(draft.data.title);
        setGoal(draft.data.goal as DietGoal);
        setGoalDescription(draft.data.goalDescription);
        setMeals(normalizeMeals(draft.data.meals));
        setExpandedMeal(0);
        toast.info("Rascunho recuperado! Seus dados não foram perdidos.", { duration: 5000 });
        return;
      }
      setSelectedStudent(editingPlan.user_id);
      setTitle(editingPlan.title);
      setGoal(((editingPlan as any).goal as DietGoal) || "manutenção");
      setGoalDescription((editingPlan as any).goal_description || "");
      setMeals(normalizeMeals(editingPlan.meals));
      setExpandedMeal(0);
    } else if (open && !editingPlan) {
      const newDraftKey = `diet-draft-${preSelectedStudent || "new"}`;
      const draft = loadDraft<typeof dietDraftData>(newDraftKey);
      if (draft && !draftRestored) {
        setDraftRestored(true);
        setSelectedStudent(draft.data.selectedStudent);
        setTitle(draft.data.title);
        setGoal(draft.data.goal as DietGoal);
        setGoalDescription(draft.data.goalDescription);
        setMeals(normalizeMeals(draft.data.meals));
        setExpandedMeal(0);
        toast.info("Rascunho recuperado! Seus dados não foram perdidos.", { duration: 5000 });
        return;
      }
      setSelectedStudent(preSelectedStudent ?? "");
      setTitle("Plano Alimentar");
      setGoal("manutenção");
      setGoalDescription("");
      setMeals([createEmptyMeal("Café da Manhã", "07:00")]);
      setExpandedMeal(0);
    }
    if (!open) setDraftRestored(false);
  }, [open, editingPlan, preSelectedStudent]);

  function createEmptyMeal(name: string, time: string): Meal {
    return {
      name,
      time,
      foods: [{ name: "", quantity: "", unit: "g", substitutes: [], quantityInGrams: 0, displayPortion: "" }],
      notes: "",
      macros: { protein: 0, carbs: 0, fat: 0, calories: 0 },
    };
  }

  /** Recalculate meal macros from all foods that have baseMacros */
  const recalcMealMacros = (mealFoods: FoodItem[]) => {
    let protein = 0, carbs = 0, fat = 0;
    for (const f of mealFoods) {
      if (f.baseMacros && f.baseMacros.basePortion > 0) {
        // Use quantityInGrams for measure-based foods, else raw quantity
        const { quantityInGrams } = resolvePortioning(f);
        const m = calculateMacros(f.baseMacros, quantityInGrams);
        protein += m.protein;
        carbs += m.carbs;
        fat += m.fat;
      }
    }
    return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), calories: Math.round(protein * 4 + carbs * 4 + fat * 9) };
  };

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

  const updateMeal = (idx: number, field: keyof Meal, value: any) => {
    const next = [...meals];
    next[idx] = { ...next[idx], [field]: value };
    if (field === "macros") {
      next[idx].macros.calories = calcCalories(next[idx].macros);
    }
    setMeals(next);
  };

  const updateMacro = (mealIdx: number, key: keyof Meal["macros"], value: number) => {
    const next = [...meals];
    const macros = { ...next[mealIdx].macros, [key]: value };
    macros.calories = calcCalories(macros);
    next[mealIdx] = { ...next[mealIdx], macros };
    setMeals(next);
  };

  const addFood = (mealIdx: number) => {
    const next = [...meals];
    next[mealIdx] = {
      ...next[mealIdx],
      foods: [...next[mealIdx].foods, { name: "", quantity: "", unit: "g", substitutes: [], quantityInGrams: 0, displayPortion: "" }],
    };
    setMeals(next);
  };

  const removeFood = (mealIdx: number, foodIdx: number) => {
    const next = [...meals];
    next[mealIdx] = {
      ...next[mealIdx],
      foods: next[mealIdx].foods.filter((_, i) => i !== foodIdx),
    };
    setMeals(next);
  };

  const updateFood = (mealIdx: number, foodIdx: number, field: keyof FoodItem, value: string) => {
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    foods[foodIdx] = { ...foods[foodIdx], [field]: value };
    // Recalculate portioning whenever quantity or unit changes
    if (field === "quantity" || field === "unit") {
      const resolved = resolvePortioning(foods[foodIdx]);
      foods[foodIdx] = { ...foods[foodIdx], quantityInGrams: resolved.quantityInGrams, displayPortion: resolved.displayPortion };
    }
    next[mealIdx] = { ...next[mealIdx], foods };
    if (field === "quantity" || field === "unit" || field === "name") {
      const autoMacros = recalcMealMacros(foods);
      if (foods.some(f => f.baseMacros)) {
        next[mealIdx] = { ...next[mealIdx], foods, macros: autoMacros };
      }
    }
    setMeals(next);
  };

  // ── Substitute management ──
  const addSubstitute = (mealIdx: number, foodIdx: number) => {
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    const subs = [...(foods[foodIdx].substitutes || [])];
    subs.push({ name: "", portion: "", calories: 0, protein: 0, carbs: 0, fat: 0 });
    foods[foodIdx] = { ...foods[foodIdx], substitutes: subs };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  const removeSubstitute = (mealIdx: number, foodIdx: number, subIdx: number) => {
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    const subs = [...(foods[foodIdx].substitutes || [])];
    subs.splice(subIdx, 1);
    foods[foodIdx] = { ...foods[foodIdx], substitutes: subs };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  const updateSubstituteName = (mealIdx: number, foodIdx: number, subIdx: number, name: string) => {
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    const subs = [...(foods[foodIdx].substitutes || [])];
    if (!name) {
      subs.splice(subIdx, 1);
    } else {
      subs[subIdx] = { ...subs[subIdx], name };
    }
    foods[foodIdx] = { ...foods[foodIdx], substitutes: subs };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  const selectSubstituteFromDB = async (mealIdx: number, foodIdx: number, subIdx: number, dbFood: any) => {
    // Fetch household measures for this substitute food
    const { data: measures } = await supabase
      .from("food_measures")
      .select("id, food_id, description, gram_equivalent")
      .eq("food_id", dbFood.id);
    const foodMeasures: FoodMeasure[] = (measures || []) as any;

    const parsed = parsePortion(dbFood.portion);
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    const subs = [...(foods[foodIdx].substitutes || [])];
    subs[subIdx] = {
      name: dbFood.name,
      portion: String(parsed.quantity),
      quantity: String(parsed.quantity),
      unit: "g",
      foodId: dbFood.id,
      measures: foodMeasures,
      calories: dbFood.calories,
      protein: dbFood.protein,
      carbs: dbFood.carbs,
      fat: dbFood.fat,
      baseMacros: {
        protein: dbFood.protein,
        carbs: dbFood.carbs,
        fat: dbFood.fat,
        calories: dbFood.calories,
        basePortion: dbFood.portion_grams ? Number(dbFood.portion_grams) : 100,
      },
    };
    foods[foodIdx] = { ...foods[foodIdx], substitutes: subs };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  const updateSubstituteQuantity = (mealIdx: number, foodIdx: number, subIdx: number, quantity: string) => {
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    const subs = [...(foods[foodIdx].substitutes || [])];
    const sub = { ...subs[subIdx], quantity, portion: quantity };
    // Resolve grams
    const qty = parseFloat(quantity) || 0;
    let grams = qty;
    if (sub.unit && sub.unit !== "g" && sub.unit !== "ml") {
      const measure = (sub.measures || []).find(m => m.description === sub.unit);
      if (measure) grams = qty * measure.gram_equivalent;
    }
    // Recalculate macros
    if (sub.baseMacros) {
      const calc = calculateMacros(sub.baseMacros, grams);
      sub.protein = calc.protein;
      sub.carbs = calc.carbs;
      sub.fat = calc.fat;
      sub.calories = calc.calories;
    }
    subs[subIdx] = sub;
    foods[foodIdx] = { ...foods[foodIdx], substitutes: subs };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  const updateSubstituteUnit = (mealIdx: number, foodIdx: number, subIdx: number, unit: string) => {
    const next = [...meals];
    const foods = [...next[mealIdx].foods];
    const subs = [...(foods[foodIdx].substitutes || [])];
    const sub = { ...subs[subIdx], unit };
    // Recalculate macros with new unit
    const qty = parseFloat(sub.quantity || sub.portion || "0") || 0;
    let grams = qty;
    if (unit !== "g" && unit !== "ml") {
      const measure = (sub.measures || []).find(m => m.description === unit);
      if (measure) grams = qty * measure.gram_equivalent;
    }
    if (sub.baseMacros) {
      const calc = calculateMacros(sub.baseMacros, grams);
      sub.protein = calc.protein;
      sub.carbs = calc.carbs;
      sub.fat = calc.fat;
      sub.calories = calc.calories;
    }
    subs[subIdx] = sub;
    foods[foodIdx] = { ...foods[foodIdx], substitutes: subs };
    next[mealIdx] = { ...next[mealIdx], foods };
    setMeals(next);
  };

  /** Detect "Opção 2/3/4" alternative meals that should NOT count in totals */
  const isAlternativeMeal = (name: string) => /[–\-]\s*Op[çc][ãa]o\s*[2-9]/i.test(name);

  const totalMacros = meals.reduce(
    (acc, m) => {
      if (isAlternativeMeal(m.name)) return acc; // skip alternatives
      return {
        protein: acc.protein + (m.macros?.protein ?? 0),
        carbs: acc.carbs + (m.macros?.carbs ?? 0),
        fat: acc.fat + (m.macros?.fat ?? 0),
        calories: acc.calories + (m.macros?.calories ?? 0),
      };
    },
    { protein: 0, carbs: 0, fat: 0, calories: 0 }
  );

  // Caloric goal alert
  const caloricDiff = useMemo(() => {
    if (!caloricGoal || totalMacros.calories === 0) return null;
    const diff = ((totalMacros.calories - caloricGoal) / caloricGoal) * 100;
    return Math.round(diff);
  }, [caloricGoal, totalMacros.calories]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!selectedStudent) throw new Error("Selecione um aluno");
      if (!goalDescription.trim()) throw new Error("Preencha o objetivo/descrição do plano");
      if (meals.length === 0) throw new Error("Adicione ao menos uma refeição");

      // Clean up: remove baseMacros/measures from saved data (keep data lean)
      const cleanMeals = meals.map(m => ({
        ...m,
        foods: m.foods.map(f => {
          const resolved = resolvePortioning(f);
          // Prefer rich displayPortion (with letters like "1 Unidade(s) (50g)") over simple "50g"
          const richPortion = (f as any).displayPortion || (f as any).portion || "";
          const hasRichText = typeof richPortion === "string" && /[a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(richPortion);
          const finalDisplayPortion = hasRichText ? richPortion : (resolved.displayPortion || richPortion || "");
          // Preserve the original portion string (from AI/PDF) so it can be re-parsed on load
          const originalPortion = richPortion || resolved.displayPortion || "";
          return {
            name: f.name,
            portion: originalPortion,
            quantity: f.quantity,
            unit: f.unit,
            quantityInGrams: resolved.quantityInGrams,
            displayPortion: finalDisplayPortion,
            substitute: undefined, // remove legacy field
            substitutes: (f.substitutes || []).map(s => {
              const qty = parseFloat(s.quantity || s.portion || "0") || 0;
              const unit = s.unit || "g";
              // If substitute already has a rich displayPortion from AI (contains letters), keep it
              let displayPortion = s.displayPortion || "";
              if (!displayPortion || displayPortion === `${qty}g` || displayPortion === `${qty}${unit}`) {
                // Recompute only if not already set by AI
                if (unit !== "g" && unit !== "ml") {
                  const measure = (s.measures || []).find(m => m.description === unit);
                  if (measure) {
                    const grams = Math.round(qty * measure.gram_equivalent * 10) / 10;
                    displayPortion = `${qty} ${unit} ou ${grams}g`;
                  } else {
                    displayPortion = `${qty} ${unit}`;
                  }
                } else {
                  // Check if portion has richer text (e.g. "2 Unidade(s) ou 40g")
                  const portionText = s.portion || "";
                  if (typeof portionText === "string" && /[a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/.test(portionText)) {
                    displayPortion = portionText;
                  } else {
                    displayPortion = qty ? `${qty}${unit}` : "";
                  }
                }
              }
              return {
                name: s.name,
                portion: s.quantity || s.portion || "",
                quantity: s.quantity || s.portion || "",
                unit,
                displayPortion,
                calories: s.calories,
                protein: s.protein,
                carbs: s.carbs,
                fat: s.fat,
              };
            }),
          };
        }),
      }));

      if (isEditing && editingPlan) {
        const { error } = await supabase
          .from("diet_plans")
          .update({
            title,
            goal,
            goal_description: goalDescription || null,
            meals: cleanMeals as any,
            specialist_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPlan.id);
        if (error) throw error;
      } else {
        await supabase
          .from("diet_plans")
          .update({ active: false })
          .eq("user_id", selectedStudent)
          .eq("active", true);

        const { error } = await supabase.from("diet_plans").insert({
          user_id: selectedStudent,
          specialist_id: user.id,
          title,
          goal,
          goal_description: goalDescription || null,
          meals: cleanMeals as any,
          active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      clearDraft();
      toast.success(isEditing ? "Dieta atualizada!" : "Dieta criada!");
      queryClient.invalidateQueries({ queryKey: ["specialist-diet-plans"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const selectedStudentName = students.find(s => s.id === selectedStudent)?.name || "";

  const editorContent = (
    <>
      <div className={embedded ? "p-4 border-b border-border" : "p-6 pb-0"}>
        {!embedded && (
          <DialogHeader>
            <DialogTitle className="gold-text-gradient font-cinzel text-xl">
              {isEditing ? "Editar Plano Alimentar" : "Novo Plano Alimentar"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Editor de plano alimentar para o aluno
            </DialogDescription>
          </DialogHeader>
        )}
        {embedded && (
          <h2 className="gold-text-gradient font-cinzel text-lg font-bold">
            {isEditing ? "Editar Plano Alimentar" : "Novo Plano Alimentar"}
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
                <label className="text-xs text-muted-foreground mb-1 block">Título</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                />
              </div>
            </div>

            {/* Goal selector chips */}
            <div className="flex gap-2 flex-wrap">
              {([
                { value: "deficit" as DietGoal, label: "Déficit", icon: <Flame size={13} /> },
                { value: "bulking" as DietGoal, label: "Bulking", icon: <TrendingUp size={13} /> },
                { value: "manutenção" as DietGoal, label: "Manutenção", icon: <Scale size={13} /> },
                { value: "recomposição" as DietGoal, label: "Recomposição", icon: <RefreshCw size={13} /> },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGoal(opt.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    goal === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-[hsl(var(--glass-bg))] text-muted-foreground border-[hsl(var(--glass-border))] hover:text-foreground"
                  )}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>

            {/* Goal description textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Objetivo do plano (visível para o aluno) <span className="text-primary">*</span></label>
              <textarea
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="Ex: Dieta elaborada com um déficit calórico controlado com aproximadamente 300 calorias a menos do seu GET..."
                rows={3}
                className="w-full rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
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
                disabled={meals.length === 0}
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
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => pdfInputRef.current?.click()}
                disabled={pdfParsing}
                className="gap-1.5 border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]"
              >
                {pdfParsing ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                {pdfParsing ? "Lendo PDF..." : "Importar PDF"}
              </Button>
              <Button
                size="sm"
                onClick={generateWithAI}
                disabled={aiGenerating || !selectedStudent}
                className="gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0"
              >
                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiGenerating ? "Gerando..." : "Gerar com IA"}
              </Button>
            </div>

            {/* Caloric Goal Alert */}
            {caloricGoal && caloricDiff !== null && Math.abs(caloricDiff) > 10 && (
              <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-xs text-amber-200">
                  <strong>Atenção:</strong> O total de calorias ({totalMacros.calories} kcal) está{" "}
                  <strong>{Math.abs(caloricDiff)}% {caloricDiff > 0 ? "acima" : "abaixo"}</strong> da meta estimada do aluno ({caloricGoal} kcal).
                </AlertDescription>
              </Alert>
            )}

            {/* Total Macros Summary */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{totalMacros.calories}</p>
                <p className="text-[10px] text-muted-foreground">kcal total</p>
                {caloricGoal && (
                  <p className="text-[9px] text-muted-foreground">meta: {caloricGoal}</p>
                )}
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
                      <Apple size={14} className={isAlternativeMeal(meal.name) ? "text-blue-400" : "text-emerald-400"} />
                      <span className="text-sm font-medium text-foreground">{meal.name}</span>
                      {isAlternativeMeal(meal.name) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">ALTERNATIVA</span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={10} /> {meal.time}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {meal.macros.calories} kcal
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
                          <Select value={meal.name} onValueChange={(v) => updateMeal(mi, "name", v)}>
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
                            onChange={(e) => updateMeal(mi, "time", e.target.value)}
                            className="h-8 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                          />
                        </div>
                      </div>

                      {/* Macros */}
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Proteína (g)</label>
                          <Input
                            type="number"
                            value={meal.macros.protein || ""}
                            onChange={(e) => updateMacro(mi, "protein", Number(e.target.value) || 0)}
                            className="h-7 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Carbos (g)</label>
                          <Input
                            type="number"
                            value={meal.macros.carbs || ""}
                            onChange={(e) => updateMacro(mi, "carbs", Number(e.target.value) || 0)}
                            className="h-7 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Gordura (g)</label>
                          <Input
                            type="number"
                            value={meal.macros.fat || ""}
                            onChange={(e) => updateMacro(mi, "fat", Number(e.target.value) || 0)}
                            className="h-7 text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Calorias</label>
                          <Input
                            value={meal.macros.calories}
                            readOnly
                            className="h-7 text-xs bg-muted/30 border-[hsl(var(--glass-border))] text-muted-foreground"
                          />
                        </div>
                      </div>

                      {/* Foods */}
                      <div className="space-y-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Alimentos</p>
                        {meal.foods.map((food, fi) => (
                          <div key={fi} className="space-y-1.5 rounded-lg border border-border/20 p-2 bg-background/30">
                            {/* Main food row */}
                            <div className="flex items-center gap-2">
                              <FoodAutocomplete
                                value={food.name}
                                onChange={(name) => updateFood(mi, fi, "name", name)}
                                onSelect={async (dbFood) => {
                                  // Fetch household measures for this food
                                  const { data: measures } = await supabase
                                    .from("food_measures")
                                    .select("id, food_id, description, gram_equivalent")
                                    .eq("food_id", dbFood.id);
                                  const foodMeasures: FoodMeasure[] = (measures || []) as any;

                                  const parsed = parsePortion(dbFood.portion);
                                  const qty = parsed.quantity;
                                  const unit = "g";

                                  const newFood: FoodItem = {
                                    ...meals[mi].foods[fi],
                                    name: dbFood.name,
                                    foodId: dbFood.id,
                                    quantity: String(qty),
                                    unit,
                                    measures: foodMeasures,
                                    baseMacros: {
                                      protein: dbFood.protein,
                                      carbs: dbFood.carbs,
                                      fat: dbFood.fat,
                                      calories: dbFood.calories,
                                      basePortion: dbFood.portion_grams ? Number(dbFood.portion_grams) : 100,
                                    },
                                  };
                                  const resolved = resolvePortioning(newFood);
                                  newFood.quantityInGrams = resolved.quantityInGrams;
                                  newFood.displayPortion = resolved.displayPortion;

                                  const next = [...meals];
                                  const foods = [...next[mi].foods];
                                  foods[fi] = newFood;
                                  next[mi] = { ...next[mi], foods, macros: recalcMealMacros(foods) };
                                  setMeals(next);
                                }}
                                className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                              />
                              <Input
                                placeholder="Qtd"
                                value={food.quantity}
                                onChange={(e) => updateFood(mi, fi, "quantity", e.target.value)}
                                className="h-7 text-xs w-16 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                              />
                              <Select value={food.unit} onValueChange={(v) => updateFood(mi, fi, "unit", v)}>
                                <SelectTrigger className="h-7 text-xs w-28 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.map((u) => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                  {(food.measures || []).map((m) => (
                                    <SelectItem key={m.id} value={m.description}>
                                      {m.description} ({m.gram_equivalent}g)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {/* Show gram equivalent when using household measure */}
                              {food.unit !== "g" && food.unit !== "ml" && food.quantityInGrams ? (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  ({food.quantityInGrams}g)
                                </span>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => removeFood(mi, fi)}
                              >
                                <Trash2 size={10} className="text-destructive" />
                              </Button>
                            </div>

                            {/* Substitutes section */}
                            <div className="pl-4 space-y-1.5">
                              {(food.substitutes || []).map((sub, si) => (
                                <div key={si} className="flex items-center gap-2">
                                  <ArrowLeftRight size={10} className="text-accent shrink-0" />
                                  <FoodAutocomplete
                                    value={sub.name}
                                    onChange={(n) => updateSubstituteName(mi, fi, si, n)}
                                    onSelect={(dbFood) => selectSubstituteFromDB(mi, fi, si, dbFood)}
                                    className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                                  />
                                  <Input
                                    placeholder="Qtd"
                                    value={sub.quantity || sub.portion || ""}
                                    onChange={(e) => updateSubstituteQuantity(mi, fi, si, e.target.value)}
                                    className="h-7 text-xs w-16 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
                                  />
                                  <Select value={sub.unit || "g"} onValueChange={(v) => updateSubstituteUnit(mi, fi, si, v)}>
                                    <SelectTrigger className="h-7 text-xs w-28 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {UNITS.map((u) => (
                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                      ))}
                                      {(sub.measures || []).map((m) => (
                                        <SelectItem key={m.id} value={m.description}>
                                          {m.description} ({m.gram_equivalent}g)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {sub.name && (
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {sub.calories}kcal
                                    </span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => removeSubstitute(mi, fi, si)}
                                  >
                                    <Trash2 size={9} className="text-destructive" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addSubstitute(mi, fi)}
                                className="text-[10px] gap-1 text-accent h-6 px-2"
                              >
                                <Plus size={10} /> Substituto
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addFood(mi)}
                          className="text-xs gap-1 text-[hsl(var(--forja-teal))]"
                        >
                          <Plus size={12} /> Adicionar Alimento
                        </Button>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-[10px] text-muted-foreground">Observações</label>
                        <Textarea
                          value={meal.notes}
                          onChange={(e) => updateMeal(mi, "notes", e.target.value)}
                          placeholder="Notas sobre esta refeição..."
                          rows={2}
                          className="text-xs bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] resize-none"
                        />
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
        <div className={cn("p-4 border-t border-[hsl(var(--glass-border))] flex justify-end gap-2", embedded && "border-border")}>
          <Button variant="outline" onClick={onClose} className="border-[hsl(var(--glass-border))]">
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!selectedStudent || meals.length === 0 || !goalDescription.trim() || saveMutation.isPending}
            className="gold-gradient text-[hsl(var(--obsidian))] font-medium gap-1.5"
          >
            <Save size={14} /> {isEditing ? "Salvar Alterações" : "Criar Dieta"}
          </Button>
        </div>
    </>
  );

  const previewModal = (
    <DietPreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      meals={meals}
      studentName={selectedStudentName}
      title={title}
    />
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full bg-card">
        {editorContent}
        <DietTemplateManager
          open={templateManagerOpen}
          onClose={() => setTemplateManagerOpen(false)}
          currentMeals={meals}
          onLoadTemplate={(m) => setMeals(normalizeMeals(m))}
        />
        {previewModal}
        <PlanVersionTimeline
          planId={editingPlan?.id}
          type="diet"
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={(v) => {
            if (v.meals) setMeals(normalizeMeals(v.meals));
            if (v.title) setTitle(v.title);
            if (v.goal) setGoal(v.goal as DietGoal);
            if (v.goal_description !== undefined) setGoalDescription(v.goal_description || "");
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

      <DietTemplateManager
        open={templateManagerOpen}
        onClose={() => setTemplateManagerOpen(false)}
        currentMeals={meals}
        onLoadTemplate={(m) => setMeals(normalizeMeals(m))}
      />
      {previewModal}
      <PlanVersionTimeline
        planId={editingPlan?.id}
        type="diet"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={(v) => {
          if (v.meals) setMeals(normalizeMeals(v.meals));
          if (v.title) setTitle(v.title);
          if (v.goal) setGoal(v.goal as DietGoal);
          if (v.goal_description !== undefined) setGoalDescription(v.goal_description || "");
        }}
      />
    </>
  );
}
