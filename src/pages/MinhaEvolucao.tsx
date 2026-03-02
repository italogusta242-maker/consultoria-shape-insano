import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ImageOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const photoLabels: Record<string, string> = {
  frente: "Frente",
  costas: "Costas",
  direito: "Lado Direito",
  esquerdo: "Lado Esquerdo",
  perfil: "Perfil",
  pose_frente: "Pose Frente",
  pose_lado: "Pose Lado",
  pose_costas: "Pose Costas",
};

const photoKeys = ["frente", "costas", "direito", "esquerdo", "perfil", "pose_frente", "pose_lado", "pose_costas"];

const MinhaEvolucao = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: anamneseComFotos, isLoading } = useQuery({
    queryKey: ["anamneses-evolucao", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Get all anamneses
      const { data: anamneses, error } = await supabase
        .from("anamnese")
        .select("id, created_at, dados_extras")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!anamneses?.length) return [];

      // For each anamnese, check for photos in dados_extras OR in storage
      const results = await Promise.all(
        anamneses.map(async (a) => {
          const extras = a.dados_extras as Record<string, any> | null;
          
          // First check dados_extras.fotos
          if (extras?.fotos && Object.keys(extras.fotos).length > 0) {
            return { ...a, fotos: extras.fotos as Record<string, string> };
          }

          // Fallback: check storage bucket for photos
          const folderPath = `${user.id}/${a.id}`;
          const { data: files } = await supabase.storage
            .from("anamnese-photos")
            .list(folderPath);

          if (files && files.length > 0) {
            const fotos: Record<string, string> = {};
            for (const file of files) {
              const key = file.name.replace(/\.[^.]+$/, ""); // remove extension
              if (photoKeys.includes(key)) {
                const { data: urlData } = supabase.storage
                  .from("anamnese-photos")
                  .getPublicUrl(`${folderPath}/${file.name}`);
                fotos[key] = urlData.publicUrl;
              }
            }
            if (Object.keys(fotos).length > 0) {
              return { ...a, fotos };
            }
          }

          return null;
        })
      );

      return results.filter(Boolean) as Array<{ id: string; created_at: string; fotos: Record<string, string> }>;
    },
    enabled: !!user,
  });

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pt-2">
        <button onClick={() => navigate("/perfil")} className="p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h1 className="font-cinzel text-xl font-bold text-foreground">MINHA EVOLUÇÃO</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-card rounded-xl border border-border animate-pulse" />
          ))}
        </div>
      ) : !anamneseComFotos || anamneseComFotos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-8 flex flex-col items-center gap-3 text-center"
        >
          <ImageOff size={40} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhuma foto de evolução ainda.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Suas fotos das anamneses mensais aparecerão aqui para acompanhar seu progresso.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {anamneseComFotos.map((anamnese, idx) => {
            const fotos = anamnese.fotos || {};
            const date = new Date(anamnese.created_at);

            return (
              <motion.div
                key={anamnese.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                {/* Month header */}
                <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-secondary/30">
                  <Calendar size={16} className="text-primary" />
                  <span className="font-cinzel font-bold text-sm text-foreground">
                    {format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                  </span>
                  {idx === 0 && (
                    <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Mais recente
                    </span>
                  )}
                </div>

                {/* Photo grid */}
                <div className="p-3 grid grid-cols-3 gap-2">
                  {Object.entries(fotos).map(([key, url]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedImage(url)}
                      className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors group"
                    >
                      <img
                        src={url}
                        alt={photoLabels[key] || key}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <span className="text-[9px] font-semibold text-white uppercase tracking-wider">
                          {photoLabels[key] || key}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Fullscreen image dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Foto de evolução"
              className="w-full h-full object-contain max-h-[90vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MinhaEvolucao;
