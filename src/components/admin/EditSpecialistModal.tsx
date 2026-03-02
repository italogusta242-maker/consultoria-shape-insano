import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  specialist: { userId: string; name: string; role: string; avatarUrl: string | null };
  onUpdated: () => void;
}

const ROLE_OPTIONS = [
  { value: "personal", label: "Preparador Físico" },
  { value: "nutricionista", label: "Nutricionista" },
];

export default function EditSpecialistModal({ open, onClose, specialist, onUpdated }: Props) {
  const [nome, setNome] = useState(specialist.name);
  const [role, setRole] = useState(
    specialist.role === "Nutricionista" ? "nutricionista" : "personal"
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update profile name
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ nome })
        .eq("id", specialist.userId);

      if (profileErr) throw profileErr;

      // Update role: remove old specialist roles, insert new one
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", specialist.userId)
        .in("role", ["especialista", "nutricionista", "personal"] as any);

      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: specialist.userId, role: role as any });

      if (roleErr) throw roleErr;

      toast.success("Especialista atualizado com sucesso!");
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + (err.message || "Tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-cinzel">Editar Especialista</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} className="bg-background border-border" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Função</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving || !nome.trim()} className="w-full gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
