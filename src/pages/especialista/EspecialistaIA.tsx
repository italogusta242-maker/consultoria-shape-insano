/**
 * @purpose Page for specialists to train their AI assistant with their philosophy and style.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Brain, Sparkles, Dumbbell, Target, Repeat, BookOpen } from "lucide-react";
import { motion } from "framer-motion";

const FIELDS = [
  {
    key: "training_philosophy",
    label: "Filosofia de Treino",
    icon: Brain,
    placeholder:
      "Descreva sua filosofia de treino. Ex: 'Priorizo hipertrofia com volume moderado-alto, foco em conexão mente-músculo, progressão de carga linear com deloads a cada 4 semanas...'",
  },
  {
    key: "preferred_methods",
    label: "Métodos Preferidos",
    icon: Sparkles,
    placeholder:
      "Quais métodos de treino você mais usa? Ex: 'Drop-sets para isoladores, rest-pause para compostos, myo-reps para posterior de coxa, bi-sets para braços...'",
  },
  {
    key: "volume_preferences",
    label: "Preferências de Volume",
    icon: Target,
    placeholder:
      "Como você distribui volume? Ex: 'Peito: 16-20 séries/semana, Costas: 18-22, Pernas: 14-18. Prefiro dividir em 2x frequência para grupos prioritários...'",
  },
  {
    key: "exercise_preferences",
    label: "Exercícios Preferidos",
    icon: Dumbbell,
    placeholder:
      "Exercícios que você sempre inclui ou evita. Ex: 'Sempre incluo supino inclinado com halteres, pull-ups, agachamento búlgaro. Evito leg press 45° para alunos com problemas de joelho...'",
  },
  {
    key: "periodization_style",
    label: "Estilo de Periodização",
    icon: Repeat,
    placeholder:
      "Como você estrutura mesociclos? Ex: '4 semanas de acúmulo + 1 deload. Progressão ondulada diária para intermediários, linear para iniciantes...'",
  },
  {
    key: "notes",
    label: "Notas Adicionais",
    icon: BookOpen,
    placeholder:
      "Qualquer outra informação que a IA deve saber sobre seu estilo. Ex: 'Sempre começo com aquecimento articular, incluo exercícios corretivos para alunos com desvios posturais, prefiro séries de 8-12 para hipertrofia...'",
  },
] as const;

export default function EspecialistaIA() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["ai-preferences", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("specialist_ai_preferences")
        .select("*")
        .eq("specialist_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    training_philosophy: "",
    preferred_methods: "",
    volume_preferences: "",
    exercise_preferences: "",
    periodization_style: "",
    notes: "",
  });

  useEffect(() => {
    if (prefs) {
      setForm({
        training_philosophy: prefs.training_philosophy || "",
        preferred_methods: prefs.preferred_methods || "",
        volume_preferences: prefs.volume_preferences || "",
        exercise_preferences: prefs.exercise_preferences || "",
        periodization_style: prefs.periodization_style || "",
        notes: prefs.notes || "",
      });
    }
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const payload = { specialist_id: user.id, ...form };

      if (prefs) {
        const { error } = await supabase
          .from("specialist_ai_preferences")
          .update(form)
          .eq("specialist_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("specialist_ai_preferences")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Preferências salvas! A IA vai gerar treinos no seu estilo.");
      queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const filledCount = Object.values(form).filter((v) => v.trim().length > 20).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-cinzel font-bold gold-text-gradient">🧠 Treinar a IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ensine a IA a pensar como você. Quanto mais detalhes, mais preciso será o plano gerado.
        </p>
      </div>

      {/* Progress indicator */}
      <Card className="border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Nível de treinamento da IA</span>
            <span className="text-xs font-bold text-accent">{filledCount}/{FIELDS.length} campos preenchidos</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(filledCount / FIELDS.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {filledCount === 0 && "A IA vai gerar treinos genéricos. Preencha os campos para personalizar."}
            {filledCount > 0 && filledCount < 4 && "Bom começo! Continue preenchendo para resultados mais próximos do seu estilo."}
            {filledCount >= 4 && filledCount < 6 && "Ótimo! A IA já tem uma boa base do seu estilo."}
            {filledCount === 6 && "🔥 Perfeito! A IA está calibrada para gerar treinos exatamente como você faria."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {FIELDS.map(({ key, label, icon: Icon, placeholder }, idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Icon size={16} className="text-accent" />
                  {label}
                  {form[key].trim().length > 20 && (
                    <span className="text-[10px] text-emerald-400 ml-auto">✓ Preenchido</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Textarea
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="min-h-[100px] text-sm bg-background/50 border-[hsl(var(--glass-border))] resize-y"
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="sticky bottom-4 z-10">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full gold-gradient text-[hsl(var(--obsidian))] font-bold gap-2 h-12 text-base shadow-lg"
        >
          <Save size={18} />
          {saveMutation.isPending ? "Salvando..." : "Salvar Preferências da IA"}
        </Button>
      </div>
    </div>
  );
}
