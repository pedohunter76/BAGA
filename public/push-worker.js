/* Imported by Workbox. Lock-screen messages never contain private diary data. */
self.addEventListener("push", (event) => {
  let category = "daily";
  try {
    if (event.data?.json()?.category === "weekly") category = "weekly";
  } catch {
    /* Use a neutral default. */
  }
  event.waitUntil(
    self.registration.showNotification("A moment for yourself", {
      body: "Your private space is ready whenever you are.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `baga-${category}`,
      data: { view: category === "weekly" ? "insights" : "goals" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const view = ["home", "goals", "insights"].includes(
    event.notification.data?.view,
  )
    ? event.notification.data.view
    : "goals";
  const target = new URL(`/?view=${view}`, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(target);
        await existing.focus();
      } else await self.clients.openWindow(target);
    })(),
  );
});
