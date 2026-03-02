import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function usePushNotifications() {
  const { user } = useAuth();
  const attemptedRef = useRef(false);
  const [pushState, setPushState] = useState<"loading" | "granted" | "denied" | "prompt" | "unsupported">("loading");

  useEffect(() => {
    if (!user) {
      setPushState("loading");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }

    // Check current permission state
    const perm = Notification.permission;
    if (perm === "denied") {
      setPushState("denied");
      return;
    }

    if (perm === "default") {
      setPushState("prompt");
      // Don't auto-request - wait for user interaction via banner
      return;
    }

    // Permission is granted - subscribe
    setPushState("granted");

    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const subscribe = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const vapidRes = await fetch(
          `${supabaseUrl}/functions/v1/push-notifications?action=vapid-key`,
          { headers: { apikey } }
        );
        if (!vapidRes.ok) {
          console.error("[push] Failed to get VAPID key:", vapidRes.status);
          return;
        }
        const { publicKey } = await vapidRes.json();
        if (!publicKey) return;

        const registration = await navigator.serviceWorker.ready as ServiceWorkerRegistration & { pushManager: PushManager };

        // Always check/renew subscription
        let subscription = await registration.pushManager.getSubscription();
        
        // If subscription exists but endpoint might be stale, unsubscribe and resubscribe
        if (subscription) {
          try {
            // Test if the subscription is still valid by checking its endpoint
            const testRes = await fetch(subscription.endpoint, { method: "HEAD" }).catch(() => null);
            if (testRes && (testRes.status === 410 || testRes.status === 404)) {
              console.log("[push] Subscription expired, resubscribing...");
              await subscription.unsubscribe();
              subscription = null;
            }
          } catch {
            // Ignore - keep existing subscription
          }
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
          });
          console.log("[push] New subscription created");
        }

        // Send subscription to server
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) return;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/push-notifications?action=subscribe`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey,
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
          }
        );

        if (res.ok) {
          console.log("[push] Subscription saved successfully");
        } else {
          console.error("[push] Failed to save subscription:", res.status);
        }
      } catch (e) {
        console.error("[push] Subscription failed:", e);
      }
    };

    const timer = setTimeout(subscribe, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    
    const result = await Notification.requestPermission();
    if (result === "granted") {
      setPushState("granted");
      attemptedRef.current = false; // Allow re-subscribe attempt
    } else if (result === "denied") {
      setPushState("denied");
    }
  };

  return { pushState, requestPermission };
}

export async function sendPushToConversation(
  conversationId: string,
  title: string,
  body: string
) {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    // Fire and forget
    fetch(
      `${supabaseUrl}/functions/v1/push-notifications?action=send-to-conversation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversation_id: conversationId, title, body }),
      }
    ).catch(() => {});
  } catch {}
}
