/**
 * @purpose Shared timeline component for viewing & restoring plan version history.
 * Used by TrainingPlanEditor and DietPlanEditor.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Version {
  id: string;
  version_number: number;
  saved_at: string;
  title: string;
  // Training-specific
  groups?: any;
  total_sessions?: number;
  avaliacao_postural?: string | null;
  objetivo_mesociclo?: string | null;
  pontos_melhoria?: string | null;
  // Diet-specific
  meals?: any;
  goal?: string;
  goal_description?: string | null;
}

interface Props {
  planId: string | undefined;
  type: "training" | "diet";
  open: boolean;
  onClose: () => void;
  onRestore: (version: Version) => void;
}

export default function PlanVersionTimeline({ planId, type, open, onClose, onRestore }: Props) {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const tableName = type === "training" ? "training_plan_versions" : "diet_plan_versions";

  const { data: versions, isLoading } = useQuery({
    queryKey: [tableName, planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("plan_id", planId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
    enabled: open && !!planId,
  });

  const handleRestore = (version: Version) => {
    onRestore(version);
    toast.success(`Versão ${version.version_number} restaurada!`);
    onClose();
  };

  const renderTrainingSummary = (v: Version) => {
    const groups = v.groups as any[] | undefined;
    if (!groups?.length) return <p className="text-xs text-muted-foreground">Sem grupos</p>;
    return (
      <div className="space-y-1">
        {groups.map((g: any, i: number) => (
          <div key={i} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{g.name}</span>
            {" — "}
            {(g.exercises?.length ?? 0)} exercícios
          </div>
        ))}
        {v.objetivo_mesociclo && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">📋 {v.objetivo_mesociclo}</p>
        )}
      </div>
    );
  };

  const renderDietSummary = (v: Version) => {
    const meals = v.meals as any[] | undefined;
    if (!meals?.length) return <p className="text-xs text-muted-foreground">Sem refeições</p>;
    const isAlt = (name: string) => /[–\-]\s*Op[çc][ãa]o\s*[2-9]/i.test(name);
    const totalCals = meals.filter((m: any) => !isAlt(m.name)).reduce((sum: number, m: any) => sum + (m.macros?.calories ?? 0), 0);
    return (
      <div className="space-y-1">
        {meals.map((m: any, i: number) => (
          <div key={i} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{m.name}</span>
            {m.macros?.calories ? ` — ${m.macros.calories}kcal` : ""}
          </div>
        ))}
        {totalCals > 0 && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">Total: {totalCals}kcal</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] p-0 bg-card border-border overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="font-cinzel text-foreground flex items-center gap-2">
            <History size={18} /> Histórico de Versões
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cada alteração salva gera uma versão automática. Restaure para aplicar no plano atual.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-4 pb-4">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !versions?.length ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Nenhuma versão anterior encontrada.
              <p className="text-xs text-muted-foreground/60 mt-1">O histórico será criado automaticamente na próxima edição.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-4 bottom-4 w-px bg-border" />

              <div className="space-y-3">
                {versions.map((v) => {
                  const isExpanded = expandedVersion === v.id;
                  return (
                    <div key={v.id} className="relative pl-8">
                      {/* Timeline dot */}
                      <div className={cn(
                        "absolute left-1.5 top-3 w-3 h-3 rounded-full border-2 border-card",
                        v.version_number === versions[0]?.version_number
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      )} />

                      <div className={cn(
                        "rounded-lg border p-3 transition-all",
                        isExpanded ? "bg-secondary/50 border-primary/30" : "bg-card border-border hover:border-border/80"
                      )}>
                        {/* Header */}
                        <button
                          onClick={() => setExpandedVersion(isExpanded ? null : v.id)}
                          className="w-full flex items-center justify-between text-left"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">
                                v{v.version_number}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(v.saved_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{v.title}</p>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-3">
                            <div className="rounded-lg bg-background/50 border border-border p-3">
                              {type === "training" ? renderTrainingSummary(v) : renderDietSummary(v)}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleRestore(v)}
                              className="w-full gap-1.5 gold-gradient text-[hsl(var(--obsidian))] font-medium"
                            >
                              <RotateCcw size={14} /> Restaurar esta versão
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
