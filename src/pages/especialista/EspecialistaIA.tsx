/**
 * @purpose Page for specialists to train their AI assistant with their philosophy and style.
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Brain, Sparkles, Dumbbell, Target, Repeat, BookOpen, Upload, FileText, Trash2, ScrollText, Database, Loader2 } from "lucide-react";
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

function KnowledgeBaseStats({ specialistId }: { specialistId?: string }) {
  const { data: stats } = useQuery({
    queryKey: ["kb-stats", specialistId],
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_knowledge_base" as any)
        .select("*", { count: "exact", head: true })
        .eq("specialist_id", specialistId!);
      return count ?? 0;
    },
    enabled: !!specialistId,
  });

  if (!stats) return null;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20">
      <Database size={14} className="text-accent" />
      <span className="text-xs text-foreground font-medium">{stats} blocos vetorizados</span>
      <span className="text-[10px] text-muted-foreground">na base de conhecimento</span>
    </div>
  );
}

export default function EspecialistaIA() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    system_prompt: "",
    knowledge_base_pdf_path: "",
  });

  const [uploading, setUploading] = useState(false);
  const [processingKB, setProcessingKB] = useState(false);
  const textFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefs) {
      setForm({
        training_philosophy: prefs.training_philosophy || "",
        preferred_methods: prefs.preferred_methods || "",
        volume_preferences: prefs.volume_preferences || "",
        exercise_preferences: prefs.exercise_preferences || "",
        periodization_style: prefs.periodization_style || "",
        notes: prefs.notes || "",
        system_prompt: (prefs as any).system_prompt || "",
        knowledge_base_pdf_path: (prefs as any).knowledge_base_pdf_path || "",
      });
    }
  }, [prefs]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são aceitos.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 20MB.");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${user.id}/knowledge-base.pdf`;

      // Delete old file if exists
      await supabase.storage.from("ai-knowledge").remove([filePath]);

      const { error } = await supabase.storage
        .from("ai-knowledge")
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      setForm((prev) => ({ ...prev, knowledge_base_pdf_path: filePath }));
      toast.success("PDF enviado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar PDF");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePdf = async () => {
    if (!user || !form.knowledge_base_pdf_path) return;
    try {
      await supabase.storage.from("ai-knowledge").remove([form.knowledge_base_pdf_path]);
      setForm((prev) => ({ ...prev, knowledge_base_pdf_path: "" }));
      toast.success("PDF removido.");
    } catch {
      toast.error("Erro ao remover PDF");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const payload = { specialist_id: user.id, ...form };

      if (prefs) {
        const { specialist_id, ...updateData } = payload;
        const { error } = await supabase
          .from("specialist_ai_preferences")
          .update(updateData as any)
          .eq("specialist_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("specialist_ai_preferences")
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Preferências salvas! A IA vai gerar treinos no seu estilo.");
      queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar"),
  });

  const filledCount = Object.entries(form)
    .filter(([key]) => FIELDS.some((f) => f.key === key))
    .filter(([, v]) => v.trim().length > 20).length;

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

      {/* System Prompt */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-accent/30 bg-[hsl(var(--glass-bg))]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ScrollText size={16} className="text-accent" />
              Regras Mágicas da IA (System Prompt)
              {form.system_prompt.trim().length > 20 && (
                <span className="text-[10px] text-emerald-400 ml-auto">✓ Definido</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-[10px] text-muted-foreground mb-2">
              Este prompt será injetado diretamente como instrução principal da IA ao gerar treinos. Escreva exatamente como você quer que a IA se comporte.
            </p>
            <Textarea
              value={form.system_prompt}
              onChange={(e) => setForm((prev) => ({ ...prev, system_prompt: e.target.value }))}
              placeholder="Ex: 'Você é um preparador físico de elite especializado em bodybuilding natural. Sempre priorize exercícios compostos no início do treino, seguidos de isoladores. Nunca prescreva mais de 6 exercícios por sessão. Use rest-pause apenas para alunos avançados...'"
              className="min-h-[160px] text-sm bg-background/50 border-[hsl(var(--glass-border))] resize-y"
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Knowledge Base RAG Upload */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-accent/30 bg-[hsl(var(--glass-bg))]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Database size={16} className="text-accent" />
              Base de Conhecimento (RAG)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-[10px] text-muted-foreground mb-3">
              Envie um arquivo TXT ou MD com seu material de referência (livro, protocolo, apostila). 
              O sistema vai dividir em blocos, vetorizar e buscar automaticamente os trechos mais relevantes ao gerar treinos.
            </p>

            <KnowledgeBaseStats specialistId={user?.id} />

            <input
              ref={textFileInputRef}
              type="file"
              accept=".txt,.md,.text"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("O arquivo deve ter no máximo 5MB.");
                  return;
                }
                setProcessingKB(true);
                try {
                  const content = await file.text();
                  const { data, error } = await supabase.functions.invoke("process-knowledge-document", {
                    body: { content, clear_existing: true },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  toast.success(`Base de conhecimento processada! ${data.chunks_processed} blocos vetorizados.`);
                  queryClient.invalidateQueries({ queryKey: ["kb-stats"] });
                } catch (err: any) {
                  toast.error(err.message || "Erro ao processar documento");
                } finally {
                  setProcessingKB(false);
                  if (textFileInputRef.current) textFileInputRef.current.value = "";
                }
              }}
            />
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed border-[hsl(var(--glass-border))] mt-3"
              onClick={() => textFileInputRef.current?.click()}
              disabled={processingKB}
            >
              {processingKB ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processando... (pode levar até 2 min)
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Enviar arquivo TXT/MD
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Legacy PDF Upload */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText size={16} className="text-muted-foreground" />
              <span className="text-muted-foreground">PDF de Referência (legado)</span>
              {form.knowledge_base_pdf_path && (
                <span className="text-[10px] text-emerald-400 ml-auto">✓ Enviado</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-[10px] text-muted-foreground mb-3">
              PDF enviado diretamente ao Gemini. Funciona, mas o RAG acima é mais preciso e eficiente.
            </p>

            {form.knowledge_base_pdf_path ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <FileText size={20} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">knowledge-base.pdf</p>
                  <p className="text-[10px] text-muted-foreground">PDF ativo</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={handleRemovePdf}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-dashed border-[hsl(var(--glass-border))]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload size={14} />
                  {uploading ? "Enviando..." : "Selecionar PDF"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Existing preference fields */}
      <div className="grid gap-4">
        {FIELDS.map(({ key, label, icon: Icon, placeholder }, idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (idx + 2) * 0.05 }}
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
