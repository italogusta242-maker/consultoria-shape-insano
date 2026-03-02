import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Download, Trash2, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Meal {
  name: string;
  time: string;
  foods: { name: string; quantity: string; unit: string }[];
  notes: string;
  macros: { protein: number; carbs: number; fat: number; calories: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentMeals: Meal[];
  onLoadTemplate: (meals: Meal[]) => void;
}

// We reuse training_templates table with a naming convention prefix "DIETA:" to distinguish
// Or better, we create a dedicated table. But for now let's use a simple approach with
// training_templates since the structure (name, groups/meals as JSON, specialist_id) is identical.
// We'll store diet templates with a description starting with "[DIETA]" to distinguish them.

export default function DietTemplateManager({ open, onClose, currentMeals, onLoadTemplate }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["diet-templates-manager", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("diet_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        meals: (typeof t.meals === "string" ? JSON.parse(t.meals) : t.meals) as any[],
      }));
    },
    enabled: !!user && open,
  });

  const saveTemplate = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      // Calculate totals from current meals
      const totals = currentMeals.reduce(
        (acc, m) => {
          const macros = m.macros ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
          return {
            calories: acc.calories + (macros.calories ?? 0),
            protein: acc.protein + (macros.protein ?? 0),
            carbs: acc.carbs + (macros.carbs ?? 0),
            fat: acc.fat + (macros.fat ?? 0),
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const { error } = await supabase.from("diet_templates").insert({
        specialist_id: user.id,
        name,
        goal: "manutenção",
        total_calories: Math.round(totals.calories),
        total_protein: Math.round(totals.protein),
        total_carbs: Math.round(totals.carbs),
        total_fat: Math.round(totals.fat),
        meals: currentMeals as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template de dieta salvo!");
      queryClient.invalidateQueries({ queryKey: ["diet-templates"] });
      setSaveName("");
      setShowSave(false);
    },
    onError: () => toast.error("Erro ao salvar template"),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diet_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template excluído");
      queryClient.invalidateQueries({ queryKey: ["diet-templates"] });
    },
  });

  /** Convert diet_templates format → DietPlanEditor Meal format */
  const convertTemplateMeals = (rawMeals: any[]): Meal[] => {
    return (rawMeals ?? []).map((m: any) => {
      const foods = (m.foods ?? []).map((f: any) => ({
        name: f.name ?? "",
        quantity: f.portion ?? "",
        unit: "",
        baseMacros: {
          protein: f.protein ?? 0,
          carbs: f.carbs ?? 0,
          fat: f.fat ?? 0,
          calories: f.calories ?? 0,
          basePortion: 1,
        },
      }));
      const totalP = (m.foods ?? []).reduce((a: number, f: any) => a + (f.protein ?? 0), 0);
      const totalC = (m.foods ?? []).reduce((a: number, f: any) => a + (f.carbs ?? 0), 0);
      const totalF = (m.foods ?? []).reduce((a: number, f: any) => a + (f.fat ?? 0), 0);
      const totalCal = (m.foods ?? []).reduce((a: number, f: any) => a + (f.calories ?? 0), 0);
      return {
        name: m.name ?? "",
        time: m.time ?? "",
        foods,
        notes: m.notes ?? "",
        macros: {
          protein: Math.round(totalP),
          carbs: Math.round(totalC),
          fat: Math.round(totalF),
          calories: Math.round(totalCal),
        },
      };
    });
  };

  const handleLoad = (rawMeals: any) => {
    onLoadTemplate(convertTemplateMeals(rawMeals));
    toast.success("Template de dieta carregado!");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[hsl(var(--card))] border-[hsl(var(--glass-border))]">
        <DialogHeader>
          <DialogTitle className="gold-text-gradient font-cinzel">Templates de Dieta</DialogTitle>
        </DialogHeader>

        {!showSave ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSave(true)}
            disabled={currentMeals.length === 0}
            className="w-full gap-2 border-[hsl(var(--glass-border))]"
          >
            <Save size={14} /> Salvar dieta atual como template
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Nome (ex: Cutting 2000kcal)"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
            />
            <Button
              size="sm"
              disabled={!saveName.trim()}
              onClick={() => saveTemplate.mutate(saveName.trim())}
              className="gold-gradient text-[hsl(var(--obsidian))]"
            >
              Salvar
            </Button>
          </div>
        )}

        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-center text-muted-foreground text-sm py-6">Carregando...</p>
            ) : (templates ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">Nenhum template de dieta salvo</p>
            ) : (
              (templates ?? []).map((t) => {
                const meals = Array.isArray(t.meals) ? t.meals : [];
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-[hsl(var(--gold))]" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {meals.length} refeição(ões) · {t.total_calories ?? 0} kcal
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleLoad(t.meals)}
                        title="Carregar"
                      >
                        <Download size={14} className="text-[hsl(var(--forja-teal))]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteTemplate.mutate(t.id)}
                        title="Excluir"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
