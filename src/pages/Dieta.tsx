import { useState, useMemo } from "react";
import { ArrowLeft, Leaf, Clock, Flame, Check, AlertTriangle, ChevronDown, ChevronUp, ArrowLeftRight, MessageSquare, Target, Repeat2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { getToday } from "@/lib/dateUtils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useDailyHabits } from "@/hooks/useDailyHabits";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──
interface FoodSubstitute {
  name: string;
  portion: string;
  displayPortion?: string;
  quantity?: string;
  unit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ParsedFood {
  name: string;
  portion: string;
  substitutes: FoodSubstitute[];
}

interface ParsedMeal {
  id: string;
  time: string;
  label: string;
  foods: ParsedFood[];
  calories: number;
  macros: { protein: number; carbs: number; fats: number };
  notes: string;
}

/** A main meal with its alternative options grouped */
interface GroupedMeal {
  main: ParsedMeal;
  alternatives: ParsedMeal[];
}

const GoalDescriptionCard = ({ description }: { description: string }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="bg-card border-border mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/15 border border-primary/30">
          <Target size={14} className="text-primary" />
        </div>
        <span className="font-cinzel text-sm font-bold text-foreground flex-1">Objetivo do Plano</span>
        {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

/** Detect "Opção 2/3/4" alternative meals */
const isAlternativeMeal = (name: string) => /[–\-]\s*Op[çc][ãa]o\s*[2-9]/i.test(name);

/** Extract base meal name from an alternative (e.g. "08:00 – Café da manhã – Opção 2" → "Café da manhã") */
const getBaseMealName = (name: string): string => {
  return name.replace(/\s*[–\-]\s*Op[çc][ãa]o\s*[2-9].*/i, "").trim();
};

const Dieta = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: dietPlan, isLoading } = useQuery({
    queryKey: ["diet-plan", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("diet_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const allMeals: ParsedMeal[] = useMemo(() => {
    if (!dietPlan?.meals) return [];
    try {
      const raw = dietPlan.meals as any[];
      return raw.map((meal: any, idx: number) => {
        const mealId = meal.id || `m${idx + 1}`;

        if (meal.foods !== undefined) {
          const foods: ParsedFood[] = (meal.foods as any[])
            .filter((f: any) => f.name)
            .map((f: any) => {
              const subs: FoodSubstitute[] = f.substitutes ?? [];
              if (f.substitute && !subs.length) subs.push(f.substitute);
              let portion = f.displayPortion || "";
              // Filter out corrupted "0 undefined" values
              if (portion === "0 undefined" || portion === "0undefined") portion = "";
              if (!portion) {
                portion = f.quantity
                  ? (String(f.quantity).match(/[a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/)
                    ? String(f.quantity)
                    : f.unit && f.unit !== "undefined" ? `${f.quantity} ${f.unit}` : `${f.quantity}g`)
                  : (f.portion || "");
              }
              // Final safety: don't show "0g" or empty-ish portions
              if (portion === "0g" || portion === "0 g") portion = "";
              return { name: f.name, portion, substitutes: subs };
            });

          let mealCalories = meal.macros?.calories || 0;
          let mealProtein = meal.macros?.protein || 0;
          let mealCarbs = meal.macros?.carbs || 0;
          let mealFat = meal.macros?.fat || 0;

          if (mealCalories === 0 && (meal.foods ?? []).length > 0) {
            for (const fd of meal.foods ?? []) {
              mealCalories += Number(fd.calories) || 0;
              mealProtein += Number(fd.protein) || 0;
              mealCarbs += Number(fd.carbs) || 0;
              mealFat += Number(fd.fat) || 0;
            }
            if (mealCalories === 0 && (mealProtein > 0 || mealCarbs > 0 || mealFat > 0)) {
              mealCalories = Math.round(mealProtein * 4 + mealCarbs * 4 + mealFat * 9);
            }
          }

          return {
            id: mealId, time: meal.time || "",
            label: meal.name || `Refeição ${idx + 1}`, foods,
            calories: Math.round(mealCalories),
            macros: { protein: Math.round(mealProtein), carbs: Math.round(mealCarbs), fats: Math.round(mealFat) },
            notes: meal.notes || "",
          };
        }

        // Legacy format
        const opt = meal.options?.[0] || {};
        const items: string[] = opt.items || [];
        const foods: ParsedFood[] = items.map((item: string, i: number) => ({
          name: item, portion: "",
          substitutes: opt.substitutes?.[i] ? [opt.substitutes[i]] : [],
        }));
        return {
          id: mealId, time: meal.time || "",
          label: meal.label || meal.name || `Refeição ${idx + 1}`, foods,
          calories: opt.calories || 0,
          macros: { protein: opt.macros?.protein || 0, carbs: opt.macros?.carbs || 0, fats: opt.macros?.fats || 0 },
          notes: "",
        };
      });
    } catch {
      return [];
    }
  }, [dietPlan]);

  // Group alternatives under their parent meal
  const groupedMeals: GroupedMeal[] = useMemo(() => {
    const groups: GroupedMeal[] = [];
    const usedIndices = new Set<number>();

    allMeals.forEach((meal, idx) => {
      if (usedIndices.has(idx)) return;
      if (isAlternativeMeal(meal.label)) return; // Will be picked up by parent

      const baseName = getBaseMealName(meal.label);
      const alternatives: ParsedMeal[] = [];

      // Find all alternatives for this meal
      allMeals.forEach((other, otherIdx) => {
        if (otherIdx === idx || usedIndices.has(otherIdx)) return;
        if (!isAlternativeMeal(other.label)) return;
        const otherBase = getBaseMealName(other.label);
        // Match by base name (ignoring time prefix)
        const cleanBase = baseName.replace(/^\d{1,2}:\d{2}\s*[–\-]\s*/, "").trim().toLowerCase();
        const cleanOther = otherBase.replace(/^\d{1,2}:\d{2}\s*[–\-]\s*/, "").trim().toLowerCase();
        if (cleanBase === cleanOther) {
          alternatives.push(other);
          usedIndices.add(otherIdx);
        }
      });

      usedIndices.add(idx);
      groups.push({ main: meal, alternatives });
    });

    // Add any orphaned alternatives that didn't match
    allMeals.forEach((meal, idx) => {
      if (!usedIndices.has(idx)) {
        groups.push({ main: meal, alternatives: [] });
      }
    });

    return groups;
  }, [allMeals]);

  const mainMeals = groupedMeals.map(g => g.main);

  const { completedMeals, toggleMeal: toggleMealInDb } = useDailyHabits();

  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [showSubstitute, setShowSubstitute] = useState<string | null>(null);
  const [showAlternatives, setShowAlternatives] = useState<string | null>(null);
  // Track which alternative the user selected for each meal
  const [selectedAlternative, setSelectedAlternative] = useState<Record<string, number>>({});

  const totalMacros = useMemo(() => {
    return mainMeals.reduce(
      (acc, meal) => ({
        cal: acc.cal + meal.calories,
        prot: acc.prot + meal.macros.protein,
        carb: acc.carb + meal.macros.carbs,
        fat: acc.fat + meal.macros.fats,
      }),
      { cal: 0, prot: 0, carb: 0, fat: 0 }
    );
  }, [mainMeals]);

  if (!isLoading && allMeals.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6 pt-2">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Leaf size={20} className="text-primary" />
            <span className="font-cinzel font-bold text-foreground">PLANO ALIMENTAR</span>
          </div>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle size={32} className="text-accent mx-auto" />
            <h3 className="font-cinzel font-bold text-foreground">Plano em preparação</h3>
            <p className="text-sm text-muted-foreground">
              Seu nutricionista está montando seu plano alimentar personalizado. Ele aparecerá aqui assim que estiver pronto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Leaf size={20} className="text-primary" />
          <span className="font-cinzel font-bold text-foreground">PLANO ALIMENTAR</span>
        </div>
      </div>

      {/* Macros totais */}
      <Card className="bg-card border-border mb-4">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Macros do Dia</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: "Calorias", value: totalMacros.cal, unit: "kcal", color: "text-accent" },
              { label: "Proteína", value: totalMacros.prot, unit: "g", color: "text-destructive" },
              { label: "Carbs", value: totalMacros.carb, unit: "g", color: "text-primary" },
              { label: "Gordura", value: totalMacros.fat, unit: "g", color: "text-accent" },
            ].map((m) => (
              <div key={m.label}>
                <p className={`font-cinzel text-lg font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {dietPlan?.goal_description && (
        <GoalDescriptionCard description={dietPlan.goal_description} />
      )}

      {/* Meal counter */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs text-muted-foreground">Refeições feitas</p>
        <p className="text-sm font-bold text-foreground">
          {mainMeals.filter(m => completedMeals.has(m.id)).length} / {mainMeals.length}
        </p>
      </div>
      <div className="flex gap-1.5 mb-4 px-1">
        {mainMeals.map((meal) => (
          <div
            key={meal.id}
            className="h-1.5 flex-1 rounded-full transition-all"
            style={{
              background: completedMeals.has(meal.id) ? "hsl(var(--primary))" : "hsl(var(--secondary))",
            }}
          />
        ))}
      </div>

      {/* Meals */}
      <div className="space-y-2">
        {groupedMeals.map((group) => {
          const { main: meal, alternatives } = group;
          const hasAlternatives = alternatives.length > 0;
          const isCompleted = completedMeals.has(meal.id);
          const isExpanded = expandedMeal === meal.id;
          const isAltOpen = showAlternatives === meal.id;
          const selectedAltIdx = selectedAlternative[meal.id];
          const displayMeal = selectedAltIdx !== undefined ? alternatives[selectedAltIdx] : meal;

          return (
            <div key={meal.id} className="rounded-xl border border-border bg-card overflow-hidden transition-all">
              {/* Header row */}
              <div className="flex items-center gap-3 p-4">
                {/* Check-in button */}
                <div
                  role="button"
                  onClick={() => toggleMealInDb(meal.id, mainMeals.length)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    isCompleted
                      ? "bg-primary/20 border border-primary/40"
                      : "bg-secondary border border-border"
                  }`}
                >
                  {isCompleted ? (
                    <Check size={14} className="text-primary" />
                  ) : (
                    <Leaf size={14} className="text-muted-foreground" />
                  )}
                </div>

                {/* Meal info - clickable to expand */}
                <button
                  onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className={`font-cinzel text-sm font-bold truncate ${isCompleted ? "text-foreground/60 line-through" : "text-foreground"}`}>
                    {meal.time ? `${meal.time} – ` : ""}{meal.label.replace(/\s*[–\-]\s*Op[çc][ãa]o\s*\d+.*/i, "")}
                  </p>
                  {selectedAltIdx !== undefined && (
                    <span className="text-[9px] text-accent font-medium">Usando opção {selectedAltIdx + 2}</span>
                  )}
                </button>

                {/* Alternative swap button */}
                {hasAlternatives && (
                  <button
                    onClick={() => setShowAlternatives(isAltOpen ? null : meal.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      isAltOpen ? "bg-accent/20 border border-accent/40" : "bg-secondary/60 border border-border/50"
                    }`}
                    title={`${alternatives.length} opção(ões) alternativa(s)`}
                  >
                    <Repeat2 size={15} className={isAltOpen ? "text-accent" : "text-muted-foreground"} />
                  </button>
                )}

                {/* Chevron */}
                <button onClick={() => setExpandedMeal(isExpanded ? null : meal.id)}>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown size={18} className="text-muted-foreground" />
                  </motion.div>
                </button>
              </div>

              {/* Alternative selector dropdown */}
              <AnimatePresence>
                {isAltOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Escolha a opção:</p>
                      
                      {/* Original meal option */}
                      <button
                        onClick={() => {
                          const next = { ...selectedAlternative };
                          delete next[meal.id];
                          setSelectedAlternative(next);
                          setShowAlternatives(null);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedAltIdx === undefined
                            ? "border-accent/50 bg-accent/10"
                            : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-foreground">Opção 1 (Principal)</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {meal.calories} kcal · P: {meal.macros.protein}g · C: {meal.macros.carbs}g · G: {meal.macros.fats}g
                            </p>
                          </div>
                          {selectedAltIdx === undefined && (
                            <Check size={14} className="text-accent shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* Alternative options */}
                      {alternatives.map((alt, altIdx) => (
                        <button
                          key={alt.id}
                          onClick={() => {
                            setSelectedAlternative({ ...selectedAlternative, [meal.id]: altIdx });
                            setShowAlternatives(null);
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedAltIdx === altIdx
                              ? "border-accent/50 bg-accent/10"
                              : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-foreground">Opção {altIdx + 2}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {alt.calories} kcal · P: {alt.macros.protein}g · C: {alt.macros.carbs}g · G: {alt.macros.fats}g
                              </p>
                            </div>
                            {selectedAltIdx === altIdx && (
                              <Check size={14} className="text-accent shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Expanded content - shows the selected meal (main or alternative) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {/* Macros summary */}
                      <div className="flex gap-3 text-[10px] text-muted-foreground pb-2 border-b border-border/50">
                        <span className="text-accent font-semibold">{displayMeal.calories} kcal</span>
                        <span>P: {displayMeal.macros.protein}g</span>
                        <span>C: {displayMeal.macros.carbs}g</span>
                        <span>G: {displayMeal.macros.fats}g</span>
                      </div>

                      {/* Food items */}
                      {displayMeal.foods.map((food, foodIdx) => {
                        const subKey = `${displayMeal.id}-${foodIdx}`;
                        const hasSubs = food.substitutes.length > 0;
                        const isSubOpen = showSubstitute === subKey;

                        return (
                          <div key={foodIdx} className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                            <p className="text-sm font-bold text-foreground">{food.name}</p>
                            {food.portion && (
                              <p className="text-xs text-muted-foreground mt-0.5">{food.portion}</p>
                            )}
                            {hasSubs && (
                              <>
                                <button
                                  onClick={() => setShowSubstitute(isSubOpen ? null : subKey)}
                                  className="flex items-center gap-1.5 mt-2 text-xs text-accent hover:text-accent/80 transition-colors bg-accent/10 rounded-md px-2.5 py-1.5"
                                >
                                  <ArrowLeftRight size={12} />
                                  Ver substituições ({food.substitutes.length})
                                </button>
                                <AnimatePresence>
                                  {isSubOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-2 space-y-2">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Opções para substituir:</p>
                                        {food.substitutes.map((sub, si) => (
                                          <div key={si} className="p-3 rounded-lg bg-card border border-border/50">
                                            <p className="text-sm font-bold text-foreground">{sub.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {sub.displayPortion || (sub.quantity ? `${sub.quantity}${sub.unit || 'g'}` : sub.portion)}
                                            </p>
                                            <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                                              <span>{sub.calories} kcal</span>
                                              <span>P: {sub.protein}g</span>
                                              <span>C: {sub.carbs}g</span>
                                              <span>G: {sub.fat}g</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </>
                            )}
                          </div>
                        );
                      })}

                      {/* Notes */}
                      {displayMeal.notes && (
                        <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex gap-2">
                          <MessageSquare size={14} className="text-accent shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-accent font-bold mb-0.5">Observação:</p>
                            <p className="text-xs text-muted-foreground">{displayMeal.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dieta;
