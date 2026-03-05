/**
 * @purpose Modal to upload legacy photos for an existing anamnese record.
 * Uploads to anamnese-photos/{studentId}/{anamneseId}/ bucket following the same pattern as StudentPhotosPanel.
 */
import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2, ImagePlus } from "lucide-react";

interface Props {
  studentId: string;
  anamneseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PHOTO_SLOTS = [
  { key: "frente", label: "Frente" },
  { key: "costas", label: "Costas" },
  { key: "direito", label: "Lado Direito" },
  { key: "esquerdo", label: "Lado Esquerdo" },
  { key: "alcance", label: "Teste de Alcançar" },
] as const;

export default function LegacyPhotosUpload({ studentId, anamneseId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (slotKey: string, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são aceitas");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 10MB)");
      return;
    }
    setFiles((prev) => ({ ...prev, [slotKey]: file }));
    const url = URL.createObjectURL(file);
    setPreviews((prev) => ({ ...prev, [slotKey]: url }));
  };

  const removeFile = (slotKey: string) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setPreviews((prev) => {
      if (prev[slotKey]) URL.revokeObjectURL(prev[slotKey]);
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(files).filter(([, f]) => f !== null) as [string, File][];
      if (entries.length === 0) throw new Error("Nenhuma foto selecionada");

      const folderPath = `${studentId}/${anamneseId}`;

      for (const [slotKey, file] of entries) {
        const ext = file.name.split(".").pop() || "jpg";
        const filePath = `${folderPath}/${slotKey}.${ext}`;

        const { error } = await supabase.storage
          .from("anamnese-photos")
          .upload(filePath, file, { upsert: true, contentType: file.type });

        if (error) throw new Error(`Erro ao subir ${slotKey}: ${error.message}`);
      }

      return entries.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} foto(s) enviada(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["student-anamnese-photos", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-photo-timeline", studentId] });
      setFiles({});
      setPreviews({});
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar fotos");
    },
  });

  const selectedCount = Object.values(files).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-lg flex items-center gap-2">
            <ImagePlus size={18} className="text-[hsl(var(--gold))]" />
            Anexar Fotos Legadas
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Envie até 5 fotos para esta anamnese. Elas aparecerão na timeline de fotos do aluno.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PHOTO_SLOTS.map((slot) => {
            const hasFile = !!files[slot.key];
            const preview = previews[slot.key];

            return (
              <div
                key={slot.key}
                className="relative rounded-lg border-2 border-dashed border-border aspect-[3/4] flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                onClick={() => !hasFile && inputRefs.current[slot.key]?.click()}
              >
                {preview ? (
                  <>
                    <img src={preview} alt={slot.label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(slot.key);
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <p className="text-[10px] text-white text-center font-medium">{slot.label}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Camera size={20} className="text-muted-foreground mb-1" />
                    <p className="text-[10px] text-muted-foreground font-medium">{slot.label}</p>
                  </>
                )}
                <input
                  ref={(el) => { inputRefs.current[slot.key] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(slot.key, e.target.files?.[0] ?? null)}
                />
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploadMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={selectedCount === 0 || uploadMutation.isPending}
            className="gap-2"
          >
            {uploadMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Enviando...</>
            ) : (
              <><Upload size={14} /> Enviar {selectedCount} foto(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
