import { supabase } from "@/integrations/supabase/client";

export interface PhotoEntry {
  label: string;
  url: string;
}

export type TimelineSource = "anamnese" | "reavaliação";

export interface TimelineEntry {
  date: string;
  source: TimelineSource;
  /** True only for the very first anamnese ever submitted by the user */
  isInitial?: boolean;
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

/** Validates that a photo URL is non-empty, well-formed, and not a known broken pattern */
function isValidPhotoUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed === "null" || trimmed === "undefined") return false;
  // Must look like a URL or path
  if (!/^(https?:\/\/|\/)/i.test(trimmed)) return false;
  return true;
}

/** Extract photos from a monthly_assessment record */
export function extractAssessmentPhotos(assessment: Record<string, any>): PhotoEntry[] {
  return ASSESSMENT_PHOTO_FIELDS
    .map((f) => ({ label: f.label, url: (assessment[f.key] as string) || "" }))
    .filter((p) => isValidPhotoUrl(p.url));
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
      if (isValidPhotoUrl(urlData.publicUrl)) {
        photos.push({
          label: mappedLabel || key.replace(/_/g, " "),
          url: urlData.publicUrl,
        });
      }
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
      if (!isValidPhotoUrl(url)) return false;
      if (filterPrivate && isPrivateGoogleDriveUrl(url)) return false;
      return true;
    })
    .map(([key, url]) => ({
      label: STORAGE_LABEL_MAP[key] || key.replace(/_/g, " "),
      url,
    }));
}

/** Get YYYY-MM-DD key for date-based grouping */
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Deduplicate photos within a single timeline entry by URL */
function dedupePhotos(photos: PhotoEntry[]): PhotoEntry[] {
  const seen = new Set<string>();
  const out: PhotoEntry[] = [];
  for (const p of photos) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);
    out.push(p);
  }
  return out;
}

/**
 * Build a complete photo timeline for a user.
 *
 * Single source of truth rules:
 * 1. Entries are grouped by calendar day. If the same day has both an
 *    anamnese and a monthly_assessment record, they are merged into ONE entry.
 * 2. When merged, the entry is labeled "reavaliação" (the active monthly cycle
 *    takes precedence over a same-day anamnese row).
 * 3. Anamnese records with zero valid photos are excluded entirely
 *    (prevents the "black squares" bug from empty/broken records).
 * 4. The earliest anamnese with photos is flagged `isInitial: true` so the
 *    UI can render a distinct "Anamnese Inicial" badge.
 *
 * Sorted by date descending.
 */
export async function buildPhotoTimeline(userId: string): Promise<TimelineEntry[]> {
  const buckets = new Map<string, TimelineEntry>();

  // 1. Monthly assessments
  const { data: assessments } = await supabase
    .from("monthly_assessments")
    .select("id, created_at, foto_frente, foto_costas, foto_lado_direito, foto_lado_esquerdo, foto_perfil_lado")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (assessments) {
    for (const a of assessments) {
      const photos = extractAssessmentPhotos(a as Record<string, any>);
      if (photos.length === 0) continue; // skip empty assessments
      const key = dayKey(a.created_at);
      const existing = buckets.get(key);
      if (existing) {
        existing.photos = dedupePhotos([...existing.photos, ...photos]);
        existing.source = "reavaliação";
      } else {
        buckets.set(key, {
          date: a.created_at,
          source: "reavaliação",
          photos,
        });
      }
    }
  }

  // 2. Anamnese records (oldest first so we can flag the initial one)
  const { data: anamneses } = await supabase
    .from("anamnese")
    .select("id, created_at, dados_extras")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  let initialAnamneseDay: string | null = null;

  if (anamneses) {
    for (const a of anamneses) {
      let photos = await fetchStorageBucketPhotos(userId, a.id);

      // Fallback: dados_extras.fotos
      if (photos.length === 0) {
        const extras = a.dados_extras as Record<string, any> | null;
        photos = extractDadosExtrasPhotos(extras, false);
      }

      if (photos.length === 0) continue; // skip anamneses with no real photos

      const key = dayKey(a.created_at);
      // Mark the first anamnese (chronologically) that actually has photos
      if (!initialAnamneseDay) initialAnamneseDay = key;

      const existing = buckets.get(key);
      if (existing) {
        // Merge into existing entry. Keep "reavaliação" label if it already
        // came from a monthly_assessment; otherwise stays "anamnese".
        existing.photos = dedupePhotos([...existing.photos, ...photos]);
      } else {
        buckets.set(key, {
          date: a.created_at,
          source: "anamnese",
          photos,
        });
      }
    }
  }

  // Apply "initial" flag (only if that day's entry is still labeled anamnese)
  if (initialAnamneseDay) {
    const initial = buckets.get(initialAnamneseDay);
    if (initial && initial.source === "anamnese") {
      initial.isInitial = true;
    }
  }

  const entries = Array.from(buckets.values()).filter((e) => e.photos.length > 0);
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
  source: TimelineSource;
  isInitial?: boolean;
} | null> {
  const timeline = await buildPhotoTimeline(userId);

  const reliable = timeline.find((e) =>
    e.photos.some((p) => !isPrivateGoogleDriveUrl(p.url))
  );
  if (reliable) return reliable;

  return timeline[0] || null;
}
