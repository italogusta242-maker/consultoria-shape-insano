import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Users, MessageCircle, Reply, X, Search, ChevronLeft } from "lucide-react";
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

interface SidebarItem {
  id: string;
  type: "direct" | "group" | "new";
  name: string;
  studentId?: string;
  avatarUrl?: string | null;
  lastMessage?: string;
  lastTime?: string;
  unread: number;
  memberNames?: string[];
}

const formatConvTime = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM");
};

const EspecialistaChat = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const sidebarTab = "alunos";
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);

  const {
    messages, loading: msgsLoading, initialLoad, hasMore, loadMore,
    addOptimistic, replaceOptimistic, removeOptimistic,
  } = useChatMessages(activeConvId);

  const myName = profile?.nome || "Especialista";
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(activeConvId, user?.id, myName);
  const { isOnline } = usePresence(activeConvId, user?.id);
  const { isRead } = useReadReceipts(activeConvId, user?.id);

  // Load sidebar
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: studentLinks } = await supabase
        .from("student_specialists")
        .select("student_id, specialty")
        .eq("specialist_id", user.id);

      const studentIds = (studentLinks || []).map((s) => s.student_id);

      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      const convIds = (myParts || []).map((p) => p.conversation_id);

      // Parallel: profiles + conversations + all participants + last messages (single RPC)
      const [profilesRes, convsRes, allPartsRes, lastMsgsRes] = await Promise.all([
        studentIds.length > 0
          ? supabase.from("profiles").select("id, nome, avatar_url").in("id", studentIds)
          : Promise.resolve({ data: [] }),
        convIds.length > 0
          ? supabase.from("conversations").select("*").in("id", convIds)
          : Promise.resolve({ data: [] }),
        convIds.length > 0
          ? supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds)
          : Promise.resolve({ data: [] }),
        convIds.length > 0
          ? supabase.rpc("get_last_messages", { conv_ids: convIds })
          : Promise.resolve({ data: [] }),
      ]);

      const studentProfiles = profilesRes.data || [];
      const convs = convsRes.data || [];
      const allParts = allPartsRes.data || [];
      const lastMsgs = (lastMsgsRes.data || []) as { conversation_id: string; content: string; created_at: string; sender_id: string; type: string }[];

      // Build a map of last messages by conversation_id
      const lastMsgMap = new Map(lastMsgs.map((m) => [m.conversation_id, m]));

      // Get profiles for other participants
      const otherIds = [...new Set(allParts.filter((p) => p.user_id !== user.id).map((p) => p.user_id))];
      let otherProfiles: { id: string; nome: string | null; avatar_url: string | null }[] = [];
      if (otherIds.length > 0) {
        const { data } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", otherIds);
        otherProfiles = data || [];
      }

      const studentsWithConv = new Set<string>();
      let convItems: SidebarItem[] = [];

      for (const c of convs) {
        const cParts = allParts.filter((p) => p.conversation_id === c.id && p.user_id !== user.id);
        const lastMsg = lastMsgMap.get(c.id);

        if (c.type === "direct") {
          const otherId = cParts[0]?.user_id;
          if (otherId) studentsWithConv.add(otherId);
          const other = otherProfiles.find((p) => p.id === otherId) || studentProfiles.find((p) => p.id === otherId);
          convItems.push({
            id: c.id,
            type: "direct",
            name: other?.nome || "Aluno",
            studentId: otherId,
            avatarUrl: other?.avatar_url,
            lastMessage: lastMsg?.content,
            lastTime: lastMsg?.created_at,
            unread: 0,
          });
        } else {
          const groupStudentIds = cParts.map((p) => p.user_id);
          const groupStudentNames = groupStudentIds
            .map((sid) => (otherProfiles.find((p) => p.id === sid) || studentProfiles.find((p) => p.id === sid))?.nome || null)
            .filter(Boolean) as string[];

          convItems.push({
            id: c.id,
            type: "group",
            name: c.title || "Grupo",
            memberNames: groupStudentNames,
            lastMessage: lastMsg?.content,
            lastTime: lastMsg?.created_at,
            unread: 0,
          });
        }
      }

      for (const sp of studentProfiles) {
        if (!studentsWithConv.has(sp.id)) {
          convItems.push({
            id: `student-${sp.id}`,
            type: "new" as const,
            name: sp.nome || "Aluno",
            studentId: sp.id,
            avatarUrl: sp.avatar_url,
            unread: 0,
          });
        }
      }

      convItems.sort((a, b) => {
        if (a.type === "new" && b.type !== "new") return 1;
        if (a.type !== "new" && b.type === "new") return -1;
        if (!a.lastTime) return 1;
        if (!b.lastTime) return -1;
        return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
      });

      setSidebarItems(convItems);
      if (convItems.length > 0 && !selectedItem) {
        setSelectedItem(convItems[0]);
        if (convItems[0].type !== "new") setActiveConvId(convItems[0].id);
      }
      setLoading(false);
    };

    load();

    // Realtime: listen to ALL new messages to reorder sidebar
    const myConvChannel = supabase
      .channel("sidebar-reorder")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as { conversation_id: string; content: string; created_at: string; sender_id: string; type: string };
          setSidebarItems((prev) => {
            const idx = prev.findIndex((item) => item.id === newMsg.conversation_id);
            if (idx === -1) return prev;
            const updated = [...prev];
            const item = { ...updated[idx] };
            item.lastMessage = newMsg.type === "image" || newMsg.type === "video" ? "📎 Mídia" : newMsg.content;
            item.lastTime = newMsg.created_at;
            // Remove from current position and put at top (after accounting for "new" items)
            updated.splice(idx, 1);
            const insertIdx = updated.findIndex((i) => i.type !== "new" && (!i.lastTime || new Date(i.lastTime).getTime() < new Date(newMsg.created_at).getTime()));
            if (insertIdx === -1) {
              updated.push(item);
            } else {
              updated.splice(insertIdx, 0, item);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(myConvChannel);
    };
  }, [user]);

  const handleSelect = async (item: SidebarItem) => {
    setSelectedItem(item);
    setReplyTo(null);

    if (item.type === "new" && item.studentId && user) {
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ type: "direct" })
        .select()
        .single();

      if (conv && !error) {
        await supabase.from("conversation_participants").insert([
          { conversation_id: conv.id, user_id: user.id },
          { conversation_id: conv.id, user_id: item.studentId },
        ]);

        setSidebarItems((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? { ...s, id: conv.id, type: "direct" as const }
              : s
          )
        );
        setSelectedItem({ ...item, id: conv.id, type: "direct" });
        setActiveConvId(conv.id);
      }
    } else {
      setActiveConvId(item.id);
    }
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (!initialLoad) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, initialLoad]);

  useEffect(() => {
    if (!initialLoad) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [initialLoad]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || msgsLoading || !hasMore) return;
    if (el.scrollTop < 80) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadMore().then(() => {
        requestAnimationFrame(() => {
          if (el) {
            el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
          }
        });
      });
    }
  }, [msgsLoading, hasMore, loadMore]);

  const handleSend = async () => {
    if (!msg.trim() || !user || !activeConvId || sending) return;
    setSending(true);
    stopTyping();

    const content = msg.trim();
    const insertData: any = {
      conversation_id: activeConvId,
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
    setMsg("");
    setReplyTo(null);

    const { data, error } = await supabase.from("chat_messages").insert(insertData).select().single();
    if (data) {
      replaceOptimistic(optimisticId, data as ChatMessage);
    } else if (error) {
      removeOptimistic(optimisticId);
    }
    setSending(false);
  };

  const handleMediaSent = async (url: string, mediaType: "image" | "video", metadata: { width: number; height: number; size: number }) => {
    if (!activeConvId || !user) return;

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
      conversation_id: activeConvId,
      sender_id: user.id,
      content,
      type: mediaType,
    }).select().single();

    if (data) {
      replaceOptimistic(optimisticId, data as ChatMessage);
    } else if (error) {
      removeOptimistic(optimisticId);
    }
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) return "Você";
    return selectedItem?.name || "Aluno";
  };

  const getReplyContent = (replyToId: string) => {
    const m = messages.find((m) => m.id === replyToId);
    if (!m) return null;
    return { name: getSenderName(m.sender_id), content: m.type === "image" || m.type === "video" ? "📎 Mídia" : m.content };
  };

  const handleReply = (m: ChatMessage) => {
    setReplyTo(m);
    inputRef.current?.focus();
  };

  const parseMediaContent = (m: ChatMessage) => {
    if (m.type !== "image" && m.type !== "video") return null;
    try {
      const data = JSON.parse(m.content);
      return data as { url: string; mediaType: "image" | "video"; width: number; height: number };
    } catch {
      return { url: m.content, mediaType: m.type as "image" | "video", width: 0, height: 0 };
    }
  };

  const filteredItems = sidebarItems.filter((item) => {
    if (item.type === "group") return false;
    if (!searchQuery.trim()) return true;
    return item.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedStudentOnline = selectedItem?.studentId ? isOnline(selectedItem.studentId) : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Carregando conversas...</p>
      </div>
    );
  }



  const handleSelectMobile = async (item: SidebarItem) => {
    await handleSelect(item);
    setShowMobileChat(true);
  };

  return (
    <div className="space-y-4 md:space-y-4">
      <div className="hidden md:block">
        <h1 className="font-cinzel text-2xl font-bold gold-text-gradient tracking-wide">CHAT COM ALUNOS</h1>
        <p className="text-sm text-muted-foreground">Comunicação direta com seus guerreiros</p>
      </div>

      {/* Mobile: fullscreen layout */}
      <div className="md:hidden fixed inset-0 top-14 z-20 flex flex-col bg-background">
        {!showMobileChat ? (
          /* Mobile conversation list */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 space-y-2 border-b border-border">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar aluno..."
                  className="w-full pl-7 pr-3 py-2 text-sm rounded-md bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
                  style={{ fontSize: "16px" }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum resultado</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectMobile(item)}
                    className={`w-full text-left px-4 py-3.5 border-b border-border/30 hover:bg-secondary/30 transition-colors ${
                      selectedItem?.id === item.id ? "bg-secondary/40" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.type === "group" ? (
                        <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                          <Users size={16} className="text-accent" />
                        </div>
                      ) : item.avatarUrl ? (
                        <div className="relative shrink-0">
                          <img src={item.avatarUrl} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                          <User size={16} className="text-accent" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{formatConvTime(item.lastTime)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.type === "new" ? "Clique para iniciar conversa..." : item.lastMessage || "Inicie a conversa..."}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Mobile chat view */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile chat header */}
            <div className="px-3 py-2.5 border-b border-border flex items-center gap-3 bg-card/50">
              <button
                onClick={() => setShowMobileChat(false)}
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">
                  {selectedItem?.name || "Chat"}
                </h2>
                {typingUsers.length > 0 ? (
                  <p className="text-xs text-accent animate-pulse">digitando...</p>
                ) : selectedStudentOnline ? (
                  <p className="text-xs text-green-400">Online</p>
                ) : null}
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            >
              {msgsLoading && hasMore && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                </div>
              )}
              {initialLoad ? (
                <SkeletonMessages />
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-10">
                  <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                  <p>Nenhuma mensagem ainda. Envie a primeira!</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isMe = m.sender_id === user?.id;
                  const msgDate = new Date(m.created_at);
                  const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
                  const showDateSep = !prevDate || startOfDay(msgDate).getTime() !== startOfDay(prevDate).getTime();
                  const replyData = m.reply_to ? getReplyContent(m.reply_to) : null;
                  const mediaData = parseMediaContent(m);

                  if (m.type === "system") {
                    return (
                      <div key={m.id}>
                        {showDateSep && (
                          <div className="flex items-center justify-center my-3">
                            <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">
                              {formatDateSeparator(msgDate)}
                            </span>
                          </div>
                        )}
                        <SystemMessage content={m.content} />
                      </div>
                    );
                  }

                  return (
                    <div key={m.id}>
                      {showDateSep && (
                        <div className="flex items-center justify-center my-3">
                          <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">
                            {formatDateSeparator(msgDate)}
                          </span>
                        </div>
                      )}
                      <SwipeMessage onSwipeReply={() => handleReply(m)}>
                        <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                              isMe
                                ? "bg-primary/20 border border-primary/30 text-foreground rounded-br-md"
                                : "bg-secondary/60 border border-border text-foreground rounded-bl-md"
                            }`}
                          >
                            {replyData && (
                              <div className="mb-1.5 pl-2 border-l-2 border-accent/50 opacity-70">
                                <p className="text-[10px] font-semibold">{replyData.name}</p>
                                <p className="text-[11px] truncate">{replyData.content}</p>
                              </div>
                            )}
                            {mediaData ? (
                              <MediaMessage url={mediaData.url} type={mediaData.mediaType} metadata={{ width: mediaData.width, height: mediaData.height }} />
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            )}
                            <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                              <span className="text-[10px] opacity-60">{format(msgDate, "HH:mm")}</span>
                              {isMe && <ReadReceiptTicks isRead={isRead(m.id)} isMine={isMe} />}
                            </div>
                          </div>
                        </div>
                      </SwipeMessage>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Mobile input */}
            <div className="border-t border-border bg-card/50">
              {replyTo && (
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border">
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
              <div className="px-3 py-2 flex gap-2">
                {activeConvId && (
                  <MediaUploadButton conversationId={activeConvId} onMediaSent={handleMediaSent} disabled={sending} />
                )}
                <Input
                  ref={inputRef}
                  value={msg}
                  onChange={(e) => { setMsg(e.target.value); sendTyping(); }}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Mensagem..."
                  className="bg-secondary/50 border-border/50 h-10"
                  style={{ fontSize: "16px" }}
                  disabled={!activeConvId}
                />
                <Button onClick={handleSend} disabled={!msg.trim() || sending || !activeConvId} size="icon" className="shrink-0 h-10 w-10 rounded-full crimson-gradient">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: original side-by-side layout */}
      <div className="hidden md:flex h-[calc(100vh-220px)] gap-0 rounded-xl overflow-hidden border border-border">
        {/* Sidebar */}
        <div className="w-[340px] shrink-0 bg-card/50 border-r border-border overflow-y-auto flex flex-col">
          <div className="p-2 space-y-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar aluno..."
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center">
              <User size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum aluno vinculado.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-4 py-3.5 border-b border-border/30 hover:bg-secondary/30 transition-colors ${
                  selectedItem?.id === item.id ? "bg-secondary/40" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.type === "group" ? (
                    <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                      <Users size={16} className="text-accent" />
                    </div>
                  ) : item.avatarUrl ? (
                    <div className="relative shrink-0">
                      <img src={item.avatarUrl} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                      {item.studentId && (
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isOnline(item.studentId) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                      )}
                    </div>
                  ) : (
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
                        <User size={16} className="text-accent" />
                      </div>
                      {item.studentId && (
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isOnline(item.studentId) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {item.type === "group" && item.memberNames?.length
                          ? item.memberNames.join(", ")
                          : item.name}
                      </p>
                      <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{formatConvTime(item.lastTime)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate pr-2">
                        {item.type === "group"
                          ? item.lastMessage || "Grupo multidisciplinar"
                          : item.type === "new"
                            ? "Clique para iniciar conversa..."
                            : item.lastMessage || "Inicie a conversa..."}
                      </p>
                      {item.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                          {item.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-card/30">
          {/* Chat Header */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card/50">
            <div>
              <h2 className="font-cinzel text-sm font-bold text-foreground tracking-wide">
                {selectedItem?.name?.toUpperCase() || "SELECIONE UM ALUNO"}
              </h2>
              {typingUsers.length > 0 ? (
                <p className="text-xs text-accent animate-pulse">digitando...</p>
              ) : selectedStudentOnline ? (
                <p className="text-xs text-green-400">Online</p>
              ) : null}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
          >
            {msgsLoading && hasMore && (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
              </div>
            )}
            {!selectedItem ? (
              <div className="text-center text-muted-foreground text-sm py-10">
                <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                <p>Selecione um aluno para iniciar</p>
              </div>
            ) : initialLoad ? (
              <SkeletonMessages />
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-10">
                <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                <p>Nenhuma mensagem ainda. Envie a primeira!</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.sender_id === user?.id;
                const msgDate = new Date(m.created_at);
                const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
                const showDateSep = !prevDate || startOfDay(msgDate).getTime() !== startOfDay(prevDate).getTime();
                const replyData = m.reply_to ? getReplyContent(m.reply_to) : null;
                const mediaData = parseMediaContent(m);

                if (m.type === "system") {
                  return (
                    <div key={m.id}>
                      {showDateSep && (
                        <div className="flex items-center justify-center my-3">
                          <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">
                            {formatDateSeparator(msgDate)}
                          </span>
                        </div>
                      )}
                      <SystemMessage content={m.content} />
                    </div>
                  );
                }

                return (
                  <div key={m.id}>
                    {showDateSep && (
                      <div className="flex items-center justify-center my-3 sticky top-0 z-[5]">
                        <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">
                          {formatDateSeparator(msgDate)}
                        </span>
                      </div>
                    )}
                    <SwipeMessage onSwipeReply={() => handleReply(m)}>
                      <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                        <div className="flex items-center gap-1 max-w-[75%]">
                          {isMe && (
                            <button
                              onClick={() => handleReply(m)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50 shrink-0"
                            >
                              <Reply size={14} className="text-muted-foreground" />
                            </button>
                          )}
                          <div
                            className={`px-4 py-2.5 rounded-xl text-sm ${
                              isMe
                                ? "bg-primary/20 border border-primary/30 text-foreground rounded-br-sm"
                                : "bg-secondary/60 border border-border text-foreground rounded-bl-sm"
                            }`}
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {replyData && (
                              <div className={`mb-2 pl-2 border-l-2 ${isMe ? "border-primary/50" : "border-muted-foreground/30"} rounded-sm`}>
                                <p className="text-[10px] font-semibold opacity-70">{replyData.name}</p>
                                <p className="text-[11px] opacity-60 truncate max-w-[200px]">{replyData.content}</p>
                              </div>
                            )}
                            {mediaData ? (
                              <MediaMessage
                                url={mediaData.url}
                                type={mediaData.mediaType}
                                metadata={{ width: mediaData.width, height: mediaData.height }}
                              />
                            ) : (
                              <p className="leading-relaxed">{m.content}</p>
                            )}
                            <p className={`text-[10px] mt-1.5 ${isMe ? "text-right" : "text-left"} text-muted-foreground flex items-center ${isMe ? "justify-end" : "justify-start"} gap-0.5`}>
                              {format(msgDate, "HH:mm")}
                              <ReadReceiptTicks isRead={isRead(m.id)} isMine={isMe} />
                            </p>
                          </div>
                          {!isMe && (
                            <button
                              onClick={() => handleReply(m)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50"
                            >
                              <Reply size={14} className="text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                    </SwipeMessage>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Reply preview + Input */}
          <div className="border-t border-border bg-card/50">
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
            <div className="px-4 py-3 flex gap-3">
              {activeConvId && (
                <MediaUploadButton
                  conversationId={activeConvId}
                  onMediaSent={handleMediaSent}
                  disabled={sending}
                />
              )}
              <Input
                ref={inputRef}
                value={msg}
                onChange={(e) => {
                  setMsg(e.target.value);
                  sendTyping();
                }}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Digite sua mensagem..."
                className="bg-secondary/50 border-border/50 h-10"
                disabled={!activeConvId}
              />
              <Button
                onClick={handleSend}
                disabled={!msg.trim() || sending || !activeConvId}
                size="icon"
                className="shrink-0 h-10 w-10 rounded-full crimson-gradient"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EspecialistaChat;
