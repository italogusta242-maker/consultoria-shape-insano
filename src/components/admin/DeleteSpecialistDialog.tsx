import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  specialist: { userId: string; name: string };
  onDeleted: () => void;
}

export default function DeleteSpecialistDialog({ open, onClose, specialist, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Remove specialist roles
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", specialist.userId)
        .in("role", ["especialista", "nutricionista", "personal"] as any);

      // Remove student links
      await supabase
        .from("student_specialists")
        .delete()
        .eq("specialist_id", specialist.userId);

      // Update profile status to inativo
      await supabase
        .from("profiles")
        .update({ status: "inativo" })
        .eq("id", specialist.userId);

      toast.success(`${specialist.name} foi removido como especialista.`);
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao remover: " + (err.message || "Tente novamente"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover especialista?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso irá remover <strong>{specialist.name}</strong> da função de especialista, desvincular todos os alunos e inativar o perfil. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
