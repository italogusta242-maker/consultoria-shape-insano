import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Dumbbell, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface VolumeLimitsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
}

const defaultLimits = [
  { grupo: "Peito", min: 10, max: 20, regiao: "superior" },
  { grupo: "Costas", min: 10, max: 20, regiao: "superior" },
  { grupo: "Ombro", min: 10, max: 20, regiao: "superior" },
  { grupo: "Bíceps", min: 8, max: 16, regiao: "superior" },
  { grupo: "Tríceps", min: 8, max: 16, regiao: "superior" },
  { grupo: "Trapézio", min: 6, max: 14, regiao: "superior" },
  { grupo: "Antebraço", min: 4, max: 10, regiao: "superior" },
  { grupo: "Quadríceps", min: 10, max: 20, regiao: "inferior" },
  { grupo: "Posterior", min: 10, max: 20, regiao: "inferior" },
  { grupo: "Glúteos", min: 8, max: 16, regiao: "inferior" },
  { grupo: "Panturrilha", min: 6, max: 12, regiao: "inferior" },
  { grupo: "Abdômen", min: 6, max: 12, regiao: "inferior" },
  { grupo: "Core", min: 6, max: 12, regiao: "inferior" },
];

const VolumeLimitsEditor = ({ open, onOpenChange, studentId, studentName }: VolumeLimitsEditorProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [limits, setLimits] = useState(defaultLimits);
  const [synced, setSynced] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["volume-limits", studentId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volume_limits")
        .select("*")
        .eq("student_id", studentId)
        .eq("specialist_id", user!.id);
      if (error) throw error;

      // Merge saved values into defaults
      const merged = defaultLimits.map((d) => {
        const saved = (data ?? []).find((s) => s.muscle_group === d.grupo);
        return saved ? { ...d, min: saved.min_sets, max: saved.max_sets } : { ...d };
      });
      setLimits(merged);
      setSynced(true);
      return data;
    },
    enabled: open && !!user && !!studentId,
  });

  const updateLimit = (grupo: string, field: "min" | "max", value: string) => {
    const num = parseInt(value) || 0;
    setLimits((prev) =>
      prev.map((l) => (l.grupo === grupo ? { ...l, [field]: num } : l))
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const invalid = limits.find((l) => l.min >= l.max);
      if (invalid) throw new Error(`${invalid.grupo}: mínimo deve ser menor que máximo`);

      const rows = limits.map((l) => ({
        student_id: studentId,
        specialist_id: user.id,
        muscle_group: l.grupo,
        min_sets: l.min,
        max_sets: l.max,
      }));

      const { error } = await supabase
        .from("volume_limits")
        .upsert(rows, { onConflict: "student_id,specialist_id,muscle_group" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volume-limits", studentId] });
      toast.success(`Limites de volume salvos para ${studentName}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const superiorGroups = limits.filter((l) => l.regiao === "superior");
  const inferiorGroups = limits.filter((l) => l.regiao === "inferior");

  const GroupSection = ({ title, groups }: { title: string; groups: typeof limits }) => (
    <div>
      <h4 className="font-cinzel text-sm font-bold text-foreground mb-3">{title}</h4>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.grupo} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30">
            <span className="text-sm text-foreground w-24 shrink-0">{g.grupo}</span>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Min</span>
                <Input type="number" value={g.min} onChange={(e) => updateLimit(g.grupo, "min", e.target.value)} className="w-16 h-8 text-center text-sm bg-card border-border" min={0} max={50} />
              </div>
              <span className="text-muted-foreground text-xs">—</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Max</span>
                <Input type="number" value={g.max} onChange={(e) => updateLimit(g.grupo, "max", e.target.value)} className="w-16 h-8 text-center text-sm bg-card border-border" min={0} max={50} />
              </div>
              <span className="text-[10px] text-muted-foreground ml-auto">séries</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-lg flex items-center gap-2">
            <Dumbbell size={18} className="text-primary" />
            Volume Semanal — {studentName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Defina os limites mínimo e máximo de séries semanais por grupo muscular
          </p>
        </DialogHeader>
        <div className="space-y-5 mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : (
            <>
              <GroupSection title="Superior" groups={superiorGroups} />
              <div className="border-t border-border" />
              <GroupSection title="Inferior" groups={inferiorGroups} />
            </>
          )}
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading} className="w-full mt-4 gap-2">
          <Save size={16} />
          {saveMutation.isPending ? "Salvando..." : "Salvar Limites"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default VolumeLimitsEditor;
