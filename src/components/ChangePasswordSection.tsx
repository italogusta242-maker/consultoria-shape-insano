import { useState } from "react";
import { Lock, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChangePasswordSectionProps {
  variant?: "sheet" | "inline";
}

const ChangePasswordSection = ({ variant = "sheet" }: ChangePasswordSectionProps) => {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleSave = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      reset();
      setOpen(false);
    }
  };

  const form = (
    <div className="space-y-4 py-4">
      <div>
        <Label className="text-muted-foreground text-xs">Nova Senha</Label>
        <div className="relative mt-1">
          <Input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-secondary border-border pr-10"
            placeholder="Mínimo 6 caracteres"
          />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div>
        <Label className="text-muted-foreground text-xs">Confirmar Nova Senha</Label>
        <div className="relative mt-1">
          <Input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-secondary border-border pr-10"
            placeholder="Repita a nova senha"
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <Button onClick={handleSave} className="w-full" disabled={saving || !newPassword || !confirmPassword}>
        {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Lock size={16} className="mr-2" />}
        {saving ? "Salvando..." : "Alterar Senha"}
      </Button>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <KeyRound size={16} /> Alterar Senha
        </h3>
        {form}
      </div>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-foreground">Alterar Senha</SheetTitle>
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
      {/* Expose trigger */}
      <button className="hidden" id="change-password-trigger" onClick={() => setOpen(true)} />
    </>
  );
};

export const useChangePasswordTrigger = () => {
  const [open, setOpen] = useState(false);
  return { open, setOpen, ChangePasswordSheet: () => <ChangePasswordSheetInner open={open} onOpenChange={setOpen} /> };
};

const ChangePasswordSheetInner = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
  };

  const handleSave = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error("Erro ao alterar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-cinzel text-foreground">Alterar Senha</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-muted-foreground text-xs">Nova Senha</Label>
            <div className="relative mt-1">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-secondary border-border pr-10"
                placeholder="Mínimo 6 caracteres"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Confirmar Nova Senha</Label>
            <div className="relative mt-1">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-secondary border-border pr-10"
                placeholder="Repita a nova senha"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <Button onClick={handleSave} className="w-full" disabled={saving || !newPassword || !confirmPassword}>
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Lock size={16} className="mr-2" />}
            {saving ? "Salvando..." : "Alterar Senha"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChangePasswordSection;
