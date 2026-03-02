import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Users, MessageCircle, Reply, X, Search, Headset, Shield, Dumbbell } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  type: "direct" | "new";
  name: string;
  otherUserId?: string;
  avatarUrl?: string | null;
  lastMessage?: string;
  lastTime?: string;
  unread: number;
  category: "aluno" | "especialista" | "admin";
}

const formatConvTime = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM");
};

type TabCategory = "alunos" | "especialistas" | "admin";

const CSChat = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<SidebarItem | null>(null);
  const [sidebarTab, setSidebarTab] = useState<TabCategory>("alunos");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);

  const {
    messages, loading: msgsLoading, initialLoad, hasMore, loadMore,
    addOptimistic, replaceOptimistic, removeOptimistic,
  } = useChatMessages(activeConvId);

  const myName = profile?.nome || "CS";
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(activeConvId, user?.id, myName);
  const { isOnline } = usePresence(activeConvId, user?.id);
  const { isRead } = useReadReceipts(activeConvId, user?.id);

  // Load sidebar conversations
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Get all roles to categorize users
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role");
      const rolesMap = new Map<string, string[]>();
      for (const r of allRoles || []) {
        if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
        rolesMap.get(r.user_id)!.push(r.role);
      }

      // Get my conversations
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      const convIds = (myParts || []).map((p) => p.conversation_id);
      const items: SidebarItem[] = [];

      if (convIds.length > 0) {
        const { data: convs } = await supabase
          .from("conversations")
          .select("*")
          .in("id", convIds)
          .eq("type", "direct");

        const { data: allParts } = await supabase
          .from("conversation_participants")
          .select("conversation_id, user_id")
          .in("conversation_id", convIds);

        const otherIds = [...new Set((allParts || []).filter((p) => p.user_id !== user.id).map((p) => p.user_id))];
        let otherProfiles: { id: string; nome: string | null; avatar_url: string | null }[] = [];
        if (otherIds.length > 0) {
          const { data } = await supabase
            .from("profiles")
            .select("id, nome, avatar_url")
            .in("id", otherIds);
          otherProfiles = data || [];
        }

        for (const c of convs || []) {
          const cParts = (allParts || []).filter((p) => p.conversation_id === c.id && p.user_id !== user.id);
          const otherId = cParts[0]?.user_id;
          if (!otherId) continue;

          const other = otherProfiles.find((p) => p.id === otherId);
          const userRoles = rolesMap.get(otherId) || [];

          // Determine category
          let category: "aluno" | "especialista" | "admin" = "aluno";
          if (userRoles.includes("admin")) {
            category = "admin";
          } else if (userRoles.includes("personal") || userRoles.includes("nutricionista") || userRoles.includes("especialista")) {
            category = "especialista";
          }

          const { data: lastMsgs } = await supabase
            .from("chat_messages")
            .select("content, created_at")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const lastMsg = lastMsgs?.[0];

          items.push({
            id: c.id,
            type: "direct",
            name: other?.nome || "Usuário",
            otherUserId: otherId,
            avatarUrl: other?.avatar_url,
            lastMessage: lastMsg?.content,
            lastTime: lastMsg?.created_at,
            unread: 0,
            category,
          });
        }
      }

      // Sort by last message time
      items.sort((a, b) => {
        if (!a.lastTime) return 1;
        if (!b.lastTime) return -1;
        return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
      });

      setSidebarItems(items);
      // Select first item in the default tab
      const alunoItems = items.filter(i => i.category === "aluno");
      if (alunoItems.length > 0 && !selectedItem) {
        setSelectedItem(alunoItems[0]);
        setActiveConvId(alunoItems[0].id);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const handleSelect = (item: SidebarItem) => {
    setSelectedItem(item);
    setReplyTo(null);
    setActiveConvId(item.id);
  };

  const handleStartChat = async (targetUserId: string, targetName: string, category: "especialista" | "admin") => {
    if (!user) return;
    try {
      // Check existing conversation
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      const { data: targetParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", targetUserId);

      const myConvIds = new Set((myParts ?? []).map((p) => p.conversation_id));
      const sharedConvId = (targetParts ?? []).find((p) => myConvIds.has(p.conversation_id))?.conversation_id;

      if (sharedConvId) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("id, type")
          .eq("id", sharedConvId)
          .eq("type", "direct")
          .maybeSingle();

        if (conv) {
          // Check if already in sidebar
          const existing = sidebarItems.find(i => i.id === conv.id);
          if (existing) {
            handleSelect(existing);
          } else {
            const newItem: SidebarItem = {
              id: conv.id, type: "direct", name: targetName,
              otherUserId: targetUserId, unread: 0, category,
            };
            setSidebarItems(prev => [newItem, ...prev]);
            handleSelect(newItem);
          }
          return;
        }
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ type: "direct", title: null })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("conversation_participants").insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: targetUserId },
      ]);

      const newItem: SidebarItem = {
        id: newConv.id, type: "direct", name: targetName,
        otherUserId: targetUserId, unread: 0, category,
      };
      setSidebarItems(prev => [newItem, ...prev]);
      handleSelect(newItem);
    } catch (err) {
      toast.error("Erro ao iniciar conversa");
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (!initialLoad) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, initialLoad]);

  useEffect(() => {
    if (!initialLoad) bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [initialLoad]);

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
    if (!msg.trim() || !user || !activeConvId || sending) return;
    setSending(true);
    stopTyping();

    const content = msg.trim();
    const insertData: any = { conversation_id: activeConvId, sender_id: user.id, content };
    if (replyTo) insertData.reply_to = replyTo.id;

    const optimisticId = crypto.randomUUID();
    addOptimistic({ id: optimisticId, content, sender_id: user.id, created_at: new Date().toISOString(), reply_to: replyTo?.id || null, type: "text" });
    setMsg("");
    setReplyTo(null);

    const { data, error } = await supabase.from("chat_messages").insert(insertData).select().single();
    if (data) replaceOptimistic(optimisticId, data as ChatMessage);
    else if (error) removeOptimistic(optimisticId);
    setSending(false);
  };

  const handleMediaSent = async (url: string, mediaType: "image" | "video", metadata: { width: number; height: number; size: number }) => {
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
    if (senderId === user?.id) return "Você";
    return selectedItem?.name || "Usuário";
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
      return JSON.parse(m.content) as { url: string; mediaType: "image" | "video"; width: number; height: number };
    } catch {
      return { url: m.content, mediaType: m.type as "image" | "video", width: 0, height: 0 };
    }
  };

  const filteredItems = sidebarItems.filter((item) => {
    const matchesTab = item.category === (sidebarTab === "especialistas" ? "especialista" : sidebarTab === "admin" ? "admin" : "aluno");
    if (!matchesTab) return false;
    if (!searchQuery.trim()) return true;
    return item.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedOtherOnline = selectedItem?.otherUserId ? isOnline(selectedItem.otherUserId) : false;

  // New chat functionality for especialistas/admin tabs
  const [availableUsers, setAvailableUsers] = useState<{ id: string; nome: string; avatar_url: string | null }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadAvailableUsers = async (tab: TabCategory) => {
    if (tab === "alunos") return;
    setLoadingUsers(true);
    const targetRole = tab === "especialistas" ? ["personal", "nutricionista", "especialista"] : ["admin"];

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const targetIds = [...new Set((roles || []).filter(r => targetRole.includes(r.role) && r.user_id !== user?.id).map(r => r.user_id))];

    if (targetIds.length > 0) {
      const existingOtherIds = new Set(sidebarItems.filter(i => i.category === (tab === "especialistas" ? "especialista" : "admin")).map(i => i.otherUserId));
      const newIds = targetIds.filter(id => !existingOtherIds.has(id));

      if (newIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", newIds);
        setAvailableUsers(profiles || []);
      } else {
        setAvailableUsers([]);
      }
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    if (user) loadAvailableUsers(sidebarTab);
  }, [sidebarTab, user, sidebarItems.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Carregando conversas...</p>
      </div>
    );
  }

  const tabIcon = (tab: TabCategory) => {
    if (tab === "alunos") return <Headset size={13} />;
    if (tab === "especialistas") return <Dumbbell size={13} />;
    return <Shield size={13} />;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Chat</h1>
        <p className="text-sm text-muted-foreground">Comunicação com alunos, especialistas e administração</p>
      </div>

      <div className="flex h-[calc(100vh-220px)] gap-0 rounded-xl overflow-hidden border border-border">
        {/* Sidebar */}
        <div className="w-[340px] shrink-0 bg-card/50 border-r border-border overflow-y-auto flex flex-col">
          <div className="p-2 space-y-2 border-b border-border">
            <Tabs value={sidebarTab} onValueChange={(v) => { setSidebarTab(v as TabCategory); setSearchQuery(""); }}>
              <TabsList className="w-full">
                <TabsTrigger value="alunos" className="flex-1 text-xs gap-1">{tabIcon("alunos")} Alunos</TabsTrigger>
                <TabsTrigger value="especialistas" className="flex-1 text-xs gap-1">{tabIcon("especialistas")} Equipe</TabsTrigger>
                <TabsTrigger value="admin" className="flex-1 text-xs gap-1">{tabIcon("admin")} Admin</TabsTrigger>
              </TabsList>
            </Tabs>
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
            {filteredItems.length === 0 && availableUsers.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
              </div>
            ) : (
              <>
                {filteredItems.map((item) => (
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
                          <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                          {item.lastTime && <span className="text-[10px] text-muted-foreground shrink-0">{formatConvTime(item.lastTime)}</span>}
                        </div>
                        {item.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.lastMessage}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {/* Show available users to start new conversations */}
                {availableUsers.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/20">
                      Iniciar conversa
                    </div>
                    {availableUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleStartChat(u.id, u.nome || "Usuário", sidebarTab === "especialistas" ? "especialista" : "admin")}
                        className="w-full text-left px-4 py-3 border-b border-border/30 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary/50 border border-border flex items-center justify-center">
                            <User size={16} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{u.nome || "Usuário"}</p>
                            <p className="text-[10px] text-muted-foreground">Nova conversa</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-background">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center space-y-2">
                <MessageCircle size={40} className="mx-auto text-muted-foreground/40" />
                <p>Selecione uma conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/30">
                <div className="relative">
                  {selectedItem.avatarUrl ? (
                    <img src={selectedItem.avatarUrl} alt={selectedItem.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
                      <User size={18} className="text-accent" />
                    </div>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${selectedOtherOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">{selectedItem.name}</h3>
                  {typingUsers.length > 0 ? (
                    <p className="text-xs text-accent animate-pulse">digitando...</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{selectedOtherOnline ? "Online" : "Offline"}</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
                {msgsLoading && hasMore && (
                  <div className="flex justify-center py-2">
                    <div className="w-5 h-5 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                  </div>
                )}
                {initialLoad ? (
                  <SkeletonMessages />
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem ainda. Inicie a conversa!</div>
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
                              <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">{formatDateSeparator(msgDate)}</span>
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
                            <span className="px-3 py-1 rounded-full bg-secondary/60 text-[11px] text-muted-foreground font-medium">{formatDateSeparator(msgDate)}</span>
                          </div>
                        )}
                        <SwipeMessage onSwipeReply={() => handleReply(m)}>
                          <div className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                            <div className="flex items-center gap-1 max-w-[80%]">
                              {isMe && (
                                <button onClick={() => handleReply(m)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50 shrink-0">
                                  <Reply size={14} className="text-muted-foreground" />
                                </button>
                              )}
                              <div className={`rounded-xl px-4 py-2.5 text-sm ${isMe ? "bg-accent/20 border border-accent/30 text-foreground" : "bg-secondary/60 border border-border text-foreground"}`} style={{ overflowWrap: "anywhere" }}>
                                {replyData && (
                                  <div className={`mb-2 pl-2 border-l-2 ${isMe ? "border-accent/50" : "border-border"} rounded-sm`}>
                                    <p className="text-[10px] font-semibold opacity-70">{replyData.name}</p>
                                    <p className="text-[11px] opacity-60 truncate max-w-[200px]">{replyData.content}</p>
                                  </div>
                                )}
                                {!isMe && (
                                  <p className="text-[10px] font-semibold text-accent mb-0.5 opacity-70">{getSenderName(m.sender_id)}</p>
                                )}
                                {mediaData ? (
                                  <MediaMessage url={mediaData.url} type={mediaData.mediaType} metadata={{ width: mediaData.width, height: mediaData.height }} />
                                ) : (
                                  <p>{m.content}</p>
                                )}
                                <p className="text-[9px] text-muted-foreground mt-1 text-right flex items-center justify-end gap-0.5">
                                  {format(new Date(m.created_at), "HH:mm")}
                                  <ReadReceiptTicks isRead={isRead(m.id)} isMine={isMe} />
                                </p>
                              </div>
                              {!isMe && (
                                <button onClick={() => handleReply(m)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary/50">
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

              {/* Reply + Input */}
              <div className="border-t border-border bg-background">
                {replyTo && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border-b border-border">
                    <Reply size={14} className="text-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-accent">{getSenderName(replyTo.sender_id)}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{replyTo.content}</p>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-secondary rounded"><X size={14} className="text-muted-foreground" /></button>
                  </div>
                )}
                <div className="flex gap-2 px-4 py-3">
                  <MediaUploadButton conversationId={activeConvId || ""} onMediaSent={handleMediaSent} />
                  <Input
                    ref={inputRef}
                    value={msg}
                    onChange={(e) => { setMsg(e.target.value); sendTyping(); }}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-secondary/50 border-border/50"
                  />
                  <Button onClick={handleSend} disabled={sending || !msg.trim()} size="icon" className="bg-accent hover:bg-accent/90 shrink-0">
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSChat;
