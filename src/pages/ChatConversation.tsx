import { useState, useEffect, useRef, useCallback } from "react";
import { sendPushToConversation } from "@/hooks/usePushNotifications";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Dumbbell, Leaf, LucideIcon, X, Reply } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isYesterday, differenceInCalendarDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useProfile } from "@/hooks/useProfile";
import { usePresence } from "@/hooks/usePresence";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useChatMessages, ChatMessage } from "@/hooks/useChatMessages";
import SwipeMessage from "@/components/chat/SwipeMessage";
import SkeletonMessages from "@/components/chat/SkeletonMessages";
import SystemMessage from "@/components/chat/SystemMessage";
import ReadReceiptTicks from "@/components/chat/ReadReceiptTicks";
import MediaUploadButton from "@/components/chat/MediaUploadButton";
import MediaMessage from "@/components/chat/MediaMessage";

const formatDateSeparator = (date: Date): string => {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  const diffDays = differenceInCalendarDays(new Date(), date);
  if (diffDays < 7) {
    const day = format(date, "EEEE", { locale: ptBR });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  return format(date, "dd/MM");
};

interface Participant {
  user_id: string;
  profile?: { nome: string | null; avatar_url: string | null };
}

const specialistConfig: Record<string, { color: string; bg: string; border: string; icon: LucideIcon; title: string }> = {
  preparador: {
    color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-800/50", icon: Dumbbell,
    title: "Preparador Físico",
  },
  personal: {
    color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-800/50", icon: Dumbbell,
    title: "Preparador Físico",
  },
  preparador_fisico: {
    color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-800/50", icon: Dumbbell,
    title: "Preparador Físico",
  },
  nutricionista: {
    color: "text-green-400", bg: "bg-green-900/30", border: "border-green-800/50", icon: Leaf,
    title: "Nutricionista",
  },
};

const defaultSpec = { color: "text-muted-foreground", bg: "bg-secondary", border: "border-border", icon: Dumbbell, title: "Especialista" };

const ChatConversation = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [convTitle, setConvTitle] = useState("");
  const [spec, setSpec] = useState(defaultSpec);
  const [headerReady, setHeaderReady] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);

  const {
    messages, loading, initialLoad, hasMore, loadMore,
    addOptimistic, replaceOptimistic, removeOptimistic,
  } = useChatMessages(conversationId || null);

  const myName = profile?.nome || "Aluno";
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(conversationId || null, user?.id, myName);
  const { isOnline } = usePresence(conversationId || null, user?.id);
  const { isRead } = useReadReceipts(conversationId || null, user?.id);

  // Load conversation info + participants
  useEffect(() => {
    if (!conversationId || !user) return;

    const loadConversation = async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

      if (conv?.title) setConvTitle(conv.title);

      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (parts) {
        const userIds = parts.map((p) => p.user_id);
        const otherIds = userIds.filter((id) => id !== user.id);
        if (otherIds.length > 0) setOtherUserId(otherIds[0]);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", userIds);

        const { data: links } = await supabase
          .from("student_specialists")
          .select("specialist_id, specialty")
          .eq("student_id", user.id)
          .in("specialist_id", otherIds);

        if (links && links.length > 0) {
          const specialty = links[0].specialty;
          if (specialistConfig[specialty]) {
            setSpec(specialistConfig[specialty]);
          }
        }

        setParticipants(
          parts.map((p) => ({
            user_id: p.user_id,
            profile: profiles?.find((pr) => pr.id === p.user_id)
              ? { nome: profiles.find((pr) => pr.id === p.user_id)!.nome, avatar_url: profiles.find((pr) => pr.id === p.user_id)!.avatar_url }
              : undefined,
          }))
        );

        if (!conv?.title) {
          const other = profiles?.find((p) => p.id !== user.id);
          if (other?.nome) setConvTitle(other.nome);
        }
      }
      setHeaderReady(true);
    };

    loadConversation();
  }, [conversationId, user?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!initialLoad) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, initialLoad]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!initialLoad) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [initialLoad]);

  // Infinite scroll - detect scroll to top
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop < 80) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadMore().then(() => {
        // Maintain scroll position after loading older messages
        requestAnimationFrame(() => {
          if (el) {
            el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
          }
        });
      });
    }
  }, [loading, hasMore, loadMore]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sending || !user) return;
    setSending(true);
    stopTyping();

    const content = newMessage.trim();
    const insertData: any = {
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    };
    if (replyTo) insertData.reply_to = replyTo.id;

    const optimisticId = crypto.randomUUID();
    addOptimistic({
      id: optimisticId,
      content,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      reply_to: replyTo?.id || null,
      type: "text",
    });
    setNewMessage("");
    setReplyTo(null);

    const { data, error } = await supabase.from("chat_messages").insert(insertData).select().single();
    if (data) {
      replaceOptimistic(optimisticId, data as ChatMessage);
      // Send push notification to other participants
      sendPushToConversation(conversationId, myName, content.length > 100 ? content.slice(0, 100) + "…" : content);
    } else if (error) {
      removeOptimistic(optimisticId);
    }
    setSending(false);
  };

  const handleMediaSent = async (url: string, mediaType: "image" | "video", metadata: { width: number; height: number; size: number }) => {
    if (!conversationId || !user) return;

    const content = JSON.stringify({ url, mediaType, ...metadata });
    const optimisticId = crypto.randomUUID();
    addOptimistic({
      id: optimisticId,
      content,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      type: mediaType,
    });

    const { data, error } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      type: mediaType,
    }).select().single();

    if (data) {
      replaceOptimistic(optimisticId, data as ChatMessage);
      sendPushToConversation(conversationId, myName, "📎 Mídia");
    } else if (error) {
      removeOptimistic(optimisticId);
    }
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return "Você";
    const p = participants.find((pp) => pp.user_id === senderId);
    return p?.profile?.nome || convTitle || "Especialista";
  };

  const getReplyContent = (replyToId: string) => {
    const msg = messages.find((m) => m.id === replyToId);
    if (!msg) return null;
    return { name: getSenderName(msg.sender_id), content: msg.type === "image" || msg.type === "video" ? "📎 Mídia" : msg.content };
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  const parseMediaContent = (msg: ChatMessage) => {
    if (msg.type !== "image" && msg.type !== "video") return null;
    try {
      const data = JSON.parse(msg.content);
      return data as { url: string; mediaType: "image" | "video"; width: number; height: number };
    } catch {
      return { url: msg.content, mediaType: msg.type as "image" | "video", width: 0, height: 0 };
    }
  };

  const SpecIcon = spec.icon;
  const otherOnline = otherUserId ? isOnline(otherUserId) : false;

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] max-w-lg mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/chat")}
          className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </motion.button>
        {headerReady ? (
          <>
            <div className={`w-10 h-10 rounded-lg ${spec.bg} flex items-center justify-center relative`}>
              <SpecIcon className={spec.color} size={20} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                  otherOnline ? "bg-green-500" : "bg-muted-foreground/40"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <h3 className="font-cinzel font-bold text-sm text-accent truncate">{convTitle || "Especialista"}</h3>
              <div className="h-4 relative">
                {typingUsers.length > 0 ? (
                  <p className="text-xs text-accent animate-pulse absolute inset-0 truncate">Digitando...</p>
                ) : (
                  <p className="text-xs text-muted-foreground absolute inset-0 truncate">
                    {otherOnline ? "Online" : spec.title}
                  </p>
                )}
              </div>
            </div>
            <NotificationCenter />
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="w-24 h-3.5 rounded bg-muted animate-pulse" />
              <div className="w-16 h-2.5 rounded bg-muted animate-pulse" />
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-3 px-4 py-4"
      >
        {loading && hasMore && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          </div>
        )}
        {initialLoad || !headerReady ? (
          <SkeletonMessages />
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-10">
            Nenhuma mensagem ainda. Inicie a conversa!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const msgDate = new Date(msg.created_at);
            const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
            const showDateSep = !prevDate || startOfDay(msgDate).getTime() !== startOfDay(prevDate).getTime();
            const replyData = msg.reply_to ? getReplyContent(msg.reply_to) : null;
            const mediaData = parseMediaContent(msg);

            if (msg.type === "system") {
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center justify-center my-3">
                      <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium sticky top-0">
                        {formatDateSeparator(msgDate)}
                      </span>
                    </div>
                  )}
                  <SystemMessage content={msg.content} />
                </div>
              );
            }

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center justify-center my-3 sticky top-0 z-[5]">
                    <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">
                      {formatDateSeparator(msgDate)}
                    </span>
                  </div>
                )}
                <SwipeMessage onSwipeReply={() => handleReply(msg)}>
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} group`}
                  >
                    <div className="flex items-center gap-1 max-w-[80%]">
                      {isMe && (
                        <button
                          onClick={() => handleReply(msg)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50 shrink-0"
                        >
                          <Reply size={14} className="text-muted-foreground" />
                        </button>
                      )}
                      <div
                        className={`rounded-xl px-4 py-2.5 text-sm ${
                          isMe
                            ? "bg-accent/20 border border-accent/30 text-foreground"
                            : "bg-secondary/60 border border-border text-foreground"
                        }`}
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {replyData && (
                          <div className={`mb-2 pl-2 border-l-2 ${isMe ? "border-accent/50" : `${spec.border}`} rounded-sm`}>
                            <p className="text-[10px] font-semibold opacity-70">{replyData.name}</p>
                            <p className="text-[11px] opacity-60 truncate max-w-[200px]">{replyData.content}</p>
                          </div>
                        )}
                        {!isMe && (
                          <p className={`text-[10px] font-semibold ${spec.color} mb-0.5 opacity-70`}>
                            {getSenderName(msg.sender_id)}
                          </p>
                        )}
                        {mediaData ? (
                          <MediaMessage
                            url={mediaData.url}
                            type={mediaData.mediaType}
                            metadata={{ width: mediaData.width, height: mediaData.height }}
                          />
                        ) : (
                          <p className={isMe ? "text-foreground" : ""}>{msg.content}</p>
                        )}
                        <p className="text-[9px] text-muted-foreground mt-1 text-right flex items-center justify-end gap-0.5">
                          {format(msgDate, "HH:mm")}
                          <ReadReceiptTicks isRead={isRead(msg.id)} isMine={isMe} />
                        </p>
                      </div>
                      {!isMe && (
                        <button
                          onClick={() => handleReply(msg)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50"
                        >
                          <Reply size={14} className="text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                </SwipeMessage>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview + Input */}
      <div className="border-t border-border bg-background sticky bottom-0 z-10">
        {replyTo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border-b border-border">
            <Reply size={14} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-accent">{getSenderName(replyTo.sender_id)}</p>
              <p className="text-[11px] text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-secondary rounded">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        )}
        <div className="flex gap-2 px-4 py-3">
          {conversationId && (
            <MediaUploadButton
              conversationId={conversationId}
              onMediaSent={handleMediaSent}
              disabled={sending}
            />
          )}
          <input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              sendTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
            style={{ fontSize: "16px" }}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center disabled:opacity-50"
          >
            <Send size={18} className="text-accent-foreground" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatConversation;
