import { useState } from "react";

interface MediaMessageProps {
  url: string;
  type: "image" | "video";
  metadata?: { width?: number; height?: number };
}

const MediaMessage = ({ url, type, metadata }: MediaMessageProps) => {
  const [loaded, setLoaded] = useState(false);
  const aspectRatio = metadata?.width && metadata?.height
    ? `${metadata.width} / ${metadata.height}`
    : "16 / 9";

  if (type === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="rounded-lg max-w-full max-h-[300px] w-auto"
        style={{ aspectRatio }}
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio, maxWidth: 280, maxHeight: 300 }}>
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded-lg" />
      )}
      <img
        src={url}
        alt="Mídia"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover rounded-lg cursor-pointer transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        onClick={() => window.open(url, "_blank")}
      />
    </div>
  );
};

export default MediaMessage;
