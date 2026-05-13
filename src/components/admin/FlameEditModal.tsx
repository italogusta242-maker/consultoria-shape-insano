import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Snowflake, Skull, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FlameState = "normal" | "ativa" | "tregua" | "extinta";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userName?: string;
  onSaved?: (next: { state: FlameState; streak: number }) => void;
}

const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const FlameEditModal = ({ open, onOpenChange, userId, userName, onSaved }: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<FlameState>("normal");
  const [streak, setStreak] = useState<number>(0);
  const [lastApproved, setLastApproved] = useState<string>("");

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    supabase
      .from("flame_status")
      .select("state, streak, last_approved_date")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setState(((data?.state as FlameState) || "normal") as FlameState);
        setStreak(data?.streak ?? 0);
        setLastApproved(data?.last_approved_date || toLocalDate(new Date()));
      })
      .then(() => setLoading(false));
  }, [open, userId]);

  const save = async (overrides?: Partial<{ state: FlameState; streak: number; last_approved_date: string }>) => {
    if (!userId) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      state: overrides?.state ?? state,
      streak: overrides?.streak ?? streak,
      last_approved_date: overrides?.last_approved_date ?? lastApproved,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("flame_status")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar Chama: " + error.message);
      return;
    }
    toast.success("Chama atualizada");
    onSaved?.({ state: payload.state, streak: payload.streak });
    onOpenChange(false);
  };

  const extinguir = () =>
    save({ state: "extinta", streak: 0, last_approved_date: toLocalDate(new Date()) });

  const congelar = () =>
    save({ state: "tregua", last_approved_date: toLocalDate(new Date()) });

  const acender = () =>
    save({ state: "ativa", last_approved_date: toLocalDate(new Date()) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-cinzel flex items-center gap-2">
            <Flame size={18} className="text-orange-400" />
            Editar Chama {userName ? `— ${userName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Ajuste o estado, dias acumulados ou aplique uma ação rápida.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" onClick={acender} disabled={saving} className="flex flex-col h-auto py-2 gap-1 border-orange-500/40 hover:bg-orange-500/10">
                <Flame size={16} className="text-orange-400" />
                <span className="text-[11px]">Acender</span>
              </Button>
              <Button type="button" variant="outline" onClick={congelar} disabled={saving} className="flex flex-col h-auto py-2 gap-1 border-blue-500/40 hover:bg-blue-500/10">
                <Snowflake size={16} className="text-blue-400" />
                <span className="text-[11px]">Congelar</span>
              </Button>
              <Button type="button" variant="outline" onClick={extinguir} disabled={saving} className="flex flex-col h-auto py-2 gap-1 border-destructive/40 hover:bg-destructive/10">
                <Skull size={16} className="text-destructive" />
                <span className="text-[11px]">Extinguir</span>
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={state} onValueChange={(v) => setState(v as FlameState)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal (sem chama)</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="tregua">Trégua (congelada)</SelectItem>
                  <SelectItem value="extinta">Extinta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dias acumulados (streak)</Label>
              <Input
                type="number"
                min={0}
                value={streak}
                onChange={(e) => setStreak(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="space-y-2">
              <Label>Última data aprovada</Label>
              <Input
                type="date"
                value={lastApproved}
                onChange={(e) => setLastApproved(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => save()} disabled={saving || loading}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FlameEditModal;
