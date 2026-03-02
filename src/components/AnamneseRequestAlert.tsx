import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ClipboardList, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Aggressive UI alert for pending anamnesis requests.
 * - Always shows a sticky banner when an unread anamnese_request notification exists.
 * - Opens a blocking modal if the notification is >2 days old.
 */
const AnamneseRequestAlert = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [modalDismissed, setModalDismissed] = useState(false);

  const { data: pendingNotification } = useQuery({
    queryKey: ["anamnese-request-alert", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("notifications")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("type", "anamnese_request")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  if (!pendingNotification) return null;

  const daysSinceRequest = Math.floor(
    (Date.now() - new Date(pendingNotification.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const showModal = daysSinceRequest >= 2 && !modalDismissed;

  const markReadAndNavigate = async () => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", pendingNotification.id);
    navigate("/reavaliacao");
  };

  return (
    <>
      {/* ── Sticky Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-2 border-amber-500/60 p-4 relative z-20"
        style={{
          background: "linear-gradient(135deg, hsl(40, 90%, 14%), hsl(30, 80%, 12%))",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={22} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-cinzel text-sm font-bold text-amber-200">
              ⚠️ Atenção: Anamnese Solicitada
            </p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Seu especialista solicitou sua Anamnese Mensal.
              {daysSinceRequest > 0 && (
                <span className="font-semibold text-amber-300">
                  {" "}Há {daysSinceRequest} dia{daysSinceRequest > 1 ? "s" : ""}.
                </span>
              )}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={markReadAndNavigate}
          className="w-full mt-3 py-3 rounded-lg font-cinzel text-sm font-bold tracking-wide flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, hsl(40, 90%, 50%), hsl(30, 85%, 45%))",
            color: "hsl(0, 0%, 5%)",
            boxShadow: "0 0 20px hsl(40, 90%, 50%, 0.3)",
          }}
        >
          <ClipboardList size={16} />
          PREENCHER AGORA
        </motion.button>
      </motion.div>

      {/* ── Blocking Modal (after 2 days) ── */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) setModalDismissed(true); }}>
        <DialogContent className="sm:max-w-md border-amber-500/40" style={{ background: "hsl(30, 20%, 8%)" }}>
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-3">
              <AlertTriangle size={32} className="text-amber-400" />
            </div>
            <DialogTitle className="font-cinzel text-lg text-amber-200">
              Anamnese Pendente!
            </DialogTitle>
            <DialogDescription className="text-amber-200/60 mt-2">
              Seu especialista solicitou sua anamnese há {daysSinceRequest} dias. 
              Preencher agora garante que seu plano será atualizado corretamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            <Button
              onClick={markReadAndNavigate}
              className="w-full font-cinzel font-bold tracking-wide py-5"
              style={{
                background: "linear-gradient(135deg, hsl(40, 90%, 50%), hsl(30, 85%, 45%))",
                color: "hsl(0, 0%, 5%)",
              }}
            >
              <ClipboardList size={16} className="mr-2" />
              PREENCHER AGORA
            </Button>
            <Button
              variant="ghost"
              onClick={() => setModalDismissed(true)}
              className="w-full text-muted-foreground text-xs"
            >
              Lembrar mais tarde
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnamneseRequestAlert;
