import { useState } from "react";
import { ImageOff, AlertTriangle } from "lucide-react";
import { getDisplayableImageUrl } from "@/lib/imageUtils";
import { isPrivateGoogleDriveUrl } from "@/lib/photoTimeline";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/** Sample the rendered image and return true if it's a single solid color
 *  (the "all-black" symptom of a failed HEIC upload). */
function detectMonochrome(img: HTMLImageElement): boolean {
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return false;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const samples = 16;
    const stepX = Math.max(1, Math.floor(w / samples));
    const stepY = Math.max(1, Math.floor(h / samples));
    const data = ctx.getImageData(0, 0, w, h).data;
    let firstR = -1, firstG = -1, firstB = -1;
    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (firstR === -1) { firstR = r; firstG = g; firstB = b; continue; }
        if (Math.abs(r - firstR) > 6 || Math.abs(g - firstG) > 6 || Math.abs(b - firstB) > 6) {
          return false;
        }
      }
    }
    return true;
  } catch {
    // Tainted canvas (CORS) → can't sample; assume valid.
    return false;
  }
}

/**
 * Image component that handles broken/private images gracefully.
 * Detects four failure modes:
 *   1. No src / empty string
 *   2. onError fires (network / 404)
 *   3. Image loads but has 0x0 dimensions
 *   4. Image loads but is a single solid color (HEIC upload corruption)
 */
export default function SafeImage({ src, alt, className = "", loading = "lazy" }: SafeImageProps) {
  const [error, setError] = useState(false);
  const [corrupted, setCorrupted] = useState(false);
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

  if (corrupted) {
    return (
      <div className={`flex flex-col items-center justify-center bg-destructive/10 border border-destructive/30 ${className}`}>
        <AlertTriangle size={16} className="text-destructive mb-1" />
        <span className="text-[8px] text-destructive font-semibold text-center px-1 leading-tight">
          Foto corrompida
        </span>
        <span className="text-[7px] text-muted-foreground text-center px-1 leading-tight mt-0.5">
          Pedir reenvio
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
      crossOrigin="anonymous"
      onError={() => setError(true)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          setError(true);
          return;
        }
        if (detectMonochrome(img)) {
          setCorrupted(true);
        }
      }}
    />
  );
}
