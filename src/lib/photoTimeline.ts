import { supabase } from "@/integrations/supabase/client";

export interface PhotoEntry {
  label: string;
  url: string;
}

export interface TimelineEntry {
  date: string;
  source: "anamnese" | "reavaliação";
  photos: PhotoEntry[];
}

const ASSESSMENT_PHOTO_FIELDS = [
  { key: "foto_frente", label: "Frente" },
  { key: "foto_costas", label: "Costas" },
  { key: "foto_lado_direito", label: "Lado D" },
  { key: "foto_lado_esquerdo", label: "Lado E" },
  { key: "foto_perfil_lado", label: "Perfil" },
] as const;

const STORAGE_LABEL_MAP: Record<string, string> = {
  frente: "Frente",
  costas: "Costas",
  direito: "Lado D",
  esquerdo: "Lado E",
  perfil: "Perfil",
  pose_frente: "Pose Frente",
  pose_lado: "Pose Lado",
  pose_costas: "Pose Costas",
  foto_frente: "Frente",
  foto_costas: "Costas",
  foto_lado_direito: "Lado D",
  foto_lado_esquerdo: "Lado E",
  foto_perfil_lado: "Perfil",
};

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|heic|heif|gif|tiff?)$/i;

/** Check if a URL is a private Google Drive link (unreliable for display) */
export function isPrivateGoogleDriveUrl(url: string): boolean {
  return url.includes("drive.google.com");
}

/** Extract photos from a monthly_assessment record */
export function extractAssessmentPhotos(assessment: Record<string, any>): PhotoEntry[] {
  return ASSESSMENT_PHOTO_FIELDS
    .map((f) => ({ label: f.label, url: (assessment[f.key] as string) || "" }))
    .filter((p) => !!p.url);
}

/** Fetch photos from the anamnese-photos storage bucket for a given folder */
async function fetchStorageBucketPhotos(userId: string, anamneseId: string): Promise<PhotoEntry[]> {
  const folderPath = `${userId}/${anamneseId}`;
  const { data: files } = await supabase.storage
    .from("anamnese-photos")
    .list(folderPath);

  const validFiles = (files || []).filter((f) => IMAGE_EXT.test(f.name));
  const photos: PhotoEntry[] = [];

  for (const file of validFiles) {
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

  return photos;
}

/** Extract photos from dados_extras.fotos, filtering out private Drive links */
function extractDadosExtrasPhotos(extras: Record<string, any> | null, filterPrivate = false): PhotoEntry[] {
  if (!extras?.fotos || typeof extras.fotos !== "object") return [];
  const fotosObj = extras.fotos as Record<string, string>;
  return Object.entries(fotosObj)
    .filter(([, url]) => {
      if (!url) return false;
      if (filterPrivate && isPrivateGoogleDriveUrl(url)) return false;
      return true;
    })
    .map(([key, url]) => ({
      label: STORAGE_LABEL_MAP[key] || key.replace(/_/g, " "),
      url,
    }));
}

/**
 * Build a complete photo timeline for a user, combining:
 * 1. All monthly_assessments with photos
 * 2. All anamnese records (storage bucket + dados_extras fallback)
 * 
 * Sorted by date descending.
 */
export async function buildPhotoTimeline(userId: string): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  // 1. All monthly assessments with photos
  const { data: assessments } = await supabase
    .from("monthly_assessments")
    .select("id, created_at, foto_frente, foto_costas, foto_lado_direito, foto_lado_esquerdo, foto_perfil_lado")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (assessments) {
    for (const a of assessments) {
      const photos = extractAssessmentPhotos(a as Record<string, any>);
      if (photos.length > 0) {
        entries.push({ date: a.created_at, source: "reavaliação", photos });
      }
    }
  }

  // 2. All anamnese records
  const { data: anamneses } = await supabase
    .from("anamnese")
    .select("id, created_at, dados_extras")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (anamneses) {
    for (const a of anamneses) {
      // Try storage bucket first
      let photos = await fetchStorageBucketPhotos(userId, a.id);

      // Fallback: dados_extras.fotos (include Drive links for legacy display)
      if (photos.length === 0) {
        const extras = a.dados_extras as Record<string, any> | null;
        photos = extractDadosExtrasPhotos(extras, false);
      }

      if (photos.length > 0) {
        entries.push({ date: a.created_at, source: "anamnese", photos });
      }
    }
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return entries;
}

/**
 * Find the latest entry with real displayable photos.
 * Prioritizes entries with non-Google-Drive URLs.
 */
export async function findLatestPhotos(userId: string): Promise<{
  photos: PhotoEntry[];
  date: string;
  source: "anamnese" | "reavaliação";
} | null> {
  const timeline = await buildPhotoTimeline(userId);
  
  // First pass: find entry with at least one non-Drive photo
  const reliable = timeline.find((e) =>
    e.photos.some((p) => !isPrivateGoogleDriveUrl(p.url))
  );
  if (reliable) return reliable;

  // Second pass: return any entry (even with Drive links)
  return timeline[0] || null;
}
