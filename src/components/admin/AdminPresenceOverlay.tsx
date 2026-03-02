/**
 * @purpose Real-time overlay showing online users with names, roles and closer metrics.
 * @dependencies presenceService, AuthContext, useProfile, supabase.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { subscribeGlobalPresence, getOnlineCount, getOnlineUsers } from "@/services/presenceService";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, ChevronDown, ChevronUp, Users, Receipt, ShoppingBag, UserX, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface OnlineUser {
  id: string;
  name?: string;
  role?: string;
}

interface CloserStats {
  id: string;
  name: string;
  charges: number;
  closings: number;
  cancellations: number;
}

const useCloserStats = () => {
  return useQuery({
    queryKey: ["closer-stats-overlay"],
    queryFn: async () => {
      // Get all closers
      const { data: closerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "closer");

      if (!closerRoles?.length) return [];

      const closerIds = closerRoles.map((r) => r.user_id);

      // Get closer names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", closerIds);

      // Get invites by each closer
      const { data: invites } = await supabase
        .from("invites")
        .select("created_by, payment_status, status")
        .in("created_by", closerIds);

      // Get cancellations (subscriptions from users invited by closers)
      const { data: allInvites } = await supabase
        .from("invites")
        .select("email, created_by")
        .in("created_by", closerIds);

      // Map invited emails to closer
      const emailToCloser: Record<string, string> = {};
      allInvites?.forEach((inv) => {
        if (inv.created_by && inv.email) emailToCloser[inv.email] = inv.created_by;
      });

      // Get profiles of invited users to find their IDs
      const invitedEmails = Object.keys(emailToCloser);
      let cancelMap: Record<string, number> = {};

      if (invitedEmails.length > 0) {
        const { data: invitedProfiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("email", invitedEmails);

        if (invitedProfiles?.length) {
          const invitedUserIds = invitedProfiles.map((p) => p.id);
          const { data: canceledSubs } = await supabase
            .from("subscriptions")
            .select("user_id")
            .in("user_id", invitedUserIds)
            .eq("status", "canceled");

          canceledSubs?.forEach((sub) => {
            const profile = invitedProfiles.find((p) => p.id === sub.user_id);
            if (profile?.email) {
              const closerId = emailToCloser[profile.email];
              if (closerId) {
                cancelMap[closerId] = (cancelMap[closerId] || 0) + 1;
              }
            }
          });
        }
      }

      const stats: CloserStats[] = closerIds.map((cid) => {
        const closerInvites = invites?.filter((i) => i.created_by === cid) || [];
        const profile = profiles?.find((p) => p.id === cid);

        return {
          id: cid,
          name: profile?.nome || "Closer",
          charges: closerInvites.filter((i) => i.payment_status === "confirmed" || i.payment_status === "paid").length,
          closings: closerInvites.filter((i) => i.status === "used").length,
          cancellations: cancelMap[cid] || 0,
        };
      });

      return stats;
    },
    refetchInterval: 30000,
  });
};

const AdminPresenceOverlay = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [onlineCount, setOnlineCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const { data: closerStats } = useCloserStats();

  // Drag state
  const [position, setPosition] = useState({ x: window.innerWidth - 304, y: 16 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 288, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 48, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Get user role for presence metadata
  const { data: myRole } = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      return data?.role || null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    const cleanup = subscribeGlobalPresence(
      user.id,
      (state) => {
        setOnlineCount(getOnlineCount(state));
        setOnlineUsers(getOnlineUsers(state).slice(0, 20));
      },
      { name: profile?.nome || undefined, role: myRole || undefined }
    );

    return cleanup;
  }, [user?.id, profile?.nome, myRole]);

  const roleLabel = (role?: string) => {
    const map: Record<string, string> = {
      admin: "Admin",
      closer: "Closer",
      personal: "Preparador",
      nutricionista: "Nutricionista",
      cs: "CS",
      user: "Atleta",
      especialista: "Especialista",
    };
    return role ? map[role] || role : "Usuário";
  };

  const roleBadgeColor = (role?: string) => {
    const map: Record<string, string> = {
      admin: "bg-red-500/20 text-red-400",
      closer: "bg-amber-500/20 text-amber-400",
      personal: "bg-blue-500/20 text-blue-400",
      nutricionista: "bg-green-500/20 text-green-400",
      cs: "bg-purple-500/20 text-purple-400",
      user: "bg-slate-500/20 text-slate-400",
    };
    return role ? map[role] || "bg-slate-500/20 text-slate-400" : "bg-slate-500/20 text-slate-400";
  };

  return (
    <div
      ref={overlayRef}
      className="fixed z-50 w-72 pointer-events-auto select-none"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex items-center">
        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center justify-center px-1.5 py-2 cursor-grab active:cursor-grabbing rounded-l-lg border border-r-0 bg-card/90 backdrop-blur-sm border-border/50"
        >
          <GripHorizontal size={14} className="text-muted-foreground" />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex-1 flex items-center justify-between gap-2 px-3 py-2 border shadow-lg transition-all duration-300",
            "bg-card/90 backdrop-blur-sm border-border/50 hover:border-accent/50 rounded-r-lg",
            expanded && "rounded-br-none border-b-0"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <Wifi size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold text-foreground">{onlineCount}</span>
            <span className="text-[10px] text-muted-foreground">online</span>
          </div>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>
      </div>

      {expanded && (
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 border-t-0 rounded-b-lg shadow-lg overflow-hidden">
          {/* Online Users Section */}
          <div className="p-3 border-b border-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Users size={12} className="text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Usuários conectados
              </p>
            </div>
            {onlineCount === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum no momento</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {onlineUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs text-foreground truncate">
                        {u.name || u.id.slice(0, 8) + "..."}
                      </span>
                    </div>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-medium", roleBadgeColor(u.role))}>
                      {roleLabel(u.role)}
                    </span>
                  </div>
                ))}
                {onlineCount > 20 && (
                  <p className="text-[10px] text-muted-foreground">+{onlineCount - 20} outros</p>
                )}
              </div>
            )}
          </div>

          {/* Closer Stats Section */}
          {closerStats && closerStats.length > 0 && (
            <div className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Performance dos Closers
              </p>
              <div className="space-y-2.5">
                {closerStats.map((cs) => (
                  <div key={cs.id} className="space-y-1">
                    <p className="text-xs font-medium text-foreground">{cs.name}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="flex flex-col items-center bg-emerald-500/10 rounded px-1 py-1">
                        <Receipt size={10} className="text-emerald-400 mb-0.5" />
                        <span className="text-xs font-bold text-emerald-400">{cs.charges}</span>
                        <span className="text-[8px] text-muted-foreground">Cobranças</span>
                      </div>
                      <div className="flex flex-col items-center bg-blue-500/10 rounded px-1 py-1">
                        <ShoppingBag size={10} className="text-blue-400 mb-0.5" />
                        <span className="text-xs font-bold text-blue-400">{cs.closings}</span>
                        <span className="text-[8px] text-muted-foreground">Fechamentos</span>
                      </div>
                      <div className="flex flex-col items-center bg-red-500/10 rounded px-1 py-1">
                        <UserX size={10} className="text-red-400 mb-0.5" />
                        <span className="text-xs font-bold text-red-400">{cs.cancellations}</span>
                        <span className="text-[8px] text-muted-foreground">Cancelam.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPresenceOverlay;
