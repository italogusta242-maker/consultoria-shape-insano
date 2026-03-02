import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, MessageCircle, Reply, X, Search, Loader2, Eye } from "lucide-react";
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

import { toast } from "sonner";

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
  otherUserId?: string;
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

const AdminComunicacao = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUserId = searchParams.get("userId");
  const observeUserId = searchParams.get("observe");
  const isObserverMode = !!observeUserId;

  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [observedName, setObservedName] = useState<string>("");
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, { nome: string | null; avatar_url: string | null }>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);

  const {
    messages, loading: msgsLoading, initialLoad, hasMore, loadMore,
    addOptimistic, replaceOptimistic, removeOptimistic,
  } = useChatMessages(activeConvId);

  const myName = profile?.nome || "Admin";
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(isObserverMode ? null : activeConvId, user?.id, myName);
  const { isOnline } = usePresence(activeConvId, user?.id);
  const { isRead } = useReadReceipts(activeConvId, user?.id);

  // Load sidebar
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // OBSERVER MODE: load conversations of the observed specialist
      if (isObserverMode && observeUserId) {
        // Get observed user profile
        const { data: obsProfile } = await supabase
          .from("profiles")
          .select("id, nome, avatar_url")
          .eq("id", observeUserId)
          .maybeSingle();
        setObservedName(obsProfile?.nome || "Especialista");

        // Get all conversations the specialist participates in
        const { data: specParts } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", observeUserId);

        const convIds = (specParts || []).map((p) => p.conversation_id);
        let convItems: SidebarItem[] = [];

        if (convIds.length > 0) {
          const { data: convs } = await supabase
            .from("conversations")
            .select("*")
            .in("id", convIds);

          const { data: allParts } = await supabase
            .from("conversation_participants")
            .select("conversation_id, user_id")
            .in("conversation_id", convIds);

          const allUserIds = [...new Set((allParts || []).map((p) => p.user_id))];
          let allProfiles: { id: string; nome: string | null; avatar_url: string | null }[] = [];
          if (allUserIds.length > 0) {
            const { data } = await supabase
              .from("profiles")
              .select("id, nome, avatar_url")
              .in("id", allUserIds);
            allProfiles = data || [];
          }

          // Store participant profiles for message sender names
          const profileMap: Record<string, { nome: string | null; avatar_url: string | null }> = {};
          allProfiles.forEach((p) => { profileMap[p.id] = { nome: p.nome, avatar_url: p.avatar_url }; });
          setParticipantProfiles(profileMap);

          // Batch fetch last messages using the DB function (avoids N+1)
          const { data: lastMsgsData } = await supabase.rpc("get_last_messages", { conv_ids: convIds });
          const lastMsgMap: Record<string, { content: string; created_at: string }> = {};
          (lastMsgsData || []).forEach((m: any) => {
            lastMsgMap[m.conversation_id] = { content: m.content, created_at: m.created_at };
          });

          for (const c of convs || []) {
            // Only show direct conversations in observer mode (no groups)
            if (c.type !== "direct") continue;
            const cParts = (allParts || []).filter((p) => p.conversation_id === c.id && p.user_id !== observeUserId);
            const lastMsg = lastMsgMap[c.id];

            const otherId = cParts[0]?.user_id;
            const other = allProfiles.find((p) => p.id === otherId);
            convItems.push({
              id: c.id,
              type: "direct",
              name: other?.nome || "Usuário",
              otherUserId: otherId,
              avatarUrl: other?.avatar_url,
              lastMessage: lastMsg?.content,
              lastTime: lastMsg?.created_at,
              unread: 0,
            });
          }
        }

        convItems.sort((a, b) => {
          if (!a.lastTime) return 1;
          if (!b.lastTime) return -1;
          return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
        });

        setSidebarItems(convItems);
        if (convItems.length > 0) {
          setSelectedItem(convItems[0]);
          setActiveConvId(convItems[0].id);
        }
        setLoading(false);
        return;
      }

      // NORMAL MODE: load admin's own conversations + all users for new chats
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      const convIds = (myParts || []).map((p) => p.conversation_id);
      let convItems: SidebarItem[] = [];
      const existingOtherIds = new Set<string>();

      if (convIds.length > 0) {
        const { data: convs } = await supabase
          .from("conversations")
          .select("*")
          .in("id", convIds)
          .eq("type", "direct"); // Only direct conversations

        const directConvIds = (convs || []).map((c) => c.id);

        const { data: allParts } = directConvIds.length > 0
          ? await supabase
              .from("conversation_participants")
              .select("conversation_id, user_id")
              .in("conversation_id", directConvIds)
          : { data: [] };

        const otherIds = [...new Set((allParts || []).filter((p) => p.user_id !== user.id).map((p) => p.user_id))];
        let otherProfiles: { id: string; nome: string | null; avatar_url: string | null }[] = [];
        if (otherIds.length > 0) {
          const { data } = await supabase
            .from("profiles")
            .select("id, nome, avatar_url")
            .in("id", otherIds);
          otherProfiles = data || [];
        }

        // Batch fetch last messages
        let lastMsgMap: Record<string, { content: string; created_at: string }> = {};
        if (directConvIds.length > 0) {
          const { data: lastMsgsData } = await supabase.rpc("get_last_messages", { conv_ids: directConvIds });
          (lastMsgsData || []).forEach((m: any) => {
            lastMsgMap[m.conversation_id] = { content: m.content, created_at: m.created_at };
          });
        }

        for (const c of convs || []) {
          const cParts = (allParts || []).filter((p) => p.conversation_id === c.id && p.user_id !== user.id);
          const lastMsg = lastMsgMap[c.id];
          const otherId = cParts[0]?.user_id;
          if (otherId) existingOtherIds.add(otherId);
          const other = otherProfiles.find((p) => p.id === otherId);
          convItems.push({
            id: c.id,
            type: "direct",
            name: other?.nome || "Usuário",
            otherUserId: otherId,
            avatarUrl: other?.avatar_url,
            lastMessage: lastMsg?.content,
            lastTime: lastMsg?.created_at,
            unread: 0,
          });
        }
      }

      // Load ALL profiles (students + specialists) the admin doesn't have a conversation with yet
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .neq("id", user.id);

      const newContactItems: SidebarItem[] = (allProfiles || [])
        .filter((p) => !existingOtherIds.has(p.id))
        .map((p) => ({
          id: `new-${p.id}`,
          type: "new" as const,
          name: p.nome || "Usuário",
          otherUserId: p.id,
          avatarUrl: p.avatar_url,
          unread: 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      convItems.sort((a, b) => {
        if (!a.lastTime) return 1;
        if (!b.lastTime) return -1;
        return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
      });

      setSidebarItems([...convItems, ...newContactItems]);

      // If targetUserId is set, find or create conversation with that user
      if (targetUserId) {
        const existing = convItems.find((c) => c.type === "direct" && c.otherUserId === targetUserId);
        if (existing) {
          setSelectedItem(existing);
          setActiveConvId(existing.id);
        } else {
          try {
            const { data: newConv, error } = await supabase
              .from("conversations")
              .insert({ type: "direct" })
              .select("id")
              .single();
            if (error || !newConv) throw new Error(error?.message || "Erro");
            await supabase.from("conversation_participants").insert([
              { conversation_id: newConv.id, user_id: user.id },
              { conversation_id: newConv.id, user_id: targetUserId },
            ]);
            const { data: targetProfile } = await supabase
              .from("profiles")
              .select("id, nome, avatar_url")
              .eq("id", targetUserId)
              .maybeSingle();

            const newItem: SidebarItem = {
              id: newConv.id,
              type: "direct",
              name: targetProfile?.nome || "Usuário",
              otherUserId: targetUserId,
              avatarUrl: targetProfile?.avatar_url,
              unread: 0,
            };
            setSidebarItems((prev) => [newItem, ...prev]);
            setSelectedItem(newItem);
            setActiveConvId(newConv.id);
          } catch (err: any) {
            toast.error("Erro ao criar conversa: " + err.message);
          }
        }
        setSearchParams({}, { replace: true });
      } else if (convItems.length > 0 && !selectedItem) {
        setSelectedItem(convItems[0]);
        setActiveConvId(convItems[0].id);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  const handleSelect = async (item: SidebarItem) => {
    setReplyTo(null);
    
    if (item.type === "new" && item.otherUserId && user) {
      // Create a new direct conversation
      try {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({ type: "direct" })
          .select("id")
          .single();
        if (error || !newConv) throw new Error(error?.message || "Erro");
        await supabase.from("conversation_participants").insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: item.otherUserId },
        ]);
        const createdItem: SidebarItem = {
          ...item,
          id: newConv.id,
          type: "direct",
        };
        setSidebarItems((prev) =>
          [createdItem, ...prev.filter((i) => i.id !== item.id)]
        );
        setSelectedItem(createdItem);
        setActiveConvId(newConv.id);
      } catch (err: any) {
        toast.error("Erro ao criar conversa: " + err.message);
      }
      return;
    }

    setSelectedItem(item);
    setActiveConvId(item.id);
  };

  // Auto-scroll
  useEffect(() => {
    if (!initialLoad) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, initialLoad]);

  useEffect(() => {
    if (!initialLoad) bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [initialLoad]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || msgsLoading || !hasMore) return;
    if (el.scrollTop < 80) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadMore().then(() => {
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
        });
      });
    }
  }, [msgsLoading, hasMore, loadMore]);

  const handleSend = async () => {
    if (isObserverMode) return; // Block sending in observer mode
    if (!msg.trim() || !user || !activeConvId || sending) return;
    setSending(true);
    stopTyping();

    const content = msg.trim();
    const insertData: any = { conversation_id: activeConvId, sender_id: user.id, content };
    if (replyTo) insertData.reply_to = replyTo.id;

    const optimisticId = crypto.randomUUID();
    addOptimistic({
      id: optimisticId, content, sender_id: user.id,
      created_at: new Date().toISOString(), reply_to: replyTo?.id || null, type: "text",
    });
    setMsg("");
    setReplyTo(null);

    const { data, error } = await supabase.from("chat_messages").insert(insertData).select().single();
    if (data) replaceOptimistic(optimisticId, data as ChatMessage);
    else if (error) removeOptimistic(optimisticId);
    setSending(false);
  };

  const handleMediaSent = async (url: string, mediaType: "image" | "video", metadata: { width: number; height: number; size: number }) => {
    if (isObserverMode) return;
    if (!activeConvId || !user) return;
    const content = JSON.stringify({ url, mediaType, ...metadata });
    const optimisticId = crypto.randomUUID();
    addOptimistic({ id: optimisticId, content, sender_id: user.id, created_at: new Date().toISOString(), type: mediaType });
    const { data, error } = await supabase.from("chat_messages").insert({
      conversation_id: activeConvId, sender_id: user.id, content, type: mediaType,
    }).select().single();
    if (data) replaceOptimistic(optimisticId, data as ChatMessage);
    else if (error) removeOptimistic(optimisticId);
  };

  const getSenderName = (senderId: string) => {
    if (isObserverMode) {
      return participantProfiles[senderId]?.nome || "Usuário";
    }
    if (senderId === user?.id) return "Você";
    return selectedItem?.name || "Usuário";
  };

  const getReplyContent = (replyToId: string) => {
    const m = messages.find((m) => m.id === replyToId);
    if (!m) return null;
    return { name: getSenderName(m.sender_id), content: m.type === "image" || m.type === "video" ? "📎 Mídia" : m.content };
  };

  const handleReply = (m: ChatMessage) => {
    if (isObserverMode) return;
    setReplyTo(m);
    inputRef.current?.focus();
  };

  const parseMediaContent = (m: ChatMessage) => {
    if (m.type !== "image" && m.type !== "video") return null;
    try {
      return JSON.parse(m.content) as { url: string; mediaType: "image" | "video"; width: number; height: number };
    } catch {
      return { url: m.content, mediaType: m.type as "image" | "video", width: 0, height: 0 };
    }
  };

  const filteredItems = sidebarItems.filter((item) => {
    if (item.type === "group") return false; // Never show groups
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q);
  });

  const selectedOtherOnline = selectedItem?.otherUserId ? isOnline(selectedItem.otherUserId) : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary mr-2" />
        <p className="text-muted-foreground text-sm">Carregando conversas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">
          {isObserverMode ? "Modo Observador" : "Comunicação"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isObserverMode
            ? `Visualizando conversas de ${observedName} (somente leitura)`
            : "Chat direto com profissionais e alunos"
          }
        </p>
      </div>

      {/* Observer mode banner */}
      {isObserverMode && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30">
          <Eye size={18} className="text-accent shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Modo Observador Ativo</p>
            <p className="text-xs text-muted-foreground">
              Você está visualizando as conversas de <strong>{observedName}</strong>. Nenhuma mensagem pode ser enviada.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs shrink-0"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Sair
          </Button>
        </div>
      )}

      <div className="flex h-[calc(100vh-220px)] gap-0 rounded-xl overflow-hidden border border-border">
        {/* Sidebar */}
        <div className="w-[340px] shrink-0 bg-card/50 border-r border-border overflow-y-auto flex flex-col">
          <div className="p-2 space-y-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversa..."
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isObserverMode ? "Nenhuma conversa encontrada para este profissional." : "Nenhuma conversa encontrada."}
                </p>
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
                    {item.avatarUrl ? (
                      <div className="relative shrink-0">
                        <img src={item.avatarUrl} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                        {item.otherUserId && (
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isOnline(item.otherUserId) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        )}
                      </div>
                    ) : (
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
                          <User size={16} className="text-accent" />
                        </div>
                        {item.otherUserId && (
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isOnline(item.otherUserId) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {item.name}
                        </p>
                        {item.type !== "new" && (
                          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{formatConvTime(item.lastTime)}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.type === "new" ? "Iniciar conversa" : item.lastMessage || "Sem mensagens ainda..."}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-card/30">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-card/50">
            <div>
              <h2 className="font-cinzel text-sm font-bold text-foreground tracking-wide">
                {selectedItem?.name?.toUpperCase() || "SELECIONE UMA CONVERSA"}
              </h2>
              {!isObserverMode && typingUsers.length > 0 ? (
                <p className="text-xs text-accent animate-pulse">digitando...</p>
              ) : selectedOtherOnline ? (
                <p className="text-xs text-green-400">Online</p>
              ) : null}
            </div>
            {isObserverMode && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30">
                <Eye size={12} className="text-accent" />
                <span className="text-[10px] font-medium text-accent">Somente leitura</span>
              </div>
            )}
          </div>

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
                <p>Selecione uma conversa para visualizar</p>
              </div>
            ) : initialLoad ? (
              <SkeletonMessages />
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-10">
                <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
                <p>{isObserverMode ? "Nenhuma mensagem nesta conversa." : "Nenhuma mensagem ainda. Envie a primeira!"}</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                // In observer mode, highlight messages from the observed specialist
                const isObservedUser = isObserverMode && m.sender_id === observeUserId;
                const isMe = !isObserverMode && m.sender_id === user?.id;
                const isRight = isMe || isObservedUser;
                const msgDate = new Date(m.created_at);
                const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at) : null;
                const showDateSep = !prevDate || startOfDay(msgDate).getTime() !== startOfDay(prevDate).getTime();
                const replyData = m.reply_to ? getReplyContent(m.reply_to) : null;
                const mediaData = parseMediaContent(m);
                const senderName = getSenderName(m.sender_id);

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
                    <div className={`flex ${isRight ? "justify-end" : "justify-start"} group`}>
                      <div className="flex flex-col max-w-[75%]">
                        {/* Show sender name in observer mode */}
                        {isObserverMode && (
                          <p className={`text-[10px] font-semibold mb-0.5 px-1 ${isRight ? "text-right text-accent" : "text-left text-muted-foreground"}`}>
                            {senderName}
                          </p>
                        )}
                        <div
                          className={`px-4 py-2.5 rounded-xl text-sm ${
                            isRight
                              ? "bg-primary/20 border border-primary/30 text-foreground rounded-br-sm"
                              : "bg-secondary/60 border border-border text-foreground rounded-bl-sm"
                          }`}
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {replyData && (
                            <div className={`mb-2 pl-2 border-l-2 ${isRight ? "border-primary/50" : "border-muted-foreground/30"} rounded-sm`}>
                              <p className="text-[10px] font-semibold opacity-70">{replyData.name}</p>
                              <p className="text-[11px] opacity-60 truncate max-w-[200px]">{replyData.content}</p>
                            </div>
                          )}
                          {mediaData ? (
                            <MediaMessage url={mediaData.url} type={mediaData.mediaType} metadata={{ width: mediaData.width, height: mediaData.height }} />
                          ) : (
                            <p className="leading-relaxed">{m.content}</p>
                          )}
                          <p className={`text-[10px] mt-1.5 ${isRight ? "text-right" : "text-left"} text-muted-foreground flex items-center ${isRight ? "justify-end" : "justify-start"} gap-0.5`}>
                            {format(msgDate, "HH:mm")}
                            {!isObserverMode && <ReadReceiptTicks isRead={isRead(m.id)} isMine={isMe} />}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area - hidden in observer mode */}
          {!isObserverMode && (
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
                  <MediaUploadButton conversationId={activeConvId} onMediaSent={handleMediaSent} disabled={sending} />
                )}
                <Input
                  ref={inputRef}
                  value={msg}
                  onChange={(e) => { setMsg(e.target.value); sendTyping(); }}
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
          )}

          {/* Observer mode footer */}
          {isObserverMode && (
            <div className="border-t border-border bg-card/50 px-5 py-3 flex items-center justify-center gap-2">
              <Eye size={14} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Modo observador — somente leitura</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminComunicacao;
