import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PhotoSourcePicker from "@/components/PhotoSourcePicker";

interface MediaUploadButtonProps {
  conversationId: string;
  onMediaSent: (url: string, type: "image" | "video", metadata: { width: number; height: number; size: number }) => void;
  disabled?: boolean;
}

const MAX_IMAGE_DIM = 1200;
const JPEG_QUALITY = 0.8;

const compressImage = (file: File): Promise<{ blob: Blob; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
        const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve({ blob, width, height });
          else reject(new Error("Compression failed"));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const MediaUploadButton = ({ conversationId, onMediaSent, disabled }: MediaUploadButtonProps) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!user) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) return;

    setUploading(true);
    try {
      const ext = isVideo ? "mp4" : "jpg";
      const path = `${user.id}/${conversationId}/${Date.now()}.${ext}`;

      let uploadBlob: Blob = file;
      let width = 0;
      let height = 0;

      if (isImage) {
        const compressed = await compressImage(file);
        uploadBlob = compressed.blob;
        width = compressed.width;
        height = compressed.height;
      }

      if (isVideo) {
        const video = document.createElement("video");
        video.preload = "metadata";
        await new Promise<void>((res) => {
          video.onloadedmetadata = () => {
            width = video.videoWidth;
            height = video.videoHeight;
            res();
          };
          video.src = URL.createObjectURL(file);
        });
      }

      const { error } = await supabase.storage
        .from("chat-media")
        .upload(path, uploadBlob, { contentType: isVideo ? file.type : "image/jpeg" });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
      onMediaSent(urlData.publicUrl, isVideo ? "video" : "image", { width, height, size: uploadBlob.size });
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <PhotoSourcePicker accept="image/*,video/*" onFile={handleFile} disabled={disabled || uploading}>
      <button
        disabled={disabled || uploading}
        className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-50 shrink-0"
      >
        {uploading ? (
          <Loader2 size={18} className="text-muted-foreground animate-spin" />
        ) : (
          <ImagePlus size={18} className="text-muted-foreground" />
        )}
      </button>
    </PhotoSourcePicker>
  );
};

export default MediaUploadButton;
