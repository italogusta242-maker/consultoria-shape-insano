/**
 * @purpose Global presence service for tracking online users across the app.
 * @dependencies supabase client, Realtime channels.
 * @returns Functions to subscribe/unsubscribe and get online user set.
 */
import { supabase } from "@/integrations/supabase/client";

const CHANNEL_NAME = "global-presence";

let channel: ReturnType<typeof supabase.channel> | null = null;
let listeners: Set<(users: Record<string, any[]>) => void> = new Set();
let currentUserId: string | null = null;

/**
 * Subscribe to global presence updates.
 * @param userId - The current user's ID to track.
 * @param onUpdate - Callback receiving the full presence state.
 * @param meta - Optional metadata (name, role) to track alongside presence.
 * @returns Cleanup function.
 */
export function subscribeGlobalPresence(
  userId: string,
  onUpdate: (state: Record<string, any[]>) => void,
  meta?: { name?: string; role?: string }
): () => void {
  listeners.add(onUpdate);
  currentUserId = userId;

  if (!channel) {
    channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: userId } },
    });

    const broadcastState = () => {
      if (!channel) return;
      const state = channel.presenceState();
      listeners.forEach((cb) => cb(state));
    };

    channel
      .on("presence", { event: "sync" }, broadcastState)
      .on("presence", { event: "join" }, broadcastState)
      .on("presence", { event: "leave" }, broadcastState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel!.track({
            online: true,
            user_id: userId,
            joined_at: new Date().toISOString(),
            name: meta?.name || undefined,
            role: meta?.role || undefined,
          });
        }
      });
  } else {
    // Re-track with updated metadata (name/role may have loaded after initial mount)
    channel.track({
      online: true,
      user_id: userId,
      joined_at: new Date().toISOString(),
      name: meta?.name || undefined,
      role: meta?.role || undefined,
    });

    // Also send current state immediately
    const state = channel.presenceState();
    onUpdate(state);
  }

  return () => {
    listeners.delete(onUpdate);
    if (listeners.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
      currentUserId = null;
    }
  };
}

/** Get count of currently online users from a presence state object */
export function getOnlineCount(state: Record<string, any[]>): number {
  return Object.keys(state).length;
}

/** Get array of online user IDs from a presence state object */
export function getOnlineUserIds(state: Record<string, any[]>): string[] {
  return Object.keys(state);
}

/** Get array of online users with metadata from a presence state object */
export function getOnlineUsers(state: Record<string, any[]>): Array<{ id: string; name?: string; role?: string }> {
  return Object.entries(state).map(([id, presences]) => {
    const latest = presences[presences.length - 1] as any;
    return {
      id,
      name: latest?.name,
      role: latest?.role,
    };
  });
}
