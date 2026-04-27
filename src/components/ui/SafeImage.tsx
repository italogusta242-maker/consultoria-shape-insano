import { useState } from "react";
import { ImageOff } from "lucide-react";
import { getDisplayableImageUrl } from "@/lib/imageUtils";
import { isPrivateGoogleDriveUrl } from "@/lib/photoTimeline";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/**
 * Image component that handles broken/private images gracefully.
 * Shows fallback when:
 *   1. No src / empty string
 *   2. onError fires (network / 404)
 *   3. Image loads but has 0x0 dimensions
 */
export default function SafeImage({ src, alt, className = "", loading = "lazy" }: SafeImageProps) {
  const [error, setError] = useState(false);
  const isLegacy = isPrivateGoogleDriveUrl(src);

  if (error || !src || src.trim() === "") {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted/50 ${className}`}>
        <ImageOff size={16} className="text-muted-foreground/40 mb-1" />
        <span className="text-[8px] text-muted-foreground/60 text-center px-1">
          {isLegacy ? "Foto legada" : "Indisponível"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={getDisplayableImageUrl(src)}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => setError(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          setError(true);
        }
      }}
    />
  );
}
