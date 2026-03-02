/**
 * @purpose Compact sidebar profile widget with avatar upload for Admin/Closer/CS layouts.
 * @dependencies AvatarUpload, supabase, react-query, AuthContext.
 */
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AvatarUpload from "@/components/AvatarUpload";
import { cn } from "@/lib/utils";

interface SidebarProfileProps {
  collapsed: boolean;
}

export default function SidebarProfile({ collapsed }: SidebarProfileProps) {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["sidebar-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <div className={cn("flex items-center gap-2 px-2", collapsed ? "justify-center" : "")}>
      <AvatarUpload
        userId={user.id}
        avatarUrl={profile?.avatar_url}
        size="sm"
        invalidateKeys={[["sidebar-profile", user.id]]}
      />
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {profile?.nome ?? "Usuário"}
          </p>
        </div>
      )}
    </div>
  );
}
