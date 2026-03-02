import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useReadReceipts(conversationId: string | null, userId: string | undefined) {
  const [readMap, setReadMap] = useState<Record<string, string[]>>({});

  const markAsRead = useCallback(async () => {
    if (!conversationId || !userId) return;

    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId);

    if (!msgs || msgs.length === 0) return;

    const msgIds = msgs.map((m) => m.id);

    // message_reads may not be in generated types yet, cast to any
    const { data: existing } = await (supabase as any)
      .from("message_reads")
      .select("message_id")
      .eq("user_id", userId)
      .in("message_id", msgIds);

    const alreadyRead = new Set((existing || []).map((e: any) => e.message_id));
    const toInsert = msgIds
      .filter((id) => !alreadyRead.has(id))
      .map((message_id) => ({ message_id, user_id: userId }));

    if (toInsert.length > 0) {
      await (supabase as any).from("message_reads").insert(toInsert);
    }
  }, [conversationId, userId]);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const loadReads = async () => {
      const { data: myMsgs } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_id", userId);

      if (!myMsgs || myMsgs.length === 0) return;

      const myMsgIds = myMsgs.map((m) => m.id);

      const { data: reads } = await (supabase as any)
        .from("message_reads")
        .select("message_id, user_id")
        .in("message_id", myMsgIds);

      const map: Record<string, string[]> = {};
      for (const r of (reads || []) as any[]) {
        if (!map[r.message_id]) map[r.message_id] = [];
        map[r.message_id].push(r.user_id);
      }
      setReadMap(map);
    };

    loadReads();

    const channel = supabase
      .channel(`reads-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "message_reads",
      }, (payload) => {
        const nr = payload.new as { message_id: string; user_id: string };
        setReadMap((prev) => ({
          ...prev,
          [nr.message_id]: [...(prev[nr.message_id] || []), nr.user_id],
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const isRead = (messageId: string) => (readMap[messageId] || []).length > 0;

  return { isRead, markAsRead };
}
