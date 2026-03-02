import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Download, Trash2, FileText, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExerciseItem } from "./ExerciseSelector";

interface Group {
  name: string;
  exercises: ExerciseItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentGroups: Group[];
  onLoadTemplate: (groups: Group[]) => void;
}

export default function TemplateManager({ open, onClose, currentGroups, onLoadTemplate }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [search, setSearch] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["training-templates", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("training_templates")
        .select("*")
        .eq("specialist_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  const saveTemplate = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("training_templates").insert({
        specialist_id: user.id,
        name,
        groups: currentGroups as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template salvo!");
      queryClient.invalidateQueries({ queryKey: ["training-templates"] });
      setSaveName("");
      setShowSave(false);
    },
    onError: () => toast.error("Erro ao salvar template"),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template excluído");
      queryClient.invalidateQueries({ queryKey: ["training-templates"] });
    },
  });

  const handleLoad = (groups: any) => {
    onLoadTemplate(groups as Group[]);
    toast.success("Template carregado!");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[hsl(var(--card))] border-[hsl(var(--glass-border))]">
        <DialogHeader>
          <DialogTitle className="gold-text-gradient font-cinzel">Templates de Treino</DialogTitle>
        </DialogHeader>

        {/* Save current as template */}
        {!showSave ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSave(true)}
            disabled={currentGroups.length === 0}
            className="w-full gap-2 border-[hsl(var(--glass-border))]"
          >
            <Save size={14} /> Salvar treino atual como template
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Nome do template (ex: ABC Padrão)"
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

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))]"
          />
        </div>

        {/* Templates list */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-center text-muted-foreground text-sm py-6">Carregando...</p>
            ) : (() => {
              const filtered = (templates ?? []).filter(t =>
                t.name.toLowerCase().includes(search.toLowerCase())
              );
              return filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">
                  {search ? "Nenhum template encontrado" : "Nenhum template salvo"}
                </p>
              ) : (
              filtered.map((t) => {
                const groups = Array.isArray(t.groups) ? t.groups : [];
                const totalExercises = groups.reduce(
                  (acc: number, g: any) => acc + (Array.isArray(g.exercises) ? g.exercises.length : 0),
                  0
                );
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
                          {groups.length} grupo(s) · {totalExercises} exercício(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleLoad(t.groups)}
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
              );
            })()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
