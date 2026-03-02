// Push notification handler for Service Worker
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const handlePush = async () => {
    try {
      const data = event.data.json();
      const conversationId = data.data?.conversation_id;

      // Check if app is focused on the same conversation - skip notification
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const focusedOnConversation = clients.some(
        (client) =>
          client.focused &&
          conversationId &&
          client.url.includes("/chat/" + conversationId)
      );

      if (focusedOnConversation) return;

      await self.registration.showNotification(
        data.title || "Shape Insano",
        {
          body: data.body || "",
          icon: "/insano-icon-192.png",
          badge: "/insano-icon-192.png",
          vibrate: [200, 100, 200],
          data: data.data || {},
          tag: conversationId || "chat-" + Date.now(),
          renotify: true,
        }
      );
    } catch (e) {
      console.error("Push handler error:", e);
    }
  };

  event.waitUntil(handlePush());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversation_id;
  const url = conversationId ? "/chat/" + conversationId : "/chat";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open new window
        return self.clients.openWindow(url);
      })
  );
});
