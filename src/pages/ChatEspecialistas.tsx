import { useState, useEffect } from "react";
import { Dumbbell, Leaf, Headset, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ConversationItem {
  id: string;
  otherName: string;
  otherRole: string;
  color: string;
  bg: string;
  border: string;
  icon: LucideIcon;
}

const roleConfig: Record<string, { color: string; bg: string; border: string; label: string; icon: LucideIcon }> = {
  preparador_fisico: { color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-800/50", label: "Preparador Físico", icon: Dumbbell },
  preparador: { color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-800/50", label: "Preparador Físico", icon: Dumbbell },
  personal: { color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-800/50", label: "Preparador Físico", icon: Dumbbell },
  nutricionista: { color: "text-green-400", bg: "bg-green-900/30", border: "border-green-800/50", label: "Nutricionista", icon: Leaf },
  default: { color: "text-muted-foreground", bg: "bg-secondary", border: "border-border", label: "Especialista", icon: Dumbbell },
};

const ChatEspecialistas = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // 1. Start from student_specialists — the source of truth (single query)
      const { data: links } = await supabase
        .from("student_specialists")
        .select("specialist_id, specialty")
        .eq("student_id", user.id);

      if (!links || links.length === 0) {
        setLoading(false);
        return;
      }

      const specialistIds = links.map((l) => l.specialist_id);

      // 2. Parallel: get profiles + find direct conversations
      const [profilesRes, participationsRes] = await Promise.all([
        supabase.from("profiles").select("id, nome").in("id", specialistIds),
        supabase.from("conversation_participants").select("conversation_id, user_id").in("user_id", [user.id, ...specialistIds]),
      ]);

      const profiles = profilesRes.data || [];
      const allParts = participationsRes.data || [];

      // Find conversation IDs where both user and a specialist participate
      const userConvIds = new Set(allParts.filter((p) => p.user_id === user.id).map((p) => p.conversation_id));

      // For each specialist, find shared direct conversation
      const items: ConversationItem[] = [];

      for (const link of links) {
        const specParts = allParts.filter((p) => p.user_id === link.specialist_id && userConvIds.has(p.conversation_id));
        // Pick the first shared conversation (direct)
        const convId = specParts[0]?.conversation_id;
        if (!convId) continue;

        const profile = profiles.find((p) => p.id === link.specialist_id);
        const rc = roleConfig[link.specialty] || roleConfig.default;

        items.push({
          id: convId,
          otherName: profile?.nome || "Membro da Equipe",
          otherRole: rc.label,
          color: rc.color,
          bg: rc.bg,
          border: rc.border,
          icon: rc.icon,
        });
      }

      setConversations(items);
      setLoading(false);
    };

    load();
  }, [user]);

  const handleSupportChat = async () => {
    if (!user) return;
    setSupportLoading(true);

    try {
      // Find a CS user
      const { data: csRoles, error: csErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cs")
        .limit(1);

      if (csErr) {
        console.error("Error finding CS:", csErr);
      }

      if (!csRoles || csRoles.length === 0) {
        // Fallback: if user is admin/cs, navigate to comunicacao
        toast.error("Nenhum agente de suporte disponível no momento");
        setSupportLoading(false);
        return;
      }

      const csUserId = csRoles[0].user_id;

      // If user IS the CS agent, don't create a conversation with yourself
      if (csUserId === user.id) {
        toast.info("Você é o agente de suporte!");
        setSupportLoading(false);
        return;
      }

      // Check if a direct conversation already exists between user and CS
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      const { data: csParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", csUserId);

      const myConvIds = new Set((myParts ?? []).map((p) => p.conversation_id));
      const sharedConvIds = (csParts ?? []).filter((p) => myConvIds.has(p.conversation_id)).map((p) => p.conversation_id);

      // Try to find an existing direct conversation
      if (sharedConvIds.length > 0) {
        const { data: directConvs } = await supabase
          .from("conversations")
          .select("id, type")
          .in("id", sharedConvIds)
          .eq("type", "direct");

        if (directConvs && directConvs.length > 0) {
          navigate(`/chat/${directConvs[0].id}`);
          setSupportLoading(false);
          return;
        }

        // If no direct but there's any shared conversation, use it
        navigate(`/chat/${sharedConvIds[0]}`);
        setSupportLoading(false);
        return;
      }

      // Create new support conversation
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({ type: "direct", title: "Suporte" })
        .select("id")
        .single();

      if (convErr) throw convErr;

      // Add participants
      const { error: partErr } = await supabase.from("conversation_participants").insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: csUserId },
      ]);

      if (partErr) throw partErr;

      navigate(`/chat/${newConv.id}`);
    } catch (err) {
      console.error("Support chat error:", err);
      toast.error("Erro ao abrir chat de suporte. Tente novamente.");
    } finally {
      setSupportLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24 min-h-[calc(100vh-4rem)] flex flex-col">
      <h1 className="font-cinzel text-2xl font-bold text-foreground mb-1 pt-2">EQUIPE TÉCNICA</h1>
      <p className="text-muted-foreground text-sm mb-6">Converse diretamente com seus instrutores e nutrição</p>

      <div className="flex-1 flex flex-col space-y-4">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-10">Carregando...</div>
        ) : conversations.length > 0 ? (
          conversations.map((conv, i) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className={`cursor-pointer bg-card rounded-xl border ${conv.border} p-4 flex items-center gap-4 transition-all hover:gold-shadow`}
            >
              <div className={`w-14 h-14 rounded-lg ${conv.bg} flex items-center justify-center shrink-0`}>
                <conv.icon className={conv.color} size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-cinzel font-bold ${conv.color}`}>{conv.otherName}</h3>
                <p className="text-sm text-muted-foreground">{conv.otherRole}</p>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center text-muted-foreground text-sm py-10">
            Nenhum membro da equipe associado ainda. Aguarde a atribuição.
          </div>
        )}

        {/* Support chat - lower visual weight */}
        <div className="pt-4 mt-auto" style={{ marginTop: 'auto', paddingTop: '3rem' }}>
          <motion.a
            href="https://api.whatsapp.com/send?phone=5561999281490&text=Vim%20do%20APP%20Shape%20Insano%20e%20estou%20com%20um%20problema"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            whileTap={{ scale: 0.98 }}
            className="block rounded-lg border border-border/40 bg-card/50 px-4 py-3 flex items-center gap-3 transition-all hover:bg-card/80 no-underline"
          >
            <div className="w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
              <Headset className="text-muted-foreground" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Suporte</p>
              <p className="text-xs text-muted-foreground/60">Precisa de ajuda? Fale conosco</p>
            </div>
          </motion.a>
        </div>
      </div>
    </div>
  );
};

export default ChatEspecialistas;
