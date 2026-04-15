/**
 * Converts image URLs to displayable formats:
 * - Google Drive URLs → thumbnail endpoint
 * - Supabase Storage HEIC/HEIF/TIFF → render/image endpoint with webp conversion
 */
export function getDisplayableImageUrl(url: string): string {
  if (!url) return url;

  // Google Drive: convert open?id=XXX or file/d/XXX to thumbnail
  if (url.includes('drive.google.com')) {
    let fileId: string | undefined;

    // Format: drive.google.com/open?id=XXX
    const openMatch = url.match(/[?&]id=([^&]+)/);
    if (openMatch) fileId = openMatch[1];

    // Format: drive.google.com/file/d/XXX/...
    if (!fileId) {
      const fileMatch = url.match(/\/file\/d\/([^/]+)/);
      if (fileMatch) fileId = fileMatch[1];
    }

    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    }
  }

  // Supabase storage: convert unsupported formats via render endpoint
  const needsTransform = /\.(heic|heif|tiff?)$/i.test(url);
  const isSupabaseStorage = url.includes('/storage/v1/object/public/');

  if (needsTransform && isSupabaseStorage) {
    return url.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    ) + '?format=webp';
  }

  return url;
}
