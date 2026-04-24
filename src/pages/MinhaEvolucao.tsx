import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ImageOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getDisplayableImageUrl } from "@/lib/imageUtils";
import SafeImage from "@/components/ui/SafeImage";
import { buildPhotoTimeline, type TimelineEntry } from "@/lib/photoTimeline";

const MinhaEvolucao = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: timeline, isLoading } = useQuery({
    queryKey: ["evolucao-timeline", user?.id],
    queryFn: () => buildPhotoTimeline(user!.id),
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
      ) : !timeline || timeline.length === 0 ? (
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
            Suas fotos das anamneses e reavaliações mensais aparecerão aqui para acompanhar seu progresso.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {timeline.map((entry, idx) => {
            const date = new Date(entry.date);

            return (
              <motion.div
                key={`${entry.source}-${entry.date}-${idx}`}
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
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    entry.source === "reavaliação"
                      ? "bg-primary/20 text-primary"
                      : entry.isInitial
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-accent/20 text-accent-foreground"
                  }`}>
                    {entry.source === "reavaliação"
                      ? "Reavaliação"
                      : entry.isInitial
                        ? "Anamnese Inicial"
                        : "Anamnese"}
                  </span>
                  {idx === 0 && (
                    <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Mais recente
                    </span>
                  )}
                </div>

                {/* Photo grid */}
                <div className="p-3 grid grid-cols-3 gap-2">
                  {entry.photos.map((photo) => (
                    <button
                      key={photo.label}
                      onClick={() => setSelectedImage(photo.url)}
                      className="relative aspect-[3/4] rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors group"
                    >
                      <SafeImage
                        src={photo.url}
                        alt={photo.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <span className="text-[9px] font-semibold text-white uppercase tracking-wider">
                          {photo.label}
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
              src={getDisplayableImageUrl(selectedImage)}
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
