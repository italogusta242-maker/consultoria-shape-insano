import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Camera, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  studentId: string;
}

const PHOTO_FIELDS = [
  { key: "foto_frente", label: "Frente" },
  { key: "foto_costas", label: "Costas" },
  { key: "foto_lado_direito", label: "Lado D" },
  { key: "foto_lado_esquerdo", label: "Lado E" },
] as const;

// File names used in submitAnamnese upload (label param): frente, costas, direito, esquerdo, perfil, pose_frente, pose_lado, pose_costas
const STORAGE_LABEL_MAP: Record<string, string> = {
  frente: "Frente",
  costas: "Costas",
  direito: "Lado D",
  esquerdo: "Lado E",
  perfil: "Perfil",
  pose_frente: "Pose Frente",
  pose_lado: "Pose Lado",
  pose_costas: "Pose Costas",
  // Also handle old naming if any
  foto_frente: "Frente",
  foto_costas: "Costas",
  foto_lado_direito: "Lado D",
  foto_lado_esquerdo: "Lado E",
  foto_perfil_lado: "Perfil",
};

interface TimelineEntry {
  date: string;
  source: "anamnese" | "reavaliação";
  photos: { label: string; url: string }[];
}

export default function StudentPhotosPanel({ studentId }: Props) {
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Try monthly assessment first (latest)
  const { data: assessment, isLoading: loadingAssessment } = useQuery({
    queryKey: ["student-photos", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_assessments")
        .select("id, created_at, foto_frente, foto_costas, foto_lado_direito, foto_lado_esquerdo, peso, altura")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });

  const assessmentHasPhotos = assessment && PHOTO_FIELDS.some((f) => !!(assessment as any)[f.key]);

  // Fallback: fetch photos from anamnese storage bucket (latest)
  const { data: anamnesePhotos, isLoading: loadingAnamnese } = useQuery({
    queryKey: ["student-anamnese-photos", studentId],
    queryFn: async () => {
      const { data: anamnese, error } = await supabase
        .from("anamnese")
        .select("id, created_at")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !anamnese) return null;

      const folderPath = `${studentId}/${anamnese.id}`;
      const { data: files } = await supabase.storage
        .from("anamnese-photos")
        .list(folderPath);

      if (!files || files.length === 0) return null;

      const photos: { label: string; url: string }[] = [];
      for (const file of files) {
        const key = file.name.replace(/\.[^.]+$/, "");
        const mappedLabel = STORAGE_LABEL_MAP[key];
        if (mappedLabel || key) {
          const { data: urlData } = supabase.storage
            .from("anamnese-photos")
            .getPublicUrl(`${folderPath}/${file.name}`);
          photos.push({
            label: mappedLabel || key.replace(/_/g, " "),
            url: urlData.publicUrl,
          });
        }
      }

      return { photos, date: anamnese.created_at, source: "anamnese" as const };
    },
    enabled: !!studentId && !assessmentHasPhotos && !loadingAssessment,
  });

  // Timeline: all assessments + all anamnese photos
  const { data: timeline, isLoading: loadingTimeline } = useQuery({
    queryKey: ["student-photo-timeline", studentId],
    queryFn: async () => {
      const entries: TimelineEntry[] = [];

      // 1. All monthly assessments with photos
      const { data: assessments } = await supabase
        .from("monthly_assessments")
        .select("id, created_at, foto_frente, foto_costas, foto_lado_direito, foto_lado_esquerdo")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false });

      if (assessments) {
        for (const a of assessments) {
          const photos = PHOTO_FIELDS
            .map((f) => ({ label: f.label, url: (a as any)[f.key] as string | null }))
            .filter((p) => !!p.url) as { label: string; url: string }[];
          if (photos.length > 0) {
            entries.push({ date: a.created_at, source: "reavaliação", photos });
          }
        }
      }

      // 2. All anamnese with photos in storage
      const { data: anamneses } = await supabase
        .from("anamnese")
        .select("id, created_at")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false });

      if (anamneses) {
        for (const a of anamneses) {
          const folderPath = `${studentId}/${a.id}`;
          const { data: files } = await supabase.storage
            .from("anamnese-photos")
            .list(folderPath);

      if (files && files.length > 0) {
        const photos: { label: string; url: string }[] = [];
        for (const file of files) {
          const key = file.name.replace(/\.[^.]+$/, "");
          const mappedLabel = STORAGE_LABEL_MAP[key];
          if (mappedLabel || key) {
            const { data: urlData } = supabase.storage
              .from("anamnese-photos")
              .getPublicUrl(`${folderPath}/${file.name}`);
            photos.push({
              label: mappedLabel || key.replace(/_/g, " "),
              url: urlData.publicUrl,
            });
          }
            }
            if (photos.length > 0) {
              entries.push({ date: a.created_at, source: "anamnese", photos });
            }
          }
        }
      }

      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return entries;
    },
    enabled: timelineOpen && !!studentId,
  });

  const isLoading = loadingAssessment || (loadingAnamnese && !assessmentHasPhotos);

  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;

  const renderPhotoGrid = (photos: { label: string; url: string | null }[]) => (
    <div className="grid grid-cols-4 gap-2">
      {photos.filter((p) => !!p.url).map((p) => {
        // Append transform query to resize large images for thumbnails
        const thumbUrl = p.url! + (p.url!.includes('?') ? '&' : '?') + 'width=300&height=400&resize=contain';
        return (
          <div
            key={p.label}
            className="cursor-pointer group relative rounded-lg overflow-hidden border border-[hsl(var(--glass-border))] aspect-[3/4]"
            onClick={() => setZoomUrl(p.url)}
          >
            <img
              src={thumbUrl}
              alt={p.label}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1">
              <p className="text-[9px] text-white text-center font-medium capitalize">{p.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Determine current photos to show
  let currentContent: React.ReactNode = null;
  let hasAnyPhotos = false;

  if (assessmentHasPhotos) {
    const photos = PHOTO_FIELDS
      .map((f) => ({ label: f.label, url: (assessment as any)[f.key] as string | null }))
      .filter((p) => !!p.url);
    hasAnyPhotos = photos.length > 0;
    currentContent = (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Última Reavaliação · {new Date(assessment!.created_at).toLocaleDateString("pt-BR")}
          </p>
          {(assessment!.peso || assessment!.altura) && (
            <p className="text-[10px] text-muted-foreground">
              {assessment!.peso && `${assessment!.peso}kg`} {assessment!.altura && `· ${assessment!.altura}cm`}
            </p>
          )}
        </div>
        {renderPhotoGrid(photos)}
      </div>
    );
  } else if (anamnesePhotos && anamnesePhotos.photos.length > 0) {
    hasAnyPhotos = true;
    currentContent = (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Anamnese · {new Date(anamnesePhotos.date).toLocaleDateString("pt-BR")}
          </p>
        </div>
        {renderPhotoGrid(anamnesePhotos.photos)}
      </div>
    );
  }

  return (
    <>
      {currentContent || (
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
          {zoomUrl && <img src={zoomUrl} alt="Foto ampliada" className="w-full h-auto rounded" />}
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
                {/* Timeline line */}
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

                <div className="space-y-6">
                  {timeline.map((entry, idx) => (
                    <div key={idx} className="relative pl-8">
                      {/* Timeline dot */}
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
