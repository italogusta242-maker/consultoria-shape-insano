/**
 * Converts a Supabase Storage public URL to use the render/image endpoint
 * for server-side format conversion (handles HEIC, WEBP, etc.)
 * 
 * Pattern: /storage/v1/object/public/bucket/path → /storage/v1/render/image/public/bucket/path?format=webp
 */
export function getDisplayableImageUrl(url: string): string {
  if (!url) return url;
  
  // Only transform Supabase storage URLs with unsupported formats
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
