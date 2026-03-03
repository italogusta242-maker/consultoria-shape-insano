import { useCallback, useState } from "react";
import html2canvas from "html2canvas";

export function useWorkoutShare() {
  const [isSharing, setIsSharing] = useState(false);

  const shareWorkout = useCallback(async (cardRef: React.RefObject<HTMLDivElement>) => {
    if (!cardRef.current) return;
    setIsSharing(true);

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1.0)
      );

      if (!blob) throw new Error("Failed to generate image");

      const file = new File([blob], "treino-shape-insano.png", { type: "image/png" });

      // Try native share first (works best on mobile)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Treino Concluído",
          text: "Mais um dia de vitória no Shape Insano Pro! 🔥",
        });
        return;
      }

      // Desktop: try clipboard then fallback to download
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        // If clipboard worked, also download as backup
      } catch {
        // Clipboard not supported (iOS Safari, etc.) — just download
      }

      // Fallback: always download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "treino-shape-insano.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      // User cancelled share is not an error
      if (error?.name !== "AbortError") {
        console.error("Share failed:", error);
      }
    } finally {
      setIsSharing(false);
    }
  }, []);

  return { shareWorkout, isSharing };
}
