/**
 * @purpose Preview modal showing the student's diet view without saving.
 * @dependencies Dialog, Dieta page rendering logic.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import { Leaf, Clock, ArrowLeftRight, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface SubstituteItem {
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

interface PreviewMeal {
  name: string;
  time: string;
  foods: {
    name: string;
    quantity: string;
    unit: string;
    displayPortion?: string;
    quantityInGrams?: number;
    substitutes?: SubstituteItem[];
    substitute?: SubstituteItem | null;
  }[];
  notes: string;
  macros: { protein: number; carbs: number; fat: number; calories: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  meals: PreviewMeal[];
  studentName: string;
  title: string;
}

export default function DietPreviewModal({ open, onClose, meals, studentName, title }: Props) {
  const [expandedMeal, setExpandedMeal] = useState<number | null>(0);

  const totalMacros = useMemo(() => {
    return meals.reduce(
      (acc, m) => ({
        cal: acc.cal + (m.macros?.calories ?? 0),
        prot: acc.prot + (m.macros?.protein ?? 0),
        carb: acc.carb + (m.macros?.carbs ?? 0),
        fat: acc.fat + (m.macros?.fat ?? 0),
      }),
      { cal: 0, prot: 0, carb: 0, fat: 0 }
    );
  }, [meals]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] p-0 bg-background border-border overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Leaf size={16} className="text-green-400" />
            <span className="font-cinzel">PREVIEW: Visão do Aluno</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {studentName ? `Como ${studentName} verá` : "Como o aluno verá"} — "{title}"
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-80px)]">
          <div className="p-4 space-y-3">
            {/* Macros totais */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Macros do Dia</p>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: "Calorias", value: totalMacros.cal, unit: "kcal", color: "text-accent" },
                  { label: "Proteína", value: totalMacros.prot, unit: "g", color: "text-red-500" },
                  { label: "Carbs", value: totalMacros.carb, unit: "g", color: "text-blue-400" },
                  { label: "Gordura", value: totalMacros.fat, unit: "g", color: "text-amber-400" },
                ].map((m) => (
                  <div key={m.label}>
                    <p className={`font-cinzel text-lg font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-[10px] text-muted-foreground">{m.unit}</p>
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Refeição counter */}
            <div className="flex gap-1.5 px-1">
              {meals.map((_, i) => (
                <div key={i} className="h-1.5 flex-1 rounded-full bg-secondary" />
              ))}
            </div>

            {/* Meals */}
            {meals.map((meal, mi) => {
              const isExpanded = expandedMeal === mi;
              const validFoods = meal.foods.filter(f => f.name);

              return (
                <div key={mi} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedMeal(isExpanded ? null : mi)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-secondary border border-border">
                      <Leaf size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-cinzel text-sm font-bold truncate text-foreground">
                        {meal.time ? `${meal.time} - ` : ""}{meal.name}
                      </p>
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <ChevronDown size={18} className="text-muted-foreground" />
                    </motion.div>
                  </button>

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
                          <div className="flex gap-3 text-[10px] text-muted-foreground pb-2 border-b border-border/50">
                            <span className="text-accent font-semibold">{meal.macros.calories} kcal</span>
                            <span>P: {meal.macros.protein}g</span>
                            <span>C: {meal.macros.carbs}g</span>
                            <span>G: {meal.macros.fat}g</span>
                          </div>

                          {validFoods.map((food, fi) => {
                            const subs = food.substitutes?.length ? food.substitutes : (food.substitute ? [food.substitute] : []);
                            const portion = food.displayPortion || (food.quantity
                              ? (String(food.quantity).match(/[a-zA-Z]/) ? String(food.quantity) : food.unit ? `${food.quantity} ${food.unit}` : `${food.quantity}g`)
                              : "");

                            return (
                              <div key={fi} className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                                <p className="text-sm font-bold text-foreground">{food.name}</p>
                                {portion && <p className="text-xs text-muted-foreground mt-0.5">{portion}</p>}
                                {subs.length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs text-accent">
                                      <ArrowLeftRight size={12} />
                                      <span>Opções de substituição:</span>
                                    </div>
                                    {subs.map((sub, si) => (
                                      <div key={si} className="p-2 rounded-lg bg-card border border-border/50 ml-4">
                                        <p className="text-sm font-bold text-foreground">{sub.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {sub.displayPortion || (sub.quantity ? `${sub.quantity}${sub.unit || 'g'}` : sub.portion)}
                                        </p>
                                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                                          <span>{sub.calories}kcal</span>
                                          <span>P: {sub.protein}g</span>
                                          <span>C: {sub.carbs}g</span>
                                          <span>G: {sub.fat}g</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {meal.notes && (
                            <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex gap-2">
                              <MessageSquare size={14} className="text-accent shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-accent font-bold mb-0.5">Observação:</p>
                                <p className="text-xs text-muted-foreground">{meal.notes}</p>
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
