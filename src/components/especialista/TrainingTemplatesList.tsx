/**
 * @purpose List, search and manage training templates with exercise details.
 * @dependencies TemplateManager (for save/load inside editor), supabase, react-query.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Trash2, Eye, Search, Dumbbell, Video } from "lucide-react";


interface TrainingTemplate {
  id: string;
  name: string;
  description: string | null;
  groups: any[];
  specialist_id: string;
  created_at: string;
  updated_at: string;
}

const TrainingTemplatesList = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<TrainingTemplate | null>(null);
  const [search, setSearch] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["training-templates-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("training_templates")
        .select("*")
        .eq("specialist_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        groups: Array.isArray(t.groups) ? t.groups : [],
      })) as TrainingTemplate[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template removido");
      queryClient.invalidateQueries({ queryKey: ["training-templates"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });


  const filtered = (templates ?? []).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
  });

  const getTemplateStats = (groups: any[]) => {
    const totalExercises = groups.reduce(
      (acc: number, g: any) => acc + (Array.isArray(g.exercises) ? g.exercises.length : 0),
      0
    );
    const muscleGroups = new Set<string>();
    groups.forEach((g: any) => {
      (g.exercises ?? []).forEach((ex: any) => {
        if (ex.muscle_group) muscleGroups.add(ex.muscle_group);
      });
    });
    return { totalExercises, muscleGroups: Array.from(muscleGroups) };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {filtered.length} template{filtered.length !== 1 ? "s" : ""} · Crie templates no Editor de Treinos
          </p>
        </div>

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
            const stats = getTemplateStats(tpl.groups);
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
                    <Badge variant="outline" className="shrink-0 text-[10px] gap-1 bg-[hsl(var(--forja-teal)/0.15)] text-[hsl(var(--forja-teal))] border-[hsl(var(--forja-teal)/0.3)]">
                      <Dumbbell size={10} />
                      {tpl.groups.length} grupo(s)
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-secondary/30 rounded-md p-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase">Grupos</p>
                      <p className="text-sm font-bold text-accent">{tpl.groups.length}</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md p-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase">Exercícios</p>
                      <p className="text-sm font-bold text-foreground">{stats.totalExercises}</p>
                    </div>
                  </div>

                  {/* Group names */}
                  <div className="flex flex-wrap gap-1">
                    {tpl.groups.map((g: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] border-[hsl(var(--glass-border))] text-muted-foreground">
                        {g.name}
                      </Badge>
                    ))}
                  </div>

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

              <div className="space-y-4 mt-2">
                {selectedTemplate.groups.map((group: any, gi: number) => (
                  <div key={gi} className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Dumbbell size={14} className="text-[hsl(var(--forja-teal))]" />
                      {group.name}
                    </h4>
                    <div className="bg-secondary/20 rounded-lg p-3 space-y-1.5">
                      {(group.exercises ?? []).map((ex: any, ei: number) => (
                        <div key={ei} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-foreground">{ex.name}</span>
                            {ex.videoId && (
                              <Video size={10} className="text-[hsl(var(--forja-teal))] shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground text-[10px] shrink-0 ml-2">
                            <span>{ex.sets}×{ex.reps}</span>
                            {ex.rest && <span>⏱ {ex.rest}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default TrainingTemplatesList;
