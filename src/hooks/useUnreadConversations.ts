import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadConversations() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [forcedUnread, setForcedUnread] = useState<Set<string>>(new Set());

  const loadUnreadCounts = useCallback(async () => {
    if (!user) return;

    // Get all conversations user participates in
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!parts || parts.length === 0) return;

    const convIds = parts.map((p) => p.conversation_id);

    // Get all message_reads for this user
    const { data: reads } = await supabase
      .from("message_reads")
      .select("message_id")
      .eq("user_id", user.id);

    const readMessageIds = new Set((reads || []).map((r) => r.message_id));

    // For each conversation, count messages NOT sent by me and NOT read
    const counts: Record<string, number> = {};

    // Batch: get recent messages for all conversations (last 100 per conv is enough)
    for (const convId of convIds) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, sender_id")
        .eq("conversation_id", convId)
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (msgs) {
        const unread = msgs.filter((m) => !readMessageIds.has(m.id)).length;
        if (unread > 0) counts[convId] = unread;
      }
    }

    setUnreadCounts(counts);
  }, [user]);

  useEffect(() => {
    loadUnreadCounts();

    // Realtime: refresh on new messages
    const channel = supabase
      .channel("unread-counter")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as { sender_id: string; conversation_id: string };
          if (msg.sender_id !== user?.id) {
            setUnreadCounts((prev) => ({
              ...prev,
              [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadUnreadCounts]);

  const totalUnread = Object.values(unreadCounts).filter((c) => c > 0).length + forcedUnread.size;

  const getConversationUnread = (convId: string): number => {
    if (forcedUnread.has(convId)) return Math.max(unreadCounts[convId] || 0, 1);
    return unreadCounts[convId] || 0;
  };

  const markAsRead = (convId: string) => {
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
    setForcedUnread((prev) => {
      const next = new Set(prev);
      next.delete(convId);
      return next;
    });
  };

  const markAsUnread = async (convId: string) => {
    if (!user) return;

    // Delete message_reads for this user in this conversation
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("conversation_id", convId)
      .neq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (msgs && msgs.length > 0) {
      await supabase
        .from("message_reads")
        .delete()
        .eq("user_id", user.id)
        .eq("message_id", msgs[0].id);
    }

    // Force unread state locally
    setForcedUnread((prev) => new Set(prev).add(convId));
    setUnreadCounts((prev) => ({
      ...prev,
      [convId]: Math.max(prev[convId] || 0, 1),
    }));
  };

  return {
    totalUnread,
    unreadCounts,
    getConversationUnread,
    markAsRead,
    markAsUnread,
    refresh: loadUnreadCounts,
  };
}
