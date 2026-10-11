import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
function worker() {
  const handlers: Record<string, (event: any) => void> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined),
    openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    location: { origin: "https://baga.example" },
    registration: { showNotification },
    clients: { matchAll: async () => [], openWindow },
    addEventListener: (name: string, listener: (event: any) => void) => {
      handlers[name] = listener;
    },
  };
  runInNewContext(
    readFileSync(new URL("../public/push-worker.js", import.meta.url), "utf8"),
    { self, URL },
  );
  return { handlers, showNotification, openWindow };
}
it("push notifications never expose sensitive payload values", async () => {
  const { handlers, showNotification } = worker();
  let pending: Promise<unknown> | undefined;
  handlers.push({
    data: {
      json: () => ({
        category: "weekly",
        notes: "private medical information",
        count: 40,
      }),
    },
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise;
    },
  });
  await pending;
  const [title, options] = showNotification.mock.calls[0];
  expect(title).toBe("A moment for yourself");
  expect(JSON.stringify(options)).not.toContain("private medical");
  expect(JSON.stringify(options)).not.toContain("40");
  expect(options.data.view).toBe("insights");
});
it("notification clicks cannot navigate to an untrusted payload URL", async () => {
  const { handlers, openWindow } = worker();
  let pending: Promise<unknown> | undefined;
  handlers.notificationclick({
    notification: {
      close: () => {},
      data: { view: "https://untrusted.example" },
    },
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise;
    },
  });
  await pending;
  expect(openWindow).toHaveBeenCalledWith("https://baga.example/?view=goals");
});
