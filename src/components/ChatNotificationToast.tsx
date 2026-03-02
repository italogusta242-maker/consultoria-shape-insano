import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";

/**
 * Global component that listens for new chat notifications 
 * and shows an in-app toast when the user is NOT on that conversation.
 */
const ChatNotificationToast = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("chat-toast-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as any;
          if (notif.type !== "chat") return;

          const conversationId = (notif.metadata as any)?.conversation_id;

          // Don't show toast if user is already viewing this conversation
          if (conversationId && location.pathname.includes(`/chat/${conversationId}`)) {
            return;
          }

          toast(notif.title, {
            description: notif.body,
            icon: <MessageSquare size={16} className="text-accent" />,
            action: conversationId
              ? {
                  label: "Abrir",
                  onClick: () => navigate(`/chat/${conversationId}`),
                }
              : undefined,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname, navigate]);

  return null;
};

export default ChatNotificationToast;
