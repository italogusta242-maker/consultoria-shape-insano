import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingUser {
  userId: string;
  name: string;
}

export function useTypingIndicator(conversationId: string | null, userId: string | undefined, userName: string) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userNameRef = useRef(userName);
  userNameRef.current = userName;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!conversationId || !userId) {
      setTypingUsers([]);
      return;
    }

    const channelName = `typing-${conversationId}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    const updateFromState = () => {
      const state = channel.presenceState();
      const users: TypingUser[] = [];
      for (const [key, presences] of Object.entries(state)) {
        if (key !== userIdRef.current) {
          const p = (presences as any[])[0];
          if (p?.typing) {
            users.push({ userId: key, name: p.name || "..." });
          }
        }
      }
      setTypingUsers(users);
    };

    channel
      .on("presence", { event: "sync" }, updateFromState)
      .on("presence", { event: "join" }, updateFromState)
      .on("presence", { event: "leave" }, updateFromState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ typing: false, name: userNameRef.current });
        }
      });

    channelRef.current = channel;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.track({ typing: true, name: userNameRef.current });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      channelRef.current?.track({ typing: false, name: userNameRef.current });
    }, 2000);
  }, []);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    channelRef.current?.track({ typing: false, name: userNameRef.current });
  }, []);

  return { typingUsers, sendTyping, stopTyping };
}
