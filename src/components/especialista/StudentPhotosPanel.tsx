import { useQuery } from "@tanstack/react-query";
import { Camera, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import SafeImage from "@/components/ui/SafeImage";
import { getDisplayableImageUrl } from "@/lib/imageUtils";
import {
  findLatestPhotos,
  buildPhotoTimeline,
  type PhotoEntry,
  type TimelineEntry,
} from "@/lib/photoTimeline";

interface Props {
  studentId: string;
}

export default function StudentPhotosPanel({ studentId }: Props) {
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Latest photos (from any source)
  const { data: latestPhotos, isLoading } = useQuery({
    queryKey: ["student-latest-photos", studentId],
    queryFn: () => findLatestPhotos(studentId),
    enabled: !!studentId,
  });

  // Full timeline (lazy-loaded when dialog opens)
  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["student-photo-timeline", studentId],
    queryFn: () => buildPhotoTimeline(studentId),
    enabled: timelineOpen && !!studentId,
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  const renderPhotoGrid = (photos: PhotoEntry[]) => (
    <div className="grid grid-cols-4 gap-2">
      {photos.filter((p) => !!p.url).map((p) => (
        <div
          key={p.label}
          className="cursor-pointer group relative rounded-lg overflow-hidden border border-[hsl(var(--glass-border))] aspect-[3/4]"
          onClick={() => setZoomUrl(p.url)}
        >
          <SafeImage
            src={p.url}
            alt={p.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1">
            <p className="text-[9px] text-white text-center font-medium capitalize">{p.label}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {latestPhotos ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {latestPhotos.source === "reavaliação" ? "Última Reavaliação" : "Anamnese"} · {new Date(latestPhotos.date).toLocaleDateString("pt-BR")}
            </p>
          </div>
          {renderPhotoGrid(latestPhotos.photos)}
        </div>
      ) : (
        <div className="text-center text-xs text-muted-foreground py-3 flex flex-col items-center gap-1">
          <Camera size={16} className="opacity-50" />
          Nenhuma foto disponível
        </div>
      )}

      {/* Timeline button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTimelineOpen(true)}
        className="w-full text-[10px] gap-1 text-muted-foreground hover:text-foreground mt-2"
      >
        <History size={12} />
        Ver Timeline de Fotos
      </Button>

      {/* Zoom dialog */}
      <Dialog open={!!zoomUrl} onOpenChange={() => setZoomUrl(null)}>
        <DialogContent className="max-w-lg p-1 bg-black/90 border-none">
          {zoomUrl && <img src={getDisplayableImageUrl(zoomUrl)} alt="Foto ampliada" className="w-full h-auto rounded" />}
        </DialogContent>
      </Dialog>

      {/* Timeline dialog */}
      <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 bg-card border-border">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="font-cinzel text-lg flex items-center gap-2">
              <History size={18} className="text-primary" />
              Timeline de Fotos
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[70vh]">
            {loadingTimeline ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
              </div>
            ) : !timeline || timeline.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12 flex flex-col items-center gap-2">
                <Camera size={24} className="opacity-40" />
                <p>Nenhuma foto encontrada para este aluno.</p>
                <p className="text-xs">As fotos aparecerão aqui quando o aluno enviar anamneses ou reavaliações com fotos.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                <div className="space-y-6">
                  {timeline.map((entry, idx) => (
                    <div key={idx} className="relative pl-8">
                      <div className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 ${
                        entry.source === "reavaliação"
                          ? "bg-primary border-primary"
                          : "bg-accent border-accent"
                      }`} />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-foreground">
                            {new Date(entry.date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                            entry.source === "reavaliação"
                              ? "bg-primary/20 text-primary"
                              : "bg-accent/20 text-accent-foreground"
                          }`}>
                            {entry.source === "reavaliação" ? "Reavaliação" : "Anamnese"}
                          </span>
                        </div>
                        {renderPhotoGrid(entry.photos)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
