import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresence(conversationId: string | null, userId: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`presence-${conversationId}`, {
      config: { presence: { key: userId } },
    });

    const updateFromState = () => {
      const state = channel.presenceState();
      setOnlineUsers(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, updateFromState)
      .on("presence", { event: "join" }, updateFromState)
      .on("presence", { event: "leave" }, updateFromState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online: true });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const isOnline = useCallback(
    (uid: string) => onlineUsers.has(uid),
    [onlineUsers]
  );

  return { onlineUsers, isOnline };
}
