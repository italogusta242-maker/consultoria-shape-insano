/**
 * @purpose Reusable avatar upload component with camera overlay and storage integration.
 * @dependencies supabase storage (avatars bucket), react-query.
 */
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Camera, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PhotoSourcePicker from "@/components/PhotoSourcePicker";

interface AvatarUploadProps {
  userId: string;
  avatarUrl: string | null | undefined;
  size?: "sm" | "md" | "lg";
  invalidateKeys?: string[][];
  className?: string;
}

const sizeClasses = { sm: "w-12 h-12", md: "w-16 h-16", lg: "w-24 h-24" };
const iconSizes = { sm: 20, md: 28, lg: 40 };
const badgeSizes = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-7 h-7" };
const badgeIconSizes = { sm: 8, md: 10, lg: 12 };

export default function AvatarUpload({ userId, avatarUrl, size = "md", invalidateKeys, className }: AvatarUploadProps) {
  const queryClient = useQueryClient();

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar foto");
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", userId);

    if (updateError) {
      toast.error("Erro ao atualizar perfil");
    } else {
      toast.success("Avatar atualizado!");
      const keys = invalidateKeys ?? [["profile"], ["specialist-profile"]];
      keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    }
  };

  return (
    <div className={cn("relative group", className)}>
      <PhotoSourcePicker onFile={handleFile}>
        <button className="relative cursor-pointer">
          <Avatar className={cn(sizeClasses[size], "border-2 border-primary/30 shadow-lg shadow-primary/10")}>
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-secondary">
              <User size={iconSizes[size]} className="text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload size={iconSizes[size] * 0.5} className="text-foreground" />
          </div>
          <div className={cn(
            "absolute -bottom-1 -right-1 rounded-full bg-primary flex items-center justify-center border-2 border-card",
            badgeSizes[size]
          )}>
            <Camera size={badgeIconSizes[size]} className="text-primary-foreground" />
          </div>
        </button>
      </PhotoSourcePicker>
    </div>
  );
}
