import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  reply_to?: string | null;
  type?: string;
}

const PAGE_SIZE = 40;

export function useChatMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const oldestRef = useRef<string | null>(null);

  // Reset when conversation changes
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setInitialLoad(true);
    oldestRef.current = null;
  }, [conversationId]);

  // Initial load - get latest messages
  useEffect(() => {
    if (!conversationId) return;

    const loadLatest = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (data) {
        const sorted = (data as ChatMessage[]).reverse();
        setMessages(sorted);
        setHasMore(data.length === PAGE_SIZE);
        if (sorted.length > 0) {
          oldestRef.current = sorted[0].created_at;
        }
      }
      setLoading(false);
      setInitialLoad(false);
    };

    loadLatest();

    // Realtime subscription
    const channel = supabase
      .channel(`chat-msgs-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Load older messages (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || loading || !oldestRef.current) return;

    setLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .lt("created_at", oldestRef.current)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      const sorted = (data as ChatMessage[]).reverse();
      if (sorted.length > 0) {
        oldestRef.current = sorted[0].created_at;
        setMessages((prev) => [...sorted, ...prev]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [conversationId, hasMore, loading]);

  // Optimistic add
  const addOptimistic = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Replace optimistic with real
  const replaceOptimistic = useCallback((optimisticId: string, real: ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === optimisticId ? real : m)));
  }, []);

  // Remove failed optimistic
  const removeOptimistic = useCallback((optimisticId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
  }, []);

  return {
    messages,
    loading,
    initialLoad,
    hasMore,
    loadMore,
    addOptimistic,
    replaceOptimistic,
    removeOptimistic,
  };
}
