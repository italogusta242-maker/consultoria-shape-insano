import React from "react";
import { Youtube } from "lucide-react";

// The legacy thumb component from Treinos.tsx
export const ExerciseVideoThumb = ({ videoId, name }: { videoId?: string; name: string }) => {
    if (!videoId) return null;
    return (
        <div className="rounded-lg overflow-hidden border border-[hsl(var(--gold)/0.2)] bg-black/60 relative group cursor-pointer w-full aspect-video flex-shrink-0">
            <img
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt={`Miniatura de ${name}`}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm border border-[hsl(var(--gold)/0.3)] group-hover:scale-110 transition-transform">
                    <Youtube size={24} className="text-[hsl(var(--gold))]" />
                </div>
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                <span className="bg-black/80 text-[10px] text-[hsl(var(--gold))] px-2 py-1 rounded font-cinzel font-bold border border-[hsl(var(--gold)/0.3)] truncate max-w-[80%]">
                    {name}
                </span>
            </div>
            <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10"
                aria-label={`Assistir vídeo sobre ${name}`}
            />
        </div>
    );
};

interface ExerciseMediaProps {
    videoId?: string;
    gifUrl?: string;
    name: string;
    mode: "detail" | "execution";
}

export const ExerciseMedia: React.FC<ExerciseMediaProps> = ({ videoId, gifUrl, name, mode }) => {
    if (mode === "detail") {
        // Detail view: Prioritizes Video over GIF
        if (videoId) {
            return (
                <div data-testid="media-container-video-detail">
                    <ExerciseVideoThumb videoId={videoId} name={name} />
                </div>
            );
        }
        return gifUrl ? (
            <div data-testid="media-container-gif-detail" className="rounded-lg overflow-hidden border border-border bg-background">
                <img
                    src={gifUrl}
                    data-testid="exercise-gif"
                    alt={`Demonstração: ${name}`}
                    className="w-full max-h-48 object-contain"
                    loading="lazy"
                />
            </div>
        ) : null;
    }

    // Execution view: Prioritizes GIF over Video
    return gifUrl ? (
        <div data-testid="media-container-gif-execution" className="rounded-lg overflow-hidden border border-border bg-black/40 flex justify-center mb-4">
            <img
                src={gifUrl}
                data-testid="exercise-gif"
                alt={`Demonstração: ${name}`}
                className="w-full max-h-56 object-contain"
                loading="lazy"
            />
        </div>
    ) : (
        <div data-testid="media-container-video-execution" className="mb-4">
            <ExerciseVideoThumb videoId={videoId} name={name} />
        </div>
    );
};
